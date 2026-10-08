/**
 * Versioned MySQL migrations (additive). Safe to re-run.
 * Usage: node --env-file=.env.local lib/db/migrate.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "migrations");

function loadEnvLocal() {
  try {
    const p = path.join(ROOT, ".env.local");
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const idx = t.indexOf("=");
      if (idx <= 0) continue;
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter((s) => s.length > 0);
}

/** MySQL <8.0.12 may not support ADD COLUMN IF NOT EXISTS — emulate. */
async function execCompatible(conn, statement) {
  const addCol = statement.match(
    /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)\s+([\s\S]+)/i
  );
  if (addCol) {
    const [, table, column, rest] = addCol;
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (Number(rows[0]?.c) > 0) return { skipped: true, column };
    const cleaned = rest.replace(/,\s*$/, "").trim();
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${cleaned}`);
    return { added: true, column };
  }
  await conn.query(statement);
  return { ok: true };
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      description VARCHAR(255) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function main() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306),
    user: process.env.MYSQL_USER || process.env.DB_USER,
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "beego_vn",
    multipleStatements: false,
  });

  try {
    await ensureMigrationsTable(conn);
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const [existing] = await conn.query(
        "SELECT version FROM schema_migrations WHERE version = ? LIMIT 1",
        [version]
      );
      if (existing.length) {
        console.log(`[migrate] skip ${version}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`[migrate] apply ${version}`);
      for (const stmt of splitStatements(sql)) {
        if (/^CREATE TABLE IF NOT EXISTS schema_migrations/i.test(stmt)) continue;
        try {
          const r = await execCompatible(conn, stmt);
          if (r.skipped) console.log(`  skip column ${r.column}`);
          else if (r.added) console.log(`  add column ${r.column}`);
        } catch (e) {
          // Duplicate column / key — treat as already applied fragment
          if (e && (e.errno === 1060 || e.errno === 1061 || e.errno === 1050)) {
            console.log(`  ignore ${e.errno}: ${e.message}`);
            continue;
          }
          throw e;
        }
      }
      await conn.query(
        "INSERT INTO schema_migrations (version, description) VALUES (?, ?)",
        [version, file]
      );
      console.log(`[migrate] done ${version}`);
    }
    console.log("[migrate] OK");
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error("[migrate] FAIL", e);
  process.exit(1);
});
