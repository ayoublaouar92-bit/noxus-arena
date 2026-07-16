import { ipcMain } from "electron";

type ReportRange = "today" | "week" | "month" | "custom";

type GetReportData = {
  range: ReportRange;
  start?: string; // ISO
  end?: string; // ISO
};

function registerHandler(channel: string, handler: (...args: any[]) => any) {
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
    return { start: isoStartOfDay(now), end: isoEndOfDay(now) };
  }

  if (payload.range === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { start: isoStartOfDay(start), end: isoEndOfDay(now) };
  }

  // month (last 30 days)
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  return { start: isoStartOfDay(start), end: isoEndOfDay(now) };
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
          AND datetime(endTime) BETWEEN datetime(?) AND datetime(?)`
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
        WHERE datetime(joinedAt) BETWEEN datetime(?) AND datetime(?)`
      )
      .get(start, end);

    // Store sales in range
    const storeSales = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(total), 0) AS revenue,
          COALESCE(SUM(cashPaid), 0) AS cashPaid,
          COALESCE(SUM(walletPaid), 0) AS walletPaid,
          COALESCE(SUM(debtAdded), 0) AS debtAdded,
          COUNT(*) AS count
        FROM sales
        WHERE status = 'Completed'
          AND datetime(createdAt) BETWEEN datetime(?) AND datetime(?)`
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
          AND datetime(createdAt) BETWEEN datetime(?) AND datetime(?)`
      )
      .get(start, end);

    // Guest debt paid in range (cash inflow)
    // NOTE: v2 guest debts use paidAmount; for legacy paid debts, amount is original debt.
    // We'll count "collected" as:
    // - if paidAmount exists: paidAmount when Paid (for older rows could be 0); fallback to amount.
    const guestPaid = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(CASE
            WHEN paidAmount IS NOT NULL AND paidAmount > 0 THEN paidAmount
            ELSE amount
          END), 0) AS total,
          COUNT(*) AS count
        FROM guest_debts
        WHERE status = 'Paid'
          AND settledAt IS NOT NULL
          AND datetime(settledAt) BETWEEN datetime(?) AND datetime(?)`
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
        WHERE datetime(spentAt) BETWEEN datetime(?) AND datetime(?)`
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
        LIMIT 10`
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
        LIMIT 10`
      )
      .all();

    // ===== NEW: Store analytics =====

    // Top products (by quantity / revenue)
    const topProducts = db
      .prepare(
        `
        SELECT
          sale_items.productId AS productId,
          products.name AS name,
          products.unit AS unit,
          COALESCE(SUM(sale_items.quantity), 0) AS quantity,
          COALESCE(SUM(sale_items.lineTotal), 0) AS revenue
        FROM sale_items
        INNER JOIN sales
          ON sales.id = sale_items.saleId
        INNER JOIN products
          ON products.id = sale_items.productId
        WHERE sales.status = 'Completed'
          AND datetime(sales.createdAt) BETWEEN datetime(?) AND datetime(?)
        GROUP BY sale_items.productId
        ORDER BY quantity DESC, revenue DESC
        LIMIT 10`
      )
      .all(start, end);

    // Revenue by category
    const revenueByCategory = db
      .prepare(
        `
        SELECT
          COALESCE(product_categories.name, 'Other') AS category,
          COALESCE(SUM(sale_items.quantity), 0) AS quantity,
          COALESCE(SUM(sale_items.lineTotal), 0) AS revenue
        FROM sale_items
        INNER JOIN sales
          ON sales.id = sale_items.saleId
        INNER JOIN products
          ON products.id = sale_items.productId
        LEFT JOIN product_categories
          ON product_categories.id = products.categoryId
        WHERE sales.status = 'Completed'
          AND datetime(sales.createdAt) BETWEEN datetime(?) AND datetime(?)
        GROUP BY COALESCE(product_categories.name, 'Other')
        ORDER BY revenue DESC
        LIMIT 50`
      )
      .all(start, end);

    // Profit in range:
    // profit = sum( (unitPrice - costPrice) * quantity )
    const storeProfit = db
      .prepare(
        `
        SELECT
          COALESCE(SUM((sale_items.unitPrice - products.costPrice) * sale_items.quantity), 0) AS profit,
          COALESCE(SUM(products.costPrice * sale_items.quantity), 0) AS cogs
        FROM sale_items
        INNER JOIN sales
          ON sales.id = sale_items.saleId
        INNER JOIN products
          ON products.id = sale_items.productId
        WHERE sales.status = 'Completed'
          AND datetime(sales.createdAt) BETWEEN datetime(?) AND datetime(?)`
      )
      .get(start, end);

    // Inventory valuation (current snapshot, not time-ranged)
    const inventoryValuation = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(stock * costPrice), 0) AS valuationCost,
          COALESCE(SUM(stock * salePrice), 0) AS valuationSale
        FROM products
        WHERE active = 1`
      )
      .get();

    const cashInflow =
      n(topUps.total) +
      n(sessions.cashPaid) +
      n(storeSales.cashPaid) +
      n(guestPaid.total);

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

      store: {
        revenue: n(storeSales.revenue),
        cashPaid: n(storeSales.cashPaid),
        walletPaid: n(storeSales.walletPaid),
        debtAdded: n(storeSales.debtAdded),
        count: n(storeSales.count),
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

      // NEW store analytics
      storeAnalytics: {
        topProducts,
        revenueByCategory,
        profit: n(storeProfit.profit),
        cogs: n(storeProfit.cogs),
        inventoryValuation: {
          valuationCost: n(inventoryValuation.valuationCost),
          valuationSale: n(inventoryValuation.valuationSale),
        },
      },
    };
  });
}