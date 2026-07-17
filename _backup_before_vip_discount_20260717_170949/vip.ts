import { ipcMain } from "electron";
import { audit, requireStaff } from "./staff";

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function ensureVipTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vip_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      spendPerPoint REAL NOT NULL DEFAULT 100,
      roundPoints REAL NOT NULL DEFAULT 10,
      autoVipThreshold REAL NOT NULL DEFAULT 100,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO vip_settings
      (id, spendPerPoint, roundPoints, autoVipThreshold)
    VALUES (1, 100, 10, 100);

    CREATE TABLE IF NOT EXISTS vip_overrides (
      playerId INTEGER PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE
    );
  `);
}

export function registerVipHandlers(db: any) {
  ensureVipTables(db);

  registerHandler("vip:get-overview", () => {
    const settings = db
      .prepare("SELECT * FROM vip_settings WHERE id = 1")
      .get() as any;
    const spendPerPoint = Math.max(1, Number(settings.spendPerPoint || 100));
    const roundPoints = Math.max(0, Number(settings.roundPoints || 10));
    const threshold = Math.max(0, Number(settings.autoVipThreshold || 100));

    const players = db
      .prepare(
        `
        SELECT
          p.id AS playerId,
          COALESCE((
            SELECT SUM(s.total)
            FROM sales s
            WHERE s.playerId = p.id AND s.status = 'Completed'
          ), 0) AS storeSpent,
          COALESCE((
            SELECT COUNT(*)
            FROM sessions se
            WHERE se.playerId = p.id
              AND se.sessionType = 'round'
              AND se.status = 'Finished'
          ), 0) AS roundsPlayed,
          COALESCE((SELECT enabled FROM vip_overrides v WHERE v.playerId = p.id), 0) AS manualVip
        FROM players p
        ORDER BY p.id DESC
      `,
      )
      .all() as Array<any>;

    const rows = players.map((row) => {
      const storeSpent = Number(row.storeSpent || 0);
      const roundsPlayed = Number(row.roundsPlayed || 0);
      const spendPoints = Math.floor(storeSpent / spendPerPoint);
      const points = spendPoints + roundsPlayed * roundPoints;
      const automaticVip = points >= threshold;
      const manualVip = Number(row.manualVip || 0) === 1;
      return {
        playerId: Number(row.playerId),
        storeSpent,
        roundsPlayed,
        spendPoints,
        points,
        automaticVip,
        manualVip,
        isVip: automaticVip || manualVip,
      };
    });

    return {
      settings: { spendPerPoint, roundPoints, autoVipThreshold: threshold },
      players: rows,
    };
  });

  registerHandler(
    "vip:update-settings",
    (
      _event,
      data: {
        spendPerPoint: number;
        roundPoints: number;
        autoVipThreshold: number;
      },
    ) => {
      requireStaff(db, "VIP_UPDATE_SETTINGS");
      const spendPerPoint = Number(data.spendPerPoint);
      const roundPoints = Number(data.roundPoints);
      const threshold = Number(data.autoVipThreshold);
      if (!Number.isFinite(spendPerPoint) || spendPerPoint <= 0)
        throw new Error("Invalid spend value");
      if (!Number.isFinite(roundPoints) || roundPoints < 0)
        throw new Error("Invalid round points");
      if (!Number.isFinite(threshold) || threshold < 0)
        throw new Error("Invalid VIP threshold");

      db.prepare(
        `
        UPDATE vip_settings
        SET spendPerPoint = ?, roundPoints = ?, autoVipThreshold = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = 1
      `,
      ).run(spendPerPoint, roundPoints, threshold);
      return { spendPerPoint, roundPoints, autoVipThreshold: threshold };
    },
  );

  registerHandler(
    "vip:set-manual",
    (_event, data: { playerId: number; enabled: boolean }) => {
      requireStaff(db, "VIP_SET_MANUAL");
      const playerId = Number(data.playerId);
      const player = db
        .prepare("SELECT id FROM players WHERE id = ?")
        .get(playerId);
      if (!player) throw new Error("Player not found");

      if (data.enabled) {
        db.prepare(
          `
          INSERT INTO vip_overrides (playerId, enabled)
          VALUES (?, 1)
          ON CONFLICT(playerId) DO UPDATE SET enabled = 1, updatedAt = CURRENT_TIMESTAMP
        `,
        ).run(playerId);
      } else {
        db.prepare("DELETE FROM vip_overrides WHERE playerId = ?").run(
          playerId,
        );
      }

      audit(db, {
        action: data.enabled ? "VIP_MANUAL_ENABLED" : "VIP_MANUAL_DISABLED",
        entity: "players",
        entityId: playerId,
      });
      return { playerId, enabled: Boolean(data.enabled) };
    },
  );
}
