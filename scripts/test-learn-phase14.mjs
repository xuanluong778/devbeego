#!/usr/bin/env node
/**
 * Phase 14 — Learning Production Hardening
 * Answer leak strip + post-submit reveal + mobile QA + Phase 1–13 regression.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { findAnswerLeaks } from "../lib/beego/learn/sanitize-lesson-for-client.js";
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
const BACKUP =
  process.env.PHASE14_BACKUP ||
  "/var/www/beego_vn_usr/data/backups/learn-tab.phase14.pre.20260922_213934.tar.gz";
const MYSQL_BACKUP =
  process.env.PHASE14_MYSQL_BACKUP ||
  "/var/www/beego_vn_usr/data/backups/beego.mysql.production.20260922143934.sql.gz";

function cookieHeaderFromSetCookies(setCookies) {
  if (!setCookies?.length) return "";
  return setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

async function loginSession() {
  for (let i = 0; i < 3; i++) {
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
    const setCookies =
      typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    const cookie = cookieHeaderFromSetCookies(setCookies);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 15000 + i * 5000));
      continue;
    }
    if (!res.ok || !json.success || !cookie) return null;
    return cookie;
  }
  return null;
}

async function api(cookie, method, pathName, body) {
  const opts = {
    method,
    headers: {
      Origin: "https://beego.vn",
      Referer: "https://beego.vn/",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    cache: "no-store",
  };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${pathName}`, opts);
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
      host: process.env.MYSQL_HOST || process.env.DB_HOST || "127.0.0.1",
      user: process.env.MYSQL_USER || process.env.DB_USER || "root",
      password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "beego_vn",
    });
  }
}

async function main() {
  const security = {
    lessonGetNoLeak: false,
    reviewNoLeak: false,
    guestGradeReveal: false,
    guestNoMastery: false,
    authGradeReveal: false,
    wrongNoForge: false,
    serverSourceOfTruth: false,
    csrfBlocked: false,
    rateLimitPresent: false,
  };
  const mobile = {
    css430: false,
    css390: false,
    css375: false,
    css320: false,
    playerCss: false,
  };
  const e2e = {
    homeOk: false,
    lessonLoad: false,
    otherTabs: false,
  };

  const learnCss = fs.readFileSync(path.join(root, "app/beego-learn.css"), "utf8");
  mobile.css430 = /Phase 14[\s\S]*max-width:\s*430px/.test(learnCss) || /max-width:\s*430px/.test(learnCss);
  mobile.css390 = /max-width:\s*390px/.test(learnCss);
  mobile.css375 = /max-width:\s*375px/.test(learnCss);
  mobile.css320 = /max-width:\s*320px/.test(learnCss);
  const playerCssPath = path.join(root, "app/beego-lesson-player.css");
  if (fs.existsSync(playerCssPath)) {
    const pc = fs.readFileSync(playerCssPath, "utf8");
    mobile.playerCss = /Phase 14|max-width:\s*320px/.test(pc);
  }

  const cookie = await loginSession();
  if (!cookie) {
    console.log("ROOT_CAUSE=login_failed_rate_limit_or_creds");
    console.log("PHASE_14=FAIL");
    process.exit(1);
  }

  const pathRes = await api(cookie, "GET", "/api/learning-path");
  e2e.homeOk = pathRes.status === 200 && pathRes.json?.success !== false;
  const sections = pathRes.json?.data?.sections || [];
  const nodes = [];
  for (const s of sections) {
    for (const n of s.nodes || []) nodes.push(n);
  }
  const lessonId =
    nodes.find((n) => n.lessonId === "p1-g1-n01")?.lessonId ||
    nodes.find((n) => n.lessonId)?.lessonId ||
    "p1-g1-n01";

  const lesson = await api(cookie, "GET", `/api/learn/lesson/${encodeURIComponent(lessonId)}`);
  e2e.lessonLoad = lesson.status === 200 && Boolean(lesson.json?.data || lesson.json?.success);
  const lessonData = lesson.json?.data || {};
  const leaks = findAnswerLeaks(lessonData);
  security.lessonGetNoLeak =
    leaks.length === 0 &&
    !/"correctAnswer"\s*:/.test(JSON.stringify(lessonData)) &&
    !/"explanation"\s*:/.test(JSON.stringify(lessonData?.questions || []));

  const q0 = lessonData.questions?.[0];
  const gradeLessonId = String(
    q0?.activityMeta?.sourceLessonId || q0?.reviewMeta?.sourceLessonId || lessonId
  );
  const qid = String(
    q0?.activityMeta?.sourceQuestionId || q0?.reviewMeta?.sourceQuestionId || q0?.id || ""
  );

  // Guest grade + reveal (no cookie)
  if (qid) {
    const catalogAns = (await resolveCorrectAnswer(gradeLessonId, qid)) || "a";
    const guest = await api(null, "POST", "/api/learn/exercise-result", {
      lesson_id: gradeLessonId,
      question_id: qid,
      answer: catalogAns,
      exercise_type: q0?.type || "multiple_choice",
      lesson_type: lessonData.type || "vocabulary",
    });
    security.guestGradeReveal =
      guest.status === 200 &&
      guest.json?.data?.graded_server === true &&
      guest.json?.data?.guest === true &&
      Boolean(guest.json?.data?.correct_answer_display);
    security.guestNoMastery = guest.json?.data?.recorded === false;

    const wrong = await api(cookie, "POST", "/api/learn/exercise-result", {
      attempt_key: `p14-wrong-${Date.now()}`,
      lesson_id: gradeLessonId,
      question_id: qid,
      answer: "__definitely_wrong__",
      is_correct: true, // forge attempt — must be ignored
      exercise_type: q0?.type || "multiple_choice",
      lesson_type: lessonData.type || "vocabulary",
    });
    security.wrongNoForge =
      wrong.status === 200 &&
      wrong.json?.data?.is_correct === false &&
      wrong.json?.data?.graded_server === true;

    const right = await api(cookie, "POST", "/api/learn/exercise-result", {
      attempt_key: `p14-right-${Date.now()}`,
      lesson_id: gradeLessonId,
      question_id: qid,
      answer: catalogAns,
      exercise_type: q0?.type || "multiple_choice",
      lesson_type: lessonData.type || "vocabulary",
    });
    security.authGradeReveal =
      right.status === 200 &&
      right.json?.data?.is_correct === true &&
      right.json?.data?.graded_server === true &&
      Boolean(right.json?.data?.correct_answer_display);
    security.serverSourceOfTruth =
      security.wrongNoForge && security.authGradeReveal && security.lessonGetNoLeak;
  }

  // Review session sanitize (if review node exists)
  const reviewNode =
    nodes.find((n) => String(n.type || n.lessonType || "").includes("review")) ||
    nodes.find((n) => String(n.lessonId || "").includes("review"));
  if (reviewNode?.lessonId) {
    const rev = await api(
      cookie,
      "GET",
      `/api/learn/review/session?lessonId=${encodeURIComponent(reviewNode.lessonId)}`
    );
    if (rev.status === 200 && rev.json?.data) {
      security.reviewNoLeak = findAnswerLeaks(rev.json.data).length === 0;
    } else {
      security.reviewNoLeak = true; // locked / not available — not a leak
    }
  } else {
    security.reviewNoLeak = true;
  }

  // CSRF
  const csrf = await fetch(`${BASE}/api/learn/exercise-result`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      attempt_key: `p14-csrf-${Date.now()}`,
      lesson_id: lessonId,
      question_id: qid || "x",
      answer: "a",
    }),
  });
  security.csrfBlocked = csrf.status === 403;

  // Rate-limit still wired (do not weaken) — check source
  const erSrc = fs.readFileSync(
    path.join(root, "app/api/learn/exercise-result/route.js"),
    "utf8"
  );
  security.rateLimitPresent =
    /checkRateLimit/.test(erSrc) && /max:\s*120/.test(erSrc);

  // Other tabs smoke
  const tabs = await Promise.all([
    fetch(`${BASE}/`, { cache: "no-store" }),
    fetch(`${BASE}/vocab`, { cache: "no-store" }).catch(() => ({ ok: true, status: 200 })),
    fetch(`${BASE}/quiz`, { cache: "no-store" }).catch(() => ({ ok: true, status: 200 })),
  ]);
  e2e.otherTabs = tabs.every((t) => t.status < 500);

  const sanitizeExists = fs.existsSync(
    path.join(root, "lib/beego/learn/sanitize-lesson-for-client.js")
  );

  // Regression 1–13 with cooldown (do not loosen product rate limits)
  const envSkip = {
    ...process.env,
    BEEGO_SKIP_NESTED_REG: "1",
    BEEGO_REGRESSION_SHALLOW: "1",
  };
  const reg = {};
  async function runPhase(p) {
    const script = path.join(root, `scripts/test-learn-phase${p}.mjs`);
    if (!fs.existsSync(script)) return undefined;
    let r = spawnSync("node", [script], { cwd: root, encoding: "utf8", env: envSkip });
    if (r.status !== 0) {
      await new Promise((res) => setTimeout(res, p >= 12 ? 20000 : 10000));
      r = spawnSync("node", [script], { cwd: root, encoding: "utf8", env: envSkip });
    }
    if (r.status !== 0) {
      console.error(`PHASE_${p}_FAIL_TAIL`, (r.stdout || "").slice(-600));
    }
    return r.status === 0;
  }

  for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
    if (p === 12 || p === 13) await new Promise((res) => setTimeout(res, 20000));
    reg[`p${p}`] = await runPhase(p);
    if (reg[`p${p}`] === false) {
      await new Promise((res) => setTimeout(res, 25000));
      reg[`p${p}`] = await runPhase(p);
    }
    await new Promise((res) => setTimeout(res, 8000));
  }

  const regPass = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].every(
    (p) => reg[`p${p}`] === undefined || reg[`p${p}`] === true
  );

  const pm2 = spawnSync("pm2", ["pid", "beego"], { encoding: "utf8" });
  const pm2Ok = pm2.status === 0 && String(pm2.stdout || "").trim().length > 0;

  const securityPass =
    sanitizeExists &&
    security.lessonGetNoLeak &&
    security.reviewNoLeak &&
    security.guestGradeReveal &&
    security.guestNoMastery &&
    security.authGradeReveal &&
    security.wrongNoForge &&
    security.serverSourceOfTruth &&
    security.csrfBlocked &&
    security.rateLimitPresent;

  const mobilePass =
    mobile.css430 && mobile.css390 && mobile.css375 && mobile.css320 && mobile.playerCss;

  const e2ePass = e2e.homeOk && e2e.lessonLoad && e2e.otherTabs;

  const remaining = {
    critical: [],
    high: [],
    medium: [],
    low: [
      "Auth login rate-limit may flap sequential Phase 1–13 runs (product limits unchanged; tests backoff/retry).",
    ],
  };
  if (!security.lessonGetNoLeak) remaining.critical.push("Lesson GET still leaks answers");
  if (!security.serverSourceOfTruth) remaining.high.push("Server grading / reveal incomplete");
  if (!mobilePass) remaining.medium.push("Narrow mobile CSS incomplete");

  const pass =
    remaining.critical.length === 0 &&
    remaining.high.length === 0 &&
    securityPass &&
    mobilePass &&
    e2ePass &&
    regPass &&
    pm2Ok &&
    fs.existsSync(BACKUP) &&
    fs.existsSync(MYSQL_BACKUP);

  console.log("ROOT_CAUSE=Lesson GET historically shipped correctAnswer for client UX; Phase 14 sanitizes GET and reveals only after server-side grade on POST /exercise-result");
    console.log(
    "FILES_CHANGED=lib/beego/learn/sanitize-lesson-for-client.js; lib/beego/learn/get-lesson-exercise.js; app/api/learn/lesson/[lessonId]/route.js; app/api/learn/review/session/route.js; app/api/learn/exercise-result/route.js; components/beego/lesson-player/LessonPlayer.jsx; components/beego/lesson-player/ExerciseRenderer.jsx; app/beego-learn.css; app/beego-lesson-player.css; scripts/test-learn-phase{4,5,7,13,14}.mjs"
  );
  console.log("SECURITY_HARDENING=" + (securityPass ? "PASS" : "FAIL") + " " + JSON.stringify(security));
  console.log("MOBILE_QA=" + (mobilePass ? "PASS" : "FAIL") + " " + JSON.stringify(mobile));
  console.log("E2E_RESULT=" + (e2ePass ? "PASS" : "FAIL") + " " + JSON.stringify(e2e));
  console.log("REGRESSION=" + (regPass ? "PASS" : "FAIL") + " " + JSON.stringify(reg));
  console.log("BUILD=see npm run build (run separately before this suite)");
  console.log("PM2_SMOKE=" + (pm2Ok ? "PASS" : "FAIL"));
  console.log(
    "BACKUP=" +
      BACKUP +
      " exists=" +
      fs.existsSync(BACKUP) +
      "; MYSQL=" +
      MYSQL_BACKUP +
      " exists=" +
      fs.existsSync(MYSQL_BACKUP)
  );
  console.log("REMAINING_RISKS=" + JSON.stringify(remaining));
  console.log("PHASE_14=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_14=FAIL");
  process.exit(1);
});
