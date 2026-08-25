import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "applications.db");
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'novo',
    discord_name TEXT NOT NULL,
    ic_name TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
  CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_applications_discord ON applications(discord_name);
  CREATE INDEX IF NOT EXISTS idx_applications_ic ON applications(ic_name);
`);

export function ensureAdminUser(username, password) {
  const existing = db.prepare("SELECT id FROM admin_users WHERE username = ?").get(username);
  if (existing) return false;

  const hash = bcrypt.hashSync(password, 12);
  db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run(username, hash);
  return true;
}

export function syncAdminPassword(username, password) {
  const row = db.prepare("SELECT id, password_hash FROM admin_users WHERE username = ?").get(username);
  if (!row) return ensureAdminUser(username, password);
  if (bcrypt.compareSync(password, row.password_hash)) return false;
  const hash = bcrypt.hashSync(password, 12);
  db.prepare("UPDATE admin_users SET password_hash = ? WHERE username = ?").run(hash, username);
  return true;
}

export function verifyAdmin(username, password) {
  const row = db.prepare("SELECT * FROM admin_users WHERE username = ?").get(username);
  if (!row) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  return { id: row.id, username: row.username };
}

export function createApplication({ id, discordName, icName, answers }) {
  db.prepare(`
    INSERT INTO applications (id, discord_name, ic_name, answers_json)
    VALUES (?, ?, ?, ?)
  `).run(id, discordName, icName, JSON.stringify(answers));
  return getApplicationById(id);
}

export function getApplicationById(id) {
  const row = db.prepare("SELECT * FROM applications WHERE id = ?").get(id);
  if (!row) return null;
  return formatApplication(row);
}

export function listApplications({ search = "", status = "" } = {}) {
  let sql = "SELECT * FROM applications WHERE 1=1";
  const params = [];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    sql += " AND (discord_name LIKE ? OR ic_name LIKE ? OR answers_json LIKE ? OR id LIKE ?)";
    params.push(term, term, term, term);
  }

  sql += " ORDER BY created_at DESC";

  const rows = db.prepare(sql).all(...params);
  return rows.map(formatApplication);
}

export function updateApplicationStatus(id, status) {
  const result = db
    .prepare("UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, id);
  if (result.changes === 0) return null;
  return getApplicationById(id);
}

export function getStats() {
  const total = db.prepare("SELECT COUNT(*) as c FROM applications").get().c;
  const byStatus = db
    .prepare("SELECT status, COUNT(*) as c FROM applications GROUP BY status")
    .all();
  const stats = { total, novo: 0, u_razmatranju: 0, prihvacen: 0, odbijen: 0 };
  for (const row of byStatus) {
    stats[row.status] = row.c;
  }
  return stats;
}

function formatApplication(row) {
  return {
    id: row.id,
    status: row.status,
    discordName: row.discord_name,
    icName: row.ic_name,
    answers: JSON.parse(row.answers_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default db;
