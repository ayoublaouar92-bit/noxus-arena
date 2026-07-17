import { ipcMain } from "electron";
import { audit, requireStaff } from "./staff";

type PriceOption = {
  id: number;
  name: string;
  price: number;
  active: number;
  sortOrder: number;
};

type QueueRow = {
  id: number;
  groupId: number;
  playerId: number;
  fixedPrice: number;
  roundTitle: string;
};

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function nowIso() {
  return new Date().toISOString();
}

function ensureRoundTables(db: any) {
  const sessionColumns = db
    .prepare("PRAGMA table_info(sessions)")
    .all() as Array<{ name: string }>;
  if (!sessionColumns.some((column) => column.name === "roundGroupId")) {
    db.exec("ALTER TABLE sessions ADD COLUMN roundGroupId INTEGER;");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS round_price_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS round_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'CS Round',
      priceOptionId INTEGER,
      fixedPrice REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Running',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finishedAt TEXT,
      FOREIGN KEY (priceOptionId) REFERENCES round_price_options(id)
    );

    CREATE TABLE IF NOT EXISTS round_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupId INTEGER NOT NULL,
      playerId INTEGER NOT NULL,
      fixedPrice REAL NOT NULL,
      roundTitle TEXT NOT NULL DEFAULT 'CS Round',
      status TEXT NOT NULL DEFAULT 'Waiting',
      queueOrder INTEGER NOT NULL,
      requestedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      startedAt TEXT,
      sessionId INTEGER,
      FOREIGN KEY (groupId) REFERENCES round_groups(id),
      FOREIGN KEY (playerId) REFERENCES players(id),
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_round_queue_waiting
      ON round_queue(status, queueOrder, id);
    CREATE INDEX IF NOT EXISTS idx_round_queue_group
      ON round_queue(groupId, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_round_group
      ON sessions(roundGroupId, status);
  `);
}

function startRoundSession(
  db: any,
  data: {
    deviceId: number;
    playerId: number;
    playerName: string;
    groupId: number;
    fixedPrice: number;
    roundTitle: string;
  },
) {
  const startTime = nowIso();
  const result = db
    .prepare(
      `
      INSERT INTO sessions
      (
        deviceId, playerId, customerName, guestPhone, guestNotes,
        startTime, status, pausedAt, pausedMinutes,
        sessionType, fixedPrice, roundGroupId
      )
      VALUES (?, ?, ?, '', ?, ?, 'Running', NULL, 0, 'round', ?, ?)
    `,
    )
    .run(
      data.deviceId,
      data.playerId,
      data.playerName,
      data.roundTitle,
      startTime,
      data.fixedPrice,
      data.groupId,
    );

  db.prepare("UPDATE devices SET status = 'Busy' WHERE id = ?").run(
    data.deviceId,
  );
  return Number(result.lastInsertRowid);
}

export function advanceRoundQueue(db: any, groupId: number, deviceId: number) {
  ensureRoundTables(db);

  const group = db
    .prepare("SELECT * FROM round_groups WHERE id = ? AND status = 'Running'")
    .get(groupId) as { id: number } | undefined;
  if (!group) return null;

  const queued = db
    .prepare(
      `
      SELECT q.*, p.name AS playerName
      FROM round_queue q
      INNER JOIN players p ON p.id = q.playerId
      WHERE q.groupId = ? AND q.status = 'Waiting'
      ORDER BY q.queueOrder ASC, q.id ASC
      LIMIT 1
    `,
    )
    .get(groupId) as (QueueRow & { playerName: string }) | undefined;

  if (!queued) {
    const active = db
      .prepare(
        "SELECT COUNT(*) AS total FROM sessions WHERE roundGroupId = ? AND status = 'Running'",
      )
      .get(groupId) as { total: number };
    if (Number(active.total) === 0) {
      db.prepare(
        "UPDATE round_groups SET status = 'Finished', finishedAt = ? WHERE id = ?",
      ).run(nowIso(), groupId);
    }
    return null;
  }

  const transaction = db.transaction(() => {
    const sessionId = startRoundSession(db, {
      deviceId,
      playerId: queued.playerId,
      playerName: queued.playerName,
      groupId,
      fixedPrice: Number(queued.fixedPrice),
      roundTitle: queued.roundTitle,
    });

    db.prepare(
      `
      UPDATE round_queue
      SET status = 'Started', startedAt = ?, sessionId = ?
      WHERE id = ?
    `,
    ).run(nowIso(), sessionId, queued.id);

    return sessionId;
  });

  const sessionId = transaction();
  return { sessionId, playerId: queued.playerId, deviceId };
}

export function registerRoundHandlers(db: any) {
  ensureRoundTables(db);

  registerHandler("rounds:get-price-options", () => {
    return db
      .prepare(
        "SELECT * FROM round_price_options WHERE active = 1 ORDER BY sortOrder ASC, id ASC",
      )
      .all();
  });

  registerHandler(
    "rounds:add-price-option",
    (_event, data: { name: string; price: number }) => {
      requireStaff(db, "ROUNDS_ADD_PRICE_OPTION");
      const name = String(data.name || "").trim();
      const price = Number(data.price);
      if (!name) throw new Error("Price option name is required");
      if (!Number.isFinite(price) || price <= 0)
        throw new Error("Invalid round price");

      const result = db
        .prepare("INSERT INTO round_price_options (name, price) VALUES (?, ?)")
        .run(name, price);
      return { id: Number(result.lastInsertRowid), name, price };
    },
  );

  registerHandler("rounds:delete-price-option", (_event, optionId: number) => {
    requireStaff(db, "ROUNDS_DELETE_PRICE_OPTION");
    db.prepare("UPDATE round_price_options SET active = 0 WHERE id = ?").run(
      Number(optionId),
    );
    return { changes: 1 };
  });

  registerHandler("rounds:get-state", () => {
    const groups = db
      .prepare(
        `
        SELECT g.*,
          (SELECT COUNT(*) FROM sessions s WHERE s.roundGroupId = g.id AND s.status = 'Running') AS activeCount,
          (SELECT COUNT(*) FROM round_queue q WHERE q.groupId = g.id AND q.status = 'Waiting') AS waitingCount
        FROM round_groups g
        WHERE g.status = 'Running'
        ORDER BY g.id DESC
      `,
      )
      .all();

    const queue = db
      .prepare(
        `
        SELECT q.*, p.name AS playerName, p.username AS playerUsername, g.title AS groupTitle
        FROM round_queue q
        INNER JOIN players p ON p.id = q.playerId
        INNER JOIN round_groups g ON g.id = q.groupId
        WHERE q.status = 'Waiting'
        ORDER BY q.queueOrder ASC, q.id ASC
      `,
      )
      .all();

    return { groups, queue };
  });

  registerHandler(
    "rounds:start-group",
    (
      _event,
      data: { playerIds: number[]; priceOptionId: number; title?: string },
    ) => {
      requireStaff(db, "ROUNDS_START_GROUP");

      const playerIds = [
        ...new Set((data.playerIds || []).map(Number).filter(Boolean)),
      ];
      if (playerIds.length === 0) throw new Error("Select at least one player");

      const option = db
        .prepare(
          "SELECT * FROM round_price_options WHERE id = ? AND active = 1",
        )
        .get(Number(data.priceOptionId)) as PriceOption | undefined;
      if (!option) throw new Error("Round price option not found");

      const placeholders = playerIds.map(() => "?").join(",");
      const players = db
        .prepare(`SELECT id, name FROM players WHERE id IN (${placeholders})`)
        .all(...playerIds) as Array<{ id: number; name: string }>;
      if (players.length !== playerIds.length)
        throw new Error("One or more players were not found");

      const playerMap = new Map(players.map((player) => [player.id, player]));
      const orderedPlayers = playerIds.map((id) => playerMap.get(id)!);

      const unavailable = db
        .prepare(
          `
          SELECT p.name
          FROM players p
          WHERE p.id IN (${placeholders})
            AND (
              EXISTS (SELECT 1 FROM sessions s WHERE s.playerId = p.id AND s.status = 'Running')
              OR EXISTS (SELECT 1 FROM round_queue q WHERE q.playerId = p.id AND q.status = 'Waiting')
            )
          LIMIT 1
        `,
        )
        .get(...playerIds) as { name: string } | undefined;
      if (unavailable)
        throw new Error(`${unavailable.name} is already active or waiting`);

      const devices = db
        .prepare(
          "SELECT id, name FROM devices WHERE status = 'Available' ORDER BY id ASC",
        )
        .all() as Array<{ id: number; name: string }>;

      const title = String(data.title || option.name || "CS Round").trim();
      const fixedPrice = Number(option.price);

      const transaction = db.transaction(() => {
        const groupResult = db
          .prepare(
            `
            INSERT INTO round_groups (title, priceOptionId, fixedPrice, status)
            VALUES (?, ?, ?, 'Running')
          `,
          )
          .run(title, option.id, fixedPrice);
        const groupId = Number(groupResult.lastInsertRowid);

        const started: Array<{
          playerId: number;
          deviceId: number;
          sessionId: number;
        }> = [];
        const queued: Array<{ playerId: number; queueId: number }> = [];

        orderedPlayers.forEach((player, index) => {
          const device = devices[index];
          if (device) {
            const sessionId = startRoundSession(db, {
              deviceId: device.id,
              playerId: player.id,
              playerName: player.name,
              groupId,
              fixedPrice,
              roundTitle: title,
            });
            started.push({
              playerId: player.id,
              deviceId: device.id,
              sessionId,
            });
          } else {
            const result = db
              .prepare(
                `
                INSERT INTO round_queue
                (groupId, playerId, fixedPrice, roundTitle, status, queueOrder)
                VALUES (?, ?, ?, ?, 'Waiting', ?)
              `,
              )
              .run(groupId, player.id, fixedPrice, title, index + 1);
            queued.push({
              playerId: player.id,
              queueId: Number(result.lastInsertRowid),
            });
          }
        });

        return { groupId, title, fixedPrice, started, queued };
      });

      const result = transaction();
      audit(db, {
        action: "ROUND_GROUP_STARTED",
        entity: "round_groups",
        entityId: result.groupId,
        details: JSON.stringify({
          playerIds,
          fixedPrice,
          started: result.started.length,
          queued: result.queued.length,
        }),
      });
      return result;
    },
  );

  registerHandler("rounds:end-group", (_event, groupIdInput: number) => {
    requireStaff(db, "ROUNDS_END_GROUP");
    const groupId = Number(groupIdInput);
    const group = db
      .prepare("SELECT * FROM round_groups WHERE id = ? AND status = 'Running'")
      .get(groupId) as any;
    if (!group) throw new Error("Active round group not found");

    const sessions = db
      .prepare(
        "SELECT * FROM sessions WHERE roundGroupId = ? AND status = 'Running'",
      )
      .all(groupId) as Array<any>;

    const transaction = db.transaction(() => {
      let walletPaidTotal = 0;
      let debtAddedTotal = 0;

      for (const session of sessions) {
        const player = db
          .prepare("SELECT * FROM players WHERE id = ?")
          .get(session.playerId) as any;
        if (!player) continue;

        const total = Math.max(
          0,
          Number(session.fixedPrice || group.fixedPrice || 0),
        );
        const currentWallet = Math.max(0, Number(player.walletBalance || 0));
        const walletPaid = Math.min(currentWallet, total);
        const debtAdded = total - walletPaid;
        const newWallet = currentWallet - walletPaid;
        const newDebt = Number(player.debtBalance || 0) + debtAdded;
        const endTime = new Date();
        const minutes = Math.max(
          1,
          Math.ceil(
            (endTime.getTime() - new Date(session.startTime).getTime()) / 60000,
          ),
        );

        db.prepare(
          "UPDATE players SET walletBalance = ?, debtBalance = ? WHERE id = ?",
        ).run(newWallet, newDebt, player.id);
        db.prepare(
          `
          INSERT INTO wallet_transactions
          (playerId, sessionId, type, amount, walletChange, debtChange, note)
          VALUES (?, ?, 'SESSION_CHARGE', ?, ?, ?, ?)
        `,
        ).run(
          player.id,
          session.id,
          total,
          -walletPaid,
          debtAdded,
          `CS group #${groupId}`,
        );
        db.prepare(
          `
          UPDATE sessions
          SET endTime = ?, duration = ?, totalPrice = ?, status = 'Finished',
              paymentMethod = ?, walletPaid = ?, debtAdded = ?, cashPaid = 0
          WHERE id = ?
        `,
        ).run(
          endTime.toISOString(),
          minutes,
          total.toFixed(2),
          debtAdded > 0 ? "Wallet + Debt" : "Wallet",
          walletPaid,
          debtAdded,
          session.id,
        );
        db.prepare("UPDATE devices SET status = 'Available' WHERE id = ?").run(
          session.deviceId,
        );
        walletPaidTotal += walletPaid;
        debtAddedTotal += debtAdded;
      }

      db.prepare(
        "UPDATE round_queue SET status = 'Cancelled' WHERE groupId = ? AND status = 'Waiting'",
      ).run(groupId);
      db.prepare(
        "UPDATE round_groups SET status = 'Finished', finishedAt = ? WHERE id = ?",
      ).run(nowIso(), groupId);

      return {
        finishedSessions: sessions.length,
        walletPaidTotal,
        debtAddedTotal,
      };
    });

    const result = transaction();
    audit(db, {
      action: "ROUND_GROUP_ENDED",
      entity: "round_groups",
      entityId: groupId,
      details: JSON.stringify(result),
    });
    return result;
  });
}
