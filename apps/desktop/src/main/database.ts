import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "node:path";

const databasePath = join(
  app.getPath("userData"),
  "noxus-arena.db"
);

const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

/*
|--------------------------------------------------------------------------
| Devices
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    ip TEXT,
    mac TEXT,
    price TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'Available'
  );
`);

/*
|--------------------------------------------------------------------------
| Sessions
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId INTEGER NOT NULL,
    customerName TEXT,
    startTime TEXT NOT NULL,
    endTime TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    totalPrice TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'Running',

    FOREIGN KEY (deviceId)
      REFERENCES devices(id)
  );
`);

/*
|--------------------------------------------------------------------------
| Players
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    phone TEXT,
    balance REAL NOT NULL DEFAULT 0,
    image TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export default db;