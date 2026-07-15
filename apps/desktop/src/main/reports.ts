import { ipcMain } from "electron";

type ReportRange = "today" | "week" | "month" | "custom";

type GetReportData = {
  range: ReportRange;
  start?: string; // ISO
  end?: string; // ISO
};

function registerHandler(
  channel: string,
  handler: (...args: any[]) => any
) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function isoStartOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function isoEndOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy.toISOString();
}

function toIsoRange(payload: GetReportData) {
  const now = new Date();

  if (payload.range === "custom") {
    if (!payload.start || !payload.end) {
      throw new Error("Custom range requires start and end");
    }
    return {
      start: new Date(payload.start).toISOString(),
      end: new Date(payload.end).toISOString(),
    };
  }

  if (payload.range === "today") {
    return {
      start: isoStartOfDay(now),
      end: isoEndOfDay(now),
    };
  }

  if (payload.range === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return {
      start: isoStartOfDay(start),
      end: isoEndOfDay(now),
    };
  }

  // month (last 30 days)
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  return {
    start: isoStartOfDay(start),
    end: isoEndOfDay(now),
  };
}

function n(value: unknown) {
  return Number(value || 0);
}

export function registerReportsHandlers(db: any) {
  registerHandler("reports:get", (_event, payload: GetReportData) => {
    const { start, end } = toIsoRange(payload);

    // Sessions revenue in range
    const sessions = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(CAST(totalPrice AS REAL)), 0) AS revenue,
          COALESCE(SUM(cashPaid), 0) AS cashPaid,
          COALESCE(SUM(walletPaid), 0) AS walletPaid,
          COALESCE(SUM(debtAdded), 0) AS debtAdded,
          COUNT(*) AS count
        FROM sessions
        WHERE status = 'Finished'
          AND endTime IS NOT NULL
          AND datetime(endTime) BETWEEN datetime(?) AND datetime(?)
      `
      )
      .get(start, end);

    // Tournament fees in range
    const tournaments = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(entryFee), 0) AS revenue,
          COALESCE(SUM(walletPaid), 0) AS walletPaid,
          COALESCE(SUM(debtAdded), 0) AS debtAdded,
          COUNT(*) AS count
        FROM tournament_participants
        WHERE datetime(joinedAt) BETWEEN datetime(?) AND datetime(?)
      `
      )
      .get(start, end);

    // Top ups in range (cash inflow)
    const topUps = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(amount), 0) AS total,
          COUNT(*) AS count
        FROM wallet_transactions
        WHERE type = 'TOP_UP'
          AND datetime(createdAt) BETWEEN datetime(?) AND datetime(?)
      `
      )
      .get(start, end);

    // Guest debt paid in range (cash inflow)
    const guestPaid = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(amount), 0) AS total,
          COUNT(*) AS count
        FROM guest_debts
        WHERE status = 'Paid'
          AND settledAt IS NOT NULL
          AND datetime(settledAt) BETWEEN datetime(?) AND datetime(?)
      `
      )
      .get(start, end);

    // Expenses in range (cash outflow)
    const expenses = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(amount), 0) AS total,
          COUNT(*) AS count
        FROM expenses
        WHERE datetime(spentAt) BETWEEN datetime(?) AND datetime(?)
      `
      )
      .get(start, end);

    // Top players by spend (session + tournament fees)
    const topPlayers = db
      .prepare(
        `
        SELECT
          players.id,
          players.name,
          players.username,
          COALESCE(SUM(wallet_transactions.amount), 0) AS totalCharged
        FROM wallet_transactions
        INNER JOIN players
          ON players.id = wallet_transactions.playerId
        WHERE wallet_transactions.type IN ('SESSION_CHARGE', 'TOURNAMENT_FEE')
          AND datetime(wallet_transactions.createdAt) BETWEEN datetime(?) AND datetime(?)
        GROUP BY players.id
        ORDER BY totalCharged DESC
        LIMIT 10
      `
      )
      .all(start, end);

    // Biggest debts now
    const topDebts = db
      .prepare(
        `
        SELECT
          id,
          name,
          username,
          walletBalance,
          debtBalance
        FROM players
        WHERE debtBalance > 0
        ORDER BY debtBalance DESC
        LIMIT 10
      `
      )
      .all();

    const cashInflow =
      n(topUps.total) + n(sessions.cashPaid) + n(guestPaid.total);

    const netCash = cashInflow - n(expenses.total);

    return {
      range: payload.range,
      start,
      end,

      sessions: {
        revenue: n(sessions.revenue),
        cashPaid: n(sessions.cashPaid),
        walletPaid: n(sessions.walletPaid),
        debtAdded: n(sessions.debtAdded),
        count: n(sessions.count),
      },

      tournaments: {
        revenue: n(tournaments.revenue),
        walletPaid: n(tournaments.walletPaid),
        debtAdded: n(tournaments.debtAdded),
        count: n(tournaments.count),
      },

      topUps: {
        total: n(topUps.total),
        count: n(topUps.count),
      },

      guestDebtPaid: {
        total: n(guestPaid.total),
        count: n(guestPaid.count),
      },

      expenses: {
        total: n(expenses.total),
        count: n(expenses.count),
      },

      cashInflow,
      netCash,

      topPlayers,
      topDebts,
    };
  });
}