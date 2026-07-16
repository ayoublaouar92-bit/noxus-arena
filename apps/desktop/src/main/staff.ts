import { ipcMain } from "electron";
import crypto from "node:crypto";

type Role = "Admin" | "Staff";

type StaffUserRow = {
  id: number;
  name: string;
  role: Role;
  pinHash: string;
  active: number;
  createdAt: string;
};

type PublicStaffUser = {
  id: number;
  name: string;
  role: Role;
  active: number;
  createdAt: string;
};

type CreateUserData = {
  name: string;
  role: Role;
  pin: string;
};

type LoginData = {
  pin: string;
};

function registerHandler(channel: string, handler: (...args: any[]) => any) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, handler);
}

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function ensureTables(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Staff',
      pinHash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffUserId INTEGER NOT NULL,
      loginAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      logoutAt TEXT,

      FOREIGN KEY (staffUserId)
        REFERENCES staff_users(id)
        ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staffUserId INTEGER,
      action TEXT NOT NULL,
      entity TEXT,
      entityId TEXT,
      details TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (staffUserId)
        REFERENCES staff_users(id)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_staff_users_active ON staff_users(active);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(createdAt);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
  `);

  // Ensure default admin exists (PIN: 0000) ONLY if no users exist
  const count = db.prepare(`SELECT COUNT(*) AS total FROM staff_users`).get() as { total: number };
  if (Number(count.total) === 0) {
    db.prepare(
      `
      INSERT INTO staff_users (name, role, pinHash, active)
      VALUES (?, 'Admin', ?, 1)
    `
    ).run("Admin", sha256("0000"));

    db.prepare(
      `
      INSERT INTO audit_log (staffUserId, action, entity, details)
      VALUES (NULL, 'BOOTSTRAP_ADMIN', 'staff_users', 'Created default admin with PIN 0000')
    `
    ).run();
  }
}

function toPublic(user: StaffUserRow): PublicStaffUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
  };
}

let currentStaffUserId: number | null = null;
let currentSessionId: number | null = null;

export function getCurrentStaffUserId() {
  return currentStaffUserId;
}

export function requireStaff(db: any, action: string) {
  if (!currentStaffUserId) {
    const err = new Error("UNAUTHORIZED");
    (err as any).code = "UNAUTHORIZED";
    throw err;
  }

  // audit (minimal)
  db.prepare(
    `
    INSERT INTO audit_log (staffUserId, action, entity, entityId, details)
    VALUES (?, ?, NULL, NULL, NULL)
  `
  ).run(currentStaffUserId, action);
}

export function audit(
  db: any,
  payload: {
    action: string;
    entity?: string | null;
    entityId?: string | number | null;
    details?: string | null;
  }
) {
  db.prepare(
    `
    INSERT INTO audit_log (staffUserId, action, entity, entityId, details)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(
    currentStaffUserId,
    payload.action,
    payload.entity ?? null,
    payload.entityId !== undefined && payload.entityId !== null ? String(payload.entityId) : null,
    payload.details ?? null
  );
}

export function registerStaffHandlers(db: any) {
  ensureTables(db);

  registerHandler("staff:get-current", () => {
    if (!currentStaffUserId) return null;

    const user = db
      .prepare(`SELECT * FROM staff_users WHERE id = ?`)
      .get(currentStaffUserId) as StaffUserRow | undefined;

    if (!user) {
      currentStaffUserId = null;
      currentSessionId = null;
      return null;
    }

    return toPublic(user);
  });

  registerHandler("staff:login", (_event, data: LoginData) => {
    const pin = String(data?.pin ?? "").trim();
    if (!pin) throw new Error("PIN is required");

    const user = db
      .prepare(`SELECT * FROM staff_users WHERE pinHash = ? AND active = 1 LIMIT 1`)
      .get(sha256(pin)) as StaffUserRow | undefined;

    if (!user) {
      throw new Error("Invalid PIN");
    }

    // close old session if any
    if (currentSessionId) {
      db.prepare(`UPDATE staff_sessions SET logoutAt = ? WHERE id = ? AND logoutAt IS NULL`).run(
        nowIso(),
        currentSessionId
      );
    }

    const session = db
      .prepare(`INSERT INTO staff_sessions (staffUserId) VALUES (?)`)
      .run(user.id);

    currentStaffUserId = user.id;
    currentSessionId = Number(session.lastInsertRowid);

    audit(db, {
      action: "STAFF_LOGIN",
      entity: "staff_users",
      entityId: user.id,
      details: `Logged in as ${user.name} (${user.role})`,
    });

    return toPublic(user);
  });

  registerHandler("staff:logout", () => {
    if (currentSessionId) {
      db.prepare(`UPDATE staff_sessions SET logoutAt = ? WHERE id = ? AND logoutAt IS NULL`).run(
        nowIso(),
        currentSessionId
      );
    }

    audit(db, {
      action: "STAFF_LOGOUT",
      details: "Logged out",
    });

    currentStaffUserId = null;
    currentSessionId = null;

    return true;
  });

  registerHandler("staff:list-users", () => {
    // read-only allowed without login (optional); you can change later
    return db
      .prepare(`SELECT id, name, role, active, createdAt FROM staff_users ORDER BY role DESC, id ASC`)
      .all();
  });

  registerHandler("staff:create-user", (_event, data: CreateUserData) => {
    // must be admin
    if (!currentStaffUserId) throw new Error("UNAUTHORIZED");

    const current = db
      .prepare(`SELECT * FROM staff_users WHERE id = ?`)
      .get(currentStaffUserId) as StaffUserRow | undefined;

    if (!current || current.role !== "Admin") throw new Error("FORBIDDEN");

    const name = String(data?.name ?? "").trim();
    const role = data?.role === "Admin" ? "Admin" : "Staff";
    const pin = String(data?.pin ?? "").trim();

    if (!name) throw new Error("Name is required");
    if (!pin || pin.length < 4) throw new Error("PIN must be at least 4 digits");

    const result = db
      .prepare(`INSERT INTO staff_users (name, role, pinHash, active) VALUES (?, ?, ?, 1)`)
      .run(name, role, sha256(pin));

    audit(db, {
      action: "STAFF_CREATE_USER",
      entity: "staff_users",
      entityId: Number(result.lastInsertRowid),
      details: `Created ${name} (${role})`,
    });

    return { id: Number(result.lastInsertRowid), changes: result.changes };
  });

  registerHandler("staff:set-user-active", (_event, payload: { userId: number; active: boolean }) => {
    if (!currentStaffUserId) throw new Error("UNAUTHORIZED");

    const current = db
      .prepare(`SELECT * FROM staff_users WHERE id = ?`)
      .get(currentStaffUserId) as StaffUserRow | undefined;

    if (!current || current.role !== "Admin") throw new Error("FORBIDDEN");

    db.prepare(`UPDATE staff_users SET active = ? WHERE id = ?`).run(payload.active ? 1 : 0, payload.userId);

    audit(db, {
      action: "STAFF_SET_ACTIVE",
      entity: "staff_users",
      entityId: payload.userId,
      details: payload.active ? "Activated user" : "Deactivated user",
    });

    return true;
  });

  registerHandler("staff:get-audit", () => {
    return db
      .prepare(
        `
        SELECT
          audit_log.*,
          staff_users.name AS staffName,
          staff_users.role AS staffRole
        FROM audit_log
        LEFT JOIN staff_users
          ON staff_users.id = audit_log.staffUserId
        ORDER BY audit_log.id DESC
        LIMIT 300
      `
      )
      .all();
  });
}