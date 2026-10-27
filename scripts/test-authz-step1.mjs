/**
 * Authz step 1. Unit checks always. HTTP checks when BASE is reachable.
 * Does not print tokens or secrets.
 * BASE=http://127.0.0.1:3025 node --experimental-detect-module scripts/test-authz-step1.mjs
 */
import { assertMutationOrigin } from "../lib/security/csrf-origin.js";
import { checkIpRateLimit } from "../lib/security/ip-rate-limit.js";
import mysql from "mysql2/promise";

const BASE = process.env.BASE || "http://127.0.0.1:3025";
const results = [];
function record(id, status, evidence) {
  results.push({ id, status, evidence });
  console.log(`${status}: ${id} — ${evidence}`);
}

const cookieReq = {
  cookies: { get: () => ({ value: "cookie-token" }) },
  headers: { get: () => null },
};
const noOrigin = assertMutationOrigin(cookieReq);
record("csrf-unit-missing-origin", noOrigin.ok === false ? "PASS" : "FAIL", noOrigin.code || "ok");

const bearerBypass = assertMutationOrigin({
  cookies: { get: () => ({ value: "cookie-token" }) },
  headers: { get: (n) => (String(n).toLowerCase() === "authorization" ? "Bearer fake" : null) },
});
record(
  "csrf-unit-fake-bearer-does-not-skip",
  bearerBypass.ok === false ? "PASS" : "FAIL",
  bearerBypass.code || "skipped"
);

const bearerOnly = assertMutationOrigin({
  cookies: { get: () => undefined },
  headers: { get: (n) => (String(n).toLowerCase() === "authorization" ? "Bearer app-token" : null) },
});
record("csrf-unit-bearer-only", bearerOnly.ok === true ? "PASS" : "FAIL", "bearer without cookie");

const webhookLike = assertMutationOrigin({
  cookies: { get: () => undefined },
  headers: { get: () => null },
});
record("csrf-unit-no-cookie", webhookLike.ok === true ? "PASS" : "FAIL", "webhook/bearer path not cookie CSRF");

const key = `authz-${Date.now()}`;
let last;
for (let i = 0; i < 3; i += 1) last = checkIpRateLimit({ headers: { get: () => "" } }, { key, max: 2, windowMs: 2000 });
record("rate-unit", last?.ok === false && last.retryAfterSec >= 1 ? "PASS" : "FAIL", `retry=${last?.retryAfterSec}`);

const src = await import("fs").then((fs) => fs.readFileSync(new URL("../lib/auth/is-admin-user.ts", import.meta.url), "utf8"));
record(
  "no-default-admin-emails",
  !src.includes("xuanluong") && !src.includes("DEFAULT_ADMIN_EMAILS") ? "PASS" : "FAIL",
  "source has no hardcoded admin mailbox"
);
const schema = await import("fs").then((fs) =>
  fs.readFileSync(new URL("../lib/admin/ensure-student-admin-schema.ts", import.meta.url), "utf8")
);
record(
  "no-runtime-owner-bootstrap",
  !schema.includes("await bootstrapSystemOwnerStaffRoles()") ? "PASS" : "FAIL",
  "ensure schema does not call bootstrap"
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

async function http(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, code: json.code || "", success: json.success };
}

const anon = await http("/api/admin/students");
record("anon-admin-denied", anon.status === 401 || anon.status === 403 ? "PASS" : "FAIL", `status=${anon.status}`);

const login = await http("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://dev.beego.vn" },
  body: JSON.stringify({ identifier: "", password: "" }),
});
record("login-empty-still-400", login.status === 400 ? "PASS" : "FAIL", `status=${login.status}`);

const hook = await http("/api/billing/webhook", { method: "POST", body: "{}" });
record("webhook-not-csrf", hook.status !== 403 ? "PASS" : "FAIL", `status=${hook.status}`);

const lessons = await http("/api/lessons");
record("public-lessons-open", lessons.status === 200 ? "PASS" : "FAIL", `status=${lessons.status}`);

if (!db) {
  record("cross-account", "CHƯA KIỂM CHỨNG", "no DB from this process");
  record("owner-preserved", "CHƯA KIỂM CHỨNG", "no DB");
} else {
  const { randomBytes } = await import("crypto");
  const { hashPassword } = await import("../lib/auth.js");
  const fixtureIds = [];
  const fixtureTokens = [];
  try {
    const [[owners]] = await db.query(
      `SELECT COUNT(*) AS c FROM users WHERE staff_role = 'system_owner'`
    );
    record("owner-preserved", Number(owners.c) >= 1 ? "PASS" : "FAIL", `system_owner count=${owners.c}`);

    const [[owner]] = await db.query(
      `SELECT id FROM users WHERE staff_role = 'system_owner' AND is_active = 1 ORDER BY id LIMIT 1`
    );
    const [ownerSess] = await db.query(
      `SELECT s.token FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW() AND (s.revoked_at IS NULL) AND u.staff_role = 'system_owner' AND u.is_active = 1
       ORDER BY s.id DESC LIMIT 1`
    );
    if (!ownerSess.length) {
      record("owner-session-still-works", "CHƯA KIỂM CHỨNG", "no owner session");
      record("csrf-http-cookie-bearer", "CHƯA KIỂM CHỨNG", "no owner session");
    } else {
      const ownerToken = String(ownerSess[0].token);
      const me = await http("/api/admin/staff/me", {
        headers: { Cookie: `session_token=${ownerToken}` },
      });
      record("owner-session-still-works", me.status === 200 ? "PASS" : "FAIL", `status=${me.status}`);

      const fakeBearer = await http("/api/admin/staff/me", {
        headers: {
          Cookie: `session_token=${ownerToken}`,
          Authorization: "Bearer not-a-session",
          Origin: "https://dev.beego.vn",
        },
      });
      record(
        "cookie-plus-invalid-bearer-rejected",
        fakeBearer.status === 401 || fakeBearer.status === 403 ? "PASS" : "FAIL",
        `status=${fakeBearer.status}`
      );

      const csrfMiss = await http("/api/admin/app-settings", {
        method: "POST",
        headers: { Cookie: `session_token=${ownerToken}`, "Content-Type": "application/json" },
        body: "{}",
      });
      record("csrf-http-missing-origin", csrfMiss.status === 403 ? "PASS" : "FAIL", `status=${csrfMiss.status}`);

      const csrfFake = await http("/api/admin/app-settings", {
        method: "POST",
        headers: {
          Cookie: `session_token=${ownerToken}`,
          Authorization: "Bearer not-a-session",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      record(
        "csrf-http-fake-bearer-still-blocked",
        csrfFake.status === 403 ? "PASS" : "FAIL",
        `status=${csrfFake.status}`
      );
    }

    const [stale] = await db.query(`SELECT id FROM users WHERE email LIKE 'authz-%@invalid.local'`);
    const staleIds = stale.map((row) => Number(row.id));
    if (staleIds.length) {
      const marks = staleIds.map(() => "?").join(",");
      await db.query(`DELETE FROM user_sessions WHERE user_id IN (${marks})`, staleIds);
      await db.query(`DELETE FROM subscriptions WHERE user_id IN (${marks})`, staleIds).catch(() => {});
      await db.query(`DELETE FROM users WHERE id IN (${marks})`, staleIds);
    }

    async function fixtureUser(email, staffRole, active = 1) {
      const hash = hashPassword(`authz-fixture-${email}`);
      const [ins] = await db.query(
        `INSERT INTO users (name, email, password_hash, is_active, role, staff_role)
         VALUES ('authz fixture', ?, ?, ?, 'user', ?)`,
        [email, hash, active, staffRole]
      );
      const id = Number(ins.insertId);
      fixtureIds.push(id);
      const token = randomBytes(24).toString("hex");
      fixtureTokens.push(token);
      await db.query(
        `INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
        [id, token]
      );
      return { id, token };
    }

    const student = await fixtureUser("authz-student@invalid.local", null, 1);
    const teacher = await fixtureUser("authz-teacher@invalid.local", "teacher", 1);
    const support = await fixtureUser("authz-support@invalid.local", "support_staff", 1);
    const blocked = await fixtureUser("authz-blocked@invalid.local", null, 0);
    const origin = { Origin: "https://dev.beego.vn" };

    const studentAdmin = await http(`/api/admin/users/${owner?.id || 1}`, {
      headers: { Cookie: `session_token=${student.token}`, ...origin },
    });
    record(
      "student-cannot-open-admin-user",
      studentAdmin.status === 401 || studentAdmin.status === 403 ? "PASS" : "FAIL",
      `status=${studentAdmin.status}`
    );

    const studentOther = await http(`/api/admin/students/${owner?.id || 1}`, {
      headers: { Cookie: `session_token=${student.token}`, ...origin },
    });
    record(
      "student-cannot-read-other-via-admin",
      studentOther.status === 401 || studentOther.status === 403 ? "PASS" : "FAIL",
      `status=${studentOther.status}`
    );

    const me = await fetch(`${BASE}/api/auth/me?user_id=${owner?.id || 1}`, {
      headers: { Cookie: `session_token=${student.token}` },
    });
    const meJson = await me.json().catch(() => ({}));
    record(
      "session-me-ignores-foreign-user-id",
      me.status === 200 && Number(meJson.data?.id) === student.id ? "PASS" : "FAIL",
      `status=${me.status} matched=${Number(meJson.data?.id) === student.id}`
    );
    const dash = await fetch(`${BASE}/api/dashboard/me?user_id=${owner?.id || 1}`, {
      headers: { Cookie: `session_token=${student.token}` },
    });
    record("dashboard-session-only", dash.status === 200 ? "PASS" : "FAIL", `status=${dash.status}`);

    const teacherPay = await http("/api/admin/payments", {
      headers: { Cookie: `session_token=${teacher.token}`, ...origin },
    });
    record(
      "teacher-cannot-payments",
      teacherPay.status === 401 || teacherPay.status === 403 ? "PASS" : "FAIL",
      `status=${teacherPay.status}`
    );
    const teacherStudent = await http(`/api/admin/students/${owner?.id || 1}`, {
      headers: { Cookie: `session_token=${teacher.token}`, ...origin },
    });
    record(
      "teacher-out-of-scope-student",
      teacherStudent.status === 403 || teacherStudent.status === 404 ? "PASS" : "FAIL",
      `status=${teacherStudent.status}`
    );
    const teacherLegacy = await http(`/api/admin/users/${owner?.id || 1}`, {
      headers: { Cookie: `session_token=${teacher.token}`, ...origin },
    });
    record(
      "teacher-cannot-legacy-user-detail",
      teacherLegacy.status === 401 || teacherLegacy.status === 403 ? "PASS" : "FAIL",
      `status=${teacherLegacy.status}`
    );

    const supportList = await http("/api/admin/students", {
      headers: { Cookie: `session_token=${support.token}`, ...origin },
    });
    record("support-can-list-students", supportList.status === 200 ? "PASS" : "FAIL", `status=${supportList.status}`);
    const supportPay = await http("/api/admin/payments", {
      headers: { Cookie: `session_token=${support.token}`, ...origin },
    });
    record(
      "support-cannot-payments",
      supportPay.status === 401 || supportPay.status === 403 ? "PASS" : "FAIL",
      `status=${supportPay.status}`
    );

    const blockedMe = await http("/api/auth/me", {
      headers: { Cookie: `session_token=${blocked.token}` },
    });
    record(
      "inactive-session-rejected",
      blockedMe.status === 401 || blockedMe.status === 403 ? "PASS" : "FAIL",
      `status=${blockedMe.status}`
    );

    const blockedLogin = await http("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin },
      body: JSON.stringify({
        identifier: "authz-blocked@invalid.local",
        password: "authz-fixture-authz-blocked@invalid.local",
      }),
    });
    record("blocked-login-403", blockedLogin.status === 403 ? "PASS" : "FAIL", `status=${blockedLogin.status}`);
  } finally {
    if (fixtureTokens.length) {
      await db.query(`DELETE FROM user_sessions WHERE token IN (${fixtureTokens.map(() => "?").join(",")})`, fixtureTokens);
    }
    if (fixtureIds.length) {
      const marks = fixtureIds.map(() => "?").join(",");
      await db.query(`DELETE FROM subscriptions WHERE user_id IN (${marks})`, fixtureIds).catch(() => {});
      await db.query(`DELETE FROM users WHERE id IN (${marks}) AND email LIKE 'authz-%@invalid.local'`, fixtureIds);
    }
    await db.end();
  }
}

const failed = results.filter((r) => r.status === "FAIL");
console.log(
  `SUMMARY pass=${results.filter((r) => r.status === "PASS").length} fail=${failed.length} unverified=${results.filter((r) => r.status !== "PASS" && r.status !== "FAIL").length}`
);
if (failed.length) process.exitCode = 1;
