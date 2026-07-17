import { ipcMain } from "electron";
import { audit, requireStaff } from "./staff";

export type VipStatus = {
  playerId: number;
  storeSpent: number;
  sessionSpent: number;
  totalSpent: number;
  roundsPlayed: number;
  spendPoints: number;
  roundBonusPoints: number;
  points: number;
  manualVip: boolean;
  automaticVip: boolean;
  isVip: boolean;
  discountPercent: number;
};

type VipSettings = {
  spendPerPoint: number;
  roundPoints: number;
  autoVipThreshold: number;
  discountPercent: number;
};

function registerHandler(
  channel: string,
  handler: (...args: any[]) => any,
) {
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
      discountPercent REAL NOT NULL DEFAULT 15,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const settingColumns = db
    .prepare("PRAGMA table_info(vip_settings)")
    .all() as Array<{ name: string }>;

  const settingNames = new Set(
    settingColumns.map((column) => column.name),
  );

  if (!settingNames.has("discountPercent")) {
    db.exec(`
      ALTER TABLE vip_settings
      ADD COLUMN discountPercent REAL NOT NULL DEFAULT 15;
    `);
  }

  db.exec(`
    INSERT OR IGNORE INTO vip_settings
    (
      id,
      spendPerPoint,
      roundPoints,
      autoVipThreshold,
      discountPercent
    )
    VALUES (1, 100, 10, 100, 15);
  `);

  db.exec(`
    UPDATE vip_settings
    SET discountPercent = 15
    WHERE discountPercent IS NULL;
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS vip_overrides (
      playerId INTEGER PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (playerId)
        REFERENCES players(id)
        ON DELETE CASCADE
    );
  `);
}

function getSettings(db: any): VipSettings {
  ensureVipTables(db);

  const row = db
    .prepare(`
      SELECT
        spendPerPoint,
        roundPoints,
        autoVipThreshold,
        discountPercent
      FROM vip_settings
      WHERE id = 1
    `)
    .get() as VipSettings | undefined;

  return {
    spendPerPoint: Math.max(
      1,
      Number(row?.spendPerPoint || 100),
    ),

    roundPoints: Math.max(
      0,
      Number(row?.roundPoints || 10),
    ),

    autoVipThreshold: Math.max(
      0,
      Number(row?.autoVipThreshold || 100),
    ),

    discountPercent: Math.min(
      100,
      Math.max(
        0,
        Number(row?.discountPercent ?? 15),
      ),
    ),
  };
}

export function getVipStatus(
  db: any,
  playerIdInput: number,
): VipStatus {
  ensureVipTables(db);

  const playerId = Number(playerIdInput);
  const settings = getSettings(db);

  const player = db
    .prepare(`
      SELECT id
      FROM players
      WHERE id = ?
    `)
    .get(playerId);

  if (!player) {
    throw new Error("Player not found");
  }

  const storeResult = db
    .prepare(`
      SELECT
        COALESCE(SUM(total), 0) AS total
      FROM sales
      WHERE playerId = ?
        AND status = 'Completed'
    `)
    .get(playerId) as { total: number };

  const sessionResult = db
    .prepare(`
      SELECT
        COALESCE(SUM(CAST(totalPrice AS REAL)), 0) AS total
      FROM sessions
      WHERE playerId = ?
        AND status = 'Finished'
    `)
    .get(playerId) as { total: number };

  const roundsResult = db
    .prepare(`
      SELECT
        COUNT(*) AS total
      FROM sessions
      WHERE playerId = ?
        AND status = 'Finished'
        AND sessionType = 'round'
    `)
    .get(playerId) as { total: number };

  const manualResult = db
    .prepare(`
      SELECT enabled
      FROM vip_overrides
      WHERE playerId = ?
    `)
    .get(playerId) as
      | { enabled: number }
      | undefined;

  const storeSpent = Math.max(
    0,
    Number(storeResult.total || 0),
  );

  const sessionSpent = Math.max(
    0,
    Number(sessionResult.total || 0),
  );

  const totalSpent =
    storeSpent + sessionSpent;

  const roundsPlayed = Math.max(
    0,
    Number(roundsResult.total || 0),
  );

  const spendPoints = Math.floor(
    totalSpent / settings.spendPerPoint,
  );

  const roundBonusPoints =
    roundsPlayed * settings.roundPoints;

  const points =
    spendPoints + roundBonusPoints;

  const manualVip =
    Number(manualResult?.enabled || 0) === 1;

  const automaticVip =
    points >= settings.autoVipThreshold;

  return {
    playerId,
    storeSpent,
    sessionSpent,
    totalSpent,
    roundsPlayed,
    spendPoints,
    roundBonusPoints,
    points,
    manualVip,
    automaticVip,
    isVip: manualVip || automaticVip,
    discountPercent: settings.discountPercent,
  };
}

export function applyVipDiscount(
  db: any,
  playerId: number | null | undefined,
  basePriceInput: number,
) {
  const basePrice = Math.max(
    0,
    Number(basePriceInput || 0),
  );

  if (!playerId) {
    return {
      basePrice,
      total: Number(basePrice.toFixed(2)),
      discountAmount: 0,
      discountPercent: 0,
      isVip: false,
    };
  }

  const vip = getVipStatus(
    db,
    Number(playerId),
  );

  if (!vip.isVip) {
    return {
      basePrice,
      total: Number(basePrice.toFixed(2)),
      discountAmount: 0,
      discountPercent: 0,
      isVip: false,
    };
  }

  const discountAmount =
    basePrice *
    (vip.discountPercent / 100);

  const total =
    basePrice - discountAmount;

  return {
    basePrice: Number(basePrice.toFixed(2)),
    total: Number(total.toFixed(2)),
    discountAmount: Number(
      discountAmount.toFixed(2),
    ),
    discountPercent: vip.discountPercent,
    isVip: true,
  };
}

export function registerVipHandlers(db: any) {
  ensureVipTables(db);

  registerHandler(
    "vip:get-overview",
    () => {
      const settings = getSettings(db);

      const players = db
        .prepare(`
          SELECT id
          FROM players
          ORDER BY id DESC
        `)
        .all() as Array<{ id: number }>;

      return {
        settings,
        players: players.map((player) =>
          getVipStatus(db, player.id),
        ),
      };
    },
  );

  registerHandler(
    "vip:update-settings",
    (
      _event,
      data: {
        spendPerPoint: number;
        roundPoints: number;
        autoVipThreshold: number;
        discountPercent?: number;
      },
    ) => {
      requireStaff(
        db,
        "VIP_UPDATE_SETTINGS",
      );

      const current = getSettings(db);

      const spendPerPoint = Number(
        data.spendPerPoint,
      );

      const roundPoints = Number(
        data.roundPoints,
      );

      const autoVipThreshold = Number(
        data.autoVipThreshold,
      );

      const discountPercent =
        typeof data.discountPercent === "number"
          ? Number(data.discountPercent)
          : current.discountPercent;

      if (
        !Number.isFinite(spendPerPoint) ||
        spendPerPoint <= 0
      ) {
        throw new Error(
          "Invalid spend value",
        );
      }

      if (
        !Number.isFinite(roundPoints) ||
        roundPoints < 0
      ) {
        throw new Error(
          "Invalid round points",
        );
      }

      if (
        !Number.isFinite(
          autoVipThreshold,
        ) ||
        autoVipThreshold < 0
      ) {
        throw new Error(
          "Invalid VIP threshold",
        );
      }

      if (
        !Number.isFinite(
          discountPercent,
        ) ||
        discountPercent < 0 ||
        discountPercent > 100
      ) {
        throw new Error(
          "Invalid VIP discount",
        );
      }

      db.prepare(`
        UPDATE vip_settings
        SET
          spendPerPoint = ?,
          roundPoints = ?,
          autoVipThreshold = ?,
          discountPercent = ?,
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(
        spendPerPoint,
        roundPoints,
        autoVipThreshold,
        discountPercent,
      );

      return {
        spendPerPoint,
        roundPoints,
        autoVipThreshold,
        discountPercent,
      };
    },
  );

  registerHandler(
    "vip:set-manual",
    (
      _event,
      data: {
        playerId: number;
        enabled: boolean;
      },
    ) => {
      requireStaff(
        db,
        "VIP_SET_MANUAL",
      );

      const playerId = Number(
        data.playerId,
      );

      const player = db
        .prepare(`
          SELECT id
          FROM players
          WHERE id = ?
        `)
        .get(playerId);

      if (!player) {
        throw new Error(
          "Player not found",
        );
      }

      if (data.enabled) {
        db.prepare(`
          INSERT INTO vip_overrides
          (
            playerId,
            enabled
          )
          VALUES (?, 1)

          ON CONFLICT(playerId)
          DO UPDATE SET
            enabled = 1,
            updatedAt = CURRENT_TIMESTAMP
        `).run(playerId);
      } else {
        db.prepare(`
          DELETE FROM vip_overrides
          WHERE playerId = ?
        `).run(playerId);
      }

      audit(db, {
        action: data.enabled
          ? "VIP_MANUAL_ENABLED"
          : "VIP_MANUAL_DISABLED",

        entity: "players",
        entityId: playerId,
      });

      return getVipStatus(
        db,
        playerId,
      );
    },
  );
}
