import http from "node:http";
import { registerStartSessionByMacUsername } from "./kioskStart";

function readJson(req: http.IncomingMessage) {
  return new Promise<any>((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function send(res: http.ServerResponse, status: number, body: any) {
  const payload = JSON.stringify(body ?? {});
  res.writeHead(status, {
    "content-type": "application/json",
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

export function startKioskServer(db: any) {
  const port = Number(process.env.NOXUS_KIOSK_PORT || 3939);
  const key = String(process.env.NOXUS_KIOSK_KEY || "CHANGE_ME").trim();

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

      if (req.url === "/api/kiosk/ping" && req.method === "GET") {
        send(res, 200, { ok: true, name: "noxus-kiosk-server" });
        return;
      }

      if (req.url === "/api/kiosk/start" && req.method === "POST") {
        const incomingKey = String(req.headers["x-noxus-key"] || "");
        if (!key || key === "CHANGE_ME") {
          send(res, 500, { ok: false, error: "Server key not configured" });
          return;
        }
        if (incomingKey !== key) {
          send(res, 401, { ok: false, error: "UNAUTHORIZED" });
          return;
        }

        const body = await readJson(req);
        const mac = normalizeMac(body.mac);
        const username = String(body.username || "").trim().replace(/^@/, "");

        const result = registerStartSessionByMacUsername(db, { mac, username });
        send(res, 200, { ok: true, ...result });
        return;
      }

      send(res, 404, { ok: false, error: "Not found" });
    } catch (e: any) {
      send(res, 500, { ok: false, error: String(e?.message || e) });
    }
  });

  server.listen(port, "0.0.0.0", () => {
    // eslint-disable-next-line no-console
    console.log(`Kiosk server listening on ${port}`);
  });
}