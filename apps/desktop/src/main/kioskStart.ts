type StartByMacUsername = {
  mac: string;
  username: string;
};

function normalizeMac(mac: string) {
  return String(mac || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, ":");
}

export function registerStartSessionByMacUsername(db: any, payload: StartByMacUsername) {
  const mac = normalizeMac(payload.mac);
  const username = String(payload.username || "").trim().replace(/^@/, "");

  if (!mac) throw new Error("MAC is required");
  if (!username) throw new Error("Username is required");

  const device = db
    .prepare(
      `SELECT *
       FROM devices
       WHERE REPLACE(UPPER(mac), '-', ':') = ?
       LIMIT 1`,
    )
    .get(mac) as { id: number; name: string; status: string } | undefined;

  if (!device) throw new Error("Device not found by MAC");
  if (device.status === "Busy") throw new Error("Device is already busy");

  const player = db
    .prepare(`SELECT * FROM players WHERE LOWER(username) = LOWER(?) LIMIT 1`)
    .get(username) as { id: number; name: string } | undefined;

  if (!player) throw new Error("Player not found");

  const startTime = new Date().toISOString();

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `
        INSERT INTO sessions
          (deviceId, playerId, customerName, guestPhone, guestNotes, startTime, status, pausedAt, pausedMinutes)
        VALUES
          (?, ?, ?, '', '', ?, 'Running', NULL, 0)
      `
      )
      .run(device.id, player.id, player.name, startTime);

    db.prepare(`UPDATE devices SET status = 'Busy' WHERE id = ?`).run(device.id);

    return {
      sessionId: Number(result.lastInsertRowid),
      deviceId: device.id,
      deviceName: device.name,
      playerId: player.id,
      playerName: player.name,
      startTime,
    };
  });

  return tx();
}
