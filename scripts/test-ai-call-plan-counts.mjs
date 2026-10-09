/**
 * Read-only plan check for Learn Call. Does not write the database.
 */
import fs from "node:fs";
import mysql from "mysql2/promise";
import { decideLearnAiCallAccess } from "../lib/beego/learn/ai-call-access.js";

const env = {};
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

function planOf(row) {
  const now = Date.now();
  const expires = row.expires_at ? new Date(row.expires_at).getTime() : NaN;
  const trialEnd = row.trial_end_at ? new Date(row.trial_end_at).getTime() : NaN;
  if (Number.isFinite(expires) && now < expires && (row.plan === "pro" || row.plan === "vip")) return row.plan;
  if (Number.isFinite(trialEnd) && now < trialEnd) return "trial";
  return "expired";
}

const admins = new Set(
  String(env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});
const [rows] = await conn.query(
  `SELECT s.plan, s.trial_end_at, s.expires_at, u.email
   FROM subscriptions s
   INNER JOIN users u ON u.id = s.user_id`
);
await conn.end();

const counts = {};
for (const row of rows) {
  const plan = planOf(row);
  const adminBypass = admins.has(String(row.email || "").trim().toLowerCase());
  const decision = decideLearnAiCallAccess({
    enabled: true,
    plan,
    subscriptionLoaded: true,
    adminBypass,
  });
  const key = `${decision.code}:${decision.adminBypass ? "admin" : decision.plan}`;
  counts[key] = (counts[key] || 0) + 1;
}
console.log(JSON.stringify({ rows: rows.length, counts }));
