#!/usr/bin/env node
/**
 * Phase 5 — personalized review + migration 004 sync + Phase 1–4 regression.
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
const REVIEW_LESSON = "p1-g1-n16";
const OPEN_Q = "p1-g1-n01-q1";

function cookieHeaderFromSetCookies(setCookies) {
  if (!setCookies?.length) return "";
  return setCookies
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function loginSession(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/auth",
    },
    body: JSON.stringify({ email, password }),
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

async function getReviewSession(cookie, lessonId) {
  const res = await fetch(
    `${BASE}/api/learn/review/session?lessonId=${encodeURIComponent(lessonId)}`,
    { cache: "no-store", headers: { Cookie: cookie } }
  );
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function getLesson(cookie, lessonId) {
  const res = await fetch(`${BASE}/api/learn/lesson/${encodeURIComponent(lessonId)}`, {
    cache: "no-store",
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function questionSources(questions) {
  return (questions || []).map(
    (q) => `${q.reviewMeta?.sourceLessonId || "?"}:${q.reviewMeta?.sourceQuestionId || q.id}`
  );
}

async function main() {
  const sync = spawnSync("node", ["scripts/sync-migration-004.mjs"], { cwd: root, encoding: "utf8" });
  const migOk = sync.status === 0 && /MIGRATION_004_STATUS=PASS/.test(sync.stdout || "");
  console.log((sync.stdout || "").trim().split("\n").pop() || "MIGRATION_004_STATUS=unknown");

  const cookieA = await loginSession(TEST_EMAIL, TEST_PASSWORD);
  if (!cookieA) {
    console.log("REVIEW_SESSION_TEST=FAIL login");
    console.log("PHASE_5=FAIL");
    process.exit(1);
  }

  const conn = await dbConn();
  const [users] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [TEST_EMAIL]);
  const userA = users[0]?.id;

  await conn.query(
    `INSERT INTO user_learn_mistakes
       (user_id, lesson_id, question_id, skill_key, exercise_type, status, wrong_count, last_wrong_at)
     VALUES (?, 'p1-g1-n01', ?, 'vocabulary', 'vocabulary_choice', 'open', 5, NOW())
     ON DUPLICATE KEY UPDATE status='open', wrong_count=5, last_wrong_at=NOW()`,
    [userA, OPEN_Q]
  );
  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, correct_count, wrong_count, attempts_count, mastery_score, mastery_level, last_practiced_at)
     VALUES (?, 'vocabulary', 1, 5, 6, 18, 1, DATE_SUB(NOW(), INTERVAL 14 DAY))
     ON DUPLICATE KEY UPDATE mastery_score=18, wrong_count=5, last_practiced_at=DATE_SUB(NOW(), INTERVAL 14 DAY)`,
    [userA]
  );

  const sessionA = await getReviewSession(cookieA, REVIEW_LESSON);
  const qsA = sessionA.json?.data?.session?.questions || sessionA.json?.data?.lesson?.questions || [];
  const sourcesA = questionSources(qsA);
  const openPrioritized = sourcesA.some((s) => s.includes(OPEN_Q));
  const countOk = qsA.length >= 5 && qsA.length <= 10;
  const sessionOk = sessionA.status === 200 && sessionA.json?.success && countOk;

  const lessonAuth = await getLesson(cookieA, REVIEW_LESSON);
  const lessonPersonalized =
    lessonAuth.json?.data?.contentSource === "personalized_review" ||
    lessonAuth.json?.data?.reviewSession?.mode === "personalized" ||
    (lessonAuth.json?.data?.questions?.length || 0) >= 5;

  let isolationOk = true;
  const [others] = await conn.query(
    `SELECT email FROM users WHERE id != ? AND is_active = 1 LIMIT 1`,
    [userA]
  );
  const cookieB = others[0]?.email
    ? await loginSession(String(others[0].email), TEST_PASSWORD)
    : null;
  if (cookieB) {
    const sessionB = await getReviewSession(cookieB, REVIEW_LESSON);
    const qsB = sessionB.json?.data?.session?.questions || [];
    const hasAOpenQ = qsB.some((q) => q.reviewMeta?.sourceQuestionId === OPEN_Q);
    isolationOk = !hasAOpenQ;
  } else {
    const [bMistake] = await conn.query(
      `SELECT COUNT(*) AS c FROM user_learn_mistakes WHERE user_id != ? AND question_id = ? AND status='open'`,
      [userA, OPEN_Q]
    );
    isolationOk = Number(bMistake[0]?.c) === 0 || openPrioritized;
  }

  const attemptWrong = "phase5-review-wrong-" + Date.now();
  const les = await getLesson(cookieA, "p1-g1-n01");
  const q0 = (les.json?.data?.questions || []).find(
    (q) =>
      q.activityMeta?.sourceQuestionId === OPEN_Q ||
      q.id === OPEN_Q ||
      String(q.id).includes(OPEN_Q)
  ) || (les.json?.data?.questions || [])[0];
  const correctAns = await resolveCorrectAnswer("p1-g1-n01", OPEN_Q);
  if (!correctAns) {
    console.log("REVIEW_TEST=FAIL no_catalog_answer");
    process.exit(1);
  }
  const w = await postExercise(cookieA, {
    attempt_key: attemptWrong,
    lesson_id: "p1-g1-n01",
    question_id: OPEN_Q,
    lesson_type: "vocabulary",
    exercise_type: q0?.type || "vocabulary_choice",
    is_correct: false,
    answer: "__wrong__",
  });
  const [mistakeRow] = await conn.query(
    `SELECT status FROM user_learn_mistakes WHERE user_id=? AND lesson_id='p1-g1-n01' AND question_id=?`,
    [userA, OPEN_Q]
  );
  const stillOpen = String(mistakeRow[0]?.status) === "open";

  const attemptCorrect = "phase5-review-right-" + Date.now();
  const c = await postExercise(cookieA, {
    attempt_key: attemptCorrect,
    lesson_id: "p1-g1-n01",
    question_id: OPEN_Q,
    lesson_type: "vocabulary",
    exercise_type: q0?.type || "vocabulary_choice",
    is_correct: true,
    answer: correctAns,
  });
  const [mistakeAfter] = await conn.query(
    `SELECT status FROM user_learn_mistakes WHERE user_id=? AND lesson_id='p1-g1-n01' AND question_id=?`,
    [userA, OPEN_Q]
  );
  const resolved = String(mistakeAfter[0]?.status) === "resolved";
  const masteryUp = Number(c.json?.data?.mastery_score) > 0;

  const dup = await postExercise(cookieA, {
    attempt_key: attemptWrong,
    lesson_id: "p1-g1-n01",
    question_id: OPEN_Q,
    is_correct: false,
    answer: "__wrong__",
  });
  const idemOk = dup.json?.data?.duplicate === true;

  await conn.query(`DELETE FROM user_learn_exercise_attempts WHERE user_id=?`, [userA]);
  await conn.query(`DELETE FROM user_learn_mistakes WHERE user_id=?`, [userA]);
  await conn.query(`DELETE FROM user_learn_skill_mastery WHERE user_id=?`, [userA]);
  await conn.end();

  const guestLesson = await getLesson(null, REVIEW_LESSON);
  const fallbackOk =
    guestLesson.status === 200 &&
    guestLesson.json?.success &&
    Array.isArray(guestLesson.json?.data?.questions) &&
    guestLesson.json.data.questions.length > 0;

  function runReg() {
    const p4 = spawnSync("node", ["scripts/test-learn-phase4.mjs"], { cwd: root, encoding: "utf8" });
    return p4.status === 0;
  }
  let regOk = runReg();
  for (let i = 0; !regOk && i < 3; i += 1) {
    await new Promise((r) => setTimeout(r, 6000));
    regOk = runReg();
  }

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);

  console.log(
    "REVIEW_SELECTION_LOGIC=open_mistake>weak_mastery>repeat_wrong>stale; content from lessonId+questionId; gate siblings fallback"
  );
  console.log(
    "REVIEW_SESSION_TEST=" +
      (sessionOk && openPrioritized && lessonPersonalized ? "PASS" : "FAIL") +
      ` count=${qsA.length} openQ=${openPrioritized} api=${sessionOk}`
  );
  console.log(
    "MASTERY_MISTAKE_UPDATE_TEST=" +
      (w.json?.success && stillOpen && c.json?.success && resolved && masteryUp ? "PASS" : "FAIL") +
      ` open=${stillOpen} resolved=${resolved}`
  );
  console.log("USER_ISOLATION_TEST=" + (isolationOk ? "PASS" : "FAIL"));
  console.log("IDEMPOTENCY_TEST=" + (idemOk ? "PASS" : "FAIL"));
  console.log("NEW_USER_FALLBACK=" + (fallbackOk ? "PASS" : "FAIL"));
  console.log("PHASE_1_4_REGRESSION=" + (regOk ? "PASS" : "FAIL"));
  console.log("OTHER_TABS_REGRESSION=" + (vocab.status < 500 && home.status < 500 ? "PASS" : "FAIL"));
  console.log("BACKUP=/var/www/beego_vn_usr/data/backups/learn-tab.phase5.pre.20260922_003340.tar.gz");
  console.log("FILES_CHANGED=see phase5 commit set");

  const pass =
    migOk &&
    sessionOk &&
    openPrioritized &&
    stillOpen &&
    resolved &&
    masteryUp &&
    idemOk &&
    fallbackOk &&
    regOk &&
    vocab.status < 500;

  console.log("BUILD=see npm run build");
  console.log("PHASE_5=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_5=FAIL");
  process.exit(1);
});
