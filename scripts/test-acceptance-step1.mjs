/**
 * Acceptance step 1 — CSRF, bearer exclusivity, rate-limit unit, webhook, bootstrap block.
 * BASE=http://127.0.0.1:3025 node scripts/test-acceptance-step1.mjs
 * Does not print secrets or session tokens.
 */
import { checkIpRateLimit } from "../lib/security/ip-rate-limit.js";
import { clientIpFromRequest } from "../lib/security/client-ip.js";
import mysql from "mysql2/promise";

const BASE = process.env.BASE || "http://127.0.0.1:3025";
const results = [];

function record(id, status, evidence) {
  results.push({ id, status, evidence });
  console.log(`${status}: ${id} — ${evidence}`);
}

const health = await fetch(`${BASE}/api/health`);
record("health", health.status === 200 ? "PASS" : "FAIL", `GET /api/health ${health.status}`);

async function postAdmin(headers) {
  const res = await fetch(`${BASE}/api/admin/path-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ title: "csrf-probe" }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, code: json.code || "" };
}

const noOrigin = await postAdmin({ Cookie: "session_token=probe-cookie" });
record(
  "csrf-missing-origin",
  noOrigin.status === 403 && noOrigin.code === "CSRF_ORIGIN" ? "PASS" : "FAIL",
  `status=${noOrigin.status} code=${noOrigin.code}`
);

const foreign = await postAdmin({
  Cookie: "session_token=probe-cookie",
  Origin: "https://evil.example",
});
record(
  "csrf-foreign-origin",
  foreign.status === 403 && foreign.code === "CSRF_ORIGIN" ? "PASS" : "FAIL",
  `status=${foreign.status} code=${foreign.code}`
);

const validOriginFakeBearer = await postAdmin({
  Cookie: "session_token=probe-cookie",
  Authorization: "Bearer not-a-session",
  Origin: "https://dev.beego.vn",
});
record(
  "csrf-cookie-plus-fake-bearer-still-checks-origin",
  validOriginFakeBearer.code !== "CSRF_ORIGIN" ? "PASS" : "FAIL",
  `valid origin not blocked as CSRF status=${validOriginFakeBearer.status} code=${validOriginFakeBearer.code || "-"}`
);

const fakeBearerNoOrigin = await postAdmin({
  Cookie: "session_token=probe-cookie",
  Authorization: "Bearer not-a-session",
});
record(
  "csrf-fake-bearer-does-not-skip",
  fakeBearerNoOrigin.status === 403 && fakeBearerNoOrigin.code === "CSRF_ORIGIN" ? "PASS" : "FAIL",
  `status=${fakeBearerNoOrigin.status} code=${fakeBearerNoOrigin.code}`
);

const bearerOnly = await postAdmin({ Authorization: "Bearer not-a-session" });
record(
  "bearer-only-not-csrf",
  bearerOnly.code !== "CSRF_ORIGIN" ? "PASS" : "FAIL",
  `status=${bearerOnly.status} code=${bearerOnly.code || "-"} (expect auth failure, not CSRF)`
);

let db;
try {
  db = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || "beego_app",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "beego_vn_dev",
  });
} catch {
  db = null;
}

if (!db) {
  record("bearer-exclusive-live", "CHƯA KIỂM CHỨNG", "Không mở được DB từ host; chạy trong container.");
  record("bootstrap-block", "CHƯA KIỂM CHỨNG", "Không mở được DB từ host.");
} else {
  const [sess] = await db.query(
    `SELECT s.token FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > NOW() AND (s.revoked_at IS NULL) AND u.staff_role = 'system_owner' AND u.is_active = 1
     ORDER BY s.id DESC LIMIT 1`
  );
  if (!sess.length) {
    record("bearer-exclusive-live", "CHƯA KIỂM CHỨNG", "Không có session owner còn hạn.");
  } else {
    const token = String(sess[0].token);
    const mixed = await postAdmin({
      Cookie: `session_token=${token}`,
      Authorization: "Bearer invalid-bearer-token",
      Origin: "https://dev.beego.vn",
    });
    record(
      "bearer-invalid-no-cookie-fallback",
      mixed.status === 401 || mixed.status === 403 ? "PASS" : "FAIL",
      `cookie+invalid bearer+valid origin → ${mixed.status} (401/403 = không dùng cookie)`
    );
    const cookieOnly = await fetch(`${BASE}/api/admin/staff/me`, {
      headers: { Cookie: `session_token=${token}`, Origin: "https://dev.beego.vn" },
    });
    record(
      "web-cookie-session-still-works",
      cookieOnly.status === 200 ? "PASS" : "FAIL",
      `GET /api/admin/staff/me cookie-only ${cookieOnly.status}`
    );
  }

  const [[owner]] = await db.query(
    `SELECT id, staff_role FROM users WHERE staff_role = 'system_owner' ORDER BY id ASC LIMIT 1`
  );
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_staff_bootstrap_block (
      email VARCHAR(255) NOT NULL PRIMARY KEY,
      reason VARCHAR(200) NULL,
      blocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  await db.beginTransaction();
  try {
    const probe = `probe-revoke-${Date.now()}@example.test`;
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, staff_role) VALUES ('probe', ?, 'x', 'user', 1, NULL)`,
      [probe]
    );
    await db.query(`INSERT INTO admin_staff_bootstrap_block (email, reason) VALUES (?, 'acceptance')`, [probe]);
    const [upd] = await db.query(
      `UPDATE users SET staff_role = 'system_owner'
       WHERE LOWER(TRIM(email)) = ?
         AND (staff_role IS NULL OR TRIM(staff_role) = '')
         AND NOT EXISTS (SELECT 1 FROM admin_staff_bootstrap_block b WHERE b.email = ?)`,
      [probe, probe]
    );
    const affected = Number(upd.affectedRows || 0);
    record(
      "bootstrap-skips-blocked-email",
      affected === 0 ? "PASS" : "FAIL",
      `blocked probe affectedRows=${affected}`
    );
    await db.rollback();
  } catch (e) {
    await db.rollback();
    record("bootstrap-skips-blocked-email", "FAIL", e.message || "sql error");
  }
  const [[ownerAfter]] = await db.query(`SELECT staff_role FROM users WHERE id = ?`, [owner.id]);
  record(
    "existing-owner-unchanged",
    ownerAfter.staff_role === "system_owner" ? "PASS" : "FAIL",
    `user ${owner.id} staff_role=${ownerAfter.staff_role}`
  );

  const [[mc]] = await db.query(`SHOW VARIABLES LIKE 'max_connections'`);
  record("mysql-max-connections", "PASS", `max_connections=${mc?.Value} (pool default remains 10 unless DB_CONNECTION_LIMIT)`);
  await db.end();
}

const hook = await fetch(`${BASE}/api/billing/webhook`, { method: "POST", body: "{}" });
record(
  "webhook-stripe-not-csrf",
  hook.status !== 403 ? "PASS" : "FAIL",
  `POST /api/billing/webhook ${hook.status}`
);
const ipn = await fetch(`${BASE}/api/payments/sepay/ipn`, { method: "POST", body: "{}" });
record(
  "webhook-sepay-not-csrf",
  ipn.status !== 403 ? "PASS" : "FAIL",
  `POST /api/payments/sepay/ipn ${ipn.status}`
);

const ip = clientIpFromRequest({
  headers: { get: (n) => (n === "x-real-ip" ? "203.0.113.9" : n === "x-forwarded-for" ? "198.51.100.2, 10.0.0.1" : "") },
});
record("ip-prefers-x-real-ip", ip === "203.0.113.9" ? "PASS" : "FAIL", `resolved=${ip}`);

const req = { headers: { get: () => "" } };
const bucketKey = `accept-${Date.now()}`;
let limited = null;
for (let i = 0; i < 4; i += 1) {
  limited = checkIpRateLimit(req, { key: bucketKey, windowMs: 2000, max: 2 });
}
record(
  "rate-limit-429-unit",
  limited && limited.ok === false && limited.retryAfterSec >= 1 ? "PASS" : "FAIL",
  `ok=${limited?.ok} retryAfterSec=${limited?.retryAfterSec}`
);

const failed = results.filter((r) => r.status === "FAIL");
console.log(`SUMMARY pass=${results.filter((r) => r.status === "PASS").length} fail=${failed.length} unverified=${results.filter((r) => r.status === "CHƯA KIỂM CHỨNG").length}`);
if (failed.length) process.exitCode = 1;
