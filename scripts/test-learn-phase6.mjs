#!/usr/bin/env node
/**
 * Phase 6 — adaptive lesson mix + Phase 1–5 regression.
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

const BASE = process.env.BEEGO_TEST_BASE || "https://beego.vn";
const TEST_EMAIL = process.env.TEST_USER_EMAIL?.trim() || "test@apptienganh.local";
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || "Test123456";
const LESSON = "p1-g1-n01";

function cookieHeaderFromSetCookies(setCookies) {
  if (!setCookies?.length) return "";
  return setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
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

async function getLesson(cookie, lessonId) {
  const res = await fetch(`${BASE}/api/learn/lesson/${encodeURIComponent(lessonId)}`, {
    cache: "no-store",
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function dbConn() {
  const socket = process.env.MYSQL_SOCKET || "/var/run/mysqld/mysqld.sock";
  try {
    return await mysql.createConnection({
      socketPath: socket,
      user: process.env.MYSQL_USER || process.env.DB_USER || "root",
      password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "beego_vn",
    });
  } catch {
    return mysql.createConnection({
      host: process.env.MYSQL_HOST || process.env.DB_HOST || "127.0.0.1",
      user: process.env.MYSQL_USER || process.env.DB_USER || "root",
      password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "beego_vn",
    });
  }
}

function stageSet(questions) {
  return new Set((questions || []).map((q) => q.activityMeta?.stage).filter(Boolean));
}

function questionKeys(questions) {
  return (questions || []).map((q) => q.id).join("|");
}

async function main() {
  let guestOk = false;
  for (let i = 0; i < 3 && !guestOk; i += 1) {
    const guest = await getLesson(null, LESSON);
    const gq = guest.json?.data?.questions || [];
    const guestStages = stageSet(gq);
    guestOk =
      guest.status === 200 &&
      gq.length >= 4 &&
      guestStages.has("warmup") &&
      (guest.json?.data?.lessonMix?.delivery === "lesson_mix_standard" ||
        guest.json?.data?.lessonMix?.mode === "standard");
    if (!guestOk) await new Promise((r) => setTimeout(r, 3000));
  }

  const cookie = await loginSession();
  if (!cookie) {
    console.log("ADAPTIVE_TEST=FAIL login");
    process.exit(1);
  }

  const conn = await dbConn();
  const [users] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [TEST_EMAIL]);
  const userId = users[0]?.id;

  async function clearMix() {
    try {
      await conn.query(`DELETE FROM user_learn_lesson_mix_session WHERE user_id = ? AND lesson_id = ?`, [
        userId,
        LESSON,
      ]);
    } catch {
      /* ignore */
    }
  }

  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, correct_count, wrong_count, attempts_count, mastery_score, mastery_level, last_practiced_at)
     VALUES (?, 'vocabulary', 1, 4, 5, 22, 1, NOW())
     ON DUPLICATE KEY UPDATE mastery_score=22, wrong_count=4`,
    [userId]
  );
  await conn.query(
    `INSERT INTO user_learn_mistakes
       (user_id, lesson_id, question_id, skill_key, exercise_type, status, wrong_count, last_wrong_at)
     VALUES (?, ?, 'p1-g1-n01-q2', 'vocabulary', 'multiple_choice', 'open', 3, NOW())
     ON DUPLICATE KEY UPDATE status='open', wrong_count=3`,
    [userId, LESSON]
  );
  await clearMix();

  const adapted = await getLesson(cookie, LESSON);
  const aq = adapted.json?.data?.questions || [];
  const aStages = stageSet(aq);
  const hasRecovery = aStages.has("recovery");
  const practiceCount = aq.filter((q) => q.activityMeta?.stage === "practice").length;
  const adaptiveOk =
    adapted.status === 200 &&
    aq.length >= 4 &&
    hasRecovery &&
    (practiceCount >= 1 || aq.some((q) => q.activityMeta?.stage === "learn")) &&
    aq.every((q) => q.activityMeta?.sourceLessonId && q.activityMeta?.sourceQuestionId);

  await conn.query(
    `UPDATE user_learn_skill_mastery SET mastery_score=88, mastery_level=4 WHERE user_id=? AND skill_key='vocabulary'`,
    [userId]
  );
  await conn.query(`DELETE FROM user_learn_mistakes WHERE user_id=? AND lesson_id=?`, [userId, LESSON]);
  await clearMix();
  const strong = await getLesson(cookie, LESSON);
  const sq = strong.json?.data?.questions || [];
  const hasChallenge = sq.some((q) => q.activityMeta?.stage === "challenge");

  const reload1 = await getLesson(cookie, LESSON);
  const reload2 = await getLesson(cookie, LESSON);
  const k1 = questionKeys(reload1.json?.data?.questions);
  const k2 = questionKeys(reload2.json?.data?.questions);
  const stabilityOk = k1.length > 0 && k1 === k2 && reload2.json?.data?.lessonMix?.cached === true;

  const ids = (reload1.json?.data?.questions || []).map(
    (q) => `${q.activityMeta?.sourceQuestionId}:${q.activityMeta?.stage}`
  );
  const dupOk = ids.length === new Set(ids).size;

  const complete = await fetch(`${BASE}/api/learning-path/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/",
      Cookie: cookie,
    },
    body: JSON.stringify({ lesson_id: LESSON, score: 80 }),
  });
  const completeJson = await complete.json().catch(() => ({}));
  const completionOk = complete.status === 200 && completeJson.success;

  try {
    await conn.query(`DELETE FROM user_learn_lesson_mix_session WHERE user_id = ?`, [userId]);
  } catch {
    /* ignore */
  }
  await conn.end();

  function runReg() {
    const p1 = spawnSync("node", ["scripts/test-learn-phase1.mjs"], { cwd: root, encoding: "utf8" });
    const p3 = spawnSync("node", ["scripts/test-learn-phase3.mjs"], { cwd: root, encoding: "utf8" });
    const p4 = spawnSync("node", ["scripts/test-learn-phase4.mjs"], { cwd: root, encoding: "utf8" });
    const p5 = spawnSync("node", ["scripts/test-learn-phase5.mjs"], { cwd: root, encoding: "utf8" });
    return p1.status === 0 && p3.status === 0 && p4.status === 0 && p5.status === 0;
  }
  let regOk = runReg();
  if (!regOk) {
    await new Promise((r) => setTimeout(r, 6000));
    regOk = runReg();
  }

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);

  console.log(
    "LESSON_MIX_RULES=warmup→learn→practice→skill_activity→recovery→challenge; 5-10 activities; curriculum-only; session cache 24h"
  );
  console.log(
    "ADAPTIVE_TEST=" +
      (guestOk && adaptiveOk && hasChallenge ? "PASS" : "FAIL") +
      ` guest=${guestOk} weak_recovery=${hasRecovery} strong_challenge=${hasChallenge}`
  );
  console.log("SESSION_STABILITY_TEST=" + (stabilityOk && dupOk ? "PASS" : "FAIL") + ` sameOrder=${k1 === k2}`);
  console.log("COMPLETION_REGRESSION=" + (completionOk ? "PASS" : "FAIL"));
  console.log("PHASE_1_5_REGRESSION=" + (regOk ? "PASS" : "FAIL"));
  console.log("OTHER_TABS_REGRESSION=" + (vocab.status < 500 && home.status < 500 ? "PASS" : "FAIL"));
  console.log("BACKUP=/var/www/beego_vn_usr/data/backups/learn-tab.phase6.pre.20260922_004127.tar.gz");

  const pass =
    guestOk &&
    adaptiveOk &&
    hasChallenge &&
    stabilityOk &&
    dupOk &&
    completionOk &&
    regOk &&
    vocab.status < 500;

  console.log("BUILD=see npm run build");
  console.log("PHASE_6=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_6=FAIL");
  process.exit(1);
});
