import { ipcMain } from "electron";
import { requireAdmin, audit } from "./staff";

type AddExpenseData = {
  title: string;
  category: string;
  amount: number;
  note?: string;
  spentAt?: string;
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
        `
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
        `
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
        `
      )
      .get();

    const topUps = db
      .prepare(
        `
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM wallet_transactions
          WHERE type = 'TOP_UP'
        `
      )
      .get();

    const playerBalances = db
      .prepare(
        `
          SELECT
            COALESCE(SUM(walletBalance), 0) AS walletBalance,
            COALESCE(SUM(debtBalance), 0) AS debtBalance
          FROM players
        `
      )
      .get();

    const guestDebts = db
      .prepare(
        `
          SELECT
            COALESCE(SUM(CASE WHEN status = 'Open' THEN (amount - COALESCE(paidAmount,0)) ELSE 0 END), 0) AS openDebt,
            COALESCE(SUM(CASE WHEN status = 'Paid' THEN COALESCE(paidAmount, amount) ELSE 0 END), 0) AS collectedDebt
          FROM guest_debts
        `
      )
      .get();

    const expenses = db
      .prepare(
        `
          SELECT COALESCE(SUM(amount), 0) AS total
          FROM expenses
        `
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

    const cashInflow = totalTopUps + cashSessions + cashStore + guestDebtCollected;
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
        `
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
        `
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
        `
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
      if (existing) existing.tournamentRevenue = getNumber(row.tournamentRevenue);
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
        totalRevenue: day.sessionRevenue + day.tournamentRevenue + day.storeRevenue,
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
        `
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
        `
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
        `
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
        `
      )
      .all();

    const expenses = db
      .prepare(
        `
          SELECT *
          FROM expenses
          ORDER BY datetime(spentAt) DESC, id DESC
          LIMIT 200
        `
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 200);
  });

  registerHandler("billing:get-expenses", () => {
    return db
      .prepare(
        `
          SELECT *
          FROM expenses
          ORDER BY datetime(spentAt) DESC, id DESC
        `
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
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid expense amount");

    const result = db
      .prepare(
        `
          INSERT INTO expenses
            (title, category, amount, note, spentAt)
          VALUES
            (?, ?, ?, ?, ?)
        `
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

    const row = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(expenseId) as any;
    const result = db.prepare(`DELETE FROM expenses WHERE id = ?`).run(expenseId);

    audit(db, {
      action: "EXPENSE_DELETED",
      entity: "expenses",
      entityId: expenseId,
      details: row ? `${row.title} ${row.amount}` : null,
    });

    return { changes: result.changes };
  });
}