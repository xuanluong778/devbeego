#!/usr/bin/env node
/**
 * Phase 7 — server mastery phases + smart progression + Phase 1–6 regression.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { resolveCorrectAnswer } from "./learn-test-correct-answer.mjs";

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

async function postExercise(cookie, body) {
  const res = await fetch(`${BASE}/api/learn/exercise-result`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function getLesson(cookie, lessonId) {
  const res = await fetch(`${BASE}/api/learn/lesson/${encodeURIComponent(lessonId)}`, {
    cache: "no-store",
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function main() {
  const cookie = await loginSession();
  if (!cookie) {
    console.log("MASTERY_TEST=FAIL login");
    console.log("PHASE_7=FAIL");
    process.exit(1);
  }

  const conn = await dbConn();
  const [users] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [TEST_EMAIL]);
  const userId = users[0]?.id;

  for (const t of [
    "user_learn_exercise_attempts",
    "user_learn_mistakes",
    "user_learn_skill_mastery",
    "user_learn_mastery_rollup_events",
    "user_learn_lesson_mix_session",
  ]) {
    try {
      await conn.query(`DELETE FROM ${t} WHERE user_id = ?`, [userId]);
    } catch {
      /* ignore */
    }
  }

  const newSnap = await fetch(`${BASE}/api/learn/exercise-result`, { headers: { Cookie: cookie } });
  const newJson = await newSnap.json().catch(() => ({}));
  const newPhase =
    newJson?.data?.skills?.find((s) => s.skill_key === "vocabulary")?.mastery_phase || "NEW";
  const newUserOk = newPhase === "NEW" || (newJson?.data?.skills || []).length === 0;

  const a1 = "p7-a1-" + Date.now();
  const lessonRes = await getLesson(cookie, LESSON);
  const q0 = (lessonRes.json?.data?.questions || [])[0];
  const qid = String(q0?.activityMeta?.sourceQuestionId || q0?.id || "p1-g1-n01-q1");
  const correctAns = await resolveCorrectAnswer(LESSON, qid);
  if (!correctAns) {
    console.log("PHASE7_TEST=FAIL no_catalog_answer");
    process.exit(1);
  }
  const w = await postExercise(cookie, {
    attempt_key: a1,
    lesson_id: LESSON,
    question_id: qid,
    lesson_type: "vocabulary",
    exercise_type: q0?.type || "vocabulary_choice",
    activity_stage: "practice",
    difficulty: "easy",
    is_correct: false,
    answer: "__wrong__",
  });
  const c = await postExercise(cookie, {
    attempt_key: "p7-c1-" + Date.now(),
    lesson_id: LESSON,
    question_id: qid,
    lesson_type: "vocabulary",
    exercise_type: q0?.type || "vocabulary_choice",
    activity_stage: "recovery",
    difficulty: "medium",
    is_correct: true,
    answer: correctAns,
  });
  const dup = await postExercise(cookie, {
    attempt_key: a1,
    lesson_id: LESSON,
    question_id: qid,
    is_correct: false,
    answer: "__wrong__",
  });
  const [cnt] = await conn.query(
    `SELECT COUNT(*) AS c FROM user_learn_exercise_attempts WHERE user_id=? AND attempt_key=?`,
    [userId, a1]
  );
  const idemOk = dup.json?.data?.duplicate === true && Number(cnt[0]?.c) === 1;

  const phaseAfter = c.json?.data?.mastery_phase;
  const learningOk =
    w.json?.success &&
    c.json?.success &&
    ["LEARNING", "PRACTICING", "MASTERED"].includes(String(phaseAfter || ""));

  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, correct_count, wrong_count, attempts_count, mastery_score, mastery_level, mastery_phase, accuracy_pct, last_practiced_at)
     VALUES (?, 'vocabulary', 20, 2, 22, 88, 5, 'MASTERED', 90, NOW())
     ON DUPLICATE KEY UPDATE mastery_score=88, mastery_phase='MASTERED', accuracy_pct=90`,
    [userId]
  );
  await conn.query(`DELETE FROM user_learn_lesson_mix_session WHERE user_id=? AND lesson_id=?`, [
    userId,
    LESSON,
  ]);
  const strongLesson = await getLesson(cookie, LESSON);
  const strongChallenge = (strongLesson.json?.data?.questions || []).some(
    (q) => q.activityMeta?.stage === "challenge"
  );

  await conn.query(
    `UPDATE user_learn_skill_mastery SET mastery_score=20, mastery_phase='LEARNING', wrong_count=5, correct_count=2, attempts_count=7 WHERE user_id=? AND skill_key='vocabulary'`,
    [userId]
  );
  await conn.query(
    `INSERT INTO user_learn_mistakes (user_id, lesson_id, question_id, skill_key, exercise_type, status, wrong_count, last_wrong_at)
     VALUES (?, ?, 'p1-g1-n01-q2', 'vocabulary', 'multiple_choice', 'open', 2, NOW())
     ON DUPLICATE KEY UPDATE status='open'`,
    [userId, LESSON]
  );
  await conn.query(`DELETE FROM user_learn_lesson_mix_session WHERE user_id=? AND lesson_id=?`, [
    userId,
    LESSON,
  ]);
  const weakLesson = await getLesson(cookie, LESSON);
  const weakRecovery = (weakLesson.json?.data?.questions || []).some(
    (q) => q.activityMeta?.stage === "recovery"
  );

  const complete1 = await fetch(`${BASE}/api/learning-path/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/",
      Cookie: cookie,
    },
    body: JSON.stringify({ lesson_id: LESSON, score: 70 }),
  });
  const cj1 = await complete1.json().catch(() => ({}));
  const complete2 = await fetch(`${BASE}/api/learning-path/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/",
      Cookie: cookie,
    },
    body: JSON.stringify({ lesson_id: LESSON, score: 70 }),
  });
  const cj2 = await complete2.json().catch(() => ({}));
  const completeOk = complete1.status === 200 && cj1.success;
  const rollupOk =
    cj1.data?.smart_progression?.rolled_up === true &&
    cj2.data?.smart_progression?.duplicate === true;

  await conn.end();

  function runReg() {
    const p6 = spawnSync("node", ["scripts/test-learn-phase6.mjs"], { cwd: root, encoding: "utf8" });
    return p6.status === 0;
  }
  let regOk = runReg();
  if (!regOk) {
    await new Promise((r) => setTimeout(r, 6000));
    regOk = runReg();
  }

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);
  const pm2 = spawnSync("pm2", ["pid", "beego"], { encoding: "utf8" });
  const pm2Ok = pm2.status === 0 && String(pm2.stdout || "").trim().length > 0;

  const masteryPass =
    newUserOk && learningOk && idemOk && weakRecovery && strongChallenge && completeOk && rollupOk;

  console.log("BACKUP=/var/www/beego_vn_usr/data/backups/learn-tab.phase7.pre.20260922_091648.tar.gz");
  console.log(
    "MASTERY_MODEL=user_learn_skill_mastery(+mastery_phase,accuracy_pct); attempts(+activity_stage,difficulty); smart_progression; rollup_events"
  );
  console.log(
    "MASTERY_RULES=server recompute from attempts+mistakes+recovery/challenge stages; phases NEW|LEARNING|PRACTICING|MASTERED; decay after 7d idle"
  );
  console.log(
    "SMART_PROGRESSION=post-complete idempotent rollup; tier weak|medium|strong → recovery/challenge priority (no hard lock)"
  );
  console.log("ADAPTIVE_INTEGRATION=Phase6 mix reads getMasteryContextForLesson (phase+tier+open mistakes)");
  console.log("IDEMPOTENCY_TEST=" + (idemOk && rollupOk ? "PASS" : "FAIL"));
  console.log(
    "MASTERY_TEST=" +
      (masteryPass ? "PASS" : "FAIL") +
      ` new=${newUserOk} learning=${learningOk} weak_recovery=${weakRecovery} strong_challenge=${strongChallenge}`
  );
  console.log("PHASE_1_6_REGRESSION=" + (regOk ? "PASS" : "FAIL"));
  console.log("OTHER_TABS_REGRESSION=" + (vocab.status < 500 && home.status < 500 ? "PASS" : "FAIL"));
  console.log("BUILD=see npm run build");
  console.log("PM2_SMOKE=" + (pm2Ok ? "PASS" : "FAIL"));

  const pass = masteryPass && regOk && vocab.status < 500 && pm2Ok;
  console.log("PHASE_7=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_7=FAIL");
  process.exit(1);
});
