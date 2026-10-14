/**
 * Real API + gateway check for Learn Call sessions on an isolated Next server.
 * The Next server must use the preview database (LEARN_CALL_TEST_DB) and the isolated Redis.
 * Writes only a login session row in the preview database. Does not print secrets.
 *
 * Usage: REDIS_URL=redis://127.0.0.1:6397 VOICE_WS_PORT=3134 LEARN_CALL_TEST_DB=beego_call_preview \
 *   LEARN_CALL_TEST_PASSWORD=… LEARN_CALL_API_BASE=http://127.0.0.1:3099 node scripts/test-learn-call-api.mjs
 */
import Redis from "ioredis";
import WebSocket from "ws";
import mysql from "mysql2/promise";
import { loadLearnCallTestEnv } from "./learn-call-test-env.mjs";
import { learnAiCallOpenUserKey, learnAiCallSessionKey } from "../lib/beego/learn/ai-call-access.js";

const env = loadLearnCallTestEnv();
const BASE = process.env.LEARN_CALL_API_BASE || "http://127.0.0.1:3099";
const DB = String(process.env.LEARN_CALL_TEST_DB || "");
const PASSWORD = String(process.env.LEARN_CALL_TEST_PASSWORD || "");
if (!DB || DB === env.DB_NAME || !PASSWORD) {
  console.error("REFUSING: set LEARN_CALL_TEST_DB (not the production database) and LEARN_CALL_TEST_PASSWORD.");
  process.exit(2);
}

const results = [];
function check(name, ok, detail = undefined) {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` ${JSON.stringify(detail)}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: DB,
});
const [[user]] = await conn.query(`SELECT id, email FROM users ORDER BY id LIMIT 1`);
await conn.end();
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
await redis.del(learnAiCallOpenUserKey(user.id));

const login = await fetch(`${BASE}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ identifier: user.email, password: PASSWORD }),
});
const cookie = /session_token=([^;]+)/.exec(login.headers.get("set-cookie") || "")?.[1] || "";
check("login on the preview database", login.ok && Boolean(cookie), login.status);
const headers = { "content-type": "application/json", cookie: `session_token=${cookie}` };
const body = JSON.stringify({ lessonId: "p1-g1-n01", sectionId: "p1-g1" });

async function post() {
  const res = await fetch(`${BASE}/api/learn/ai-call/session`, { method: "POST", headers, body });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
async function del(sessionId) {
  const res = await fetch(`${BASE}/api/learn/ai-call/session`, { method: "DELETE", headers, body: JSON.stringify({ sessionId }) });
  return res.status;
}
function connect(data) {
  const url = new URL(data.wsUrl);
  check("wsUrl points at the isolated gateway", url.hostname === "127.0.0.1" && Number(url.port) === env.wsPort, data.wsUrl);
  const ws = new WebSocket(`ws://127.0.0.1:${env.wsPort}/?token=${encodeURIComponent(data.token)}&sessionId=${encodeURIComponent(data.sessionId)}`);
  const c = { ws, msgs: [], closed: null };
  ws.on("message", (d, isBinary) => {
    if (isBinary) return;
    try {
      c.msgs.push(JSON.parse(String(d)));
    } catch (_e) {}
  });
  ws.on("close", (code, reason) => {
    c.closed = { code, reason: String(reason || "") };
  });
  ws.on("error", () => {});
  return c;
}
async function waitFor(c, pred, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const found = c.msgs.find(pred);
    if (found) return found;
    if (c.closed && !found) break;
    await sleep(50);
  }
  return null;
}

const [a, b] = await Promise.all([post(), post()]);
const ok = [a, b].filter((r) => r.status === 200);
const busy = [a, b].filter((r) => r.status === 409 && r.json.code === "CALL_IN_PROGRESS");
check("two concurrent POSTs: exactly one session, one CALL_IN_PROGRESS", ok.length === 1 && busy.length === 1, [a.status, b.status]);
const first = ok[0]?.json?.data;
check("session payload: token, sessionId, level 1, 2 minutes, no test quota", Boolean(first?.token && first?.sessionId) && first.limits?.level === 1 && first.limits?.maxMinutes === 2 && first.limits?.packageLabel === undefined, first?.limits);
check("binding written to the isolated Redis", (await redis.get(learnAiCallSessionKey(first.sessionId))) === String(user.id));

const c1 = connect(first);
const hello = await waitFor(c1, (m) => m.type === "hello", 5000);
check("gateway hello carries the server lesson", hello?.lesson?.lessonId === "p1-g1-n01" && hello?.callClock?.remainingMs > 100000, hello?.lesson);
const greet = await waitFor(c1, (m) => m.type === "ai_done" && m.requestId === 1, 30000);
check("greeting arrives through the real workers", Boolean(greet?.text), greet?.text);

const third = await post();
check("POST while the call is open -> 409", third.status === 409 && third.json.code === "CALL_IN_PROGRESS", third.status);

send(c1, { type: "end_call" });
const summary = await waitFor(c1, (m) => m.type === "call_summary", 5000);
check("end_call returns the server summary", summary?.summary?.score === null && summary?.summary?.learnerTurns === 0);
await sleep(800);
const again = connect(first);
await sleep(1500);
check("closed session cannot reconnect with the same token", !again.msgs.some((m) => m.type === "hello") && Boolean(again.closed), again.closed);

const next = await post();
check("after the call ends a new session can open", next.status === 200, next.status);
const delStatus = await del(next.json?.data?.sessionId);
check("DELETE closes it", delStatus === 200);
const afterDel = connect(next.json.data);
await sleep(1500);
check("DELETEd session cannot connect", !afterDel.msgs.some((m) => m.type === "hello") && Boolean(afterDel.closed), afterDel.closed);

const [x, y] = await Promise.all([post(), post()]);
const xs = [x, y].filter((r) => r.status === 200);
check("second race after DELETE: still exactly one session", xs.length === 1 && [x, y].some((r) => r.status === 409), [x.status, y.status]);
if (xs[0]) await del(xs[0].json.data.sessionId);

function send(c, obj) {
  if (c.ws.readyState === 1) c.ws.send(JSON.stringify(obj));
}

await redis.quit();
const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ passed: results.length - failed, failed }));
process.exit(failed ? 1 : 0);
