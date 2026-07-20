import { ipcMain } from "electron";
import { audit, requireStaff } from "./staff";
import { applyVipDiscount } from "./vip";

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function nowIso() {
  return new Date().toISOString();
}

function ensureTables(db: any) {
  const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{
    name: string;
  }>;
  if (!columns.some((column) => column.name === "roundGroupId")) {
    db.exec("ALTER TABLE sessions ADD COLUMN roundGroupId INTEGER;");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS round_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'CS Round',
      fixedPrice REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Running',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finishedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS player_waiting_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playerId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'Waiting',
      queueOrder INTEGER NOT NULL,
      addedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      removedAt TEXT,
      FOREIGN KEY (playerId) REFERENCES players(id)
    );

    CREATE INDEX IF NOT EXISTS idx_waiting_list_order
      ON player_waiting_list(status, queueOrder, id);
    CREATE INDEX IF NOT EXISTS idx_sessions_round_group
      ON sessions(roundGroupId, status);
  `);
}

function startSession(
  db: any,
  data: {
    groupId: number;
    deviceId: number;
    playerId: number;
    playerName: string;
    title: string;
    fixedPrice: number;
  },
) {
  const result = db
    .prepare(
      `
    INSERT INTO sessions
    (deviceId, playerId, customerName, guestPhone, guestNotes, startTime,
     status, pausedAt, pausedMinutes, sessionType, fixedPrice, roundGroupId)
    VALUES (?, ?, ?, '', ?, ?, 'Running', NULL, 0, 'round', ?, ?)
  `,
    )
    .run(
      data.deviceId,
      data.playerId,
      data.playerName,
      data.title,
      nowIso(),
      data.fixedPrice,
      data.groupId,
    );
  db.prepare("UPDATE devices SET status = 'Busy' WHERE id = ?").run(
    data.deviceId,
  );
  return Number(result.lastInsertRowid);
}

function addToWaiting(db: any, playerId: number) {
  const duplicate = db
    .prepare(
      "SELECT id FROM player_waiting_list WHERE playerId = ? AND status = 'Waiting' LIMIT 1",
    )
    .get(playerId);
  if (duplicate) return null;
  const last = db
    .prepare(
      "SELECT COALESCE(MAX(queueOrder), 0) AS value FROM player_waiting_list WHERE status = 'Waiting'",
    )
    .get() as { value: number };
  const result = db
    .prepare(
      "INSERT INTO player_waiting_list (playerId, status, queueOrder) VALUES (?, 'Waiting', ?)",
    )
    .run(playerId, Number(last.value || 0) + 1);
  return Number(result.lastInsertRowid);
}

function chargeAndFinish(db: any, session: any, note: string) {
  const player = db
    .prepare("SELECT * FROM players WHERE id = ?")
    .get(session.playerId) as any;
  if (!player) throw new Error("Player not found");
  const baseTotal = Math.max(
    0,
    Number(session.fixedPrice || 0),
  );

  const vipPricing = applyVipDiscount(
    db,
    Number(session.playerId),
    baseTotal,
  );

  const total = vipPricing.total;
  const wallet = Math.max(0, Number(player.walletBalance || 0));
  const walletPaid = Math.min(wallet, total);
  const debtAdded = total - walletPaid;
  const end = new Date();
  const minutes = Math.max(
    1,
    Math.ceil((end.getTime() - new Date(session.startTime).getTime()) / 60000),
  );

  db.prepare(
    "UPDATE players SET walletBalance = ?, debtBalance = ? WHERE id = ?",
  ).run(
    wallet - walletPaid,
    Number(player.debtBalance || 0) + debtAdded,
    player.id,
  );
  db.prepare(
    `
    INSERT INTO wallet_transactions
    (playerId, sessionId, type, amount, walletChange, debtChange, note)
    VALUES (?, ?, 'SESSION_CHARGE', ?, ?, ?, ?)
  `,
  ).run(player.id, session.id, total, -walletPaid, debtAdded, note);
  db.prepare(
    `
    UPDATE sessions SET endTime = ?, duration = ?, totalPrice = ?, status = 'Finished',
      paymentMethod = ?, walletPaid = ?, debtAdded = ?, cashPaid = 0
    WHERE id = ?
  `,
  ).run(
    end.toISOString(),
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
  return { walletPaid, debtAdded, deviceId: Number(session.deviceId) };
}

export function advanceRoundQueue(db: any, groupId: number, deviceId: number) {
  ensureTables(db);
  const group = db
    .prepare("SELECT * FROM round_groups WHERE id = ? AND status = 'Running'")
    .get(groupId) as any;
  if (!group) return null;
  const waiting = db
    .prepare(
      `
    SELECT w.*, p.name AS playerName FROM player_waiting_list w
    INNER JOIN players p ON p.id = w.playerId
    WHERE w.status = 'Waiting' ORDER BY w.queueOrder ASC, w.id ASC LIMIT 1
  `,
    )
    .get() as any;
  if (!waiting) return null;
  const sessionId = startSession(db, {
    groupId,
    deviceId,
    playerId: Number(waiting.playerId),
    playerName: waiting.playerName,
    title: group.title,
    fixedPrice: Number(group.fixedPrice),
  });
  db.prepare(
    "UPDATE player_waiting_list SET status = 'Started', removedAt = ? WHERE id = ?",
  ).run(nowIso(), waiting.id);
  return { sessionId, playerId: Number(waiting.playerId), deviceId };
}

export function registerRoundHandlers(db: any) {
  ensureTables(db);

  registerHandler("rounds:get-state", () => {
    const groups = db
      .prepare(
        `
      SELECT g.*,
        (SELECT COUNT(*) FROM sessions s WHERE s.roundGroupId = g.id AND s.status = 'Running') AS activeCount
      FROM round_groups g WHERE g.status = 'Running' ORDER BY g.id DESC
    `,
      )
      .all();
    const waitingList = db
      .prepare(
        `
      SELECT w.*, p.name AS playerName, p.username AS playerUsername
      FROM player_waiting_list w INNER JOIN players p ON p.id = w.playerId
      WHERE w.status = 'Waiting' ORDER BY w.queueOrder ASC, w.id ASC
    `,
      )
      .all();
    const participants = db
      .prepare(
        `
      SELECT s.roundGroupId AS groupId, s.playerId, s.customerName AS playerName,
        p.username AS playerUsername, s.deviceId, d.name AS deviceName
      FROM sessions s INNER JOIN players p ON p.id = s.playerId
      INNER JOIN devices d ON d.id = s.deviceId
      WHERE s.roundGroupId IS NOT NULL AND s.status = 'Running'
      ORDER BY s.deviceId ASC, s.id ASC
    `,
      )
      .all();
    return { groups, waitingList, participants };
  });

  registerHandler(
    "rounds:add-waiting-player",
    (_event, playerIdInput: number) => {
      requireStaff(db, "ROUNDS_ADD_WAITING_PLAYER");
      const playerId = Number(playerIdInput);
      const player = db
        .prepare("SELECT id FROM players WHERE id = ?")
        .get(playerId);
      if (!player) throw new Error("Player not found");
      const active = db
        .prepare(
          "SELECT id FROM sessions WHERE playerId = ? AND status = 'Running' LIMIT 1",
        )
        .get(playerId);
      if (active) throw new Error("Player is currently playing");
      const id = addToWaiting(db, playerId);
      if (!id) throw new Error("Player is already waiting");
      return { id, playerId };
    },
  );

  registerHandler(
    "rounds:remove-waiting-player",
    (_event, waitingIdInput: number) => {
      requireStaff(db, "ROUNDS_REMOVE_WAITING_PLAYER");
      const result = db
        .prepare(
          "UPDATE player_waiting_list SET status = 'Removed', removedAt = ? WHERE id = ? AND status = 'Waiting'",
        )
        .run(nowIso(), Number(waitingIdInput));
      return { changes: result.changes };
    },
  );

  registerHandler(
    "rounds:start-group",
    (
      _event,
      data: { playerIds: number[]; fixedPrice: number; title?: string },
    ) => {
      requireStaff(db, "ROUNDS_START_GROUP");
      const playerIds = [
        ...new Set((data.playerIds || []).map(Number).filter(Boolean)),
      ];
      const fixedPrice = Number(data.fixedPrice);
      if (!playerIds.length) throw new Error("Select players");
      if (!Number.isFinite(fixedPrice) || fixedPrice <= 0)
        throw new Error("Invalid price");
      const marks = playerIds.map(() => "?").join(",");
      const players = db
        .prepare(`SELECT id, name FROM players WHERE id IN (${marks})`)
        .all(...playerIds) as Array<{ id: number; name: string }>;
      if (players.length !== playerIds.length)
        throw new Error("Player not found");
      const playerMap = new Map(
        players.map((player) => [Number(player.id), player]),
      );
      const devices = db
        .prepare(
          "SELECT id FROM devices WHERE status = 'Available' ORDER BY id ASC",
        )
        .all() as Array<{ id: number }>;
      const title = String(data.title || "CS Round").trim();

      return db.transaction(() => {
        const groupResult = db
          .prepare(
            "INSERT INTO round_groups (title, fixedPrice, status) VALUES (?, ?, 'Running')",
          )
          .run(title, fixedPrice);
        const groupId = Number(groupResult.lastInsertRowid);
        const started: any[] = [];
        const queued: number[] = [];
        playerIds.forEach((playerId, index) => {
          const player = playerMap.get(playerId)!;
          if (devices[index]) {
            const sessionId = startSession(db, {
              groupId,
              deviceId: devices[index].id,
              playerId,
              playerName: player.name,
              title,
              fixedPrice,
            });
            started.push({ playerId, deviceId: devices[index].id, sessionId });
          } else {
            if (addToWaiting(db, playerId)) queued.push(playerId);
          }
        });
        return { groupId, started, queued, fixedPrice };
      })();
    },
  );

  registerHandler(
    "rounds:finish-and-start-next",
    (_event, data: { groupId: number; winnerPlayerIds: number[] }) => {
      requireStaff(db, "ROUNDS_FINISH_AND_START_NEXT");
      const group = db
        .prepare(
          "SELECT * FROM round_groups WHERE id = ? AND status = 'Running'",
        )
        .get(Number(data.groupId)) as any;
      if (!group) throw new Error("Round group not found");
      const sessions = db
        .prepare(
          "SELECT * FROM sessions WHERE roundGroupId = ? AND status = 'Running' ORDER BY deviceId ASC",
        )
        .all(group.id) as any[];
      if (!sessions.length) throw new Error("No active sessions");
      const participants = new Set(
        sessions.map((session) => Number(session.playerId)),
      );
      const winners = [
        ...new Set((data.winnerPlayerIds || []).map(Number)),
      ].filter((id) => participants.has(id));
      const needed = Math.max(0, sessions.length - winners.length);
      const waiting = db
        .prepare(
          `
        SELECT w.*, p.name AS playerName FROM player_waiting_list w
        INNER JOIN players p ON p.id = w.playerId
        WHERE w.status = 'Waiting' ORDER BY w.queueOrder ASC, w.id ASC LIMIT ?
      `,
        )
        .all(needed) as any[];
      const nextIds = [
        ...winners,
        ...waiting.map((row) => Number(row.playerId)),
      ];
      const marks = nextIds.map(() => "?").join(",");
      const nextPlayers = nextIds.length
        ? (db
            .prepare(`SELECT id, name FROM players WHERE id IN (${marks})`)
            .all(...nextIds) as any[])
        : [];
      const playerMap = new Map(
        nextPlayers.map((player) => [Number(player.id), player]),
      );

      return db.transaction(() => {
        let walletPaidTotal = 0;
        let debtAddedTotal = 0;
        const deviceIds: number[] = [];
        for (const session of sessions) {
          const result = chargeAndFinish(db, session, `CS group #${group.id}`);
          walletPaidTotal += result.walletPaid;
          debtAddedTotal += result.debtAdded;
          deviceIds.push(result.deviceId);
        }
        db.prepare(
          "UPDATE round_groups SET status = 'Finished', finishedAt = ? WHERE id = ?",
        ).run(nowIso(), group.id);

        let nextGroupId: number | null = null;
        const started: any[] = [];
        if (nextIds.length) {
          const nextTitle = `${group.title} - Next`;
          const nextResult = db
            .prepare(
              "INSERT INTO round_groups (title, fixedPrice, status) VALUES (?, ?, 'Running')",
            )
            .run(nextTitle, Number(group.fixedPrice));
          nextGroupId = Number(nextResult.lastInsertRowid);
          nextIds.forEach((playerId, index) => {
            const player = playerMap.get(playerId);
            if (!player || !deviceIds[index] || !nextGroupId) return;
            const sessionId = startSession(db, {
              groupId: nextGroupId,
              deviceId: deviceIds[index],
              playerId,
              playerName: player.name,
              title: nextTitle,
              fixedPrice: Number(group.fixedPrice),
            });
            started.push({ playerId, sessionId, deviceId: deviceIds[index] });
          });
          for (const row of waiting) {
            db.prepare(
              "UPDATE player_waiting_list SET status = 'Started', removedAt = ? WHERE id = ?",
            ).run(nowIso(), row.id);
          }
        }
        return {
          finishedSessions: sessions.length,
          walletPaidTotal,
          debtAddedTotal,
          nextGroupId,
          winners: winners.length,
          takenFromWaiting: waiting.length,
          started,
        };
      })();
    },
  );

  registerHandler("rounds:end-group", (_event, groupIdInput: number) => {
    requireStaff(db, "ROUNDS_END_GROUP");
    const groupId = Number(groupIdInput);
    const sessions = db
      .prepare(
        "SELECT * FROM sessions WHERE roundGroupId = ? AND status = 'Running'",
      )
      .all(groupId) as any[];
    return db.transaction(() => {
      let walletPaidTotal = 0;
      let debtAddedTotal = 0;
      for (const session of sessions) {
        const result = chargeAndFinish(db, session, `CS group #${groupId}`);
        walletPaidTotal += result.walletPaid;
        debtAddedTotal += result.debtAdded;
      }
      db.prepare(
        "UPDATE round_groups SET status = 'Finished', finishedAt = ? WHERE id = ?",
      ).run(nowIso(), groupId);
      return {
        finishedSessions: sessions.length,
        walletPaidTotal,
        debtAddedTotal,
      };
    })();
  });
}

