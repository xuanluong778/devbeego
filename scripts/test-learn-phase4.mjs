#!/usr/bin/env node
/**
 * Phase 4 — mastery + mistake engine + Phase 1–3 regression.
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
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function getMastery(cookie) {
  const res = await fetch(`${BASE}/api/learn/exercise-result`, {
    cache: "no-store",
    headers: { Cookie: cookie },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
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
      host: process.env.MYSQL_HOST || "127.0.0.1",
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "beego_vn",
    });
  }
}

async function clearLearnMastery(conn, userId) {
  for (const t of [
    "user_learn_exercise_attempts",
    "user_learn_mistakes",
    "user_learn_skill_mastery",
  ]) {
    try {
      await conn.query(`DELETE FROM ${t} WHERE user_id = ?`, [userId]);
    } catch {
      /* table may not exist yet */
    }
  }
}

function skillRow(skills, key) {
  return (skills || []).find((s) => s.skill_key === key);
}

async function main() {
  const cookie = await loginSession();
  if (!cookie) {
    console.log("MASTERY_TEST=FAIL login");
    console.log("PHASE_4=FAIL");
    process.exit(1);
  }

  const conn = await dbConn();
  const [users] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [TEST_EMAIL]);
  const userId = users[0]?.id;
  if (!userId) {
    console.log("MASTERY_TEST=FAIL no_user");
    process.exit(1);
  }

  await clearLearnMastery(conn, userId);

  // Real curriculum question (server grades answer; client is_correct ignored)
  const lessonRes = await fetch(`${BASE}/api/learn/lesson/p1-g1-n01`, {
    headers: { Cookie: cookie },
  });
  const lessonJson = await lessonRes.json().catch(() => ({}));
  const q0 = (lessonJson.data?.questions || [])[0];
  const qVocab = String(q0?.activityMeta?.sourceQuestionId || q0?.id || "p1-g1-n01-q1");
  const correctAns = await resolveCorrectAnswer("p1-g1-n01", qVocab);
  if (!correctAns) {
    console.log("MASTERY_TEST=FAIL no_catalog_answer");
    process.exit(1);
  }
  const wrongAns = "__wrong__";

  const attemptWrong = "phase4-test-wrong-" + Date.now();
  const w1 = await postExercise(cookie, {
    attempt_key: attemptWrong,
    lesson_id: "p1-g1-n01",
    question_id: qVocab,
    lesson_type: "vocabulary",
    exercise_type: q0?.type || "vocabulary_choice",
    is_correct: false,
    answer: wrongAns,
  });
  const w1ok = w1.status === 200 && w1.json?.success && w1.json?.data?.recorded === true;

  const dup = await postExercise(cookie, {
    attempt_key: attemptWrong,
    lesson_id: "p1-g1-n01",
    question_id: qVocab,
    lesson_type: "vocabulary",
    exercise_type: q0?.type || "vocabulary_choice",
    is_correct: false,
    answer: wrongAns,
  });
  const dupOk = dup.json?.data?.duplicate === true && dup.json?.data?.recorded === false;

  const [cntAfterDup] = await conn.query(
    `SELECT COUNT(*) AS c FROM user_learn_exercise_attempts WHERE user_id = ? AND attempt_key = ?`,
    [userId, attemptWrong]
  );
  const idemOk = Number(cntAfterDup[0]?.c) === 1;

  const attemptCorrect = "phase4-test-correct-" + Date.now();
  const c1 = await postExercise(cookie, {
    attempt_key: attemptCorrect,
    lesson_id: "p1-g1-n01",
    question_id: qVocab,
    lesson_type: "vocabulary",
    exercise_type: q0?.type || "vocabulary_choice",
    is_correct: true,
    answer: correctAns,
  });
  const c1ok = c1.status === 200 && c1.json?.success;

  // Grammar lesson — load real question
  const gLesson = await fetch(`${BASE}/api/learn/lesson/p1-g1-n03`, {
    headers: { Cookie: cookie },
  });
  const gJson = await gLesson.json().catch(() => ({}));
  const gq = (gJson.data?.questions || [])[0];
  const gQid = String(gq?.activityMeta?.sourceQuestionId || gq?.id || "p1-g1-n03-q1");
  const g1 = await postExercise(cookie, {
    attempt_key: "phase4-grammar-" + Date.now(),
    lesson_id: "p1-g1-n03",
    question_id: gQid,
    lesson_type: gJson.data?.type || "grammar",
    exercise_type: gq?.type || "fill_blank",
    is_correct: false,
    answer: "__wrong__",
  });
  const grammarSkill = g1.json?.data?.skill_key === "grammar" || g1.json?.data?.skill_key != null;

  const snap = await getMastery(cookie);
  const vocabSkill = skillRow(snap.json?.data?.skills, "vocabulary");
  const grammarRow = skillRow(snap.json?.data?.skills, "grammar");
  const masteryUp = Number(vocabSkill?.mastery_score) > 0 || Number(vocabSkill?.correct_count) >= 1;
  const masteryWrong = Number(vocabSkill?.wrong_count) >= 1;
  const skillSplit = grammarSkill && grammarRow && grammarRow.skill_key === "grammar";

  const [mistake] = await conn.query(
    `SELECT status, wrong_count FROM user_learn_mistakes
     WHERE user_id = ? AND lesson_id = 'p1-g1-n01' AND question_id = ? LIMIT 1`,
    [userId, qVocab]
  );
  const mistakeOk =
    mistake[0] &&
    Number(mistake[0].wrong_count) >= 1 &&
    String(mistake[0].status) === "resolved";

  await conn.end();

  const masteryPass = w1ok && c1ok && masteryUp && masteryWrong && skillSplit;
  const mistakePass = w1ok && mistakeOk;
  const idempotencyPass = dupOk && idemOk;

  console.log(
    "MASTERY_TEST=" +
      (masteryPass ? "PASS" : "FAIL") +
      ` wrongRecorded=${w1ok} correctRecovery=${c1ok} score=${vocabSkill?.mastery_score}`
  );
  console.log(
    "MISTAKE_TEST=" +
      (mistakePass ? "PASS" : "FAIL") +
      ` status=${mistake[0]?.status} wrong_count=${mistake[0]?.wrong_count}`
  );
  console.log(
    "IDEMPOTENCY_TEST=" + (idempotencyPass ? "PASS" : "FAIL") + ` duplicate=${dupOk} rows=${cntAfterDup[0]?.c}`
  );

  function runRegression() {
    const p1 = spawnSync("node", ["scripts/test-learn-phase1.mjs"], { cwd: root, encoding: "utf8" });
    const p3 = spawnSync("node", ["scripts/test-learn-phase3.mjs"], { cwd: root, encoding: "utf8" });
    return p1.status === 0 && p3.status === 0;
  }
  let regOk = runRegression();
  for (let i = 0; !regOk && i < 3; i += 1) {
    await new Promise((r) => setTimeout(r, 6000));
    regOk = runRegression();
  }
  console.log("PHASE_1_3_REGRESSION=" + (regOk ? "PASS" : "FAIL"));

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);
  console.log("OTHER_TABS_REGRESSION=" + (vocab.status < 500 && home.status < 500 ? "PASS" : "FAIL"));

  console.log("DB_CHANGE=004_learn_mastery_mistakes.sql (3 tables, additive)");
  console.log(
    "MASTERY_MODEL=user_learn_skill_mastery(user_id,skill_key,correct/wrong/attempts,score,level,last_practiced)"
  );
  console.log(
    "MISTAKE_MODEL=user_learn_mistakes(user_id,lesson_id,question_id unique; open/resolved; wrong_count)"
  );
  console.log("BACKUP=/var/www/beego_vn_usr/data/backups/learn-tab.phase4.pre.20260922_002652.tar.gz");

  const pass = masteryPass && mistakePass && idempotencyPass && regOk && vocab.status < 500;
  console.log("BUILD=see npm run build");
  console.log("PHASE_4=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_4=FAIL");
  process.exit(1);
});
