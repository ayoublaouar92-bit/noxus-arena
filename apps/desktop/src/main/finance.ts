import { ipcMain } from "electron";

type StartSessionData = {
  deviceId: number;
  playerId?: number | null;
  customerName?: string;
  guestPhone?: string;
  guestNotes?: string;
};

type EndSessionData = {
  sessionId: number;
  guestPaymentMethod?: "cash" | "debt";
};

type PlayerRow = {
  id: number;
  name: string;
  username: string;
  phone: string | null;
  walletBalance: number;
  debtBalance: number;
  image: string | null;
  createdAt: string;
};

type DeviceRow = {
  id: number;
  name: string;
  type: string;
  price: string;
  status: string;
};

type SessionRow = {
  id: number;
  deviceId: number;
  playerId: number | null;
  customerName: string;
  guestPhone: string | null;
  guestNotes: string | null;
  startTime: string;
  status: string;
};

type GuestDebtRow = {
  id: number;
  amount: number;
  status: string;
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

export function registerFinanceHandlers(
  db: any
) {
  /*
  |--------------------------------------------------------------------------
  | Players
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "finance:get-players",
    () => {
      return db
        .prepare(
          `
            SELECT
              id,
              name,
              username,
              phone,
              walletBalance,
              debtBalance,
              image,
              createdAt
            FROM players
            ORDER BY id DESC
          `
        )
        .all();
    }
  );

  registerHandler(
    "finance:add-player",
    (
      _event,
      player: {
        name: string;
        username: string;
        phone?: string;
        initialDeposit?: number;
        image?: string;
      }
    ) => {
      const name = player.name?.trim();

      const username = player.username
        ?.trim()
        .replace(/^@/, "");

      const initialDeposit = Math.max(
        0,
        Number(
          player.initialDeposit || 0
        )
      );

      if (!name) {
        throw new Error(
          "Player name is required"
        );
      }

      if (!username) {
        throw new Error(
          "Username is required"
        );
      }

      const existingPlayer = db
        .prepare(
          `
            SELECT id
            FROM players
            WHERE LOWER(username) =
              LOWER(?)
          `
        )
        .get(username);

      if (existingPlayer) {
        throw new Error(
          "Username already exists"
        );
      }

      const transaction =
        db.transaction(() => {
          const result = db
            .prepare(
              `
                INSERT INTO players
                (
                  name,
                  username,
                  phone,
                  walletBalance,
                  debtBalance,
                  image
                )
                VALUES
                (
                  ?,
                  ?,
                  ?,
                  ?,
                  0,
                  ?
                )
              `
            )
            .run(
              name,
              username,
              player.phone?.trim() || "",
              initialDeposit,
              player.image || ""
            );

          const playerId = Number(
            result.lastInsertRowid
          );

          if (initialDeposit > 0) {
            db.prepare(
              `
                INSERT INTO
                  wallet_transactions
                (
                  playerId,
                  type,
                  amount,
                  walletChange,
                  debtChange,
                  note
                )
                VALUES
                (
                  ?,
                  'TOP_UP',
                  ?,
                  ?,
                  0,
                  'Initial deposit'
                )
              `
            ).run(
              playerId,
              initialDeposit,
              initialDeposit
            );
          }

          return {
            id: playerId,
            changes: result.changes,
          };
        });

      return transaction();
    }
  );

  registerHandler(
    "finance:delete-player",
    (
      _event,
      playerId: number
    ) => {
      if (!playerId) {
        throw new Error(
          "Player ID is required"
        );
      }

      const sessionCount = db
        .prepare(
          `
            SELECT COUNT(*) AS total
            FROM sessions
            WHERE playerId = ?
          `
        )
        .get(playerId) as {
        total: number;
      };

      if (
        Number(sessionCount.total) > 0
      ) {
        throw new Error(
          "Player has session history"
        );
      }

      const result = db
        .prepare(
          `
            DELETE FROM players
            WHERE id = ?
          `
        )
        .run(playerId);

      return {
        changes: result.changes,
      };
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Wallet
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "finance:top-up-player",
    (
      _event,
      data: {
        playerId: number;
        amount: number;
        note?: string;
      }
    ) => {
      const amount = Number(
        data.amount
      );

      if (!data.playerId) {
        throw new Error(
          "Player ID is required"
        );
      }

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        throw new Error(
          "Invalid top-up amount"
        );
      }

      const player = db
        .prepare(
          `
            SELECT *
            FROM players
            WHERE id = ?
          `
        )
        .get(data.playerId) as
        | PlayerRow
        | undefined;

      if (!player) {
        throw new Error(
          "Player not found"
        );
      }

      const currentDebt = Math.max(
        0,
        Number(
          player.debtBalance || 0
        )
      );

      const debtPaid = Math.min(
        currentDebt,
        amount
      );

      const walletAdded =
        amount - debtPaid;

      const newDebt =
        currentDebt - debtPaid;

      const newWallet =
        Number(
          player.walletBalance || 0
        ) + walletAdded;

      const transaction =
        db.transaction(() => {
          db.prepare(
            `
              UPDATE players
              SET
                walletBalance = ?,
                debtBalance = ?
              WHERE id = ?
            `
          ).run(
            newWallet,
            newDebt,
            player.id
          );

          db.prepare(
            `
              INSERT INTO
                wallet_transactions
              (
                playerId,
                type,
                amount,
                walletChange,
                debtChange,
                note
              )
              VALUES
              (
                ?,
                'TOP_UP',
                ?,
                ?,
                ?,
                ?
              )
            `
          ).run(
            player.id,
            amount,
            walletAdded,
            -debtPaid,
            data.note?.trim() ||
              "Wallet top-up"
          );
        });

      transaction();

      return {
        amount,
        debtPaid,
        walletAdded,
        walletBalance: newWallet,
        debtBalance: newDebt,
      };
    }
  );

  registerHandler(
    "finance:get-transactions",
    (
      _event,
      playerId: number
    ) => {
      return db
        .prepare(
          `
            SELECT *
            FROM wallet_transactions
            WHERE playerId = ?
            ORDER BY id DESC
            LIMIT 100
          `
        )
        .all(playerId);
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Start session
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "finance:start-session",
    (
      _event,
      data: StartSessionData
    ) => {
      if (!data.deviceId) {
        throw new Error(
          "Device is required"
        );
      }

      const device = db
        .prepare(
          `
            SELECT *
            FROM devices
            WHERE id = ?
          `
        )
        .get(data.deviceId) as
        | DeviceRow
        | undefined;

      if (!device) {
        throw new Error(
          "Device not found"
        );
      }

      if (device.status === "Busy") {
        throw new Error(
          "Device is already busy"
        );
      }

      let player:
        | PlayerRow
        | undefined;

      if (data.playerId) {
        player = db
          .prepare(
            `
              SELECT *
              FROM players
              WHERE id = ?
            `
          )
          .get(data.playerId) as
          | PlayerRow
          | undefined;

        if (!player) {
          throw new Error(
            "Player not found"
          );
        }
      }

      const customerName = player
        ? player.name
        : data.customerName?.trim() ||
          "Guest";

      const startTime =
        new Date().toISOString();

      const transaction =
        db.transaction(() => {
          const result = db
            .prepare(
              `
                INSERT INTO sessions
                (
                  deviceId,
                  playerId,
                  customerName,
                  guestPhone,
                  guestNotes,
                  startTime,
                  status
                )
                VALUES
                (
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  'Running'
                )
              `
            )
            .run(
              data.deviceId,
              player?.id || null,
              customerName,
              player
                ? ""
                : data.guestPhone?.trim() ||
                  "",
              player
                ? ""
                : data.guestNotes?.trim() ||
                  "",
              startTime
            );

          db.prepare(
            `
              UPDATE devices
              SET status = 'Busy'
              WHERE id = ?
            `
          ).run(data.deviceId);

          return result;
        });

      const result = transaction();

      return {
        id: Number(
          result.lastInsertRowid
        ),
        startTime,
      };
    }
  );

  registerHandler(
    "finance:get-active-sessions",
    () => {
      return db
        .prepare(
          `
            SELECT
              sessions.*,
              devices.name
                AS deviceName,
              devices.type
                AS deviceType,
              devices.price
                AS hourlyPrice,
              players.username
                AS playerUsername,
              players.walletBalance
                AS playerWallet,
              players.debtBalance
                AS playerDebt
            FROM sessions
            INNER JOIN devices
              ON devices.id =
                sessions.deviceId
            LEFT JOIN players
              ON players.id =
                sessions.playerId
            WHERE sessions.status =
              'Running'
            ORDER BY sessions.id DESC
          `
        )
        .all();
    }
  );

  /*
  |--------------------------------------------------------------------------
  | End session
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "finance:end-session",
    (
      _event,
      data: EndSessionData
    ) => {
      const sessionId =
        data.sessionId;

      if (!sessionId) {
        throw new Error(
          "Session ID is required"
        );
      }

      const session = db
        .prepare(
          `
            SELECT *
            FROM sessions
            WHERE id = ?
          `
        )
        .get(sessionId) as
        | SessionRow
        | undefined;

      if (!session) {
        throw new Error(
          "Session not found"
        );
      }

      if (
        session.status !== "Running"
      ) {
        throw new Error(
          "Session already finished"
        );
      }

      const device = db
        .prepare(
          `
            SELECT *
            FROM devices
            WHERE id = ?
          `
        )
        .get(session.deviceId) as
        | DeviceRow
        | undefined;

      if (!device) {
        throw new Error(
          "Device not found"
        );
      }

      const endTime = new Date();

      const startTime = new Date(
        session.startTime
      );

      const minutes = Math.max(
        1,
        Math.ceil(
          (endTime.getTime() -
            startTime.getTime()) /
            60000
        )
      );

      const total = Number(
        (
          (minutes / 60) *
          Number(device.price || 0)
        ).toFixed(2)
      );

      let walletPaid = 0;
      let debtAdded = 0;
      let cashPaid = 0;
      let paymentMethod = "Cash";

      const transaction =
        db.transaction(() => {
          if (session.playerId) {
            const player = db
              .prepare(
                `
                  SELECT *
                  FROM players
                  WHERE id = ?
                `
              )
              .get(
                session.playerId
              ) as
              | PlayerRow
              | undefined;

            if (!player) {
              throw new Error(
                "Player not found"
              );
            }

            const currentWallet =
              Math.max(
                0,
                Number(
                  player.walletBalance ||
                    0
                )
              );

            walletPaid = Math.min(
              currentWallet,
              total
            );

            debtAdded =
              total - walletPaid;

            const newWallet =
              currentWallet -
              walletPaid;

            const newDebt =
              Number(
                player.debtBalance || 0
              ) + debtAdded;

            db.prepare(
              `
                UPDATE players
                SET
                  walletBalance = ?,
                  debtBalance = ?
                WHERE id = ?
              `
            ).run(
              newWallet,
              newDebt,
              player.id
            );

            db.prepare(
              `
                INSERT INTO
                  wallet_transactions
                (
                  playerId,
                  sessionId,
                  type,
                  amount,
                  walletChange,
                  debtChange,
                  note
                )
                VALUES
                (
                  ?,
                  ?,
                  'SESSION_CHARGE',
                  ?,
                  ?,
                  ?,
                  ?
                )
              `
            ).run(
              player.id,
              session.id,
              total,
              -walletPaid,
              debtAdded,
              `Session on ${device.name}`
            );

            paymentMethod =
              debtAdded > 0
                ? "Wallet + Debt"
                : "Wallet";
          } else if (
            data.guestPaymentMethod ===
            "debt"
          ) {
            debtAdded = total;
            paymentMethod =
              "Guest Debt";

            db.prepare(
              `
                INSERT INTO guest_debts
                (
                  sessionId,
                  guestName,
                  phone,
                  identityNotes,
                  amount,
                  status
                )
                VALUES
                (
                  ?,
                  ?,
                  ?,
                  ?,
                  ?,
                  'Open'
                )
              `
            ).run(
              session.id,
              session.customerName ||
                "Guest",
              session.guestPhone || "",
              session.guestNotes || "",
              total
            );
          } else {
            cashPaid = total;
            paymentMethod = "Cash";
          }

          db.prepare(
            `
              UPDATE sessions
              SET
                endTime = ?,
                duration = ?,
                totalPrice = ?,
                status = 'Finished',
                paymentMethod = ?,
                walletPaid = ?,
                debtAdded = ?,
                cashPaid = ?
              WHERE id = ?
            `
          ).run(
            endTime.toISOString(),
            minutes,
            total.toFixed(2),
            paymentMethod,
            walletPaid,
            debtAdded,
            cashPaid,
            session.id
          );

          db.prepare(
            `
              UPDATE devices
              SET status = 'Available'
              WHERE id = ?
            `
          ).run(session.deviceId);
        });

      transaction();

      return {
        minutes,
        total: total.toFixed(2),
        paymentMethod,
        walletPaid:
          walletPaid.toFixed(2),
        debtAdded:
          debtAdded.toFixed(2),
        cashPaid:
          cashPaid.toFixed(2),
      };
    }
  );

  /*
  |--------------------------------------------------------------------------
  | Guest debts
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "finance:get-guest-debts",
    () => {
      return db
        .prepare(
          `
            SELECT *
            FROM guest_debts
            WHERE status = 'Open'
            ORDER BY id DESC
          `
        )
        .all();
    }
  );

  registerHandler(
    "finance:settle-guest-debt",
    (
      _event,
      debtId: number
    ) => {
      const debt = db
        .prepare(
          `
            SELECT *
            FROM guest_debts
            WHERE id = ?
          `
        )
        .get(debtId) as
        | GuestDebtRow
        | undefined;

      if (!debt) {
        throw new Error(
          "Guest debt not found"
        );
      }

      if (debt.status !== "Open") {
        throw new Error(
          "Debt already settled"
        );
      }

      const settledAt =
        new Date().toISOString();

      db.prepare(
        `
          UPDATE guest_debts
          SET
            status = 'Paid',
            settledAt = ?
          WHERE id = ?
        `
      ).run(
        settledAt,
        debtId
      );

      return {
        id: debtId,
        amount: debt.amount,
        status: "Paid",
        settledAt,
      };
    }
  );
}