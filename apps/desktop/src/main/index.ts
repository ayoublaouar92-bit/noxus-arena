import {
  app,
  BrowserWindow,
  ipcMain,
} from "electron";

import { join } from "node:path";
import db from "./database";

type AddDeviceData = {
  name: string;
  type: string;
  ip?: string;
  mac?: string;
  price: string;
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#050711",
    show: false,

    webPreferences: {
      preload: join(
        __dirname,
        "../preload/index.cjs"
      ),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(
      process.env.ELECTRON_RENDERER_URL
    );
  } else {
    void mainWindow.loadFile(
      join(
        __dirname,
        "../renderer/index.html"
      )
    );
  }
}

/*
|--------------------------------------------------------------------------
| Devices
|--------------------------------------------------------------------------
*/

ipcMain.handle("get-devices", () => {
  return db
    .prepare(
      `
        SELECT *
        FROM devices
        ORDER BY id DESC
      `
    )
    .all();
});

ipcMain.handle(
  "add-device",
  (_event, device: AddDeviceData) => {
    const name = device.name?.trim();
    const type = device.type?.trim();

    if (!name) {
      throw new Error(
        "Device name is required"
      );
    }

    if (!type) {
      throw new Error(
        "Device type is required"
      );
    }

    const result = db
      .prepare(
        `
          INSERT INTO devices
          (
            name,
            type,
            ip,
            mac,
            price,
            status
          )
          VALUES
          (
            @name,
            @type,
            @ip,
            @mac,
            @price,
            'Available'
          )
        `
      )
      .run({
        name,
        type,
        ip: device.ip?.trim() || "",
        mac: device.mac?.trim() || "",
        price: String(device.price || "0"),
      });

    return {
      id: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }
);

/*
|--------------------------------------------------------------------------
| Sessions
|--------------------------------------------------------------------------
*/

ipcMain.handle(
  "start-session",
  (_event, data: StartSessionData) => {
    if (!data.deviceId) {
      throw new Error(
        "Device is required"
      );
    }

    const device = db
      .prepare(
        `
          SELECT *
          FROM devices
          WHERE id = ?
        `
      )
      .get(data.deviceId) as
      | DeviceRow
      | undefined;

    if (!device) {
      throw new Error(
        "Device not found"
      );
    }

    if (device.status === "Busy") {
      throw new Error(
        "Device already has an active session"
      );
    }

    const startTime =
      new Date().toISOString();

    const startTransaction =
      db.transaction(() => {
        const result = db
          .prepare(
            `
              INSERT INTO sessions
              (
                deviceId,
                customerName,
                startTime,
                status
              )
              VALUES
              (
                ?,
                ?,
                ?,
                'Running'
              )
            `
          )
          .run(
            data.deviceId,
            data.customerName?.trim() ||
              "Guest",
            startTime
          );

        db.prepare(
          `
            UPDATE devices
            SET status = 'Busy'
            WHERE id = ?
          `
        ).run(data.deviceId);

        return result;
      });

    const result = startTransaction();

    return {
      id: Number(result.lastInsertRowid),
      startTime,
      changes: result.changes,
    };
  }
);

ipcMain.handle(
  "get-active-sessions",
  () => {
    return db
      .prepare(
        `
          SELECT
            sessions.*,
            devices.name AS deviceName,
            devices.type AS deviceType,
            devices.price AS hourlyPrice
          FROM sessions
          INNER JOIN devices
            ON devices.id = sessions.deviceId
          WHERE sessions.status = 'Running'
          ORDER BY sessions.id DESC
        `
      )
      .all();
  }
);

ipcMain.handle(
  "end-session",
  (_event, sessionId: number) => {
    if (!sessionId) {
      throw new Error(
        "Session ID is required"
      );
    }

    const session = db
      .prepare(
        `
          SELECT *
          FROM sessions
          WHERE id = ?
        `
      )
      .get(sessionId) as
      | SessionRow
      | undefined;

    if (!session) {
      throw new Error(
        "Session not found"
      );
    }

    if (session.status !== "Running") {
      throw new Error(
        "Session is already finished"
      );
    }

    const device = db
      .prepare(
        `
          SELECT *
          FROM devices
          WHERE id = ?
        `
      )
      .get(session.deviceId) as
      | DeviceRow
      | undefined;

    if (!device) {
      throw new Error(
        "Session device not found"
      );
    }

    const endTime = new Date();

    const startTime = new Date(
      session.startTime
    );

    const minutes = Math.max(
      1,
      Math.ceil(
        (endTime.getTime() -
          startTime.getTime()) /
          60000
      )
    );

    const total = (
      (minutes / 60) *
      Number(device.price || 0)
    ).toFixed(2);

    const endTransaction =
      db.transaction(() => {
        db.prepare(
          `
            UPDATE sessions
            SET
              endTime = ?,
              duration = ?,
              totalPrice = ?,
              status = 'Finished'
            WHERE id = ?
          `
        ).run(
          endTime.toISOString(),
          minutes,
          total,
          sessionId
        );

        db.prepare(
          `
            UPDATE devices
            SET status = 'Available'
            WHERE id = ?
          `
        ).run(session.deviceId);
      });

    endTransaction();

    return {
      minutes,
      total,
      endTime: endTime.toISOString(),
    };
  }
);

/*
|--------------------------------------------------------------------------
| Players
|--------------------------------------------------------------------------
*/

ipcMain.handle("get-players", () => {
  return db
    .prepare(
      `
        SELECT *
        FROM players
        ORDER BY id DESC
      `
    )
    .all();
});

ipcMain.handle(
  "add-player",
  (_event, player: AddPlayerData) => {
    const name = player.name?.trim();

    const username = player.username
      ?.trim()
      .replace(/^@/, "");

    if (!name) {
      throw new Error(
        "Player name is required"
      );
    }

    if (!username) {
      throw new Error(
        "Player username is required"
      );
    }

    const existingPlayer = db
      .prepare(
        `
          SELECT id
          FROM players
          WHERE LOWER(username) = LOWER(?)
        `
      )
      .get(username);

    if (existingPlayer) {
      throw new Error(
        "Username already exists"
      );
    }

    const result = db
      .prepare(
        `
          INSERT INTO players
          (
            name,
            username,
            phone,
            balance,
            image
          )
          VALUES
          (
            @name,
            @username,
            @phone,
            @balance,
            @image
          )
        `
      )
      .run({
        name,
        username,
        phone: player.phone?.trim() || "",
        balance: Number(
          player.balance || 0
        ),
        image: player.image || "",
      });

    return {
      id: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }
);

ipcMain.handle(
  "delete-player",
  (_event, playerId: number) => {
    if (!playerId) {
      throw new Error(
        "Player ID is required"
      );
    }

    const result = db
      .prepare(
        `
          DELETE FROM players
          WHERE id = ?
        `
      )
      .run(playerId);

    return {
      changes: result.changes,
    };
  }
);

/*
|--------------------------------------------------------------------------
| Application
|--------------------------------------------------------------------------
*/

app.whenReady().then(() => {
  console.log("Database connected");

  createWindow();

  app.on("activate", () => {
    if (
      BrowserWindow.getAllWindows().length === 0
    ) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});