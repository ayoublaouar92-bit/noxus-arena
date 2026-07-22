import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
import db from "./database";

import { requireAdmin, audit } from "./staff";

type AddDeviceData = {
  name: string;
  type: string;
  ip?: string;
  mac?: string;
  price: string;
};

type UpdateDeviceData = {
  deviceId: number;
  name: string;
  type: string;
  ip?: string;
  mac?: string;
  price: string;
  status?: "Available" | "Busy";
};

type StartSessionData = {
  deviceId: number;
  customerName?: string;
};

type AddPlayerData = {
  name: string;
  username: string;
  phone?: string;
  balance?: number;
  image?: string;
};

type DeviceRow = {
  id: number;
  name: string;
  type: string;
  ip: string | null;
  mac: string | null;
  price: string;
  status: string;
};

type SessionRow = {
  id: number;
  deviceId: number;
  customerName: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  totalPrice: string;
  status: string;
};

let mainWindow: BrowserWindow | null = null;

function normalizeMac(input: string) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, ":");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#050711",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.focus();
    }, 300);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

/*
|--------------------------------------------------------------------------
| Focus fix
|--------------------------------------------------------------------------
*/
ipcMain.on("renderer:request-focus", () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.focus();
  mainWindow.webContents.focus();
});

/*
|--------------------------------------------------------------------------
| Devices
|--------------------------------------------------------------------------
*/

ipcMain.handle("get-devices", () => {
  return db.prepare(`SELECT * FROM devices ORDER BY id DESC`).all();
});

ipcMain.handle("add-device", (_event, device: AddDeviceData) => {
  requireAdmin(db, "DEVICES_ADD");

  const name = device.name?.trim();
  const type = device.type?.trim();

  if (!name) throw new Error("Device name is required");
  if (!type) throw new Error("Device type is required");

  const ip = device.ip?.trim() || "";
  const mac = normalizeMac(device.mac || "");
  const price = String(device.price || "0");

  const result = db
    .prepare(
      `INSERT INTO devices (name, type, ip, mac, price, status)
       VALUES (@name, @type, @ip, @mac, @price, 'Available')`
    )
    .run({ name, type, ip, mac, price });

  audit(db, {
    action: "DEVICE_ADDED",
    entity: "devices",
    entityId: Number(result.lastInsertRowid),
    details: JSON.stringify({ name, type, ip, mac, price }),
  });

  return { id: Number(result.lastInsertRowid), changes: result.changes };
});

ipcMain.handle("update-device", (_event, data: UpdateDeviceData) => {
  requireAdmin(db, "DEVICES_UPDATE");

  const deviceId = Number(data.deviceId);
  if (!deviceId) throw new Error("Device ID is required");

  const existing = db
    .prepare(`SELECT * FROM devices WHERE id = ?`)
    .get(deviceId) as DeviceRow | undefined;

  if (!existing) throw new Error("Device not found");

  const name = String(data.name || "").trim();
  const type = String(data.type || "").trim();

  if (!name) throw new Error("Device name is required");
  if (!type) throw new Error("Device type is required");

  const ip = String(data.ip || "").trim();
  const mac = normalizeMac(String(data.mac || ""));
  const price = String(data.price || "0");

  let status = data.status ? String(data.status) : existing.status;

  if (status === "Available" && existing.status === "Busy") {
    const running = db
      .prepare(
        `SELECT COUNT(*) AS total FROM sessions WHERE deviceId = ? AND status = 'Running'`
      )
      .get(deviceId) as { total: number };

    if (Number(running.total) > 0) {
      throw new Error("Device has an active session");
    }
  }

  if (status !== "Available" && status !== "Busy") status = existing.status;

  db.prepare(
    `UPDATE devices SET name = ?, type = ?, ip = ?, mac = ?, price = ?, status = ? WHERE id = ?`
  ).run(name, type, ip, mac, price, status, deviceId);

  audit(db, {
    action: "DEVICE_UPDATED",
    entity: "devices",
    entityId: deviceId,
    details: JSON.stringify({ name, type, ip, mac, price, status }),
  });

  return { changes: 1 };
});

ipcMain.handle("delete-device", (_event, deviceId: number) => {
  requireAdmin(db, "DEVICES_DELETE");

  const id = Number(deviceId);
  if (!id) throw new Error("Device ID is required");

  const row = db
    .prepare(`SELECT * FROM devices WHERE id = ?`)
    .get(id) as DeviceRow | undefined;

  if (!row) throw new Error("Device not found");

  const result = db.prepare(`DELETE FROM devices WHERE id = ?`).run(id);

  audit(db, {
    action: "DEVICE_DELETED",
    entity: "devices",
    entityId: id,
    details: JSON.stringify({ name: row.name, ip: row.ip, mac: row.mac }),
  });

  return { changes: result.changes };
});

/*
|--------------------------------------------------------------------------
| Sessions (legacy)
|--------------------------------------------------------------------------
*/

ipcMain.handle("start-session", (_event, data: StartSessionData) => {
  if (!data.deviceId) throw new Error("Device is required");

  const device = db
    .prepare(`SELECT * FROM devices WHERE id = ?`)
    .get(data.deviceId) as DeviceRow | undefined;

  if (!device) throw new Error("Device not found");
  if (device.status === "Busy")
    throw new Error("Device already has an active session");

  const startTime = new Date().toISOString();

  const startTransaction = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO sessions (deviceId, customerName, startTime, status)
         VALUES (?, ?, ?, 'Running')`
      )
      .run(data.deviceId, data.customerName?.trim() || "Guest", startTime);

    db.prepare(`UPDATE devices SET status = 'Busy' WHERE id = ?`).run(
      data.deviceId
    );

    return result;
  });

  const result = startTransaction();

  return {
    id: Number(result.lastInsertRowid),
    startTime,
    changes: result.changes,
  };
});

ipcMain.handle("get-active-sessions", () => {
  return db
    .prepare(
      `SELECT sessions.*, devices.name AS deviceName, devices.type AS deviceType, devices.price AS hourlyPrice
       FROM sessions
       INNER JOIN devices ON devices.id = sessions.deviceId
       WHERE sessions.status = 'Running'
       ORDER BY sessions.id DESC`
    )
    .all();
});

ipcMain.handle("end-session", (_event, sessionId: number) => {
  if (!sessionId) throw new Error("Session ID is required");

  const session = db
    .prepare(`SELECT * FROM sessions WHERE id = ?`)
    .get(sessionId) as SessionRow | undefined;

  if (!session) throw new Error("Session not found");
  if (session.status !== "Running")
    throw new Error("Session is already finished");

  const device = db
    .prepare(`SELECT * FROM devices WHERE id = ?`)
    .get(session.deviceId) as DeviceRow | undefined;

  if (!device) throw new Error("Session device not found");

  const endTime = new Date();
  const startTime = new Date(session.startTime);

  const minutes = Math.max(
    1,
    Math.ceil((endTime.getTime() - startTime.getTime()) / 60000)
  );
  const total = ((minutes / 60) * Number(device.price || 0)).toFixed(2);

  const endTransaction = db.transaction(() => {
    db.prepare(
      `UPDATE sessions SET endTime = ?, duration = ?, totalPrice = ?, status = 'Finished' WHERE id = ?`
    ).run(endTime.toISOString(), minutes, total, sessionId);

    db.prepare(`UPDATE devices SET status = 'Available' WHERE id = ?`).run(
      session.deviceId
    );
  });

  endTransaction();

  return { minutes, total, endTime: endTime.toISOString() };
});

/*
|--------------------------------------------------------------------------
| Players (legacy)
|--------------------------------------------------------------------------
*/

ipcMain.handle("get-players", () => {
  return db.prepare(`SELECT * FROM players ORDER BY id DESC`).all();
});

ipcMain.handle("add-player", (_event, player: AddPlayerData) => {
  const name = player.name?.trim();
  const username = player.username?.trim().replace(/^@/, "");

  if (!name) throw new Error("Player name is required");
  if (!username) throw new Error("Player username is required");

  const existingPlayer = db
    .prepare(`SELECT id FROM players WHERE LOWER(username) = LOWER(?)`)
    .get(username);

  if (existingPlayer) throw new Error("Username already exists");

  const result = db
    .prepare(
      `INSERT INTO players (name, username, phone, balance, image)
       VALUES (@name, @username, @phone, @balance, @image)`
    )
    .run({
      name,
      username,
      phone: player.phone?.trim() || "",
      balance: Number(player.balance || 0),
      image: player.image || "",
    });

  return { id: Number(result.lastInsertRowid), changes: result.changes };
});

ipcMain.handle("delete-player", (_event, playerId: number) => {
  if (!playerId) throw new Error("Player ID is required");

  const result = db.prepare(`DELETE FROM players WHERE id = ?`).run(playerId);
  return { changes: result.changes };
});

/*
|--------------------------------------------------------------------------
| Application
|--------------------------------------------------------------------------
*/

app.whenReady().then(() => {
  console.log("Database connected");

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});