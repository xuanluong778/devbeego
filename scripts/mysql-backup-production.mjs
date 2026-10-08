#!/usr/bin/env node
/**
 * Production MySQL backup — reads .env.local, writes gzip dump, verifies integrity.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const host = process.env.DB_HOST || "127.0.0.1";
const user = process.env.DB_USER;
const pass = process.env.DB_PASSWORD;
const db = process.env.DB_NAME;
if (!user || !db) {
  console.error("MYSQL_BACKUP=FAIL missing DB_USER/DB_NAME");
  process.exit(1);
}

const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
const outDir = "/var/www/beego_vn_usr/data/backups";
fs.mkdirSync(outDir, { recursive: true });
const outSql = path.join(outDir, `beego.mysql.production.${ts}.sql`);
const out = `${outSql}.gz`;

const env = { ...process.env };
if (pass) env.MYSQL_PWD = pass;

const socket = process.env.DB_SOCKET || "/var/run/mysqld/mysqld.sock";
const useSocket = host === "127.0.0.1" || host === "localhost";
const dumpArgs = useSocket
  ? ["--socket", socket, "-u", user, "--single-transaction", "--routines", "--triggers", db]
  : ["-h", host, "-u", user, "--single-transaction", "--routines", "--triggers", db];

let dump = spawnSync("mysqldump", dumpArgs, {
  env,
  encoding: "buffer",
  maxBuffer: 512 * 1024 * 1024,
});

if (dump.status !== 0 && fs.existsSync("/etc/mysql/debian.cnf")) {
  dump = spawnSync(
    "mysqldump",
    ["--defaults-file=/etc/mysql/debian.cnf", "--single-transaction", "--routines", "--triggers", db],
    { encoding: "buffer", maxBuffer: 512 * 1024 * 1024 }
  );
}

if (dump.status !== 0) {
  console.error("MYSQL_BACKUP=FAIL dump_error");
  process.exit(1);
}

const gz = spawnSync("gzip", ["-c"], { input: dump.stdout, encoding: "buffer", maxBuffer: 512 * 1024 * 1024 });
if (gz.status !== 0 || !gz.stdout?.length) {
  console.error("MYSQL_BACKUP=FAIL gzip_error");
  process.exit(1);
}

fs.writeFileSync(out, gz.stdout);
const stat = fs.statSync(out);
if (stat.size < 1024) {
  console.error("MYSQL_BACKUP=FAIL dump_too_small");
  process.exit(1);
}

try {
  spawnSync("gzip", ["-t", out], { stdio: "ignore" });
} catch {
  console.error("MYSQL_BACKUP=FAIL gzip_integrity");
  process.exit(1);
}

let tables = 0;
try {
  const sample = spawnSync("zcat", [out], { encoding: "utf8", maxBuffer: 512 * 1024 });
  tables = (sample.stdout.match(/CREATE TABLE/gi) || []).length;
} catch {
  tables = -1;
}

console.log("MYSQL_BACKUP=OK");
console.log("MYSQL_BACKUP_PATH=" + out);
console.log("MYSQL_BACKUP_BYTES=" + stat.size);
console.log("MYSQL_BACKUP_TABLES_SAMPLE=" + tables);
