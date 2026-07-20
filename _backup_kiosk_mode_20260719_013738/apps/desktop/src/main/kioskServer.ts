import { app } from "electron";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { registerStartSessionByMacUsername } from "./kioskStart";

function readJson(req: http.IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 64 * 1024) reject(new Error("Request too large"));
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function send(res: http.ServerResponse, status: number, body: any) {
  const payload = JSON.stringify(body ?? {});
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-noxus-key",
  });
  res.end(payload);
}

function normalizeMac(mac: string) {
  return String(mac || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, ":");
}

function validMac(mac: string) {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);
}

function loadServerKey() {
  const envKey = String(process.env.NOXUS_KIOSK_KEY || "").trim();
  if (envKey && envKey !== "CHANGE_ME") return envKey;

  const keyPath = path.join(app.getPath("userData"), "kiosk-server-key.txt");
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });

  if (fs.existsSync(keyPath)) {
    const storedKey = fs.readFileSync(keyPath, "utf8").trim();
    if (storedKey) return storedKey;
  }

  const generatedKey = randomBytes(36).toString("base64url");
  fs.writeFileSync(keyPath, `${generatedKey}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`Kiosk server key created at ${keyPath}`);
  return generatedKey;
}

function loadDeviceStatus(db: any, mac: string) {
  const device = db
    .prepare(
      `SELECT id, name, type, ip, mac, status
       FROM devices
       WHERE REPLACE(UPPER(mac), '-', ':') = ?
       LIMIT 1`,
    )
    .get(mac) as
    | {
        id: number;
        name: string;
        type: string;
        ip: string | null;
        mac: string | null;
        status: string;
      }
    | undefined;

  if (!device) return { registered: false, active: false, device: null, session: null };

  const session = db
    .prepare(
      `SELECT id, playerId, customerName, startTime, status
       FROM sessions
       WHERE deviceId = ? AND status IN ('Running', 'Paused')
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(device.id) as
    | {
        id: number;
        playerId: number | null;
        customerName: string;
        startTime: string;
        status: string;
      }
    | undefined;

  return {
    registered: true,
    active: Boolean(session),
    device,
    session: session || null,
  };
}

export function startKioskServer(db: any) {
  const port = Number(process.env.NOXUS_KIOSK_PORT || 3939);
  const key = loadServerKey();

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST,GET,OPTIONS",
          "access-control-allow-headers": "content-type,x-noxus-key",
        });
        res.end();
        return;
      }

      const requestUrl = new URL(req.url || "/", "http://localhost");

      if (requestUrl.pathname === "/api/kiosk/ping" && req.method === "GET") {
        send(res, 200, {
          ok: true,
          name: "noxus-kiosk-server",
          version: 2,
          time: new Date().toISOString(),
        });
        return;
      }

      const incomingKey = String(req.headers["x-noxus-key"] || "");
      if (!key || incomingKey !== key) {
        send(res, 401, { ok: false, error: "UNAUTHORIZED" });
        return;
      }

      if (requestUrl.pathname === "/api/kiosk/status" && req.method === "GET") {
        const mac = normalizeMac(requestUrl.searchParams.get("mac") || "");
        if (!validMac(mac)) {
          send(res, 400, { ok: false, error: "INVALID_MAC" });
          return;
        }

        send(res, 200, { ok: true, mac, ...loadDeviceStatus(db, mac) });
        return;
      }

      if (requestUrl.pathname === "/api/kiosk/start" && req.method === "POST") {
        const body = await readJson(req);
        const mac = normalizeMac(body.mac);
        const username = String(body.username || "").trim().replace(/^@/, "");

        if (!validMac(mac)) {
          send(res, 400, { ok: false, error: "INVALID_MAC" });
          return;
        }

        const result = registerStartSessionByMacUsername(db, { mac, username });
        send(res, 200, { ok: true, ...result });
        return;
      }

      send(res, 404, { ok: false, error: "NOT_FOUND" });
    } catch (error: any) {
      send(res, 500, { ok: false, error: String(error?.message || error) });
    }
  });

  server.on("error", (error) => {
    console.error("Kiosk server error", error);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Kiosk server listening on 0.0.0.0:${port}`);
  });

  return server;
}
