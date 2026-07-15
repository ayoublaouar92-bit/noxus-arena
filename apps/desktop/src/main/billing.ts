import { ipcMain } from "electron";

type AddExpenseData = {
  title: string;
  category: string;
  amount: number;
  note?: string;
  spentAt?: string;
};

function registerHandler(
  channel: string,
  handler: (...args: any[]) => any
) {
  ipcMain.removeHandler(channel);

  ipcMain.handle(
    channel,
    handler
  );
}

function getNumber(
  value: unknown
) {
  return Number(value || 0);
}

export function registerBillingHandlers(
  db: any
) {
  /*
  |--------------------------------------------------------------------------
  | Expenses table
  |--------------------------------------------------------------------------
  */

  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL
        DEFAULT 'Other',
      amount REAL NOT NULL DEFAULT 0,
      note TEXT,
      spentAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS
      idx_expenses_spent_at
    ON expenses(spentAt);

    CREATE INDEX IF NOT EXISTS
      idx_expenses_category
    ON expenses(category);
  `);

  /*
  |--------------------------------------------------------------------------
  | Billing summary
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "billing:get-summary",
    () => {
      const sessions = db
        .prepare(
          `
            SELECT
              COALESCE(
                SUM(
                  CAST(
                    totalPrice AS REAL
                  )
                ),
                0
              ) AS earnedRevenue,

              COALESCE(
                SUM(cashPaid),
                0
              ) AS cashPaid,

              COALESCE(
                SUM(walletPaid),
                0
              ) AS walletPaid,

              COALESCE(
                SUM(debtAdded),
                0
              ) AS debtAdded

            FROM sessions
            WHERE status = 'Finished'
          `
        )
        .get();

      const tournaments = db
        .prepare(
          `
            SELECT
              COALESCE(
                SUM(entryFee),
                0
              ) AS earnedRevenue,

              COALESCE(
                SUM(walletPaid),
                0
              ) AS walletPaid,

              COALESCE(
                SUM(debtAdded),
                0
              ) AS debtAdded

            FROM tournament_participants
          `
        )
        .get();

      const topUps = db
        .prepare(
          `
            SELECT
              COALESCE(
                SUM(amount),
                0
              ) AS total
            FROM wallet_transactions
            WHERE type = 'TOP_UP'
          `
        )
        .get();

      const playerBalances = db
        .prepare(
          `
            SELECT
              COALESCE(
                SUM(walletBalance),
                0
              ) AS walletBalance,

              COALESCE(
                SUM(debtBalance),
                0
              ) AS debtBalance

            FROM players
          `
        )
        .get();

      const guestDebts = db
        .prepare(
          `
            SELECT
              COALESCE(
                SUM(
                  CASE
                    WHEN status = 'Open'
                      THEN amount
                    ELSE 0
                  END
                ),
                0
              ) AS openDebt,

              COALESCE(
                SUM(
                  CASE
                    WHEN status = 'Paid'
                      THEN amount
                    ELSE 0
                  END
                ),
                0
              ) AS collectedDebt

            FROM guest_debts
          `
        )
        .get();

      const expenses = db
        .prepare(
          `
            SELECT
              COALESCE(
                SUM(amount),
                0
              ) AS total
            FROM expenses
          `
        )
        .get();

      const sessionRevenue =
        getNumber(
          sessions.earnedRevenue
        );

      const tournamentRevenue =
        getNumber(
          tournaments.earnedRevenue
        );

      const totalTopUps =
        getNumber(topUps.total);

      const cashSessions =
        getNumber(
          sessions.cashPaid
        );

      const guestDebtCollected =
        getNumber(
          guestDebts.collectedDebt
        );

      const totalExpenses =
        getNumber(expenses.total);

      const cashInflow =
        totalTopUps +
        cashSessions +
        guestDebtCollected;

      const netCash =
        cashInflow -
        totalExpenses;

      const playerDebt =
        getNumber(
          playerBalances.debtBalance
        );

      const guestOpenDebt =
        getNumber(
          guestDebts.openDebt
        );

      return {
        sessionRevenue,

        tournamentRevenue,

        earnedRevenue:
          sessionRevenue +
          tournamentRevenue,

        walletTopUps:
          totalTopUps,

        cashSessions,

        sessionWalletPaid:
          getNumber(
            sessions.walletPaid
          ),

        sessionDebtAdded:
          getNumber(
            sessions.debtAdded
          ),

        tournamentWalletPaid:
          getNumber(
            tournaments.walletPaid
          ),

        tournamentDebtAdded:
          getNumber(
            tournaments.debtAdded
          ),

        walletLiability:
          getNumber(
            playerBalances.walletBalance
          ),

        playerDebt,

        guestOpenDebt,

        totalOutstandingDebt:
          playerDebt +
          guestOpenDebt,

        guestDebtCollected,

        cashInflow,

        expenses:
          totalExpenses,

        netCash,
      };
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Daily revenue
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "billing:get-daily-revenue",
    () => {
      const sessionDays = db
        .prepare(
          `
            SELECT
              date(endTime) AS day,

              COALESCE(
                SUM(
                  CAST(
                    totalPrice AS REAL
                  )
                ),
                0
              ) AS sessionRevenue,

              COALESCE(
                SUM(cashPaid),
                0
              ) AS cashPaid,

              COALESCE(
                SUM(walletPaid),
                0
              ) AS walletPaid,

              COALESCE(
                SUM(debtAdded),
                0
              ) AS debtAdded

            FROM sessions

            WHERE
              status = 'Finished'
              AND endTime IS NOT NULL

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

              COALESCE(
                SUM(entryFee),
                0
              ) AS tournamentRevenue

            FROM tournament_participants

            GROUP BY date(joinedAt)

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
          cashPaid: number;
          walletPaid: number;
          debtAdded: number;
        }
      >();

      for (
        const row of sessionDays
      ) {
        dayMap.set(
          row.day,
          {
            day: row.day,

            sessionRevenue:
              getNumber(
                row.sessionRevenue
              ),

            tournamentRevenue: 0,

            cashPaid:
              getNumber(
                row.cashPaid
              ),

            walletPaid:
              getNumber(
                row.walletPaid
              ),

            debtAdded:
              getNumber(
                row.debtAdded
              ),
          }
        );
      }

      for (
        const row
        of tournamentDays
      ) {
        const existing =
          dayMap.get(row.day);

        if (existing) {
          existing.tournamentRevenue =
            getNumber(
              row.tournamentRevenue
            );
        } else {
          dayMap.set(
            row.day,
            {
              day: row.day,

              sessionRevenue: 0,

              tournamentRevenue:
                getNumber(
                  row.tournamentRevenue
                ),

              cashPaid: 0,
              walletPaid: 0,
              debtAdded: 0,
            }
          );
        }
      }

      return Array.from(
        dayMap.values()
      )
        .map((day) => ({
          ...day,

          totalRevenue:
            day.sessionRevenue +
            day.tournamentRevenue,
        }))
        .sort(
          (first, second) =>
            second.day.localeCompare(
              first.day
            )
        )
        .slice(0, 30);
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Financial ledger
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "billing:get-ledger",
    () => {
      const walletTransactions =
        db
          .prepare(
            `
              SELECT
                wallet_transactions.id,
                wallet_transactions.type,
                wallet_transactions.amount,
                wallet_transactions.walletChange,
                wallet_transactions.debtChange,
                wallet_transactions.note,
                wallet_transactions.createdAt,
                players.name
                  AS playerName,
                players.username
                  AS playerUsername

              FROM wallet_transactions

              INNER JOIN players
                ON players.id =
                  wallet_transactions.playerId

              ORDER BY
                wallet_transactions.id DESC

              LIMIT 100
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
              sessions.paymentMethod,
              sessions.endTime,
              devices.name
                AS deviceName

            FROM sessions

            INNER JOIN devices
              ON devices.id =
                sessions.deviceId

            WHERE
              sessions.status =
                'Finished'
              AND sessions.cashPaid > 0

            ORDER BY
              sessions.id DESC

            LIMIT 100
          `
        )
        .all();

      const guestPayments = db
        .prepare(
          `
            SELECT
              id,
              guestName,
              phone,
              amount,
              settledAt

            FROM guest_debts

            WHERE status = 'Paid'

            ORDER BY id DESC

            LIMIT 100
          `
        )
        .all();

      const expenses = db
        .prepare(
          `
            SELECT *
            FROM expenses
            ORDER BY
              datetime(spentAt) DESC,
              id DESC
            LIMIT 100
          `
        )
        .all();

      const ledger: any[] = [];

      for (
        const transaction
        of walletTransactions
      ) {
        ledger.push({
          id:
            `wallet-${transaction.id}`,

          source:
            "Wallet",

          type:
            transaction.type,

          title:
            transaction.playerName,

          subtitle:
            transaction.note ||
            transaction.playerUsername,

          amount:
            getNumber(
              transaction.amount
            ),

          direction:
            transaction.type ===
            "TOP_UP"
              ? "In"
              : "Revenue",

          createdAt:
            transaction.createdAt,
        });
      }

      for (
        const session
        of cashSessions
      ) {
        ledger.push({
          id:
            `session-${session.id}`,

          source:
            "Session",

          type:
            "CASH_SESSION",

          title:
            session.customerName ||
            "Guest",

          subtitle:
            session.deviceName,

          amount:
            getNumber(
              session.cashPaid
            ),

          direction: "In",

          createdAt:
            session.endTime,
        });
      }

      for (
        const payment
        of guestPayments
      ) {
        ledger.push({
          id:
            `guest-${payment.id}`,

          source:
            "Guest Debt",

          type:
            "GUEST_DEBT_PAYMENT",

          title:
            payment.guestName,

          subtitle:
            payment.phone ||
            "Guest debt paid",

          amount:
            getNumber(
              payment.amount
            ),

          direction: "In",

          createdAt:
            payment.settledAt,
        });
      }

      for (
        const expense
        of expenses
      ) {
        ledger.push({
          id:
            `expense-${expense.id}`,

          source:
            "Expense",

          type:
            expense.category,

          title:
            expense.title,

          subtitle:
            expense.note ||
            expense.category,

          amount:
            getNumber(
              expense.amount
            ),

          direction: "Out",

          createdAt:
            expense.spentAt,
        });
      }

      return ledger
        .sort(
          (first, second) =>
            new Date(
              second.createdAt
            ).getTime() -
            new Date(
              first.createdAt
            ).getTime()
        )
        .slice(0, 200);
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Expenses
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "billing:get-expenses",
    () => {
      return db
        .prepare(
          `
            SELECT *
            FROM expenses
            ORDER BY
              datetime(spentAt) DESC,
              id DESC
          `
        )
        .all();
    }
  );

  registerHandler(
    "billing:add-expense",
    (
      _event,
      data: AddExpenseData
    ) => {
      const title =
        data.title?.trim();

      const category =
        data.category?.trim() ||
        "Other";

      const amount =
        Number(data.amount);

      const spentAt =
        data.spentAt ||
        new Date().toISOString();

      if (!title) {
        throw new Error(
          "Expense title is required"
        );
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "Invalid expense amount"
        );
      }

      const result = db
        .prepare(
          `
            INSERT INTO expenses
            (
              title,
              category,
              amount,
              note,
              spentAt
            )
            VALUES
            (
              ?,
              ?,
              ?,
              ?,
              ?
            )
          `
        )
        .run(
          title,
          category,
          amount,
          data.note?.trim() || "",
          spentAt
        );

      return {
        id: Number(
          result.lastInsertRowid
        ),

        changes:
          result.changes,
      };
    }
  );

  registerHandler(
    "billing:delete-expense",
    (
      _event,
      expenseId: number
    ) => {
      if (!expenseId) {
        throw new Error(
          "Expense ID is required"
        );
      }

      const result = db
        .prepare(
          `
            DELETE FROM expenses
            WHERE id = ?
          `
        )
        .run(expenseId);

      return {
        changes:
          result.changes,
      };
    }
  );
}