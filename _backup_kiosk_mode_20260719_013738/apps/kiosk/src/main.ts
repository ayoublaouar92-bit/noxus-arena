import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type KioskConfig = {
  managerUrl: string;
  kioskKey: string;
  expectedMac: string;
  deviceName: string;
  fullscreen?: boolean;
  pollIntervalMs?: number;
};

type KioskStatus = {
  ok: boolean;
  registered: boolean;
  active: boolean;
  device?: { id: number; name: string; status: string } | null;
  session?: { id: number; customerName: string; startTime: string; status: string } | null;
};

let mainWindow: BrowserWindow | null = null;
let currentConfig: KioskConfig;
let pollTimer: NodeJS.Timeout | null = null;
let quitting = false;
let sessionWasActive = false;

function normalizeMac(mac: string) {
  return String(mac || "").trim().toUpperCase().replace(/-/g, ":");
}

function validMac(mac: string) {
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac);
}

function getAvailableMacs() {
  const result = new Set<string>();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || !entry.mac) continue;
      const mac = normalizeMac(entry.mac);
      if (validMac(mac) && mac !== "00:00:00:00:00:00") result.add(mac);
    }
  }
  return [...result];
}

function findConfigPath() {
  const candidates = [
    process.env.NOXUS_KIOSK_CONFIG,
    path.join(process.cwd(), "config.json"),
    path.join(__dirname, "config.json"),
    path.join(path.dirname(app.getPath("exe")), "config.json"),
    path.join(path.dirname(app.getPath("exe")), "..", "app", "config.json"),
  ].filter(Boolean) as string[];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("KIOSK_CONFIG_NOT_FOUND");
  return found;
}

function readConfig(): KioskConfig {
  const configText = fs
    .readFileSync(findConfigPath(), "utf8")
    .replace(/^\uFEFF/, "");
  const raw = JSON.parse(configText);
  const managerUrl = String(raw.managerUrl || "").trim().replace(/\/$/, "");
  const kioskKey = String(raw.kioskKey || "").trim();
  const expectedMac = normalizeMac(raw.expectedMac || "");
  const deviceName = String(raw.deviceName || "Kiosk").trim();

  if (!managerUrl) throw new Error("MANAGER_URL_MISSING");
  if (!kioskKey) throw new Error("KIOSK_KEY_MISSING");
  if (!validMac(expectedMac)) throw new Error("EXPECTED_MAC_INVALID");

  return {
    managerUrl,
    kioskKey,
    expectedMac,
    deviceName,
    fullscreen: raw.fullscreen !== false,
    pollIntervalMs: Math.max(2000, Number(raw.pollIntervalMs || 3000)),
  };
}

function resolveMac() {
  const availableMacs = getAvailableMacs();
  if (!availableMacs.includes(currentConfig.expectedMac)) {
    throw new Error(`MAC_MISMATCH:${currentConfig.expectedMac}:${availableMacs.join(",")}`);
  }
  return currentConfig.expectedMac;
}

async function requestJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-noxus-key": currentConfig.kioskKey,
        ...(init.headers || {}),
      },
    });
    const json = await response.json().catch(() => ({} as any));
    if (!response.ok || json.ok === false) {
      throw new Error(json.error || `HTTP_${response.status}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function getStatus(): Promise<KioskStatus> {
  const mac = resolveMac();
  return requestJson(
    `${currentConfig.managerUrl}/api/kiosk/status?mac=${encodeURIComponent(mac)}`,
    { method: "GET" },
  );
}

async function startSession(username: string) {
  const mac = resolveMac();
  if (!username.trim()) throw new Error("USERNAME_REQUIRED");
  return requestJson(`${currentConfig.managerUrl}/api/kiosk/start`, {
    method: "POST",
    body: JSON.stringify({ mac, username: username.trim() }),
  });
}

function showLockScreen() {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(Boolean(currentConfig.fullscreen), "screen-saver");
  win.setKiosk(Boolean(currentConfig.fullscreen));
  if (!win.isVisible()) win.show();
  win.focus();
}

function unlockDesktop() {
  const win = mainWindow;
  if (!win || win.isDestroyed()) return;
  win.setKiosk(false);
  win.setAlwaysOnTop(false);
  win.hide();
}

async function refreshStatus() {
  try {
    const status = await getStatus();
    sessionWasActive = Boolean(status.active);
    if (status.active) unlockDesktop();
    else showLockScreen();
    return { ...status, online: true, mac: currentConfig.expectedMac };
  } catch (error: any) {
    if (!sessionWasActive) showLockScreen();
    return {
      ok: false,
      online: false,
      active: sessionWasActive,
      registered: false,
      mac: currentConfig.expectedMac,
      error: String(error?.message || error),
    };
  }
}

function blockEscapeShortcuts(win: BrowserWindow) {
  win.webContents.on("before-input-event", (event, input) => {
    const key = input.key.toLowerCase();
    const blocked =
      key === "f11" ||
      key === "f12" ||
      (input.alt && key === "f4") ||
      (input.control && key === "r") ||
      (input.control && input.shift && ["i", "j", "c"].includes(key));
    if (blocked) event.preventDefault();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 560,
    fullscreen: Boolean(currentConfig.fullscreen),
    frame: !currentConfig.fullscreen,
    alwaysOnTop: Boolean(currentConfig.fullscreen),
    kiosk: Boolean(currentConfig.fullscreen),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#11142a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
    },
  });

  blockEscapeShortcuts(mainWindow);
  mainWindow.loadFile(path.join(__dirname, "ui.html"));
  mainWindow.once("ready-to-show", () => void refreshStatus());
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      showLockScreen();
    }
  });
}

ipcMain.handle("kiosk:info", async () => ({
  ...(await refreshStatus()),
  deviceName: currentConfig.deviceName,
  managerUrl: currentConfig.managerUrl,
  expectedMac: currentConfig.expectedMac,
  availableMacs: getAvailableMacs(),
}));

ipcMain.handle("kiosk:start", async (_event, username: string) => {
  const result = await startSession(username);
  sessionWasActive = true;
  setTimeout(unlockDesktop, 350);
  return result;
});

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on("second-instance", () => showLockScreen());
  app.whenReady().then(() => {
    currentConfig = readConfig();
    createWindow();
    pollTimer = setInterval(() => void refreshStatus(), currentConfig.pollIntervalMs);
  });
}

app.on("before-quit", () => {
  quitting = true;
  if (pollTimer) clearInterval(pollTimer);
});

app.on("window-all-closed", (event: any) => event?.preventDefault?.());
