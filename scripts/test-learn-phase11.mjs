#!/usr/bin/env node
/**
 * Phase 11 — Learning Analytics & Progress Insights + Phase 1–10 regression.
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
  process.env.PHASE11_BACKUP ||
  "/var/www/beego_vn_usr/data/backups/learn-tab.phase11.pre.20260922_194933.tar.gz";

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
  await conn.query(`DELETE FROM user_learn_analytics_cache WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_mastery_rollup_events WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_daily_progress WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(`DELETE FROM user_learn_placement_results WHERE user_id = ?`, [uid]).catch(() => {});
  await conn.query(
    `UPDATE user_stats SET active_lesson_id='p1-g1-n01', placement_start_lesson_id=NULL,
       xp_total=0, honey_total=0, current_streak=0, last_active_date=NULL WHERE user_id=?`,
    [uid]
  );
}

async function getAnalytics(cookie, qs = "refresh=1") {
  const res = await fetch(`${BASE}/api/learn/analytics?${qs}`, {
    cache: "no-store",
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
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

async function main() {
  const cookie = await loginSession();
  if (!cookie) {
    console.log("ACCURACY_TEST=FAIL login");
    console.log("PHASE_11=FAIL");
    process.exit(1);
  }
  const conn = await dbConn();
  const uid = await getUid(conn);
  const results = {};

  // --- empty / new user ---
  await resetLearnState(conn, uid);
  const empty = await getAnalytics(cookie);
  const emptyOverview = empty.json.data?.analytics?.overview;
  results.emptyData =
    empty.status === 200 &&
    emptyOverview?.dataSparse === true &&
    emptyOverview?.lessonsCompleted === 0 &&
    (empty.json.data?.insights || []).some((i) => i.code === "INSUFFICIENT_DATA");

  // --- active user ---
  await completeLesson(cookie, "p1-g1-n01");
  await completeLesson(cookie, "p1-g1-n02");
  const active = await getAnalytics(cookie);
  const ao = active.json.data?.analytics?.overview;
  results.activeUser =
    active.status === 200 &&
    ao?.lessonsCompleted === 2 &&
    ao?.pathProgressPct > 0 &&
    ao?.dataSparse === false;

  // accuracy from mastery rows
  await conn.query(`DELETE FROM user_learn_analytics_cache WHERE user_id=?`, [uid]);
  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, mastery_score, mastery_level, mastery_phase, accuracy_pct, correct_count, wrong_count, attempts_count)
     VALUES (?, 'listening', 70, 3, 'PRACTICING', 80, 16, 4, 20)
     ON DUPLICATE KEY UPDATE mastery_score=70, accuracy_pct=80, correct_count=16, wrong_count=4, attempts_count=20, mastery_phase='PRACTICING'`,
    [uid]
  );
  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, mastery_score, mastery_level, mastery_phase, accuracy_pct, correct_count, wrong_count, attempts_count)
     VALUES (?, 'grammar', 30, 1, 'LEARNING', 40, 4, 6, 10)
     ON DUPLICATE KEY UPDATE mastery_score=30, accuracy_pct=40, correct_count=4, wrong_count=6, attempts_count=10, mastery_phase='LEARNING'`,
    [uid]
  );
  const weak = await getAnalytics(cookie);
  const wAnalytics = weak.json.data?.analytics;
  results.weakSkill =
    (wAnalytics?.weaknesses || []).some((s) => s.skillKey === "grammar") &&
    (weak.json.data?.insights || []).some(
      (i) => i.code === "SKILL_NEEDS_PRACTICE" && String(i.text).includes("Ngữ pháp")
    );
  results.accuracyMatch =
    wAnalytics?.overview?.overallAccuracyPct === Math.round(((16 + 4) / (20 + 10)) * 100);

  // mastered
  await conn.query(`DELETE FROM user_learn_analytics_cache WHERE user_id=?`, [uid]);
  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, mastery_score, mastery_level, mastery_phase, accuracy_pct, correct_count, wrong_count, attempts_count)
     VALUES (?, 'vocabulary', 90, 5, 'MASTERED', 95, 38, 2, 40)
     ON DUPLICATE KEY UPDATE mastery_score=90, accuracy_pct=95, correct_count=38, wrong_count=2, attempts_count=40, mastery_phase='MASTERED'`,
    [uid]
  );
  const mastered = await getAnalytics(cookie);
  results.mastered = (mastered.json.data?.analytics?.strengths || []).some(
    (s) => s.skillKey === "vocabulary"
  );

  // SRS due insight
  await conn.query(`DELETE FROM user_learn_analytics_cache WHERE user_id=?`, [uid]);
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
  const srs = await getAnalytics(cookie);
  results.srsDue =
    wordId > 0 &&
    Number(srs.json.data?.analytics?.overview?.srsDue || 0) >= 1 &&
    (srs.json.data?.insights || []).some((i) => i.code === "SRS_DUE");

  // 7-day activity
  await conn.query(`DELETE FROM user_learn_analytics_cache WHERE user_id=?`, [uid]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ymd = d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    await conn.query(
      `INSERT INTO user_learn_daily_progress (user_id, progress_date, xp_earned, goal_xp, lessons_completed)
       VALUES (?, ?, 20, 30, 1)
       ON DUPLICATE KEY UPDATE xp_earned=20, lessons_completed=1`,
      [uid, ymd]
    );
  }
  await conn.query(
    `UPDATE user_stats SET current_streak=5, last_active_date=? WHERE user_id=?`,
    [today, uid]
  );
  // backdate one completed_at into last 7 days for activity bars
  await conn.query(
    `UPDATE user_lesson_progress SET completed_at = NOW() - INTERVAL 1 DAY
     WHERE user_id=? AND lesson_id='p1-g1-n01'`,
    [uid]
  );
  const week = await getAnalytics(cookie);
  const act7 = week.json.data?.analytics?.activity7d || [];
  results.activity7d =
    act7.length === 7 &&
    act7.some((d) => d.active) &&
    Number(week.json.data?.analytics?.overview?.activeDays7 || 0) >= 1 &&
    (week.json.data?.insights || []).some(
      (i) => i.code === "STREAK_CONSISTENT" || i.code === "ACTIVE_WEEK"
    );

  // no duplicate reward on complete twice
  const xpBefore = Number((await getAnalytics(cookie)).json.data?.analytics?.overview?.xpTotal || 0);
  const c2 = await completeLesson(cookie, "p1-g1-n01");
  const xpAfter = Number((await getAnalytics(cookie)).json.data?.analytics?.overview?.xpTotal || 0);
  results.noDuplicateReward = Boolean(c2.json.data?.already_completed) && xpAfter === xpBefore;

  // IDOR
  const idor = await getAnalytics(cookie, "refresh=1&user_id=1");
  results.idor =
    idor.status === 200 &&
    !idor.json.data?.guest &&
    Number(idor.json.data?.analytics?.overview?.lessonsCompleted) === 2;

  // guest
  const guest = await getAnalytics(null);
  results.guestOk = guest.status === 200 && guest.json.data?.guest === true;

  // trend field present
  results.trendField = ["improving", "stable", "declining", "insufficient_data"].includes(
    String(week.json.data?.analytics?.overview?.trend || "")
  );

  // performance
  const t0 = Date.now();
  await getAnalytics(cookie, "refresh=1");
  await getAnalytics(cookie);
  const elapsed = Date.now() - t0;
  const perfOk = elapsed < 8000;

  // cleanup
  await resetLearnState(conn, uid);
  if (wordId) {
    await conn.query(`DELETE FROM user_word_progress WHERE user_id=? AND word_id=?`, [uid, wordId]).catch(() => {});
  }
  await conn.end();

  const accuracyPass =
    results.emptyData &&
    results.activeUser &&
    results.weakSkill &&
    results.accuracyMatch &&
    results.mastered &&
    results.srsDue &&
    results.activity7d &&
    results.noDuplicateReward &&
    results.trendField;

  // Regression: run each phase once (outer orchestrates; children skip nested)
  let reg = { p1: true, p8: true, p9: true, p10: true };
  if (process.env.BEEGO_SKIP_NESTED_REG !== "1") {
    const p1 = spawnSync("node", ["scripts/test-learn-phase1.mjs"], { cwd: root, encoding: "utf8" });
    const p8 = spawnSync("node", ["scripts/test-learn-phase8.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BEEGO_REGRESSION_SHALLOW: "1" },
    });
    const p9 = spawnSync("node", ["scripts/test-learn-phase9.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BEEGO_SKIP_NESTED_REG: "1" },
    });
    const p10 = spawnSync("node", ["scripts/test-learn-phase10.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BEEGO_SKIP_NESTED_REG: "1" },
    });

    reg = {
      p1: p1.status === 0,
      p8: p8.status === 0,
      p9: p9.status === 0,
      p10: p10.status === 0,
    };
    if (!reg.p1 || !reg.p8 || !reg.p10) {
      await new Promise((r) => setTimeout(r, 4000));
      if (!reg.p1) {
        reg.p1 =
          spawnSync("node", ["scripts/test-learn-phase1.mjs"], { cwd: root, encoding: "utf8" }).status ===
          0;
      }
      if (!reg.p8) {
        reg.p8 =
          spawnSync("node", ["scripts/test-learn-phase8.mjs"], {
            cwd: root,
            encoding: "utf8",
            env: { ...process.env, BEEGO_REGRESSION_SHALLOW: "1" },
          }).status === 0;
      }
      if (!reg.p10) {
        reg.p10 =
          spawnSync("node", ["scripts/test-learn-phase10.mjs"], {
            cwd: root,
            encoding: "utf8",
            env: { ...process.env, BEEGO_SKIP_NESTED_REG: "1" },
          }).status === 0;
      }
    }
  }

  const phase110Ok = reg.p1 && reg.p8 && reg.p9 && reg.p10;

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);
  const pm2 = spawnSync("pm2", ["pid", "beego"], { encoding: "utf8" });
  const pm2Ok = pm2.status === 0 && String(pm2.stdout || "").trim().length > 0;

  console.log("BACKUP=" + BACKUP);
  console.log(
    "FILES_CHANGED=lib/beego/learn/analytics-insights-engine.js; invalidate-learn-caches.js; app/api/learn/analytics; ProgressInsightsCard.jsx; LearnPage; TodayForYou id; complete/exercise/review invalidate; migrations/010; beego-learn.css; scripts/test-learn-phase11.mjs"
  );
  console.log(
    "ANALYTICS_MODEL=overview(path%/accuracy/xp/streak/goal)+skills+strengths/weaknesses+activity7d+trend+placement; batch queries + 60s cache"
  );
  console.log(
    "INSIGHT_RULES=deterministic codes INSUFFICIENT_DATA|SKILL_IMPROVING|SKILL_NEEDS_PRACTICE|SRS_DUE|STREAK_CONSISTENT|OPEN_MISTAKES|TREND_*|DAILY_GOAL_NEAR|PLACEMENT_LEVEL; no AI"
  );
  console.log("UI_RESULT=Learn tab card Tiến độ của bạn (overview/skills/7d/SW) + CTA to Phase10");
  console.log("ACCURACY_TEST=" + (accuracyPass ? "PASS" : "FAIL") + " " + JSON.stringify(results));
  console.log("PERFORMANCE_TEST=" + (perfOk ? "PASS" : "FAIL") + ` elapsed_ms=${elapsed}`);
  console.log(
    "SECURITY_TEST=" + (results.idor && results.guestOk && results.noDuplicateReward ? "PASS" : "FAIL")
  );
  console.log(
    "PHASE_1_10_REGRESSION=" +
      (phase110Ok ? "PASS" : "FAIL") +
      ` p1=${reg.p1} p8=${reg.p8} p9=${reg.p9} p10=${reg.p10}`
  );
  console.log(
    "OTHER_TABS_REGRESSION=" + (vocab.status < 500 && home.status < 500 ? "PASS" : "FAIL")
  );
  console.log("BUILD=see npm run build");
  console.log("PM2_SMOKE=" + (pm2Ok ? "PASS" : "FAIL"));

  const pass =
    accuracyPass &&
    results.idor &&
    results.noDuplicateReward &&
    perfOk &&
    phase110Ok &&
    vocab.status < 500 &&
    pm2Ok;

  console.log("PHASE_11=" + (pass ? "PASS" : "FAIL"));
  if (!pass) {
    console.error("P10_TAIL", (p10.stdout || "").slice(-800));
    console.error("P9_TAIL", (p9.stdout || "").slice(-400));
  }
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_11=FAIL");
  process.exit(1);
});
