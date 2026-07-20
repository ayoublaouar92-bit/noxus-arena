import { ipcMain } from "electron";
import { audit, requireStaff } from "./staff";
import { getSetting, setSetting } from "./settings";

const KIOSK_MODE_KEY = "kioskModeEnabled";

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

export function getKioskMode(db: any) {
  return getSetting(db, KIOSK_MODE_KEY) !== "off";
}

export function registerKioskControlHandlers(db: any) {
  registerHandler("kiosk:get-mode", () => ({ enabled: getKioskMode(db) }));

  registerHandler(
    "kiosk:set-mode",
    (_event, data: { enabled?: boolean; force?: boolean } = {}) => {
      const staffUserId = requireStaff(db, "KIOSK_MODE_CHANGE");
      const enabled = Boolean(data.enabled);
      const force = Boolean(data.force);

      const activeSessions = Number(
        (
          db
            .prepare(
              `SELECT COUNT(*) AS total FROM sessions WHERE status IN ('Running', 'Paused')`,
            )
            .get() as { total: number }
        ).total,
      );

      if (!enabled && activeSessions > 0 && !force) {
        throw new Error(`KIOSK_ACTIVE_SESSIONS:${activeSessions}`);
      }

      setSetting(db, KIOSK_MODE_KEY, enabled ? "on" : "off");
      audit(db, {
        action: enabled ? "KIOSK_MODE_ENABLED" : "KIOSK_MODE_DISABLED",
        entity: "kiosk_mode",
        details: JSON.stringify({
          enabled,
          force,
          activeSessions,
          staffUserId,
        }),
      });

      return { enabled, activeSessions };
    },
  );
}
