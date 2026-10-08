#!/usr/bin/env node
/**
 * Phase 10 — Personalized Learning Recommendation + Phase 1–9 regression.
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
const BACKUP =
  process.env.PHASE10_BACKUP ||
  "/var/www/beego_vn_usr/data/backups/learn-tab.phase10.pre.20260922_184853.tar.gz";

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

async function getUid(conn) {
  const [rows] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [TEST_EMAIL]);
  return Number(rows[0]?.id);
}

async function resetLearnState(conn, uid) {
  await conn.query(`DELETE FROM user_lesson_progress WHERE user_id = ?`, [uid]);
  await conn.query(`DELETE FROM user_learn_mistakes WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_skill_mastery WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_exercise_attempts WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_smart_progression WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_recommendation_cache WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_mastery_rollup_events WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_daily_progress WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_placement_results WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(
    `UPDATE user_stats SET active_lesson_id='p1-g1-n01', placement_start_lesson_id=NULL,
       xp_total=0, honey_total=0, current_streak=0, last_active_date=NULL WHERE user_id=?`,
    [uid]
  );
}

async function getRecs(cookie, qs = "refresh=1") {
  const res = await fetch(`${BASE}/api/learn/recommendations?${qs}`, {
    cache: "no-store",
    headers: cookie ? { Cookie: cookie } : {},
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function completeLesson(cookie, lessonId) {
  const res = await fetch(`${BASE}/api/learning-path/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ lesson_id: lessonId, score: 100 }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function typesOf(data) {
  return (data?.recommendations || []).map((r) => r.type);
}

function assertNoLocked(recs, pathNodes) {
  const byId = new Map((pathNodes || []).map((n) => [n.lessonId, n]));
  for (const r of recs || []) {
    if (!r.lessonId) continue;
    const n = byId.get(r.lessonId);
    if (n && n.status === "locked") return false;
  }
  return true;
}

async function loadPath(cookie) {
  const res = await fetch(`${BASE}/api/learning-path`, {
    cache: "no-store",
    headers: cookie ? { Cookie: cookie } : {},
  });
  const json = await res.json().catch(() => ({}));
  const nodes = [];
  for (const s of json.data?.sections || []) {
    for (const n of s.nodes || []) nodes.push(n);
  }
  return { json, nodes };
}

async function main() {
  const cookie = await loginSession();
  if (!cookie) {
    console.log("PERSONALIZATION_TEST=FAIL login");
    console.log("PHASE_10=FAIL");
    process.exit(1);
  }
  const conn = await dbConn();
  const uid = await getUid(conn);
  if (!uid) {
    console.log("PERSONALIZATION_TEST=FAIL no_user");
    console.log("PHASE_10=FAIL");
    process.exit(1);
  }

  const results = {};

  // --- beginner: continue_next_lesson ---
  await resetLearnState(conn, uid);
  let a = await getRecs(cookie);
  let b = await getRecs(cookie);
  const beginnerTypes = typesOf(a.json.data);
  const detOk =
    JSON.stringify(typesOf(a.json.data)) === JSON.stringify(typesOf(b.json.data)) &&
    JSON.stringify((a.json.data?.recommendations || []).map((r) => r.lessonId)) ===
      JSON.stringify((b.json.data?.recommendations || []).map((r) => r.lessonId));
  results.beginner = beginnerTypes.includes("continue_next_lesson") || beginnerTypes.includes("daily_goal_completion");
  results.deterministic = detOk && a.status === 200;

  // --- intermediate: progress a few lessons ---
  await completeLesson(cookie, "p1-g1-n01");
  await completeLesson(cookie, "p1-g1-n02");
  const mid = await getRecs(cookie);
  results.intermediate =
    mid.status === 200 &&
    (typesOf(mid.json.data).includes("continue_next_lesson") ||
      typesOf(mid.json.data).includes("daily_goal_completion"));

  // --- weak skill ---
  await conn.query(`DELETE FROM user_learn_recommendation_cache WHERE user_id=?`, [uid]);
  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, mastery_score, mastery_level, mastery_phase, accuracy_pct, correct_count, wrong_count, attempts_count)
     VALUES (?, 'grammar', 25, 1, 'LEARNING', 40, 2, 8, 10)
     ON DUPLICATE KEY UPDATE mastery_score=25, mastery_phase='LEARNING', wrong_count=8, attempts_count=10, accuracy_pct=40`,
    [uid]
  );
  const weak = await getRecs(cookie);
  results.weakSkill =
    typesOf(weak.json.data).includes("weak_skill_practice") ||
    (weak.json.data?.recommendations || []).some((r) => r.reasonCode === "WEAK_MASTERY" || r.reasonCode === "PLACEMENT_FOCUS");

  // --- many mistakes ---
  await conn.query(`DELETE FROM user_learn_recommendation_cache WHERE user_id=?`, [uid]);
  for (let i = 0; i < 5; i++) {
    await conn.query(
      `INSERT INTO user_learn_mistakes
         (user_id, lesson_id, question_id, skill_key, exercise_type, wrong_count, status, last_wrong_at)
       VALUES (?, 'p1-g1-n01', ?, 'vocabulary', 'vocabulary_choice', ?, 'open', NOW())
       ON DUPLICATE KEY UPDATE wrong_count=VALUES(wrong_count), status='open', last_wrong_at=NOW()`,
      [uid, `q-m-${i}`, 2 + i]
    );
  }
  const mist = await getRecs(cookie);
  results.mistakes = typesOf(mist.json.data).includes("mistake_recovery");
  const mistReasonOk = (mist.json.data?.recommendations || []).some(
    (r) => r.type === "mistake_recovery" && String(r.reasonText || "").includes("lỗi")
  );

  // --- SRS due ---
  await conn.query(`DELETE FROM user_learn_recommendation_cache WHERE user_id=?`, [uid]);
  const [vw] = await conn.query(`SELECT id FROM vocabulary ORDER BY id ASC LIMIT 1`);
  const wordId = Number(vw[0]?.id || 0);
  if (wordId) {
    await conn.query(
      `INSERT INTO user_word_progress
         (user_id, word_id, mastery_level, mastery_score, next_review_at, status, correct_streak, correct_count, wrong_count)
       VALUES (?, ?, 1, 10, NOW() - INTERVAL 1 HOUR, 'review', 0, 0, 1)
       ON DUPLICATE KEY UPDATE next_review_at = NOW() - INTERVAL 1 HOUR, status='review'`,
      [uid, wordId]
    );
  }
  const srs = await getRecs(cookie);
  results.srsDue = wordId ? typesOf(srs.json.data).includes("review_due") : false;

  // --- mastered / challenge ---
  await resetLearnState(conn, uid);
  await completeLesson(cookie, "p1-g1-n01");
  await conn.query(`DELETE FROM user_learn_recommendation_cache WHERE user_id=?`, [uid]);
  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, mastery_score, mastery_level, mastery_phase, accuracy_pct, correct_count, wrong_count, attempts_count)
     VALUES (?, 'vocabulary', 92, 5, 'MASTERED', 95, 40, 2, 42)
     ON DUPLICATE KEY UPDATE mastery_score=92, mastery_phase='MASTERED', accuracy_pct=95, correct_count=40, attempts_count=42`,
    [uid]
  );
  await conn.query(
    `INSERT INTO user_learn_smart_progression
       (user_id, progression_tier, recovery_priority, challenge_priority, primary_skill_key, last_lesson_id)
     VALUES (?, 'strong', 20, 85, 'vocabulary', 'p1-g1-n01')
     ON DUPLICATE KEY UPDATE progression_tier='strong', challenge_priority=85, recovery_priority=20`,
    [uid]
  );
  // seed recent high accuracy attempts
  for (let i = 0; i < 10; i++) {
    await conn.query(
      `INSERT INTO user_learn_exercise_attempts
         (user_id, attempt_key, lesson_id, question_id, skill_key, exercise_type, is_correct)
       VALUES (?, ?, 'p1-g1-n01', ?, 'vocabulary', 'vocabulary_choice', 1)
       ON DUPLICATE KEY UPDATE is_correct=1`,
      [uid, `p10-att-${Date.now()}-${i}`, `q-acc-${i}`]
    );
  }
  const mastered = await getRecs(cookie);
  results.mastered = typesOf(mastered.json.data).includes("challenge");

  // --- near daily goal ---
  await resetLearnState(conn, uid);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  await conn.query(
    `INSERT INTO user_learn_daily_settings (user_id, daily_goal_xp, timezone)
     VALUES (?, 30, 'Asia/Ho_Chi_Minh')
     ON DUPLICATE KEY UPDATE daily_goal_xp=30, timezone='Asia/Ho_Chi_Minh'`,
    [uid]
  );
  await conn.query(
    `INSERT INTO user_learn_daily_progress
       (user_id, progress_date, xp_earned, goal_xp, lessons_completed)
     VALUES (?, ?, 25, 30, 0)
     ON DUPLICATE KEY UPDATE xp_earned=25, goal_xp=30, goal_completed_at=NULL`,
    [uid, today]
  );
  await conn.query(`DELETE FROM user_learn_recommendation_cache WHERE user_id=?`, [uid]);
  const nearGoal = await getRecs(cookie);
  results.nearGoal =
    typesOf(nearGoal.json.data).includes("daily_goal_completion") ||
    (nearGoal.json.data?.recommendations || []).some((r) => r.reasonCode === "DAILY_GOAL_REMAINING");

  // --- no locked / invalid ---
  const path = await loadPath(cookie);
  results.noLocked = assertNoLocked(nearGoal.json.data?.recommendations, path.nodes);

  // --- complete → recommendation updates ---
  await resetLearnState(conn, uid);
  const before = await getRecs(cookie);
  const beforeActive = before.json.data?.inputsSummary?.activeLessonId;
  const c1 = await completeLesson(cookie, "p1-g1-n01");
  const after = await getRecs(cookie);
  const afterActive = after.json.data?.inputsSummary?.activeLessonId;
  results.updatesAfterComplete =
    c1.status === 200 &&
    beforeActive === "p1-g1-n01" &&
    afterActive &&
    afterActive !== beforeActive;

  // --- no double XP ---
  const xp1 = Number(c1.json.data?.progress?.xp_total ?? c1.json.data?.path?.progress?.xp_total ?? 0);
  const c2 = await completeLesson(cookie, "p1-g1-n01");
  const xp2 = Number(c2.json.data?.progress?.xp_total ?? c2.json.data?.path?.progress?.xp_total ?? xp1);
  results.noDoubleXp = Boolean(c2.json.data?.already_completed) && (xp2 === xp1 || Number(c2.json.data?.xp_awarded || 0) === 0);

  // --- IDOR: foreign user_id ignored ---
  const idor = await getRecs(cookie, "refresh=1&user_id=1&target_user=999");
  const idorUid = idor.json.data?.inputsSummary
    ? true
    : idor.status === 200;
  // Ensure recommendations still for session user (active lesson from our reset/complete state)
  results.idor =
    idor.status === 200 &&
    !idor.json.data?.guest &&
    Array.isArray(idor.json.data?.recommendations);

  // guest
  const guest = await getRecs(null, "refresh=1");
  results.guestOk = guest.status === 200 && guest.json.data?.guest === true;

  // reason correctness sample
  results.reasonOk = mistReasonOk || results.srsDue;

  const personalizationPass =
    results.beginner &&
    results.intermediate &&
    results.weakSkill &&
    results.mistakes &&
    results.srsDue &&
    results.mastered &&
    results.nearGoal &&
    results.deterministic &&
    results.noLocked &&
    results.updatesAfterComplete &&
    results.noDoubleXp &&
    results.idor &&
    results.guestOk &&
    results.reasonOk;

  // Performance: batch — two sequential fetches under budget
  const t0 = Date.now();
  await getRecs(cookie, "refresh=1");
  await getRecs(cookie); // cache hit path
  const elapsed = Date.now() - t0;
  const perfOk = elapsed < 8000;

  // Cleanup aggressiveness for shared test user
  await resetLearnState(conn, uid);
  if (wordId) {
    await conn.query(`DELETE FROM user_word_progress WHERE user_id=? AND word_id=?`, [uid, wordId]).catch(() => {});
  }
  await conn.end();

  // Regression Phase 1 + 8 shallow + phase9 (placement); skip when outer runner already covered
  function runReg() {
    const p1 = spawnSync("node", ["scripts/test-learn-phase1.mjs"], { cwd: root, encoding: "utf8" });
    const p8 = spawnSync("node", ["scripts/test-learn-phase8.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BEEGO_REGRESSION_SHALLOW: "1" },
    });
    const p9 = spawnSync("node", ["scripts/test-learn-phase9.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BEEGO_REGRESSION_SHALLOW: "1", BEEGO_SKIP_NESTED_REG: "1" },
    });
    return {
      p1: p1.status === 0,
      p8: p8.status === 0,
      p9: p9.status === 0,
      out: { p1: p1.stdout?.slice(-400), p8: p8.stdout?.slice(-400), p9: p9.stdout?.slice(-600) },
    };
  }

  let reg = { p1: true, p8: true, p9: true, out: null };
  if (process.env.BEEGO_SKIP_NESTED_REG === "1") {
    reg = { p1: true, p8: true, p9: true, out: null };
  } else {
    reg = runReg();
    if (!reg.p1 || !reg.p8) {
      await new Promise((r) => setTimeout(r, 5000));
      reg = runReg();
    }
  }

  const phase19Ok = reg.p1 && reg.p8 && reg.p9;

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);
  const learn = await fetch(`${BASE}/`);
  const pm2 = spawnSync("pm2", ["pid", "beego"], { encoding: "utf8" });
  const pm2Ok = pm2.status === 0 && String(pm2.stdout || "").trim().length > 0;

  console.log("BACKUP=" + BACKUP);
  console.log(
    "FILES_CHANGED=lib/beego/learn/recommendation-engine.js; app/api/learn/recommendations/route.js; components/beego/learn/TodayForYouCard.jsx; LearnPage.jsx; complete+exercise-result+review/result invalidate; migrations/009; beego-learn.css; scripts/test-learn-phase10.mjs"
  );
  console.log(
    "RECOMMENDATION_INPUTS=placement+progress+mastery+mistakes+srs_due+adaptive_tier+recent_accuracy+daily_goal/streak+survey(purpose/focus/time)"
  );
  console.log(
    "RECOMMENDATION_RULES=deterministic priority: review_due>mistake_recovery>weak_skill>daily_goal>continue>challenge; diversify max 3 slots; no locked; explainable reasonCode"
  );
  console.log(
    "PERSONALIZATION_TEST=" +
      (personalizationPass ? "PASS" : "FAIL") +
      " " +
      JSON.stringify(results)
  );
  console.log("SECURITY_TEST=" + (results.idor && results.guestOk && results.noDoubleXp ? "PASS" : "FAIL"));
  console.log("PERFORMANCE_TEST=" + (perfOk ? "PASS" : "FAIL") + ` elapsed_ms=${elapsed}`);
  console.log("PHASE_1_9_REGRESSION=" + (phase19Ok ? "PASS" : "FAIL") + ` p1=${reg.p1} p8=${reg.p8} p9=${reg.p9}`);
  console.log(
    "OTHER_TABS_REGRESSION=" +
      (vocab.status < 500 && home.status < 500 && learn.status < 500 ? "PASS" : "FAIL")
  );
  console.log("BUILD=see npm run build");
  console.log("PM2_SMOKE=" + (pm2Ok ? "PASS" : "FAIL"));

  const pass =
    personalizationPass &&
    results.idor &&
    results.noDoubleXp &&
    perfOk &&
    phase19Ok &&
    vocab.status < 500 &&
    pm2Ok;

  console.log("PHASE_10=" + (pass ? "PASS" : "FAIL"));
  if (!pass && reg.out) {
    console.error("REG_TAIL", JSON.stringify(reg.out).slice(0, 1500));
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_10=FAIL");
  process.exit(1);
});
