import { ipcMain } from "electron";
import {
  audit,
  getCurrentStaffUserId,
  requireAdmin,
  requireStaff,
} from "./staff";

type AddExpenseData = {
  title: string;
  category: string;
  amount: number;
  note?: string;
  spentAt?: string;
};

type OpenShiftData = {
  openingCash: number;
};

type CloseShiftData = {
  actualCash: number;
};

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function getNumber(value: unknown) {
  return Number(value || 0);
}

export function registerBillingHandlers(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      amount REAL NOT NULL DEFAULT 0,
      note TEXT,
      spentAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_expenses_spent_at ON expenses(spentAt);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffUserId INTEGER NOT NULL,
      openingCash REAL NOT NULL DEFAULT 0,
      openedAt TEXT NOT NULL,
      closedAt TEXT,
      actualCash REAL,
      expectedCash REAL,
      difference REAL,
      status TEXT NOT NULL DEFAULT 'Open',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (staffUserId)
        REFERENCES staff_users(id)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cash_shifts_status ON cash_shifts(status);
    CREATE INDEX IF NOT EXISTS idx_cash_shifts_opened ON cash_shifts(openedAt);
    CREATE INDEX IF NOT EXISTS idx_cash_shifts_staff ON cash_shifts(staffUserId);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_shifts_single_open
      ON cash_shifts(status)
      WHERE status = 'Open';
  `);

  const loadOpenShiftRow = () =>
    db
      .prepare(
        `
          SELECT
            cash_shifts.*,
            staff_users.name AS staffName,
            staff_users.role AS staffRole
          FROM cash_shifts
          INNER JOIN staff_users
            ON staff_users.id = cash_shifts.staffUserId
          WHERE cash_shifts.status = 'Open'
          ORDER BY cash_shifts.id DESC
          LIMIT 1
        `,
      )
      .get() as any | undefined;

  const calculateShiftTotals = (openedAt: string, closedAt?: string | null) => {
    const endFilter = closedAt ? " AND datetime(%COLUMN%) <= datetime(?)" : "";
    const params = closedAt ? [openedAt, closedAt] : [openedAt];

    const sumForRange = (
      table: string,
      valueColumn: string,
      dateColumn: string,
      extraWhere: string,
    ) => {
      const upperBound = endFilter.replace("%COLUMN%", dateColumn);
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(${valueColumn}), 0) AS total
           FROM ${table}
           WHERE ${extraWhere}
             AND datetime(${dateColumn}) >= datetime(?)${upperBound}`,
        )
        .get(...params) as { total: number };
      return getNumber(row?.total);
    };

    const sessionCash = sumForRange(
      "sessions",
      "cashPaid",
      "endTime",
      "status = 'Finished' AND cashPaid > 0 AND endTime IS NOT NULL",
    );
    const storeCash = sumForRange(
      "sales",
      "cashPaid",
      "createdAt",
      "status = 'Completed' AND cashPaid > 0",
    );
    const walletTopUps = sumForRange(
      "wallet_transactions",
      "amount",
      "createdAt",
      "type = 'TOP_UP' AND amount > 0",
    );
    const expenses = sumForRange("expenses", "amount", "spentAt", "amount > 0");

    const auditUpperBound = closedAt
      ? " AND datetime(createdAt) <= datetime(?)"
      : "";
    const debtAuditRows = db
      .prepare(
        `SELECT details
         FROM audit_log
         WHERE action = 'GUEST_DEBT_COLLECTED'
           AND datetime(createdAt) >= datetime(?)${auditUpperBound}`,
      )
      .all(...params) as Array<{ details?: string | null }>;

    const guestDebtCash = debtAuditRows.reduce((total, row) => {
      try {
        const details = JSON.parse(row.details || "{}");
        return total + getNumber(details.collected);
      } catch {
        return total;
      }
    }, 0);

    const cashCollected =
      sessionCash + storeCash + walletTopUps + guestDebtCash;

    return {
      sessionCash,
      storeCash,
      walletTopUps,
      guestDebtCash,
      cashCollected,
      expenses,
    };
  };

  const enrichShift = (shift: any) => {
    if (!shift) return null;
    const totals = calculateShiftTotals(shift.openedAt, shift.closedAt);
    const openingCash = getNumber(shift.openingCash);
    const expectedCash =
      shift.status === "Closed" && shift.expectedCash !== null
        ? getNumber(shift.expectedCash)
        : openingCash + totals.cashCollected - totals.expenses;

    return {
      ...shift,
      openingCash,
      actualCash:
        shift.actualCash === null ? null : getNumber(shift.actualCash),
      expectedCash,
      difference:
        shift.difference === null || shift.difference === undefined
          ? null
          : getNumber(shift.difference),
      ...totals,
    };
  };

  registerHandler("billing:get-current-shift", () => {
    return enrichShift(loadOpenShiftRow());
  });

  registerHandler("billing:open-shift", (_event, data: OpenShiftData) => {
    const staffUserId = requireStaff(db, "BILLING_OPEN_SHIFT");
    const openingCash = Number(data?.openingCash);

    if (!Number.isFinite(openingCash) || openingCash < 0) {
      throw new Error("Invalid opening cash");
    }
    if (loadOpenShiftRow()) {
      throw new Error("SHIFT_ALREADY_OPEN");
    }

    const openedAt = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO cash_shifts (staffUserId, openingCash, openedAt, status)
         VALUES (?, ?, ?, 'Open')`,
      )
      .run(staffUserId, openingCash, openedAt);

    audit(db, {
      action: "SHIFT_OPENED",
      entity: "cash_shifts",
      entityId: Number(result.lastInsertRowid),
      details: JSON.stringify({ openingCash, openedAt }),
    });

    return enrichShift(loadOpenShiftRow());
  });

  registerHandler("billing:close-shift", (_event, data: CloseShiftData) => {
    const staffUserId = requireStaff(db, "BILLING_CLOSE_SHIFT");
    const actualCash = Number(data?.actualCash);
    const shift = loadOpenShiftRow();

    if (!shift) throw new Error("NO_OPEN_SHIFT");
    if (Number(shift.staffUserId) !== Number(staffUserId)) {
      throw new Error("SHIFT_OWNED_BY_ANOTHER_STAFF");
    }
    if (!Number.isFinite(actualCash) || actualCash < 0) {
      throw new Error("Invalid actual cash");
    }

    const closedAt = new Date().toISOString();
    const totals = calculateShiftTotals(shift.openedAt, closedAt);
    const expectedCash =
      getNumber(shift.openingCash) + totals.cashCollected - totals.expenses;
    const difference = actualCash - expectedCash;

    db.prepare(
      `UPDATE cash_shifts
       SET closedAt = ?, actualCash = ?, expectedCash = ?, difference = ?, status = 'Closed'
       WHERE id = ? AND status = 'Open'`,
    ).run(closedAt, actualCash, expectedCash, difference, shift.id);

    audit(db, {
      action: "SHIFT_CLOSED",
      entity: "cash_shifts",
      entityId: shift.id,
      details: JSON.stringify({
        actualCash,
        expectedCash,
        difference,
        closedAt,
      }),
    });

    const closedShift = db
      .prepare(
        `SELECT cash_shifts.*, staff_users.name AS staffName, staff_users.role AS staffRole
         FROM cash_shifts
         INNER JOIN staff_users ON staff_users.id = cash_shifts.staffUserId
         WHERE cash_shifts.id = ?`,
      )
      .get(shift.id);

    return enrichShift(closedShift);
  });

  registerHandler("billing:get-shift-history", () => {
    return db
      .prepare(
        `SELECT
           cash_shifts.*,
           staff_users.name AS staffName,
           staff_users.role AS staffRole
         FROM cash_shifts
         INNER JOIN staff_users
           ON staff_users.id = cash_shifts.staffUserId
         WHERE cash_shifts.status = 'Closed'
         ORDER BY datetime(cash_shifts.closedAt) DESC, cash_shifts.id DESC
         LIMIT 100`,
      )
      .all()
      .map((shift: any) => enrichShift(shift));
  });

  registerHandler("billing:get-summary", () => {
    const sessions = db
      .prepare(
        `
          SELECT
            COALESCE(SUM(CAST(totalPrice AS REAL)), 0) AS earnedRevenue,
            COALESCE(SUM(cashPaid), 0) AS cashPaid,
            COALESCE(SUM(walletPaid), 0) AS walletPaid,
            COALESCE(SUM(debtAdded), 0) AS debtAdded
          FROM sessions
          WHERE status = 'Finished'
        `,
      )
      .get();

    const tournaments = db
      .prepare(
        `
          SELECT
            COALESCE(SUM(entryFee), 0) AS earnedRevenue,
            COALESCE(SUM(walletPaid), 0) AS walletPaid,
            COALESCE(SUM(debtAdded), 0) AS debtAdded
          FROM tournament_participants
        `,
      )
      .get();

    const storeSales = db
      .prepare(
        `
          SELECT
            COALESCE(SUM(total), 0) AS earnedRevenue,
            COALESCE(SUM(cashPaid), 0) AS cashPaid,
            COALESCE(SUM(walletPaid), 0) AS walletPaid,
            COALESCE(SUM(debtAdded), 0) AS debtAdded
          FROM sales
          WHERE status = 'Completed'
        `,
      )
      .get();

    const topUps = db
      .prepare(
        `
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM wallet_transactions
          WHERE type = 'TOP_UP'
        `,
      )
      .get();

    const playerBalances = db
      .prepare(
        `
          SELECT
            COALESCE(SUM(walletBalance), 0) AS walletBalance,
            COALESCE(SUM(debtBalance), 0) AS debtBalance
          FROM players
        `,
      )
      .get();

    const guestDebts = db
      .prepare(
        `
          SELECT
            COALESCE(SUM(CASE WHEN status = 'Open' THEN (amount - COALESCE(paidAmount,0)) ELSE 0 END), 0) AS openDebt,
            COALESCE(SUM(CASE WHEN status = 'Paid' THEN COALESCE(paidAmount, amount) ELSE 0 END), 0) AS collectedDebt
          FROM guest_debts
        `,
      )
      .get();

    const expenses = db
      .prepare(
        `
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM expenses
        `,
      )
      .get();

    const sessionRevenue = getNumber(sessions.earnedRevenue);
    const tournamentRevenue = getNumber(tournaments.earnedRevenue);
    const storeRevenue = getNumber(storeSales.earnedRevenue);

    const totalTopUps = getNumber(topUps.total);
    const cashSessions = getNumber(sessions.cashPaid);
    const cashStore = getNumber(storeSales.cashPaid);
    const guestDebtCollected = getNumber(guestDebts.collectedDebt);
    const totalExpenses = getNumber(expenses.total);

    const cashInflow =
      totalTopUps + cashSessions + cashStore + guestDebtCollected;
    const netCash = cashInflow - totalExpenses;

    const playerDebt = getNumber(playerBalances.debtBalance);
    const guestOpenDebt = getNumber(guestDebts.openDebt);

    return {
      sessionRevenue,
      tournamentRevenue,
      storeRevenue,
      earnedRevenue: sessionRevenue + tournamentRevenue + storeRevenue,

      walletTopUps: totalTopUps,
      cashSessions,
      cashStore,

      sessionWalletPaid: getNumber(sessions.walletPaid),
      sessionDebtAdded: getNumber(sessions.debtAdded),

      tournamentWalletPaid: getNumber(tournaments.walletPaid),
      tournamentDebtAdded: getNumber(tournaments.debtAdded),

      storeWalletPaid: getNumber(storeSales.walletPaid),
      storeDebtAdded: getNumber(storeSales.debtAdded),

      walletLiability: getNumber(playerBalances.walletBalance),

      playerDebt,
      guestOpenDebt,
      totalOutstandingDebt: playerDebt + guestOpenDebt,

      guestDebtCollected,
      cashInflow,
      expenses: totalExpenses,
      netCash,
    };
  });

  registerHandler("billing:get-daily-revenue", () => {
    const sessionDays = db
      .prepare(
        `
          SELECT
            date(endTime) AS day,
            COALESCE(SUM(CAST(totalPrice AS REAL)), 0) AS sessionRevenue,
            COALESCE(SUM(cashPaid), 0) AS cashPaid,
            COALESCE(SUM(walletPaid), 0) AS walletPaid,
            COALESCE(SUM(debtAdded), 0) AS debtAdded
          FROM sessions
          WHERE status = 'Finished' AND endTime IS NOT NULL
          GROUP BY date(endTime)
          ORDER BY day DESC
          LIMIT 30
        `,
      )
      .all();

    const tournamentDays = db
      .prepare(
        `
          SELECT
            date(joinedAt) AS day,
            COALESCE(SUM(entryFee), 0) AS tournamentRevenue
          FROM tournament_participants
          GROUP BY date(joinedAt)
          ORDER BY day DESC
          LIMIT 30
        `,
      )
      .all();

    const storeDays = db
      .prepare(
        `
          SELECT
            date(createdAt) AS day,
            COALESCE(SUM(total), 0) AS storeRevenue
          FROM sales
          WHERE status = 'Completed'
          GROUP BY date(createdAt)
          ORDER BY day DESC
          LIMIT 30
        `,
      )
      .all();

    const dayMap = new Map<
      string,
      {
        day: string;
        sessionRevenue: number;
        tournamentRevenue: number;
        storeRevenue: number;
        cashPaid: number;
        walletPaid: number;
        debtAdded: number;
      }
    >();

    for (const row of sessionDays) {
      dayMap.set(row.day, {
        day: row.day,
        sessionRevenue: getNumber(row.sessionRevenue),
        tournamentRevenue: 0,
        storeRevenue: 0,
        cashPaid: getNumber(row.cashPaid),
        walletPaid: getNumber(row.walletPaid),
        debtAdded: getNumber(row.debtAdded),
      });
    }

    for (const row of tournamentDays) {
      const existing = dayMap.get(row.day);
      if (existing)
        existing.tournamentRevenue = getNumber(row.tournamentRevenue);
      else {
        dayMap.set(row.day, {
          day: row.day,
          sessionRevenue: 0,
          tournamentRevenue: getNumber(row.tournamentRevenue),
          storeRevenue: 0,
          cashPaid: 0,
          walletPaid: 0,
          debtAdded: 0,
        });
      }
    }

    for (const row of storeDays) {
      const existing = dayMap.get(row.day);
      if (existing) existing.storeRevenue = getNumber(row.storeRevenue);
      else {
        dayMap.set(row.day, {
          day: row.day,
          sessionRevenue: 0,
          tournamentRevenue: 0,
          storeRevenue: getNumber(row.storeRevenue),
          cashPaid: 0,
          walletPaid: 0,
          debtAdded: 0,
        });
      }
    }

    return Array.from(dayMap.values())
      .map((day) => ({
        ...day,
        totalRevenue:
          day.sessionRevenue + day.tournamentRevenue + day.storeRevenue,
      }))
      .sort((a, b) => b.day.localeCompare(a.day))
      .slice(0, 30);
  });

  registerHandler("billing:get-ledger", () => {
    const walletTransactions = db
      .prepare(
        `
          SELECT
            wallet_transactions.id,
            wallet_transactions.type,
            wallet_transactions.amount,
            wallet_transactions.note,
            wallet_transactions.createdAt,
            players.name AS playerName,
            players.username AS playerUsername
          FROM wallet_transactions
          INNER JOIN players
            ON players.id = wallet_transactions.playerId
          ORDER BY wallet_transactions.id DESC
          LIMIT 200
        `,
      )
      .all();

    const cashSessions = db
      .prepare(
        `
          SELECT
            sessions.id,
            sessions.customerName,
            sessions.cashPaid,
            sessions.endTime,
            devices.name AS deviceName
          FROM sessions
          INNER JOIN devices
            ON devices.id = sessions.deviceId
          WHERE sessions.status = 'Finished' AND sessions.cashPaid > 0
          ORDER BY sessions.id DESC
          LIMIT 200
        `,
      )
      .all();

    const cashStore = db
      .prepare(
        `
          SELECT
            sales.id,
            sales.customerName,
            sales.cashPaid,
            sales.createdAt
          FROM sales
          WHERE sales.status = 'Completed' AND sales.cashPaid > 0
          ORDER BY sales.id DESC
          LIMIT 200
        `,
      )
      .all();

    const guestPayments = db
      .prepare(
        `
          SELECT id, guestName, phone,
                 COALESCE(paidAmount, amount) AS amount,
                 settledAt
          FROM guest_debts
          WHERE status = 'Paid'
          ORDER BY id DESC
          LIMIT 200
        `,
      )
      .all();

    const expenses = db
      .prepare(
        `
          SELECT *
          FROM expenses
          ORDER BY datetime(spentAt) DESC, id DESC
          LIMIT 200
        `,
      )
      .all();

    const ledger: any[] = [];

    for (const t of walletTransactions) {
      ledger.push({
        id: `wallet-${t.id}`,
        source: "Wallet",
        type: t.type,
        title: t.playerName,
        subtitle: t.note || t.playerUsername,
        amount: getNumber(t.amount),
        direction: t.type === "TOP_UP" ? "In" : "Revenue",
        createdAt: t.createdAt,
      });
    }

    for (const s of cashSessions) {
      ledger.push({
        id: `session-${s.id}`,
        source: "Session",
        type: "CASH_SESSION",
        title: s.customerName || "Guest",
        subtitle: s.deviceName,
        amount: getNumber(s.cashPaid),
        direction: "In",
        createdAt: s.endTime,
      });
    }

    for (const s of cashStore) {
      ledger.push({
        id: `store-${s.id}`,
        source: "Store",
        type: "CASH_SALE",
        title: s.customerName || "Walk-in",
        subtitle: `Sale #${s.id}`,
        amount: getNumber(s.cashPaid),
        direction: "In",
        createdAt: s.createdAt,
      });
    }

    for (const p of guestPayments) {
      ledger.push({
        id: `guest-${p.id}`,
        source: "Guest Debt",
        type: "GUEST_DEBT_PAYMENT",
        title: p.guestName,
        subtitle: p.phone || "Guest debt paid",
        amount: getNumber(p.amount),
        direction: "In",
        createdAt: p.settledAt,
      });
    }

    for (const e of expenses) {
      ledger.push({
        id: `expense-${e.id}`,
        source: "Expense",
        type: e.category,
        title: e.title,
        subtitle: e.note || e.category,
        amount: getNumber(e.amount),
        direction: "Out",
        createdAt: e.spentAt,
      });
    }

    return ledger
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 200);
  });

  registerHandler("billing:get-expenses", () => {
    return db
      .prepare(
        `
          SELECT *
          FROM expenses
          ORDER BY datetime(spentAt) DESC, id DESC
        `,
      )
      .all();
  });

  // Admin only
  registerHandler("billing:add-expense", (_event, data: AddExpenseData) => {
    requireAdmin(db, "BILLING_ADD_EXPENSE");

    const title = data.title?.trim();
    const category = data.category?.trim() || "Other";
    const amount = Number(data.amount);
    const spentAt = data.spentAt || new Date().toISOString();

    if (!title) throw new Error("Expense title is required");
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error("Invalid expense amount");

    const result = db
      .prepare(
        `
          INSERT INTO expenses
            (title, category, amount, note, spentAt)
          VALUES
            (?, ?, ?, ?, ?)
        `,
      )
      .run(title, category, amount, data.note?.trim() || "", spentAt);

    audit(db, {
      action: "EXPENSE_ADDED",
      entity: "expenses",
      entityId: Number(result.lastInsertRowid),
      details: `${title} ${amount} ${category}`,
    });

    return { id: Number(result.lastInsertRowid), changes: result.changes };
  });

  // Admin only
  registerHandler("billing:delete-expense", (_event, expenseId: number) => {
    requireAdmin(db, "BILLING_DELETE_EXPENSE");

    const row = db
      .prepare(`SELECT * FROM expenses WHERE id = ?`)
      .get(expenseId) as any;
    const result = db
      .prepare(`DELETE FROM expenses WHERE id = ?`)
      .run(expenseId);

    audit(db, {
      action: "EXPENSE_DELETED",
      entity: "expenses",
      entityId: expenseId,
      details: row ? `${row.title} ${row.amount}` : null,
    });

    return { changes: result.changes };
  });
}
