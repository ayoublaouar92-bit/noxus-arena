import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "node:path";


const dbPath = join(
  app.getPath("userData"),
  "noxus-arena.db"
);


const db = new Database(dbPath);



// جدول الأجهزة

db.exec(`

CREATE TABLE IF NOT EXISTS devices (

id INTEGER PRIMARY KEY AUTOINCREMENT,

name TEXT NOT NULL,

type TEXT NOT NULL,

ip TEXT,

mac TEXT,

price TEXT,

status TEXT DEFAULT 'Available'

);

`);





// جدول الجلسات

db.exec(`

CREATE TABLE IF NOT EXISTS sessions (

id INTEGER PRIMARY KEY AUTOINCREMENT,

deviceId INTEGER NOT NULL,

customerName TEXT,

startTime TEXT NOT NULL,

endTime TEXT,

duration INTEGER DEFAULT 0,

totalPrice TEXT DEFAULT '0',

status TEXT DEFAULT 'Running',


FOREIGN KEY(deviceId)

REFERENCES devices(id)

);

`);





export default db;