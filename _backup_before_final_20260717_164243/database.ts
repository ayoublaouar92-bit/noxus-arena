import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "node:path";

import { registerBillingHandlers } from "./billing";
import { registerFinanceHandlers } from "./finance";
import { registerReportsHandlers } from "./reports";
import { registerSettingsHandlers } from "./settings";
import { registerStaffHandlers } from "./staff";
import { registerStoreHandlers } from "./store";
import { registerTournamentHandlers } from "./tournaments";
import { startKioskServer } from "./kioskServer";

type TableColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

const databasePath = join(app.getPath("userData"), "noxus-arena.db");
const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

/*
|--------------------------------------------------------------------------
| Core tables
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

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    phone TEXT,
    walletBalance REAL NOT NULL DEFAULT 0,
    debtBalance REAL NOT NULL DEFAULT 0,
    image TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

/*
|--------------------------------------------------------------------------
| Migrate legacy balance -> wallet/debt
|--------------------------------------------------------------------------
*/

const playerColumns = db
  .prepare("PRAGMA table_info(players)")
  .all() as TableColumn[];

const playerColumnNames = new Set(playerColumns.map((column) => column.name));

const hadWalletBalance = playerColumnNames.has("walletBalance");
const hadDebtBalance = playerColumnNames.has("debtBalance");
const hasLegacyBalance = playerColumnNames.has("balance");

if (!hadWalletBalance) {
  db.exec(`
    ALTER TABLE players
    ADD COLUMN walletBalance
    REAL NOT NULL DEFAULT 0;
  `);
}

if (!hadDebtBalance) {
  db.exec(`
    ALTER TABLE players
    ADD COLUMN debtBalance
    REAL NOT NULL DEFAULT 0;
  `);
}

if (hasLegacyBalance && (!hadWalletBalance || !hadDebtBalance)) {
  db.exec(`
    UPDATE players
    SET
      walletBalance =
        CASE
          WHEN balance > 0 THEN balance
          ELSE 0
        END,
      debtBalance =
        CASE
          WHEN balance < 0 THEN ABS(balance)
          ELSE 0
        END;
  `);
}

/*
|--------------------------------------------------------------------------
| Sessions
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId INTEGER NOT NULL,
    playerId INTEGER,
    customerName TEXT,
    guestPhone TEXT,
    guestNotes TEXT,
    startTime TEXT NOT NULL,
    endTime TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    totalPrice TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'Running',
    paymentMethod TEXT,
    walletPaid REAL NOT NULL DEFAULT 0,
    debtAdded REAL NOT NULL DEFAULT 0,
    cashPaid REAL NOT NULL DEFAULT 0,

    -- PAUSE support (v2)
    pausedAt TEXT,
    pausedMinutes INTEGER NOT NULL DEFAULT 0,

    -- Session billing mode (v3)
    sessionType TEXT NOT NULL DEFAULT 'timed',
    fixedPrice REAL NOT NULL DEFAULT 0,

    FOREIGN KEY (deviceId) REFERENCES devices(id),
    FOREIGN KEY (playerId) REFERENCES players(id)
  );
`);

const sessionColumns = db
  .prepare("PRAGMA table_info(sessions)")
  .all() as TableColumn[];

const sessionColumnNames = new Set(sessionColumns.map((column) => column.name));

const sessionMigrations = [
  { name: "playerId", definition: "INTEGER" },
  { name: "guestPhone", definition: "TEXT" },
  { name: "guestNotes", definition: "TEXT" },
  { name: "paymentMethod", definition: "TEXT" },
  { name: "walletPaid", definition: "REAL NOT NULL DEFAULT 0" },
  { name: "debtAdded", definition: "REAL NOT NULL DEFAULT 0" },
  { name: "cashPaid", definition: "REAL NOT NULL DEFAULT 0" },
  { name: "pausedAt", definition: "TEXT" },
  { name: "pausedMinutes", definition: "INTEGER NOT NULL DEFAULT 0" },
  { name: "sessionType", definition: "TEXT NOT NULL DEFAULT 'timed'" },
  { name: "fixedPrice", definition: "REAL NOT NULL DEFAULT 0" },
];

for (const migration of sessionMigrations) {
  if (!sessionColumnNames.has(migration.name)) {
    db.exec(
      `ALTER TABLE sessions ADD COLUMN ${migration.name} ${migration.definition};`,
    );
  }
}

/*
|--------------------------------------------------------------------------
| Wallet transactions
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playerId INTEGER NOT NULL,
    sessionId INTEGER,
    type TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    walletChange REAL NOT NULL DEFAULT 0,
    debtChange REAL NOT NULL DEFAULT 0,
    note TEXT,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (sessionId) REFERENCES sessions(id)
  );
`);

/*
|--------------------------------------------------------------------------
| Guest debts
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE TABLE IF NOT EXISTS guest_debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId INTEGER,
    guestName TEXT NOT NULL,
    phone TEXT,
    identityNotes TEXT,
    amount REAL NOT NULL DEFAULT 0,
    paidAmount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Open',
    note TEXT,
    source TEXT NOT NULL DEFAULT 'session',
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settledAt TEXT,

    FOREIGN KEY (sessionId) REFERENCES sessions(id)
  );
`);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
  CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(playerId);
  CREATE INDEX IF NOT EXISTS idx_wallet_transactions_player ON wallet_transactions(playerId);
  CREATE INDEX IF NOT EXISTS idx_guest_debts_status ON guest_debts(status);
  CREATE INDEX IF NOT EXISTS idx_guest_debts_phone ON guest_debts(phone);
`);

/*
|--------------------------------------------------------------------------
| IPC registrations
|--------------------------------------------------------------------------
| IMPORTANT: staff first
*/

registerStaffHandlers(db);
registerSettingsHandlers(db);
registerFinanceHandlers(db);
registerTournamentHandlers(db);
registerStoreHandlers(db);
registerBillingHandlers(db);
registerReportsHandlers(db);

/*
|--------------------------------------------------------------------------
| Kiosk LAN server (for client devices)
|--------------------------------------------------------------------------
*/
startKioskServer(db);

export default db;
