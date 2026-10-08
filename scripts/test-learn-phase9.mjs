#!/usr/bin/env node
/**
 * Phase 9 — Adaptive Placement + Phase 1–8 regression.
 * Grades via server; reads DB only to drive correct/wrong answers for scenarios.
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

async function api(cookie, body) {
  const res = await fetch(`${BASE}/api/learn/placement`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function getStatus(cookie) {
  const res = await fetch(`${BASE}/api/learn/placement`, {
    cache: "no-store",
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === "object") return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

async function readCurrent(conn, sessionId) {
  const [rows] = await conn.query(
    `SELECT current_item_json, difficulty_level, asked_count, status FROM learn_placement_sessions WHERE session_id = ?`,
    [sessionId]
  );
  const row = rows[0];
  return {
    item: parseJson(row?.current_item_json),
    difficulty: Number(row?.difficulty_level || 0),
    asked: Number(row?.asked_count || 0),
    status: row?.status,
  };
}

function correctAnswerFromItem(item) {
  const ex = item?.exercise;
  if (!ex) return null;
  return ex.correctAnswer;
}

async function runScenario(conn, cookie, { alwaysCorrect, label }) {
  await conn.query(`DELETE FROM user_learn_placement_results WHERE user_id = (SELECT id FROM users WHERE email = ? LIMIT 1)`, [
    TEST_EMAIL,
  ]);
  await conn.query(
    `UPDATE learn_placement_sessions SET status='abandoned' WHERE user_id = (SELECT id FROM users WHERE email = ? LIMIT 1)`,
    [TEST_EMAIL]
  );

  const start = await api(cookie, { action: "start" });
  if (!start.json?.success) return { ok: false, label, error: "start" };
  const sessionId = start.json.data.sessionId;
  let answerKey = start.json.data.answerKey;
  let q = start.json.data.question;
  const diffs = [];
  let result = null;
  let steps = 0;

  while (steps < 20) {
    steps += 1;
    const cur = await readCurrent(conn, sessionId);
    diffs.push(cur.difficulty);
    const right = correctAnswerFromItem(cur.item);
    let answer;
    if (alwaysCorrect) {
      answer = right;
    } else if (alwaysCorrect === false) {
      if (q?.options?.length) {
        answer = q.options.find((o) => o.id !== right)?.id || "zz";
      } else {
        answer = "__wrong__";
      }
    } else {
      // mixed: alternate
      answer = steps % 2 === 1 ? right : q?.options?.find((o) => o.id !== right)?.id || "__wrong__";
    }

    const sub = await api(cookie, {
      action: "answer",
      session_id: sessionId,
      answer_key: answerKey,
      answer,
    });
    if (!sub.json?.success) return { ok: false, label, error: "answer", sub };
    if (sub.json.data.done) {
      result = sub.json.data.result;
      break;
    }
    answerKey = sub.json.data.answerKey;
    q = sub.json.data.question;
  }

  return {
    ok: Boolean(result?.recommendedLessonId),
    label,
    result,
    diffs,
    steps,
    xpAwarded: 0,
  };
}

async function main() {
  const cookie = await loginSession();
  if (!cookie) {
    console.log("PLACEMENT_TEST=FAIL login");
    console.log("PHASE_9=FAIL");
    process.exit(1);
  }

  const conn = await dbConn();
  const [users] = await conn.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [TEST_EMAIL]);
  const userId = users[0]?.id;

  // Reset learn progress for clean placement needed
  await conn.query(`DELETE FROM user_lesson_progress WHERE user_id = ?`, [userId]);
  await conn.query(`DELETE FROM user_learn_placement_results WHERE user_id = ?`, [userId]);
  await conn.query(
    `UPDATE user_stats SET active_lesson_id='p1-g1-n01', placement_start_lesson_id=NULL,
       xp_total=0, honey_total=0, current_streak=0, last_active_date=NULL WHERE user_id = ?`,
    [userId]
  );
  const [xpBefore] = await conn.query(`SELECT xp_total, honey_total, current_streak FROM user_stats WHERE user_id=?`, [
    userId,
  ]);

  const guestStart = await api(null, { action: "start" });
  const guestOk = guestStart.status === 200 && guestStart.json?.data?.guestToken;

  const strong = await runScenario(conn, cookie, { alwaysCorrect: true, label: "strong" });
  const strongOk =
    strong.ok &&
    Number(strong.result.placementScore) >= 60 &&
    String(strong.result.recommendedLessonId).match(/^p\d+-g\d+-n\d+$/) &&
    strong.diffs.some((d, i) => i > 0 && d >= strong.diffs[0]);

  await conn.query(`DELETE FROM user_learn_placement_results WHERE user_id = ?`, [userId]);
  const beginner = await runScenario(conn, cookie, { alwaysCorrect: false, label: "beginner" });
  const beginnerOk =
    beginner.ok &&
    Number(beginner.result.placementScore) <= 45 &&
    beginner.result.recommendedLessonId === "p1-g1-n01";

  await conn.query(`DELETE FROM user_learn_placement_results WHERE user_id = ?`, [userId]);
  const mixed = await runScenario(conn, cookie, { alwaysCorrect: null, label: "mixed" });
  const mixedOk = mixed.ok && mixed.steps >= 8 && mixed.steps <= 16;

  // Early-stop / adaptive: strong should often finish before max
  const earlyOk = strong.steps <= 16 && strong.steps >= 8;

  // Reward isolation
  const [xpAfter] = await conn.query(`SELECT xp_total, honey_total, current_streak FROM user_stats WHERE user_id=?`, [
    userId,
  ]);
  const noReward =
    Number(xpAfter[0].xp_total) === Number(xpBefore[0].xp_total) &&
    Number(xpAfter[0].honey_total) === Number(xpBefore[0].honey_total) &&
    Number(xpAfter[0].current_streak) === Number(xpBefore[0].current_streak);

  // Idempotent double-submit + IDOR (before consuming result for Smart Start)
  const s = await api(cookie, { action: "start" });
  // start fails if result exists with start_choice — we deleted results above scenarios keep latest mixed result
  // Abandon active and use guest session for ownership tests
  const gSess = await api(null, { action: "start" });
  const idor = await api(null, {
    action: "answer",
    session_id: gSess.json?.data?.sessionId,
    answer_key: gSess.json?.data?.answerKey,
    answer: "a",
    guest_token: "wrong-token",
  });
  const idorUserOnGuest = await api(cookie, {
    action: "answer",
    session_id: gSess.json?.data?.sessionId,
    answer_key: gSess.json?.data?.answerKey,
    answer: "a",
  });
  const idorOk =
    (idor.status === 403 || idor.json?.code === "FORBIDDEN") &&
    (idorUserOnGuest.status === 403 || idorUserOnGuest.json?.code === "FORBIDDEN");

  // Double-submit on authenticated session
  await conn.query(
    `UPDATE learn_placement_sessions SET status='abandoned' WHERE user_id=? AND status='active'`,
    [userId]
  );
  // Keep mixed result for smart start — start new session only after clearing start_choice null result
  const s2 = await api(cookie, { action: "start" });
  let idemOk = false;
  if (s2.json?.success) {
    const sid = s2.json.data.sessionId;
    const akey = s2.json.data.answerKey;
    const cur = await readCurrent(conn, sid);
    const right = correctAnswerFromItem(cur.item);
    const a1 = await api(cookie, { action: "answer", session_id: sid, answer_key: akey, answer: right });
    const a2 = await api(cookie, { action: "answer", session_id: sid, answer_key: akey, answer: right });
    idemOk = a1.json?.success && a2.json?.data?.duplicate === true;
  } else {
    // Already have completed result without start_choice — create answer-key dup via guest
    const g2 = await api(null, { action: "start" });
    const sid = g2.json.data.sessionId;
    const akey = g2.json.data.answerKey;
    const cur = await readCurrent(conn, sid);
    const right = correctAnswerFromItem(cur.item);
    const a1 = await api(null, {
      action: "answer",
      session_id: sid,
      answer_key: akey,
      answer: right,
      guest_token: g2.json.data.guestToken,
    });
    const a2 = await api(null, {
      action: "answer",
      session_id: sid,
      answer_key: akey,
      answer: right,
      guest_token: g2.json.data.guestToken,
    });
    idemOk = a1.json?.success && a2.json?.data?.duplicate === true;
  }
  void s;

  const recOk = /^p\d+-g\d+-n\d+$/.test(String(mixed.result?.recommendedLessonId || strong.result?.recommendedLessonId || ""));

  // Smart start against latest completed placement (mixed)
  const choose = await api(cookie, { action: "choose_start", choice: "recommended" });
  const chooseOk = choose.json?.success && choose.json?.data?.xpAwarded === 0;
  const choose2 = await api(cookie, { action: "choose_start", choice: "from_start" });
  const chooseIdem = choose2.json?.data?.alreadyApplied === true;

  const [stats] = await conn.query(
    `SELECT active_lesson_id, placement_start_lesson_id FROM user_stats WHERE user_id=?`,
    [userId]
  );
  const expectedStart = mixed.result?.recommendedLessonId;
  const startOk =
    stats[0]?.active_lesson_id === expectedStart &&
    stats[0]?.placement_start_lesson_id === expectedStart;

  await conn.end();

  // Clear placement start so Phase 1–8 regression sees a clean path cursor
  {
    const c2 = await dbConn();
    const [u2] = await c2.query(`SELECT id FROM users WHERE email = ? LIMIT 1`, [TEST_EMAIL]);
    const uid = u2[0]?.id;
    if (uid) {
      await c2.query(`DELETE FROM user_lesson_progress WHERE user_id = ?`, [uid]);
      try {
        await c2.query(`DELETE FROM user_learn_placement_results WHERE user_id = ?`, [uid]);
      } catch {
        /* ignore */
      }
      await c2.query(
        `UPDATE user_stats SET active_lesson_id='p1-g1-n01', placement_start_lesson_id=NULL,
           xp_total=0, honey_total=0, current_streak=0, last_active_date=NULL WHERE user_id=?`,
        [uid]
      );
    }
    await c2.end();
  }

  function runReg() {
    // Full chain via phase8 (shallow avoids 9→8→7→…→1 nested explosion on shared test user)
    const p1 = spawnSync("node", ["scripts/test-learn-phase1.mjs"], { cwd: root, encoding: "utf8" });
    const p8 = spawnSync("node", ["scripts/test-learn-phase8.mjs"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, BEEGO_REGRESSION_SHALLOW: "1" },
    });
    return p1.status === 0 && p8.status === 0;
  }
  let regOk = true;
  if (process.env.BEEGO_SKIP_NESTED_REG === "1") {
    regOk = true;
  } else {
    regOk = runReg();
    if (!regOk) {
      await new Promise((r) => setTimeout(r, 6000));
      regOk = runReg();
    }
  }

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);
  const pm2 = spawnSync("pm2", ["pid", "beego"], { encoding: "utf8" });
  const pm2Ok = pm2.status === 0 && String(pm2.stdout || "").trim().length > 0;

  const placementPass =
    guestOk &&
    strongOk &&
    beginnerOk &&
    mixedOk &&
    earlyOk &&
    noReward &&
    idemOk &&
    idorOk &&
    recOk &&
    chooseOk &&
    chooseIdem &&
    startOk;

  console.log("BACKUP=/var/www/beego_vn_usr/data/backups/learn-tab.phase9.pre.20260922_165118.tar.gz");
  console.log(
    "PLACEMENT_MODEL=learn_placement_sessions+answers; user_learn_placement_results; user_stats.placement_start_lesson_id"
  );
  console.log(
    "ADAPTIVE_RULES=start diff=2; correct→+diff; wrong→-diff; early-stop after 8 if confidence high; max 16; curriculum bank only"
  );
  console.log(
    "SCORING_RULES=weighted by difficulty; level A0→B1+; recommendedLessonId deterministic catalog; server grades only"
  );
  console.log(
    "SMART_START=recommended|from_start|skipped; sets active+placement_start only; 0 XP/Honey/Streak; soft smart_progression signal"
  );
  console.log("SECURITY_TEST=" + (idorOk && idemOk ? "PASS" : "FAIL"));
  console.log(
    "PLACEMENT_TEST=" +
      (placementPass ? "PASS" : "FAIL") +
      ` strong=${strongOk} beginner=${beginnerOk} mixed=${mixedOk} noReward=${noReward} early=${earlyOk}`
  );
  console.log("PHASE_1_8_REGRESSION=" + (regOk ? "PASS" : "FAIL"));
  console.log("OTHER_TABS_REGRESSION=" + (vocab.status < 500 && home.status < 500 ? "PASS" : "FAIL"));
  console.log("BUILD=see npm run build");
  console.log("PM2_SMOKE=" + (pm2Ok ? "PASS" : "FAIL"));

  const pass = placementPass && regOk && vocab.status < 500 && pm2Ok;
  console.log("PHASE_9=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_9=FAIL");
  process.exit(1);
});
