import { ipcMain } from "electron";
import { requireAdmin, audit } from "./staff";

type RoundingMode = "minute" | "quarter_hour" | "hour";

type AppSettings = {
  currency: string;
  roundingMode: RoundingMode;
  minimumMinutes: number;
  defaultGuestPayment: "cash" | "debt";
};

const DEFAULT_SETTINGS: AppSettings = {
  currency: "DA",
  roundingMode: "minute",
  minimumMinutes: 1,
  defaultGuestPayment: "cash",
};

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function clampInt(value: unknown, min: number, max: number) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function ensureSettingsTable(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getSetting(db: any, key: string) {
  ensureSettingsTable(db);
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(db: any, key: string, value: string) {
  ensureSettingsTable(db);
  db.prepare(
    `
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
  ).run(key, value);
}

export function getAllSettings(db: any): AppSettings {
  const currency = getSetting(db, "currency") ?? DEFAULT_SETTINGS.currency;

  const roundingModeRaw = getSetting(db, "roundingMode") ?? DEFAULT_SETTINGS.roundingMode;
  const roundingMode: RoundingMode =
    roundingModeRaw === "minute" || roundingModeRaw === "quarter_hour" || roundingModeRaw === "hour"
      ? roundingModeRaw
      : DEFAULT_SETTINGS.roundingMode;

  const minimumMinutes = clampInt(getSetting(db, "minimumMinutes") ?? DEFAULT_SETTINGS.minimumMinutes, 1, 240);

  const defaultGuestPaymentRaw =
    getSetting(db, "defaultGuestPayment") ?? DEFAULT_SETTINGS.defaultGuestPayment;

  const defaultGuestPayment: "cash" | "debt" =
    defaultGuestPaymentRaw === "cash" || defaultGuestPaymentRaw === "debt"
      ? defaultGuestPaymentRaw
      : DEFAULT_SETTINGS.defaultGuestPayment;

  return { currency, roundingMode, minimumMinutes, defaultGuestPayment };
}

export function registerSettingsHandlers(db: any) {
  ensureSettingsTable(db);

  registerHandler("settings:get", () => {
    return getAllSettings(db);
  });

  registerHandler("settings:update", (_event, updates: Partial<AppSettings>) => {
    // Admin only
    requireAdmin(db, "SETTINGS_UPDATE");

    const current = getAllSettings(db);

    const next: AppSettings = {
      currency: typeof updates.currency === "string" && updates.currency.trim() ? updates.currency.trim() : current.currency,

      roundingMode:
        updates.roundingMode === "minute" || updates.roundingMode === "quarter_hour" || updates.roundingMode === "hour"
          ? updates.roundingMode
          : current.roundingMode,

      minimumMinutes: typeof updates.minimumMinutes !== "undefined" ? clampInt(updates.minimumMinutes, 1, 240) : current.minimumMinutes,

      defaultGuestPayment:
        updates.defaultGuestPayment === "cash" || updates.defaultGuestPayment === "debt"
          ? updates.defaultGuestPayment
          : current.defaultGuestPayment,
    };

    setSetting(db, "currency", next.currency);
    setSetting(db, "roundingMode", next.roundingMode);
    setSetting(db, "minimumMinutes", String(next.minimumMinutes));
    setSetting(db, "defaultGuestPayment", next.defaultGuestPayment);

    audit(db, { action: "SETTINGS_UPDATED", entity: "app_settings", details: JSON.stringify(next) });

    return next;
  });
}