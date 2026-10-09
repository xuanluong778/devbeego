/**
 * Preview gateway: playback labels, reconnect clock, one usage mark, other user rejected.
 * Does not send a client transcript and does not print secrets.
 */
import fs from "node:fs";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import WebSocket from "ws";
import { learnAiCallClockKey, learnAiCallContextKey, learnAiCallSessionKey, learnAiCallUsageKey } from "../lib/beego/learn/ai-call-access.js";

const env = {};
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  const key = t.slice(0, i).trim();
  if (!env[key]) env[key] = t.slice(i + 1).trim();
}
const userId = "900000001";
const otherId = "900000002";
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

function tokenFor(sub, sid) {
  return jwt.sign({ sub, plan: "pro", purpose: "learn_ai_call", sid }, env.VOICE_JWT_SECRET, { expiresIn: 120 });
}
function open(sub, sid) {
  const ws = new WebSocket(`ws://127.0.0.1:3032/?token=${encodeURIComponent(tokenFor(sub, sid))}&sessionId=${encodeURIComponent(sid)}`);
  const messages = [];
  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      try { messages.push(JSON.parse(String(data))); } catch (_e) {}
    }
  });
  return new Promise((resolve, reject) => {
    ws.once("open", () => resolve({ ws, messages }));
    ws.once("error", reject);
  });
}
function waitFor(list, pred, ms) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const found = list.find(pred);
      if (found) {
        clearInterval(timer);
        resolve(found);
      } else if (Date.now() - start > ms) {
        clearInterval(timer);
        reject(new Error(`timeout; saw ${list.map((item) => item.type).join(",")}`));
      }
    }, 80);
  });
}
async function bind(sid) {
  await redis.set(learnAiCallSessionKey(sid), userId, "EX", 120);
  await redis.set(
    learnAiCallContextKey(sid),
    JSON.stringify({ userId, lessonId: "p1-g1-n01", title: "Chào một người mới", objective: "Nói tên", level: 1, maxMinutes: 0.2 }),
    "EX",
    120
  );
}

const sid = `learn-clock-${Date.now()}`;
await bind(sid);
const first = await open(userId, sid);
const hello1 = await waitFor(first.messages, (item) => item.type === "hello", 4000);
first.ws.close();
await new Promise((r) => setTimeout(r, 300));
const second = await open(userId, sid);
const hello2 = await waitFor(second.messages, (item) => item.type === "hello", 4000);
const stranger = new WebSocket(
  `ws://127.0.0.1:3032/?token=${encodeURIComponent(tokenFor(otherId, sid))}&sessionId=${encodeURIComponent(sid)}`
);
const strangerCode = await new Promise((resolve) => stranger.once("close", (code) => resolve(code)));
await waitFor(second.messages, (item) => item.type === "ai_done" && item.requestId === 1, 20000);
second.ws.send(JSON.stringify({ type: "interrupt", requestId: 1, reason: "barge_in" }));
await new Promise((r) => setTimeout(r, 200));
second.ws.send(JSON.stringify({ type: "end_call" }));
const summaryMsg = await waitFor(second.messages, (item) => item.type === "call_summary", 5000);
second.ws.close();
await new Promise((r) => setTimeout(r, 2500));
const usage = await redis.get(learnAiCallUsageKey(sid));
const clock = JSON.parse(await redis.get(learnAiCallClockKey(sid)));
await redis.del(learnAiCallSessionKey(sid), learnAiCallContextKey(sid), learnAiCallClockKey(sid), learnAiCallUsageKey(sid));
await redis.quit();
const summary = summaryMsg.summary || {};
console.log(JSON.stringify({
  sameDeadline: hello1.callClock?.deadlineAt === hello2.callClock?.deadlineAt,
  remainingShrunk: Number(hello2.callClock?.remainingMs) < Number(hello1.callClock?.remainingMs),
  strangerClose: strangerCode,
  played: Array.isArray(summary.playedTutorQuotes) ? summary.playedTutorQuotes.length : null,
  interrupted: Array.isArray(summary.interruptedTutorQuotes) ? summary.interruptedTutorQuotes.length : null,
  learner: Array.isArray(summary.learnerQuotes) ? summary.learnerQuotes.length : null,
  score: summary.score,
  usageMarks: usage,
  storedDeadline: clock?.deadlineAt === hello1.callClock?.deadlineAt,
}));
