#!/usr/bin/env node
/**
 * Idempotent: register 004_learn_mastery_mistakes when tables already exist via ensureLearnMasteryTables().
 * Does not DROP or truncate. Runs full migrate only if tables are missing.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[t.slice(0, eq).trim()] === undefined) {
      process.env[t.slice(0, eq).trim()] = val;
    }
  }
}

const VERSION = "004_learn_mastery_mistakes";
const TABLES = [
  "user_learn_exercise_attempts",
  "user_learn_skill_mastery",
  "user_learn_mistakes",
];

async function dbConn() {
  const socket = process.env.MYSQL_SOCKET || "/var/run/mysqld/mysqld.sock";
  const base = {
    user: process.env.MYSQL_USER || process.env.DB_USER || "root",
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "beego_vn",
  };
  try {
    return await mysql.createConnection({ ...base, socketPath: socket });
  } catch {
    return mysql.createConnection({
      ...base,
      host: process.env.MYSQL_HOST || "127.0.0.1",
    });
  }
}

async function tableExists(conn, name) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name]
  );
  return Number(rows[0]?.c) > 0;
}

async function countRows(conn, table) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
  return Number(rows[0]?.c);
}

async function main() {
  const conn = await dbConn();
  const exists = {};
  for (const t of TABLES) {
    exists[t] = await tableExists(conn, t);
  }
  const allExist = TABLES.every((t) => exists[t]);
  const anyExist = TABLES.some((t) => exists[t]);

  if (anyExist && !allExist) {
    console.log("MIGRATION_004_STATUS=FAIL partial_tables");
    process.exit(1);
  }

  const countsBefore = {};
  if (allExist) {
    for (const t of TABLES) countsBefore[t] = await countRows(conn, t);
  }

  const [reg] = await conn.query(
    `SELECT version FROM schema_migrations WHERE version = ? LIMIT 1`,
    [VERSION]
  );
  const registered = reg.length > 0;

  if (!allExist) {
    await conn.end();
    const r = spawnSync("node", ["--env-file=.env.local", "lib/db/migrate.js"], {
      cwd: root,
      encoding: "utf8",
    });
    if (r.status !== 0) {
      console.log("MIGRATION_004_STATUS=FAIL migrate_runner");
      console.log(r.stdout || r.stderr);
      process.exit(1);
    }
    const conn2 = await dbConn();
    const [reg2] = await conn2.query(
      `SELECT version FROM schema_migrations WHERE version = ? LIMIT 1`,
      [VERSION]
    );
    await conn2.end();
    console.log("MIGRATION_004_STATUS=PASS applied_via_migrate registered=" + (reg2.length > 0));
    process.exit(0);
  }

  if (!registered) {
    const sqlPath = path.join(root, "migrations", `${VERSION}.sql`);
    const sql = fs.readFileSync(sqlPath, "utf8");
    const stmts = sql
      .split(/;\s*\n/)
      .map((s) => s.replace(/--[^\n]*/g, "").trim())
      .filter(Boolean);
    for (const stmt of stmts) {
      await conn.query(stmt);
    }
    await conn.query(`INSERT INTO schema_migrations (version, description) VALUES (?, ?)`, [
      VERSION,
      `${VERSION}.sql`,
    ]);
    console.log("MIGRATION_004_STATUS=PASS registered_existing_tables no_data_loss");
  } else {
    console.log("MIGRATION_004_STATUS=PASS already_synchronized");
  }

  for (const t of TABLES) {
    const after = await countRows(conn, t);
    const before = countsBefore[t];
    if (before != null && after < before) {
      console.log(`MIGRATION_004_STATUS=FAIL row_loss ${t} ${before}->${after}`);
      await conn.end();
      process.exit(1);
    }
  }

  await conn.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  console.log("MIGRATION_004_STATUS=FAIL");
  process.exit(1);
});
