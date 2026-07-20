import { ipcMain } from "electron";
import { getAllSettings } from "./settings";
import { requireStaff, requireAdmin, audit } from "./staff";
import { advanceRoundQueue } from "./rounds";
import { applyVipDiscount } from "./vip";
import { requireOpenShiftForCurrentStaff } from "./billing";

type StartSessionData = {
  deviceId: number;
  playerId?: number | null;
  customerName?: string;
  guestPhone?: string;
  guestNotes?: string;
};

type StartRoundSessionData = {
  deviceId: number;
  playerId?: number | null;
  customerName?: string;
  guestPhone?: string;
  guestNotes?: string;
  fixedPrice: number;
  roundTitle?: string;
};

type EndSessionData = {
  sessionId: number;
  guestPaymentMethod?: "cash" | "debt";
  playerPaymentMethod?: "cash" | "wallet";
};

type GuestDebtQuery = {
  query?: string; // search in guestName/phone
  status?: "Open" | "Paid" | "All";
  start?: string; // ISO datetime
  end?: string; // ISO datetime
  limit?: number;
};

type SettleGuestDebtData = {
  debtId: number;
  paidAmount: number; // partial or full
  note?: string;
};

type AddGuestDebtData = {
  guestName: string;
  phone?: string;
  identityNotes?: string;
  amount: number;
  note?: string;
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
  endTime?: string | null;
  status: string;

  // pause support
  pausedAt?: string | null;
  pausedMinutes?: number;

  // billing mode support
  sessionType?: "timed" | "round";
  fixedPrice?: number;
  roundGroupId?: number | null;
};

type GuestDebtRow = {
  id: number;
  sessionId: number | null;
  guestName: string;
  phone: string | null;
  identityNotes: string | null;
  amount: number;
  paidAmount: number;
  status: string;
  note?: string | null;
  source?: string | null;
  createdAt?: string;
  settledAt?: string | null;
};

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function roundMinutes(
  rawMinutes: number,
  mode: "minute" | "quarter_hour" | "hour",
) {
  if (mode === "hour") return Math.ceil(rawMinutes / 60) * 60;
  if (mode === "quarter_hour") return Math.ceil(rawMinutes / 15) * 15;
  return Math.ceil(rawMinutes);
}

function ensureGuestDebtMigrations(db: any) {
  const cols = db.prepare("PRAGMA table_info(guest_debts)").all() as Array<{
    name: string;
  }>;
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("paidAmount")) {
    db.exec(
      `ALTER TABLE guest_debts ADD COLUMN paidAmount REAL NOT NULL DEFAULT 0;`,
    );
  }
  if (!names.has("note")) {
    db.exec(`ALTER TABLE guest_debts ADD COLUMN note TEXT;`);
  }
  if (!names.has("source")) {
    db.exec(
      `ALTER TABLE guest_debts ADD COLUMN source TEXT NOT NULL DEFAULT 'session';`,
    );
  }

  db.exec(`
    UPDATE guest_debts
    SET paidAmount = 0
    WHERE paidAmount IS NULL
  `);

  db.exec(`
    UPDATE guest_debts
    SET source = 'session'
    WHERE source IS NULL OR source = ''
  `);
}

function ensureSessionPauseColumns(db: any) {
  const cols = db.prepare("PRAGMA table_info(sessions)").all() as Array<{
    name: string;
  }>;
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("pausedAt"))
    db.exec(`ALTER TABLE sessions ADD COLUMN pausedAt TEXT;`);
  if (!names.has("pausedMinutes"))
    db.exec(
      `ALTER TABLE sessions ADD COLUMN pausedMinutes INTEGER NOT NULL DEFAULT 0;`,
    );

  db.exec(`
    UPDATE sessions
    SET pausedMinutes = 0
    WHERE pausedMinutes IS NULL
  `);
}

function toIsoNow() {
  return new Date().toISOString();
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function ensureFinanceShiftTracking(db: any) {
  const addColumns = (table: string, columns: string[]) => {
    const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>;
    const names = new Set(existing.map((column) => column.name));
    for (const column of columns) {
      if (!names.has(column))
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} INTEGER;`);
    }
  };

  addColumns("sessions", ["shiftId", "staffUserId"]);
  addColumns("wallet_transactions", ["shiftId", "staffUserId"]);
  addColumns("guest_debts", ["shiftId", "staffUserId"]);

  db.exec(`
    CREATE TABLE IF NOT EXISTS guest_debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guestDebtId INTEGER NOT NULL,
      amount REAL NOT NULL,
      shiftId INTEGER NOT NULL,
      staffUserId INTEGER NOT NULL,
      note TEXT,
      paidAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_shift ON sessions(shiftId);
    CREATE INDEX IF NOT EXISTS idx_sessions_staff ON sessions(staffUserId);
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_shift ON wallet_transactions(shiftId);
    CREATE INDEX IF NOT EXISTS idx_wallet_transactions_staff ON wallet_transactions(staffUserId);
    CREATE INDEX IF NOT EXISTS idx_guest_debts_shift ON guest_debts(shiftId);
    CREATE INDEX IF NOT EXISTS idx_guest_debt_payments_shift ON guest_debt_payments(shiftId);
    CREATE INDEX IF NOT EXISTS idx_guest_debt_payments_staff ON guest_debt_payments(staffUserId);
  `);
}

export function registerFinanceHandlers(db: any) {
  ensureGuestDebtMigrations(db);
  ensureSessionPauseColumns(db);
  ensureFinanceShiftTracking(db);

  /*
  |--------------------------------------------------------------------------
  | Players
  |--------------------------------------------------------------------------
  */

  registerHandler("finance:get-players", () => {
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
        `,
      )
      .all();
  });

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
      },
    ) => {
      const name = player.name?.trim();
      const username = player.username?.trim().replace(/^@/, "");
      const initialDeposit = Math.max(0, Number(player.initialDeposit || 0));
      const initialStaffUserId =
        initialDeposit > 0 ? requireStaff(db, "FINANCE_INITIAL_DEPOSIT") : null;
      const initialShift =
        initialDeposit > 0 ? requireOpenShiftForCurrentStaff(db) : null;

      if (!name) throw new Error("Player name is required");
      if (!username) throw new Error("Username is required");

      const existing = db
        .prepare(
          `
            SELECT id
            FROM players
            WHERE LOWER(username) = LOWER(?)
          `,
        )
        .get(username);

      if (existing) throw new Error("Username already exists");

      const transaction = db.transaction(() => {
        const result = db
          .prepare(
            `
              INSERT INTO players
              (name, username, phone, walletBalance, debtBalance, image)
              VALUES
              (?, ?, ?, ?, 0, ?)
            `,
          )
          .run(
            name,
            username,
            player.phone?.trim() || "",
            initialDeposit,
            player.image || "",
          );

        const playerId = Number(result.lastInsertRowid);

        if (initialDeposit > 0) {
          db.prepare(
            `
              INSERT INTO wallet_transactions
              (playerId, type, amount, walletChange, debtChange, note, shiftId, staffUserId)
              VALUES
              (?, 'TOP_UP', ?, ?, 0, 'Initial deposit', ?, ?)
            `,
          ).run(
            playerId,
            initialDeposit,
            initialDeposit,
            initialShift!.id,
            initialStaffUserId,
          );
        }

        return { id: playerId, changes: result.changes };
      });

      return transaction();
    },
  );

  registerHandler("finance:delete-player", (_event, playerId: number) => {
    if (!playerId) throw new Error("Player ID is required");

    const sessionCount = db
      .prepare(
        `
          SELECT COUNT(*) AS total
          FROM sessions
          WHERE playerId = ?
        `,
      )
      .get(playerId) as { total: number };

    if (Number(sessionCount.total) > 0) {
      throw new Error("Player has session history");
    }

    const result = db
      .prepare(
        `
          DELETE FROM players
          WHERE id = ?
        `,
      )
      .run(playerId);

    return { changes: result.changes };
  });

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
      },
    ) => {
      // Top-ups: Admin-only in many businesses, but you didn't ask to restrict this.
      // If you want Admin-only, change to requireAdmin(db, "FINANCE_TOP_UP_PLAYER");
      const staffUserId = requireStaff(db, "FINANCE_TOP_UP_PLAYER");
      const shift = requireOpenShiftForCurrentStaff(db);

      const amount = Number(data.amount);

      if (!data.playerId) throw new Error("Player ID is required");
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Invalid top-up amount");

      const player = db
        .prepare(
          `
            SELECT *
            FROM players
            WHERE id = ?
          `,
        )
        .get(data.playerId) as PlayerRow | undefined;

      if (!player) throw new Error("Player not found");

      // A wallet top-up must only add wallet credit. Player debt has its own
      // dedicated full/partial payment actions on the finance page.
      const currentDebt = Math.max(0, Number(player.debtBalance || 0));
      const debtPaid = 0;
      const walletAdded = amount;
      const newDebt = currentDebt;
      const newWallet = Number(player.walletBalance || 0) + amount;

      const transaction = db.transaction(() => {
        db.prepare(
          `
            UPDATE players
            SET walletBalance = ?, debtBalance = ?
            WHERE id = ?
          `,
        ).run(newWallet, newDebt, player.id);

        db.prepare(
          `
            INSERT INTO wallet_transactions
            (playerId, type, amount, walletChange, debtChange, note, shiftId, staffUserId)
            VALUES
            (?, 'TOP_UP', ?, ?, ?, ?, ?, ?)
          `,
        ).run(
          player.id,
          amount,
          walletAdded,
          -debtPaid,
          data.note?.trim() || "Wallet top-up",
          shift.id,
          staffUserId,
        );
      });

      transaction();

      audit(db, {
        action: "PLAYER_TOP_UP",
        entity: "players",
        entityId: player.id,
        details: JSON.stringify({ amount, walletAdded, debtPaid }),
      });

      return {
        amount,
        debtPaid,
        walletAdded,
        walletBalance: newWallet,
        debtBalance: newDebt,
      };
    },
  );

  registerHandler(
    "finance:set-player-wallet-balance",
    (
      _event,
      data: { playerId: number; newBalance: number; reason?: string },
    ) => {
      const staffUserId = requireAdmin(db, "FINANCE_CORRECT_PLAYER_WALLET");
      const shift = requireOpenShiftForCurrentStaff(db);
      const playerId = Number(data?.playerId);
      const newBalance = Number(data?.newBalance);
      const reason = String(data?.reason || "Wallet correction").trim();

      if (!playerId) throw new Error("Player ID is required");
      if (!Number.isFinite(newBalance) || newBalance < 0)
        throw new Error("Invalid wallet balance");

      const player = db
        .prepare(`SELECT * FROM players WHERE id = ?`)
        .get(playerId) as PlayerRow | undefined;
      if (!player) throw new Error("Player not found");

      const oldBalance = Math.max(0, Number(player.walletBalance || 0));
      const walletChange = newBalance - oldBalance;

      const transaction = db.transaction(() => {
        db.prepare(`UPDATE players SET walletBalance = ? WHERE id = ?`).run(
          newBalance,
          playerId,
        );

        db.prepare(
          `INSERT INTO wallet_transactions
           (playerId, type, amount, walletChange, debtChange, note, shiftId, staffUserId)
           VALUES (?, 'WALLET_CORRECTION', ?, ?, 0, ?, ?, ?)`,
        ).run(
          playerId,
          Math.abs(walletChange),
          walletChange,
          reason || "Wallet correction",
          shift.id,
          staffUserId,
        );
      });

      transaction();

      audit(db, {
        action: "PLAYER_WALLET_CORRECTED",
        entity: "players",
        entityId: playerId,
        details: JSON.stringify({
          oldBalance,
          newBalance,
          walletChange,
          reason,
        }),
      });

      return { playerId, oldBalance, newBalance, walletChange };
    },
  );

  registerHandler(
    "finance:pay-player-debt",
    (_event, data: { playerId: number; amount: number; note?: string }) => {
      const staffUserId = requireStaff(db, "FINANCE_PAY_PLAYER_DEBT");
      const shift = requireOpenShiftForCurrentStaff(db);
      const playerId = Number(data?.playerId);
      const amount = Number(data?.amount);

      if (!playerId) throw new Error("Player ID is required");
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Invalid debt payment amount");

      const player = db
        .prepare(`SELECT * FROM players WHERE id = ?`)
        .get(playerId) as PlayerRow | undefined;
      if (!player) throw new Error("Player not found");

      const currentDebt = Math.max(0, Number(player.debtBalance || 0));
      if (currentDebt <= 0) throw new Error("Player has no debt");
      if (amount > currentDebt) throw new Error("Payment exceeds player debt");

      const newDebt = currentDebt - amount;
      const note = String(data?.note || "Player debt payment").trim();

      const transaction = db.transaction(() => {
        db.prepare(`UPDATE players SET debtBalance = ? WHERE id = ?`).run(
          newDebt,
          playerId,
        );

        db.prepare(
          `INSERT INTO wallet_transactions
           (playerId, type, amount, walletChange, debtChange, note, shiftId, staffUserId)
           VALUES (?, 'PLAYER_DEBT_PAYMENT', ?, 0, ?, ?, ?, ?)`,
        ).run(playerId, amount, -amount, note, shift.id, staffUserId);
      });

      transaction();

      audit(db, {
        action: "PLAYER_DEBT_PAID",
        entity: "players",
        entityId: playerId,
        details: JSON.stringify({ amount, oldDebt: currentDebt, newDebt }),
      });

      return { playerId, amount, oldDebt: currentDebt, debtBalance: newDebt };
    },
  );

  registerHandler("finance:get-transactions", (_event, playerId: number) => {
    return db
      .prepare(
        `
          SELECT *
          FROM wallet_transactions
          WHERE playerId = ?
          ORDER BY id DESC
          LIMIT 100
        `,
      )
      .all(playerId);
  });

  /*
  |--------------------------------------------------------------------------
  | Sessions
  |--------------------------------------------------------------------------
  */

  registerHandler("finance:start-session", (_event, data: StartSessionData) => {
    // Staff allowed
    requireStaff(db, "FINANCE_START_SESSION");

    if (!data.deviceId) throw new Error("Device is required");

    const device = db
      .prepare(
        `
          SELECT *
          FROM devices
          WHERE id = ?
        `,
      )
      .get(data.deviceId) as DeviceRow | undefined;

    if (!device) throw new Error("Device not found");
    if (device.status === "Busy") throw new Error("Device is already busy");

    let player: PlayerRow | undefined;

    if (data.playerId) {
      player = db
        .prepare(
          `
            SELECT *
            FROM players
            WHERE id = ?
          `,
        )
        .get(data.playerId) as PlayerRow | undefined;

      if (!player) throw new Error("Player not found");
    }

    const customerName = player
      ? player.name
      : data.customerName?.trim() || "Guest";
    const startTime = toIsoNow();

    const transaction = db.transaction(() => {
      const result = db
        .prepare(
          `
            INSERT INTO sessions
            (deviceId, playerId, customerName, guestPhone, guestNotes, startTime, status, pausedAt, pausedMinutes)
            VALUES
            (?, ?, ?, ?, ?, ?, 'Running', NULL, 0)
          `,
        )
        .run(
          data.deviceId,
          player?.id || null,
          customerName,
          player ? "" : data.guestPhone?.trim() || "",
          player ? "" : data.guestNotes?.trim() || "",
          startTime,
        );

      db.prepare(
        `
          UPDATE devices
          SET status = 'Busy'
          WHERE id = ?
        `,
      ).run(data.deviceId);

      return result;
    });

    const result = transaction();

    audit(db, {
      action: "SESSION_STARTED",
      entity: "sessions",
      entityId: Number(result.lastInsertRowid),
      details: JSON.stringify({
        deviceId: data.deviceId,
        playerId: player?.id || null,
        customerName,
      }),
    });

    return {
      id: Number(result.lastInsertRowid),
      startTime,
    };
  });

  registerHandler(
    "finance:start-round-session",
    (_event, data: StartRoundSessionData) => {
      requireStaff(db, "FINANCE_START_SESSION");

      if (!data.deviceId) throw new Error("Device is required");

      const fixedPrice = Number(data.fixedPrice);
      if (!Number.isFinite(fixedPrice) || fixedPrice <= 0) {
        throw new Error("Fixed price must be greater than zero");
      }

      const device = db
        .prepare(
          `
          SELECT *
          FROM devices
          WHERE id = ?
        `,
        )
        .get(data.deviceId) as DeviceRow | undefined;

      if (!device) throw new Error("Device not found");
      if (device.status === "Busy") throw new Error("Device is already busy");

      let player: PlayerRow | undefined;

      if (data.playerId) {
        player = db
          .prepare(
            `
            SELECT *
            FROM players
            WHERE id = ?
          `,
          )
          .get(data.playerId) as PlayerRow | undefined;

        if (!player) throw new Error("Player not found");
      }

      const guestName = data.customerName?.trim();
      if (!player && !guestName) throw new Error("Guest name is required");

      const customerName = player ? player.name : guestName || "Guest";
      const startTime = toIsoNow();
      const roundTitle = data.roundTitle?.trim() || "CS Round";
      const notes = [data.guestNotes?.trim(), roundTitle]
        .filter(Boolean)
        .join(" | ");

      const transaction = db.transaction(() => {
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
              status,
              pausedAt,
              pausedMinutes,
              sessionType,
              fixedPrice
            )
            VALUES
            (?, ?, ?, ?, ?, ?, 'Running', NULL, 0, 'round', ?)
          `,
          )
          .run(
            data.deviceId,
            player?.id || null,
            customerName,
            player ? "" : data.guestPhone?.trim() || "",
            notes,
            startTime,
            fixedPrice,
          );

        db.prepare(
          `
          UPDATE devices
          SET status = 'Busy'
          WHERE id = ?
        `,
        ).run(data.deviceId);

        return result;
      });

      const result = transaction();

      audit(db, {
        action: "SESSION_STARTED",
        entity: "sessions",
        entityId: Number(result.lastInsertRowid),
        details: JSON.stringify({
          deviceId: data.deviceId,
          playerId: player?.id || null,
          customerName,
          sessionType: "round",
          fixedPrice,
          roundTitle,
        }),
      });

      return {
        id: Number(result.lastInsertRowid),
        startTime,
        sessionType: "round",
        fixedPrice,
      };
    },
  );

  registerHandler("finance:get-active-sessions", () => {
    return db
      .prepare(
        `
          SELECT
            sessions.*,
            devices.name AS deviceName,
            devices.type AS deviceType,
            devices.price AS hourlyPrice,
            players.username AS playerUsername,
            players.walletBalance AS playerWallet,
            players.debtBalance AS playerDebt
          FROM sessions
          INNER JOIN devices
            ON devices.id = sessions.deviceId
          LEFT JOIN players
            ON players.id = sessions.playerId
          WHERE sessions.status = 'Running'
          ORDER BY sessions.id DESC
        `,
      )
      .all();
  });

  // PAUSE (Staff allowed)
  registerHandler("finance:pause-session", (_event, sessionId: number) => {
    requireStaff(db, "FINANCE_PAUSE_SESSION");

    const session = db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(sessionId) as SessionRow | undefined;
    if (!session) throw new Error("Session not found");
    if (session.status !== "Running")
      throw new Error("Only running sessions can be paused");
    if (session.pausedAt) throw new Error("Session already paused");

    const pausedAt = toIsoNow();
    db.prepare(`UPDATE sessions SET pausedAt = ? WHERE id = ?`).run(
      pausedAt,
      sessionId,
    );

    audit(db, {
      action: "SESSION_PAUSED",
      entity: "sessions",
      entityId: sessionId,
      details: pausedAt,
    });

    return { id: sessionId, pausedAt };
  });

  // RESUME (Staff allowed)
  registerHandler("finance:resume-session", (_event, sessionId: number) => {
    requireStaff(db, "FINANCE_RESUME_SESSION");

    const session = db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(sessionId) as SessionRow | undefined;
    if (!session) throw new Error("Session not found");
    if (session.status !== "Running")
      throw new Error("Only running sessions can be resumed");
    if (!session.pausedAt) throw new Error("Session is not paused");

    const pausedAt = new Date(session.pausedAt);
    const now = new Date();
    const pausedMinutesAdd = Math.max(
      0,
      Math.ceil((now.getTime() - pausedAt.getTime()) / 60000),
    );
    const newPausedMinutes =
      Number(session.pausedMinutes || 0) + pausedMinutesAdd;

    db.prepare(
      `UPDATE sessions SET pausedAt = NULL, pausedMinutes = ? WHERE id = ?`,
    ).run(newPausedMinutes, sessionId);

    audit(db, {
      action: "SESSION_RESUMED",
      entity: "sessions",
      entityId: sessionId,
      details: JSON.stringify({
        pausedMinutesAdd,
        pausedMinutes: newPausedMinutes,
      }),
    });

    return { id: sessionId, pausedMinutes: newPausedMinutes };
  });

  registerHandler("finance:end-session", (_event, data: EndSessionData) => {
    // Staff allowed
    const staffUserId = requireStaff(db, "FINANCE_END_SESSION");
    const shift = requireOpenShiftForCurrentStaff(db);

    const settings = getAllSettings(db);

    const session = db
      .prepare(
        `
          SELECT *
          FROM sessions
          WHERE id = ?
        `,
      )
      .get(data.sessionId) as SessionRow | undefined;

    if (!session) throw new Error("Session not found");
    if (session.status !== "Running")
      throw new Error("Session already finished");

    const device = db
      .prepare(
        `
          SELECT *
          FROM devices
          WHERE id = ?
        `,
      )
      .get(session.deviceId) as DeviceRow | undefined;

    if (!device) throw new Error("Device not found");

    // If paused, resume bookkeeping first (add paused minutes up to now, and clear pausedAt)
    if (session.pausedAt) {
      const pausedAt = new Date(session.pausedAt);
      const now = new Date();
      const pausedMinutesAdd = Math.max(
        0,
        Math.ceil((now.getTime() - pausedAt.getTime()) / 60000),
      );
      const newPausedMinutes =
        Number(session.pausedMinutes || 0) + pausedMinutesAdd;

      db.prepare(
        `UPDATE sessions SET pausedAt = NULL, pausedMinutes = ? WHERE id = ?`,
      ).run(newPausedMinutes, session.id);

      session.pausedAt = null;
      session.pausedMinutes = newPausedMinutes;
    }

    const endTime = new Date();
    const startTime = new Date(session.startTime);

    const rawMinutes = Math.max(
      1,
      Math.ceil((endTime.getTime() - startTime.getTime()) / 60000),
    );

    const pausedMinutes = Math.max(0, Number(session.pausedMinutes || 0));
    const billableRaw = Math.max(1, rawMinutes - pausedMinutes);

    const rounded = roundMinutes(billableRaw, settings.roundingMode);
    const minutes = Math.max(settings.minimumMinutes, rounded);

    const sessionType = session.sessionType || "timed";
    const fixedPrice = Math.max(0, Number(session.fixedPrice || 0));

    const baseTotal =
      sessionType === "round"
        ? Number(fixedPrice.toFixed(2))
        : Number(((minutes / 60) * Number(device.price || 0)).toFixed(2));

    const vipPricing = applyVipDiscount(db, session.playerId, baseTotal);

    const total = vipPricing.total;

    let walletPaid = 0;
    let debtAdded = 0;
    let cashPaid = 0;
    let paymentMethod = "Cash";

    const guestPaymentMethod =
      data.guestPaymentMethod ?? settings.defaultGuestPayment;

    const transaction = db.transaction(() => {
      if (session.playerId) {
        const player = db
          .prepare(
            `
              SELECT *
              FROM players
              WHERE id = ?
            `,
          )
          .get(session.playerId) as PlayerRow | undefined;

        if (!player) throw new Error("Player not found");

        const playerPaymentMethod = session.roundGroupId
          ? "wallet"
          : data.playerPaymentMethod || "wallet";

        if (playerPaymentMethod === "cash") {
          cashPaid = total;
          paymentMethod = "Cash";
        } else {
          const currentWallet = Math.max(0, Number(player.walletBalance || 0));
          walletPaid = Math.min(currentWallet, total);
          debtAdded = total - walletPaid;

          const newWallet = currentWallet - walletPaid;
          const newDebt = Number(player.debtBalance || 0) + debtAdded;

          db.prepare(
            `
              UPDATE players
              SET walletBalance = ?, debtBalance = ?
              WHERE id = ?
            `,
          ).run(newWallet, newDebt, player.id);

          db.prepare(
            `
              INSERT INTO wallet_transactions
              (playerId, sessionId, type, amount, walletChange, debtChange, note, shiftId, staffUserId)
              VALUES
              (?, ?, 'SESSION_CHARGE', ?, ?, ?, ?, ?, ?)
            `,
          ).run(
            player.id,
            session.id,
            total,
            -walletPaid,
            debtAdded,
            `Session on ${device.name}`,
            shift.id,
            staffUserId,
          );

          paymentMethod = debtAdded > 0 ? "Wallet + Debt" : "Wallet";
        }
      } else if (guestPaymentMethod === "debt") {
        debtAdded = total;
        paymentMethod = "Guest Debt";

        db.prepare(
          `
            INSERT INTO guest_debts
            (sessionId, guestName, phone, identityNotes, amount, paidAmount, status, note, source, shiftId, staffUserId)
            VALUES
            (?, ?, ?, ?, ?, 0, 'Open', ?, 'session', ?, ?)
          `,
        ).run(
          session.id,
          session.customerName || "Guest",
          session.guestPhone || "",
          session.guestNotes || "",
          total,
          `Session on ${device.name}`,
          shift.id,
          staffUserId,
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
            cashPaid = ?,
            pausedMinutes = ?,
            shiftId = ?,
            staffUserId = ?
          WHERE id = ?
        `,
      ).run(
        endTime.toISOString(),
        minutes,
        total.toFixed(2),
        paymentMethod,
        walletPaid,
        debtAdded,
        cashPaid,
        pausedMinutes,
        shift.id,
        staffUserId,
        session.id,
      );

      db.prepare(
        `
          UPDATE devices
          SET status = 'Available'
          WHERE id = ?
        `,
      ).run(session.deviceId);
    });

    transaction();

    const queuedSession = session.roundGroupId
      ? advanceRoundQueue(db, Number(session.roundGroupId), session.deviceId)
      : null;

    audit(db, {
      action: "SESSION_ENDED",
      entity: "sessions",
      entityId: session.id,
      details: JSON.stringify({
        minutes,
        total,
        paymentMethod,
        pausedMinutes,
        sessionType,
        fixedPrice: sessionType === "round" ? fixedPrice : 0,
      }),
    });

    return {
      minutes,
      total: total.toFixed(2),
      paymentMethod,
      walletPaid: walletPaid.toFixed(2),
      debtAdded: debtAdded.toFixed(2),
      cashPaid: cashPaid.toFixed(2),
      pausedMinutes: String(pausedMinutes),
      sessionType,
      queuedSession,
    };
  });

  /*
  |--------------------------------------------------------------------------
  | Guest debts v2
  |--------------------------------------------------------------------------
  */

  registerHandler(
    "finance:get-guest-debts",
    (_event, query: GuestDebtQuery | undefined) => {
      const q = (query?.query || "").trim().toLowerCase();
      const status = query?.status || "Open";
      const start = query?.start ? String(query.start) : "";
      const end = query?.end ? String(query.end) : "";
      const limit = Math.min(500, Math.max(20, Number(query?.limit || 200)));

      const where: string[] = [];
      const params: any[] = [];

      if (status !== "All") {
        where.push(`status = ?`);
        params.push(status);
      }

      if (q) {
        where.push(`(LOWER(guestName) LIKE ? OR LOWER(phone) LIKE ?)`);
        params.push(`%${q}%`, `%${q}%`);
      }

      if (start) {
        where.push(`datetime(createdAt) >= datetime(?)`);
        params.push(start);
      }

      if (end) {
        where.push(`datetime(createdAt) <= datetime(?)`);
        params.push(end);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const rows = db
        .prepare(
          `
          SELECT
            *,
            (amount - paidAmount) AS remaining
          FROM guest_debts
          ${whereSql}
          ORDER BY id DESC
          LIMIT ${limit}
        `,
        )
        .all(...params);

      return rows;
    },
  );

  // Staff can collect/settle (partial or full)
  registerHandler(
    "finance:settle-guest-debt",
    (_event, data: SettleGuestDebtData) => {
      const staffUserId = requireStaff(db, "FINANCE_SETTLE_GUEST_DEBT");
      const shift = requireOpenShiftForCurrentStaff(db);

      const debtId = Number(data.debtId);
      const paidAmount = Number(data.paidAmount);

      if (!debtId) throw new Error("Debt ID is required");
      if (!Number.isFinite(paidAmount) || paidAmount <= 0)
        throw new Error("Invalid paid amount");

      const debt = db
        .prepare(
          `
          SELECT *
          FROM guest_debts
          WHERE id = ?
        `,
        )
        .get(debtId) as GuestDebtRow | undefined;

      if (!debt) throw new Error("Guest debt not found");
      if (debt.status !== "Open") throw new Error("Debt already settled");

      const currentPaid = Number(debt.paidAmount || 0);
      const remaining = Math.max(0, Number(debt.amount || 0) - currentPaid);

      if (paidAmount > remaining)
        throw new Error("Paid amount exceeds remaining");

      const newPaid = currentPaid + paidAmount;
      const newRemaining = Math.max(0, Number(debt.amount || 0) - newPaid);

      const settledAt = newRemaining === 0 ? toIsoNow() : null;
      const nextStatus = newRemaining === 0 ? "Paid" : "Open";

      db.prepare(
        `
        UPDATE guest_debts
        SET
          paidAmount = ?,
          status = ?,
          settledAt = COALESCE(?, settledAt),
          note = COALESCE(?, note)
        WHERE id = ?
      `,
      ).run(newPaid, nextStatus, settledAt, data.note?.trim() || null, debtId);

      db.prepare(
        `INSERT INTO guest_debt_payments
         (guestDebtId, amount, shiftId, staffUserId, note, paidAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        debtId,
        paidAmount,
        shift.id,
        staffUserId,
        data.note?.trim() || "",
        toIsoNow(),
      );

      audit(db, {
        action: "GUEST_DEBT_COLLECTED",
        entity: "guest_debts",
        entityId: debtId,
        details: JSON.stringify({
          guestName: debt.guestName,
          collected: paidAmount,
          totalAmount: debt.amount,
          remaining: newRemaining,
          status: nextStatus,
        }),
      });

      return {
        id: debtId,
        collected: paidAmount,
        paidAmount: newPaid,
        remaining: newRemaining,
        status: nextStatus,
        settledAt,
      };
    },
  );

  // Admin only: add a manual guest debt (not linked to session)
  registerHandler(
    "finance:add-guest-debt",
    (_event, data: AddGuestDebtData) => {
      const staffUserId = requireAdmin(db, "FINANCE_ADD_GUEST_DEBT");
      const shift = requireOpenShiftForCurrentStaff(db);

      const guestName = String(data.guestName || "").trim();
      const phone = String(data.phone || "").trim();
      const identityNotes = String(data.identityNotes || "").trim();
      const amount = Number(data.amount);
      const note = String(data.note || "").trim();

      if (!guestName) throw new Error("Guest name is required");
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Invalid amount");

      const result = db
        .prepare(
          `
          INSERT INTO guest_debts
            (sessionId, guestName, phone, identityNotes, amount, paidAmount, status, note, source, shiftId, staffUserId)
          VALUES
            (NULL, ?, ?, ?, ?, 0, 'Open', ?, 'manual', ?, ?)
        `,
        )
        .run(
          guestName,
          phone,
          identityNotes,
          amount,
          note || null,
          shift.id,
          staffUserId,
        );

      audit(db, {
        action: "GUEST_DEBT_CREATED",
        entity: "guest_debts",
        entityId: Number(result.lastInsertRowid),
        details: JSON.stringify({ guestName, phone, amount, source: "manual" }),
      });

      return { id: Number(result.lastInsertRowid), changes: result.changes };
    },
  );
}
