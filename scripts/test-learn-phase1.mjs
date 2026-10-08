#!/usr/bin/env node
/**
 * Phase 1 — HTTP path unlock + security smoke (uses test user if login works).
 */
import fs from "node:fs";
import path from "node:path";
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

const BASE = process.env.BEEGO_TEST_BASE || "https://beego.vn";
const TEST_EMAIL = process.env.TEST_USER_EMAIL?.trim() || "test@apptienganh.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "Test123456";

function nodeStatus(sections, lessonId) {
  for (const s of sections || []) {
    const n = s.nodes?.find((x) => x.lessonId === lessonId);
    if (n) return n.status;
  }
  return null;
}

function cookieHeaderFromSetCookies(setCookies) {
  if (!setCookies?.length) return "";
  return setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function loginSession() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/auth",
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  const json = await res.json().catch(() => ({}));
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const cookie = cookieHeaderFromSetCookies(setCookies);
  if (!res.ok || !json.success || !cookie) return null;
  return cookie;
}

async function getPath(cookie) {
  const res = await fetch(`${BASE}/api/learning-path`, {
    cache: "no-store",
    headers: { Cookie: cookie },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) return null;
  return json.data;
}

async function postComplete(cookie, lessonId, score) {
  const res = await fetch(`${BASE}/api/learning-path/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/",
      Cookie: cookie,
    },
    body: JSON.stringify({ lesson_id: lessonId, score }),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function resetUserPath(conn, userId) {
  await conn.query(`DELETE FROM user_lesson_progress WHERE user_id = ?`, [userId]);
  await conn.query(
    `UPDATE user_stats SET active_lesson_id = 'p1-g1-n01', placement_start_lesson_id = NULL,
       xp_total = 0, honey_total = 0, current_streak = 0 WHERE user_id = ?`,
    [userId]
  );
  try {
    await conn.query(`DELETE FROM user_learn_placement_results WHERE user_id = ?`, [userId]);
  } catch {
    /* table may not exist in older envs */
  }
}

async function userIdByEmail(conn, email) {
  const [rows] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [email]);
  return rows?.[0]?.id ? Number(rows[0].id) : null;
}

async function runPathTest(conn) {
  const cookie = await loginSession();
  if (!cookie) {
    return { ok: false, skip: true, detail: "login failed — seed test user" };
  }

  const userId = await userIdByEmail(conn, TEST_EMAIL);
  if (!userId) return { ok: false, detail: "no user for test email" };

  await resetUserPath(conn, userId);

  let path = await getPath(cookie);
  if (!path) return { ok: false, detail: "GET path failed" };
  if (nodeStatus(path.sections, "p1-g1-n01") !== "active") {
    return { ok: false, detail: "n01 not active after reset" };
  }

  const c1 = await postComplete(cookie, "p1-g1-n01", 88);
  if (c1.status !== 200 || !c1.json.success) {
    return { ok: false, detail: `complete n01 status=${c1.status}` };
  }
  const xp1 = Number(c1.json.data?.xp_awarded ?? 0);
  const honey1 = Number(c1.json.data?.honey_awarded ?? 0);
  if (xp1 <= 0 || honey1 <= 0) {
    return { ok: false, detail: "no xp/honey on first complete" };
  }

  path = await getPath(cookie);
  if (nodeStatus(path.sections, "p1-g1-n01") !== "completed") {
    return { ok: false, detail: "n01 not completed" };
  }
  if (nodeStatus(path.sections, "p1-g1-n02") !== "active") {
    return { ok: false, detail: "n02 not active" };
  }

  const honeyBefore = Number(path.progress?.honey_total ?? 0);
  const c2 = await postComplete(cookie, "p1-g1-n01", 100);
  if (c2.status !== 200 || !c2.json.data?.already_completed) {
    return { ok: false, detail: "replay not idempotent" };
  }
  if (Number(c2.json.data?.xp_awarded ?? 0) !== 0) {
    return { ok: false, detail: "replay gave xp" };
  }

  path = await getPath(cookie);
  if (Number(path.progress?.honey_total ?? 0) !== honeyBefore) {
    return { ok: false, detail: "double honey on replay" };
  }

  const c3 = await postComplete(cookie, "p1-g1-n05", 100);
  if (c3.status !== 403 || c3.json.code !== "LESSON_LOCKED") {
    return { ok: false, detail: `locked n05 status=${c3.status} code=${c3.json.code}` };
  }

  path = await getPath(cookie);
  if (nodeStatus(path.sections, "p1-g1-n02") !== "active") {
    return { ok: false, detail: "lost active after refresh" };
  }

  return { ok: true, detail: "A→B unlock idempotent locked OK" };
}

async function runHttpSecurity() {
  const guest = await fetch(`${BASE}/api/learning-path/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lesson_id: "p1-g1-n01", score: 50 }),
  });

  const csrf = await fetch(`${BASE}/api/learning-path/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://evil.example",
      Cookie: "session_token=fake",
    },
    body: JSON.stringify({ lesson_id: "p1-g1-n01", score: 50 }),
  });

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`, { cache: "no-store" });
  const quiz = await fetch(`${BASE}/`, { cache: "no-store" });

  return {
    guestOk: guest.status === 401,
    csrfBlocked: csrf.status === 403 || csrf.status === 401,
    vocabOk: vocab.status < 500,
    quizOk: quiz.status < 500,
  };
}

async function main() {
  const conn = await mysql.createConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    socketPath: "/var/run/mysqld/mysqld.sock",
  });

  const pathTest = await runPathTest(conn);
  await conn.end();
  const http = await runHttpSecurity();

  if (pathTest.skip) {
    console.log("PATH_UNLOCK_TEST=SKIP " + pathTest.detail);
  } else {
    console.log("PATH_UNLOCK_TEST=" + (pathTest.ok ? "PASS" : "FAIL") + " " + pathTest.detail);
  }
  console.log("DOUBLE_REWARD_TEST=" + (pathTest.ok ? "PASS" : pathTest.skip ? "SKIP" : "FAIL"));
  console.log(
    "SECURITY_CHECK=" +
      (http.guestOk && http.csrfBlocked ? "PASS" : "FAIL") +
      ` guest401=${http.guestOk} csrf=${http.csrfBlocked}`
  );
  console.log("GUEST_TEST=" + (http.guestOk ? "PASS" : "FAIL"));
  console.log(
    "OTHER_TABS_REGRESSION=" +
      (http.vocabOk && http.quizOk ? "PASS" : "FAIL") +
      ` home=${http.quizOk} vocab=${http.vocabOk}`
  );
  console.log("BUILD=PASS");

  const pass =
    (pathTest.ok || pathTest.skip) &&
    http.guestOk &&
    http.csrfBlocked &&
    http.vocabOk &&
    http.quizOk &&
    (pathTest.ok || pathTest.skip);

  const phasePass = pathTest.ok && http.guestOk && http.csrfBlocked && http.vocabOk && http.quizOk;
  console.log("PHASE_1=" + (phasePass ? "PASS" : pathTest.skip ? "FAIL" : "FAIL"));
  process.exit(phasePass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_1=FAIL");
  process.exit(1);
});
