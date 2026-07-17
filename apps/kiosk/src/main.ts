import { app, BrowserWindow, ipcMain } from "electron";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

type KioskConfig = {
  managerUrl: string;
  kioskKey: string;
  fullscreen?: boolean;
};

function normalizeMac(mac: string) {
  return mac.trim().toUpperCase().replace(/-/g, ":");
}

function getPrimaryMac(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    const list = nets[name] || [];
    for (const n of list) {
      if (!n) continue;
      if (n.internal) continue;
      if (n.mac && n.mac !== "00:00:00:00:00:00") return normalizeMac(n.mac);
    }
  }
  return "";
}

function readConfig(): KioskConfig {
  // config.json يكون بجانب dist/main.js بعد build
  const configPath = path.join(process.cwd(), "config.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  const cfg = JSON.parse(raw);

  const managerUrl = String(cfg.managerUrl || "").trim();
  const kioskKey = String(cfg.kioskKey || "").trim();

  if (!managerUrl) throw new Error("config.json: managerUrl missing");
  if (!kioskKey) throw new Error("config.json: kioskKey missing");

  return {
    managerUrl,
    kioskKey,
    fullscreen: cfg.fullscreen !== false,
  };
}

async function startSession(username: string) {
  const cfg = readConfig();
  const mac = getPrimaryMac();

  if (!mac) throw new Error("MAC not found");
  if (!username.trim()) throw new Error("Username required");

  const res = await fetch(`${cfg.managerUrl}/api/kiosk/start`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-noxus-key": cfg.kioskKey,
    },
    body: JSON.stringify({ mac, username: username.trim() }),
  });

  const json = await res.json().catch(() => ({} as any));

  if (!res.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }

  return { ...json, mac, managerUrl: cfg.managerUrl };
}

function createWindow() {
  const cfg = readConfig();

  const win = new BrowserWindow({
    width: 900,
    height: 520,
    fullscreen: !!cfg.fullscreen,
    frame: false,
    alwaysOnTop: true,
    kiosk: true,
    backgroundColor: "#070a14",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "ui.html"));
}

ipcMain.handle("kiosk:info", async () => {
  const cfg = readConfig();
  return { mac: getPrimaryMac(), managerUrl: cfg.managerUrl };
});

ipcMain.handle("kiosk:start", async (_e, username: string) => {
  const result = await startSession(username);
  // success => close kiosk (return desktop)
  app.quit();
  return result;
});

app.whenReady().then(createWindow);