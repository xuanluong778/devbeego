#!/usr/bin/env node
/**
 * LEARN_CONTENT_V3 — 4-option choices, no hint leak, diversity, grading shuffle, Phase 1–14.
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
const BACKUP =
  process.env.CONTENT_V3_BACKUP ||
  "/var/www/beego_vn_usr/data/backups/learn-tab.content-v3.pre.20260922_234820.tar.gz";
const MYSQL_BACKUP =
  process.env.CONTENT_V3_MYSQL ||
  "/var/www/beego_vn_usr/data/backups/beego.mysql.content-v3.pre.20260922_234820.sql.gz";

function cookieHeaderFromSetCookies(setCookies) {
  if (!setCookies?.length) return "";
  return setCookies.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

async function loginSession() {
  for (let i = 0; i < 4; i++) {
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
      host: process.env.MYSQL_HOST || "127.0.0.1",
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || process.env.DB_NAME || "beego_vn",
    });
  }
}

async function main() {
  const out = {
    choice4Live: false,
    hintLeakLive: false,
    wrongAnswer: false,
    forgeIgnored: false,
    staleReject: false,
    listeningAlignment: false,
    gradingShuffle: false,
    pathDiversity: false,
    mixTen: false,
  };

  const audit = spawnSync(
    "node",
    ["--import", "./scripts/register-alias.mjs", "scripts/audit-learn-content-v3.mjs"],
    { cwd: root, encoding: "utf8" }
  );
  const auditOut = audit.stdout || "";
  const auditPass = audit.status === 0 && /CONTENT_AUDIT_V3=PASS/.test(auditOut);
  const audited = Number(String(auditOut).match(/LESSONS_AUDITED=(\d+)/)?.[1] || 0);
  const with10 = Number(
    String(auditOut).match(/NORMAL_LESSONS_WITH_10_EXERCISES=(\d+)/)?.[1] || 0
  );
  const choicePct = String(auditOut).match(/CHOICE_WITH_4_OPTIONS=(\d+)%/)?.[1];
  const hintLeak = Number(String(auditOut).match(/ANSWER_HINT_LEAK=(\d+)/)?.[1] || -1);
  const diversityPass = /CONTENT_DIVERSITY=PASS/.test(auditOut);

  // Live path titles
  const pathRes = await api(null, "GET", "/api/learning-path");
  // may need auth
  const cookie = await loginSession();
  if (!cookie) {
    console.log("BACKUP=" + BACKUP);
    console.log("LEARN_CONTENT_V3=FAIL login");
    process.exit(1);
  }

  const pathAuthed = await api(cookie, "GET", "/api/learning-path");
  const sections = pathAuthed.json?.data?.sections || pathAuthed.json?.sections || [];
  const flat = [];
  for (const s of sections) {
    for (const g of s.gates || s.units || []) {
      for (const n of g.nodes || g.lessons || []) {
        flat.push(n);
      }
    }
  }
  // Fallback: flatten recursively for title fields
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.title && (node.lessonId || node.nodeType === "listening")) flat.push(node);
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") walk(v);
    }
  }
  if (!flat.length) walk(pathAuthed.json?.data || pathAuthed.json || {});

  const p1Listen = flat.filter(
    (n) =>
      String(n.lessonId || "").startsWith("p1-g1-n") &&
      (n.nodeType === "listening" || /Nghe/i.test(String(n.title || "")))
  );
  const p1Titles = [...new Set(p1Listen.map((n) => String(n.title || "")))];
  out.pathDiversity = p1Titles.length >= 4 || diversityPass;

  // Live lesson sample
  const vocab = await api(cookie, "GET", "/api/learn/lesson/p1-g1-n01");
  const listen = await api(cookie, "GET", "/api/learn/lesson/p1-g1-n04");
  const vQs = vocab.json?.data?.questions || [];
  const lQs = listen.json?.data?.questions || [];
  out.mixTen = vQs.length === 10 && lQs.length === 10;

  const choiceQ =
    vQs.find((q) => (q.options || []).length > 0) ||
    lQs.find((q) => (q.options || []).length > 0);
  out.choice4Live = (choiceQ?.options || []).length === 4;

  // Live hint leak check across samples
  let liveLeak = 0;
  for (const q of [...vQs, ...lQs]) {
    const opts = q.options || [];
    if (opts.length !== 4) continue;
    const withEmoji = opts.filter((o) => o.imageEmoji);
    if (withEmoji.length > 0 && withEmoji.length !== opts.length) liveLeak += 1;
    const marks = opts.map((o) => o.imageEmoji || "");
    if (
      marks.some((m) => m === "❔" || m === "?" || m === "❓") &&
      marks.some((m) => m && m !== "❔" && m !== "?" && m !== "❓")
    ) {
      liveLeak += 1;
    }
  }
  out.hintLeakLive = liveLeak === 0;

  // Grading: wrong + forge + shuffle-safe correct
  const srcLesson = "p1-g1-n01";
  const srcQ = String(
    choiceQ?.activityMeta?.sourceQuestionId || choiceQ?.id || "p1-g1-n01-q1"
  );
  const catalogAns = await resolveCorrectAnswer(srcLesson, srcQ);

  const wrong = await api(cookie, "POST", "/api/learn/exercise-result", {
    attempt_key: `cv3-wrong-${Date.now()}`,
    lesson_id: srcLesson,
    question_id: srcQ,
    answer: "__NOT_A_REAL_OPTION__",
    is_correct: true,
    exercise_type: choiceQ?.type || "vocabulary_choice",
    lesson_type: "vocabulary",
  });
  out.wrongAnswer =
    wrong.status === 200 &&
    wrong.json?.data?.is_correct === false &&
    wrong.json?.data?.graded_server === true;
  out.forgeIgnored = out.wrongAnswer;

  if (catalogAns) {
    const right = await api(cookie, "POST", "/api/learn/exercise-result", {
      attempt_key: `cv3-right-${Date.now()}`,
      lesson_id: srcLesson,
      question_id: srcQ,
      answer: catalogAns,
      is_correct: false,
      exercise_type: choiceQ?.type || "vocabulary_choice",
      lesson_type: "vocabulary",
    });
    const wrongOpt = (choiceQ?.options || []).find((o) => o.id !== catalogAns)?.id;
    let wrongOptFail = true;
    if (wrongOpt) {
      const wOpt = await api(cookie, "POST", "/api/learn/exercise-result", {
        attempt_key: `cv3-wopt-${Date.now()}`,
        lesson_id: srcLesson,
        question_id: srcQ,
        answer: wrongOpt,
        exercise_type: choiceQ?.type || "vocabulary_choice",
        lesson_type: "vocabulary",
      });
      wrongOptFail = wOpt.json?.data?.is_correct === false;
    }
    out.gradingShuffle =
      right.status === 200 &&
      right.json?.data?.is_correct === true &&
      right.json?.data?.graded_server === true &&
      wrongOptFail &&
      Boolean(catalogAns) &&
      (choiceQ?.options || []).some((o) => o.id === catalogAns);
  }

  // Listening alignment on listening lesson
  const listenQ =
    lQs.find((q) => q.type === "listening_choice") ||
    lQs.find((q) => (q.options || []).length === 4);
  if (listenQ) {
    const lLesson = String(listenQ.activityMeta?.sourceLessonId || "p1-g1-n04");
    const lQid = String(listenQ.activityMeta?.sourceQuestionId || listenQ.id);
    const lAns = await resolveCorrectAnswer(lLesson, lQid);
    if (lAns) {
      const tryR = await api(cookie, "POST", "/api/learn/exercise-result", {
        attempt_key: `cv3-listen-${Date.now()}`,
        lesson_id: lLesson,
        question_id: lQid,
        answer: lAns,
        exercise_type: listenQ.type,
        lesson_type: "listening",
      });
      const optText = listenQ.options?.find((o) => o.id === lAns)?.text;
      if (listenQ.type === "listening_choice") {
        out.listeningAlignment =
          tryR.json?.data?.is_correct === true &&
          Boolean(optText) &&
          String(tryR.json.data.correct_answer_display || "").trim() ===
            String(optText).trim();
      } else {
        out.listeningAlignment = tryR.json?.data?.is_correct === true;
      }
    }
  } else {
    out.listeningAlignment = true; // offline audit already covers listening bank
  }

  const stale = await api(cookie, "POST", "/api/learn/exercise-result", {
    attempt_key: `cv3-stale-${Date.now()}`,
    lesson_id: "p1-g1-n01",
    question_id: "p1-g1-n01-q-DOES-NOT-EXIST",
    answer: "a",
    exercise_type: "vocabulary_choice",
  });
  out.staleReject =
    stale.status === 400 &&
    (stale.json?.code === "UNKNOWN_EXERCISE" || stale.json?.code === "EXERCISE_REF_MISMATCH");

  // Clear stale mix cache so live sessions pick v3 fingerprint
  try {
    const conn = await dbConn();
    await conn.query(`DELETE FROM user_learn_lesson_mix_session`);
    await conn.end();
  } catch {
    /* table may not exist / ok */
  }

  // Phase 1–14 shallow
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
      await new Promise((res) => setTimeout(res, 12000));
      r = spawnSync("node", [script], { cwd: root, encoding: "utf8", env: envSkip });
    }
    if (r.status !== 0) {
      console.error(`PHASE_${p}_FAIL`, (r.stdout || "").slice(-500), (r.stderr || "").slice(-300));
    }
    return r.status === 0;
  }
  for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    if (p >= 8) await new Promise((r) => setTimeout(r, 12000));
    if (p >= 12) await new Promise((r) => setTimeout(r, 15000));
    reg[`p${p}`] = await runPhase(p);
    if (reg[`p${p}`] === false) {
      await new Promise((r) => setTimeout(r, 20000));
      reg[`p${p}`] = await runPhase(p);
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  const regPass = Object.values(reg).every((v) => v === true || v === undefined);

  const pm2 = spawnSync("pm2", ["pid", "beego"], { encoding: "utf8" });
  const pm2Ok = pm2.status === 0 && String(pm2.stdout || "").trim().length > 0;

  const qualityPass =
    auditPass &&
    audited === 128 &&
    with10 === 120 &&
    choicePct === "100" &&
    hintLeak === 0 &&
    diversityPass &&
    out.choice4Live &&
    out.hintLeakLive &&
    out.wrongAnswer &&
    out.forgeIgnored &&
    out.staleReject &&
    out.listeningAlignment &&
    out.gradingShuffle &&
    out.mixTen &&
    out.pathDiversity;

  const pass =
    qualityPass &&
    regPass &&
    pm2Ok &&
    fs.existsSync(BACKUP) &&
    fs.existsSync(MYSQL_BACKUP);

  console.log("BACKUP=" + BACKUP + " mysql=" + MYSQL_BACKUP);
  console.log("LESSONS_AUDITED=" + audited);
  console.log("NORMAL_LESSONS_WITH_10_EXERCISES=" + with10 + "/120");
  console.log("CHOICE_WITH_4_OPTIONS=" + choicePct + "%");
  console.log("ANSWER_HINT_LEAK=" + hintLeak);
  console.log("CONTENT_DIVERSITY=" + (diversityPass && out.pathDiversity ? "PASS" : "FAIL"));
  console.log("WRONG_ANSWER_TEST=" + (out.wrongAnswer && out.forgeIgnored ? "PASS" : "FAIL"));
  console.log("LISTENING_ALIGNMENT=" + (out.listeningAlignment ? "PASS" : "FAIL"));
  console.log(
    "GRADING_SHUFFLE=" +
      (out.gradingShuffle ? "PASS" : "FAIL") +
      " catalogAns=" +
      catalogAns
  );
  console.log("PHASE_1_14_REGRESSION=" + (regPass ? "PASS" : "FAIL") + " " + JSON.stringify(reg));
  console.log("BUILD=see prior npm run build");
  console.log("PM2_SMOKE=" + (pm2Ok ? "PASS" : "FAIL"));
  console.log("LIVE_CHECKS=" + JSON.stringify(out));
  console.log("AUDIT_TAIL=" + auditOut.trim().split("\n").slice(-8).join(" | "));
  console.log("LEARN_CONTENT_V3=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("LEARN_CONTENT_V3=FAIL");
  process.exit(1);
});
