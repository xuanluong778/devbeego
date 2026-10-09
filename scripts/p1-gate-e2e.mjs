/**
 * Integration test against a running Next server. Not a component test.
 * Usage: node --import ./scripts/register-alias.mjs ./scripts/p1-gate-e2e.mjs http://127.0.0.1:3208
 */
import { buildLessonContentRegistry } from "../lib/beego/learn/lesson-content-build.js";
import { checkAnswer } from "../lib/beego/learn/exercise-check.js";
import { hashPassword } from "../lib/auth.js";
import { spawn } from "node:child_process";
import { leftItemId, rightItemId } from "../lib/beego/learn/match-pairs.js";

const base = process.argv[2] || "http://127.0.0.1:3208";
const email = "p1-e2e-local@example.test";
const password = "P1e2e-Gate-2026";
const registry = buildLessonContentRegistry();

function payloadFor(question) {
  const type = question.type;
  if (type === "speaking" || type === "pronunciation") return null;
  if (type === "word_order") return question.correctAnswer;
  if (type === "listening_dictation") {
    return { text: question.extensions?.transcript || question.correctAnswer || "" };
  }
  if (type === "translation") {
    if (question.extensions?.inputMode === "text") return question.correctAnswer;
    return question.correctAnswer;
  }
  if (type === "matching_pairs") {
    return {
      completed: true,
      mistakeCount: 0,
      matches: (question.pairs || []).map((pair) => ({
        leftItemId: leftItemId(pair.pairId),
        rightItemId: rightItemId(pair.pairId),
      })),
    };
  }
  if (type === "context_cloze" && question.extensions?.inputMode === "text") {
    return question.extensions.answers?.[0] || "";
  }
  return question.correctAnswer;
}

function wrongPayload(question) {
  if (question.type === "word_order") return ["nope"];
  if (question.type === "listening_dictation") return { text: "not the sentence" };
  if (question.type === "matching_pairs") return { completed: true, mistakeCount: 2, matches: [] };
  if (Array.isArray(question.options) && question.options.length > 1) {
    const bad = question.options.find((option) => option.id !== question.correctAnswer);
    return bad?.id || "nope";
  }
  return "nope";
}

async function mysql(sql) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const { stdout } = await run("sudo", ["mysql", "beego_vn", "-N", "-e", sql], { maxBuffer: 2_000_000 });
  return stdout.trim();
}

async function api(path, { method = "GET", cookie, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie, referer: `${base}/learn` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: response.status, json, headers: response.headers };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function submit(cookie, lessonId, question, answer) {
  const result = await api("/api/learn/exercise-result", {
    method: "POST",
    cookie,
    body: {
      attempt_key: `${lessonId}-${question.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      lesson_id: lessonId,
      question_id: question.id,
      exercise_type: question.type,
      skill_label: question.skillLabel || "",
      answer,
    },
  });
  return result;
}

async function answerAllExceptSpeaking(cookie, lessonId, { includeStory }) {
  const lesson = registry[lessonId];
  for (const question of lesson.questions) {
    if (question.extensions?.activity === 11) continue;
    if (!includeStory && question.type === "story_comprehension") continue;
    const answer = payloadFor(question);
    assert(checkAnswer(question, answer) === true, `local grade failed ${question.id}`);
    const result = await submit(cookie, lessonId, question, answer);
    assert(result.status === 200 && result.json?.data?.is_correct === true, `submit ${question.id} ${result.status} ${JSON.stringify(result.json).slice(0, 240)}`);
  }
}

async function main() {
  const hash = hashPassword(password);
  const safeHash = hash.replace(/'/g, "");
  await mysql(
    `INSERT INTO users (name, email, password_hash, is_active, role, email_verified)
     VALUES ('P1 e2e', '${email}', '${safeHash}', 1, 'student', 1)
     ON DUPLICATE KEY UPDATE password_hash='${safeHash}', is_active=1`
  );
  const userId = await mysql(`SELECT id FROM users WHERE email='${email}'`);
  await mysql(`DELETE FROM user_learn_exercise_attempts WHERE user_id=${userId}`);
  await mysql(`DELETE FROM user_lesson_progress WHERE user_id=${userId}`);

  const login = await api("/api/auth/login", { method: "POST", body: { email, password } });
  assert(login.status === 200, `login ${login.status}`);
  const cookie = (login.headers.get("set-cookie") || "").split(",").map((part) => part.split(";")[0]).find((part) => part.startsWith("session_token="));
  assert(cookie, "missing session cookie");

  for (const lessonId of ["p1-g1-n01", "p1-g1-n07", "p1-g1-n14"]) {
    const loaded = await api(`/api/learn/lesson/${lessonId}`, { cookie });
    assert(loaded.status === 200, `load ${lessonId}`);
    const body = JSON.stringify(loaded.json);
    assert(!body.includes("storyVi"), `${lessonId} leaked storyVi`);
    assert(!body.includes("correctAnswer"), `${lessonId} leaked correctAnswer`);
    const speaking = loaded.json.data.questions.find((question) => question.extensions?.activity === 11);
    assert(speaking && speaking.required !== true, `${lessonId} speaking must be optional`);
  }

  const n01 = registry["p1-g1-n01"];
  const first = n01.questions[0];
  const wrong = await submit(cookie, "p1-g1-n01", first, wrongPayload(first));
  assert(wrong.json?.data?.is_correct === false, "wrong answer was graded correct");
  const right = await submit(cookie, "p1-g1-n01", first, payloadFor(first));
  assert(right.json?.data?.is_correct === true, "corrected answer stayed wrong");
  await mysql(`DELETE FROM user_learn_exercise_attempts WHERE user_id=${userId} AND lesson_id='p1-g1-n01'`);

  const required = registry["p1-g1-n01"].questions.filter((question) => question.required).map((question) => question.id);
  const values = required.map((id) => `(UUID(), ${userId}, 'p1-g1-n01', '${id}', NULL, 'legacy', 'multiple_choice', 1)`).join(",");
  await mysql(
    `INSERT INTO user_learn_exercise_attempts
      (attempt_key, user_id, lesson_id, question_id, content_revision, skill_key, exercise_type, is_correct)
     VALUES ${values}`
  );
  const blocked = await api("/api/learning-path/complete", {
    method: "POST",
    cookie,
    body: { lesson_id: "p1-g1-n01", score: 100 },
  });
  assert(blocked.status === 403 && blocked.json?.code === "REQUIRED_QUESTIONS_SKIPPED", `old attempts should not complete: ${blocked.status} ${blocked.json?.code}`);
  await mysql(`DELETE FROM user_learn_exercise_attempts WHERE user_id=${userId} AND lesson_id='p1-g1-n01' AND content_revision IS NULL`);

  async function markCompleted(from, to) {
    for (let n = from; n <= to; n += 1) {
      const lessonId = `p1-g1-n${String(n).padStart(2, "0")}`;
      await mysql(
        `INSERT INTO user_lesson_progress (user_id, lesson_id, status, score, xp_awarded, honey_awarded, completed_at)
         VALUES (${userId}, '${lessonId}', 'completed', 100, 0, 0, NOW())
         ON DUPLICATE KEY UPDATE status='completed'`
      );
    }
  }

  await answerAllExceptSpeaking(cookie, "p1-g1-n01", { includeStory: false });
  const mid = await api("/api/learn/lesson/p1-g1-n01", { cookie });
  const start = mid.json?.data?.resume?.startIndex;
  const speakingIndex = registry["p1-g1-n01"].questions.findIndex((question) => question.extensions?.activity === 11);
  assert(start === speakingIndex, `resume should open speaking, got ${start} expected ${speakingIndex}`);
  await browserSkipSpeaking(cookie.split("=")[1]);
  const afterSkip = await mysql(`SELECT COUNT(*) FROM user_learn_exercise_attempts WHERE user_id=${userId} AND lesson_id='p1-g1-n01' AND question_id LIKE '%-a12'`);
  assert(afterSkip === "0", "UI skip wrote a fake attempt");
  await answerAllExceptSpeaking(cookie, "p1-g1-n01", { includeStory: true });
  const done1 = await api("/api/learning-path/complete", { method: "POST", cookie, body: { lesson_id: "p1-g1-n01" } });
  assert(done1.status === 200, `complete n01 ${done1.status} ${JSON.stringify(done1.json).slice(0, 240)}`);
  const resume1 = await api("/api/learn/lesson/p1-g1-n01", { cookie });
  assert(resume1.json?.data?.resume?.completed === true, "n01 resume completed");

  await markCompleted(2, 6);
  await answerAllExceptSpeaking(cookie, "p1-g1-n07", { includeStory: true });
  const speakRows = await mysql(`SELECT COUNT(*) FROM user_learn_exercise_attempts WHERE user_id=${userId} AND lesson_id='p1-g1-n07' AND question_id LIKE '%-a12'`);
  assert(speakRows === "0", "skipping speak must not write an attempt");
  const done7 = await api("/api/learning-path/complete", { method: "POST", cookie, body: { lesson_id: "p1-g1-n07", score: 0 } });
  assert(done7.status === 200, `complete n07 ${done7.status} ${JSON.stringify(done7.json).slice(0, 200)}`);
  const resume7 = await api("/api/learn/lesson/p1-g1-n07", { cookie });
  assert(resume7.json?.data?.resume?.completed === true, "n07 resume should be completed");

  await markCompleted(8, 13);
  await answerAllExceptSpeaking(cookie, "p1-g1-n14", { includeStory: true });
  const done14 = await api("/api/learning-path/complete", { method: "POST", cookie, body: { lesson_id: "p1-g1-n14" } });
  assert(done14.status === 200, `complete n14 ${done14.status} ${JSON.stringify(done14.json).slice(0, 200)}`);

  await mysql(`DELETE FROM user_learn_exercise_attempts WHERE user_id=${userId}`);
  await mysql(`DELETE FROM user_learn_mistakes WHERE user_id=${userId}`);
  await mysql(`DELETE FROM user_lesson_progress WHERE user_id=${userId}`);
  await mysql(`DELETE FROM user_sessions WHERE user_id=${userId}`);
  await mysql(`DELETE FROM user_stats WHERE user_id=${userId}`);
  await mysql(`DELETE FROM users WHERE id=${userId}`);
  console.log("e2e ok", base);
}

function browserSkipSpeaking(token) {
  return new Promise((resolve, reject) => {
    const chrome = spawn("/usr/bin/chromium-browser", [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--remote-debugging-port=9223",
      "--user-data-dir=/root/p1-e2e-chrome",
      "about:blank",
    ], { stdio: "ignore" });
    const timer = setTimeout(() => {
      chrome.kill();
      reject(new Error("browser timeout"));
    }, 60000);
    const waitForDebug = async () => {
      for (let i = 0; i < 40; i += 1) {
        try {
          const response = await fetch("http://127.0.0.1:9223/json/version");
          if (response.ok) return;
        } catch { /* chrome still starting */ }
        await new Promise((res) => setTimeout(res, 250));
      }
      throw new Error("chrome debug port did not open");
    };
    waitForDebug().then(async () => {
      try {
        const version = await fetch("http://127.0.0.1:9223/json/version").then((r) => r.json());
        const ws = new WebSocket(version.webSocketDebuggerUrl);
        let id = 0;
        const pending = new Map();
        function send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((res, rej) => pending.set(messageId, { res, rej }));
        }
        ws.addEventListener("message", (event) => {
          const data = JSON.parse(event.data);
          if (data.id && pending.has(data.id)) {
            const { res, rej } = pending.get(data.id);
            pending.delete(data.id);
            if (data.error) rej(new Error(JSON.stringify(data.error)));
            else res(data.result);
          }
        });
        await new Promise((res, rej) => {
          ws.addEventListener("open", res);
          ws.addEventListener("error", rej);
        });
        const target = await send("Target.createTarget", { url: "about:blank" });
        const session = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
        function page(method, params = {}) {
          return send("Target.sendMessageToTarget", {
            sessionId: session.sessionId,
            message: JSON.stringify({ id: ++id, method, params }),
          }).catch(() => {});
        }
        // Flattened session events come as Target.receivedMessageFromTarget. Use a dedicated page socket instead.
        const pages = await fetch("http://127.0.0.1:9223/json/list").then((r) => r.json());
        const pageWs = new WebSocket(pages.find((page) => page.type === "page").webSocketDebuggerUrl);
        let pid = 0;
        const ppending = new Map();
        function psend(method, params = {}) {
          const messageId = ++pid;
          pageWs.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((res, rej) => ppending.set(messageId, { res, rej }));
        }
        pageWs.addEventListener("message", (event) => {
          const data = JSON.parse(event.data);
          if (data.id && ppending.has(data.id)) {
            const { res, rej } = ppending.get(data.id);
            ppending.delete(data.id);
            if (data.error) rej(new Error(JSON.stringify(data.error)));
            else res(data.result);
          }
        });
        await new Promise((res) => pageWs.addEventListener("open", res));
        await psend("Network.enable");
        await psend("Network.setCookie", { name: "session_token", value: token, url: base });
        await psend("Page.navigate", { url: `${base}/learn/lesson/p1-g1-n01` });
        let label = "";
        let heartsBefore = "";
        for (let i = 0; i < 40; i += 1) {
          await new Promise((res) => setTimeout(res, 500));
          const evaled = await psend("Runtime.evaluate", {
            expression: `(() => ({
              skip: document.body.innerText.includes("Bỏ qua câu nói"),
              hearts: document.querySelector(".beego-lesson-topbar__lives")?.getAttribute("aria-label") || "",
              text: document.body.innerText.slice(0, 400)
            }))()`,
            returnByValue: true,
          });
          const value = evaled.result?.value || {};
          if (value.skip) {
            label = "Bỏ qua câu nói";
            heartsBefore = value.hearts;
            break;
          }
        }
        assert(label === "Bỏ qua câu nói", "speaking skip button not shown");
        assert(heartsBefore.includes("3"), `hearts before skip: ${heartsBefore}`);
        await psend("Runtime.evaluate", {
          expression: `(() => { const b=[...document.querySelectorAll("button")].find(x=>x.textContent.includes("Bỏ qua câu nói")); b.click(); return true; })()`,
          returnByValue: true,
        });
        await new Promise((res) => setTimeout(res, 800));
        const after = await psend("Runtime.evaluate", {
          expression: `(() => ({
            hearts: document.querySelector(".beego-lesson-topbar__lives")?.getAttribute("aria-label") || "",
            story: document.body.innerText.includes("Beego chào Mai")
          }))()`,
          returnByValue: true,
        });
        const afterValue = after.result?.value || {};
        assert(afterValue.hearts === heartsBefore, `hearts changed ${heartsBefore} -> ${afterValue.hearts}`);
        assert(afterValue.story === true, "skip did not advance to the story");
        pageWs.close();
        ws.close();
        chrome.kill();
        clearTimeout(timer);
        resolve();
      } catch (error) {
        chrome.kill();
        clearTimeout(timer);
        reject(error);
      }
    }).catch((error) => {
      chrome.kill();
      clearTimeout(timer);
      reject(error);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
