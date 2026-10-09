/**
 * Isolated Call gateway on 127.0.0.1:3033. Does not use the production usage queue.
 */
import fs from "node:fs";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import WebSocket from "ws";
import {
  learnAiCallClockKey,
  learnAiCallContextKey,
  learnAiCallGateKey,
  learnAiCallSessionKey,
} from "../lib/beego/learn/ai-call-access.js";

const env = {};
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  const key = t.slice(0, i).trim();
  if (!env[key]) env[key] = t.slice(i + 1).trim();
}
const userId = "900000001";
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const usageKey = `voice:usage:daily:${userId}:${ymd}`;
const beforeUsage = await redis.hgetall(usageKey);

function open(token, sid) {
  const ws = new WebSocket(`ws://127.0.0.1:3033/?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sid)}`);
  const messages = [];
  let code = 0;
  ws.on("message", (data, isBinary) => {
    if (!isBinary) {
      try { messages.push(JSON.parse(String(data))); } catch (_e) {}
    }
  });
  ws.on("close", (next) => { code = next; });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("open timeout")), 4000);
    ws.once("open", () => {
      clearTimeout(timer);
      resolve({ ws, messages, code: () => code });
    });
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
        reject(new Error(`timeout ${list.map((item) => item.type).join(",")}`));
      }
    }, 80);
  });
}

const oldSid = `old-${Date.now()}`;
const oldToken = jwt.sign({ sub: userId, plan: "pro" }, env.VOICE_JWT_SECRET, { expiresIn: 90 });
const old = await open(oldToken, oldSid);
const oldHello = await waitFor(old.messages, (item) => item.type === "hello", 3000);
old.ws.send(JSON.stringify({ type: "client_final_transcript", requestId: 1, text: "Hello from the old speaking page." }));
const oldAi = await waitFor(old.messages, (item) => item.type === "ai_done" || item.type === "error", 25000);
old.ws.close();

const learnSid = `learn-iso-${Date.now()}`;
await redis.set(learnAiCallSessionKey(learnSid), userId, "EX", 90);
await redis.set(
  learnAiCallContextKey(learnSid),
  JSON.stringify({ userId, lessonId: "p1-g1-n01", title: "Chào một người mới", objective: "Nói tên", level: 1, maxMinutes: 2 }),
  "EX",
  90
);
await redis.del(learnAiCallGateKey());
const learnToken = jwt.sign(
  { sub: userId, plan: "pro", purpose: "learn_ai_call", sid: learnSid, learnAllow: 1 },
  env.VOICE_JWT_SECRET,
  { expiresIn: 90 }
);
const blocked = await open(learnToken, learnSid);
const blockedEnd = await waitFor(blocked.messages, (item) => item.type === "call_ended" || item.type === "hello", 3000);
await redis.set(learnAiCallGateKey(), "1", "EX", 60);
const live = await open(learnToken, learnSid);
const liveHello = await waitFor(live.messages, (item) => item.type === "hello", 4000);
await redis.del(learnAiCallGateKey());
const cut = await waitFor(live.messages, (item) => item.reason === "feature_disabled", 6000);
await redis.del(learnAiCallSessionKey(learnSid), learnAiCallContextKey(learnSid), learnAiCallClockKey(learnSid), learnAiCallGateKey());
const afterUsage = await redis.hgetall(usageKey);
if (Object.keys(beforeUsage).length) await redis.hset(usageKey, beforeUsage);
else await redis.del(usageKey);
await redis.quit();
console.log(JSON.stringify({
  oldHello: oldHello.type === "hello" && !oldHello.lesson,
  oldAi: oldAi.type,
  learnBlocked: blockedEnd.type === "call_ended" && blockedEnd.reason === "feature_disabled",
  learnHello: liveHello.type === "hello" && liveHello.lesson?.title === "Chào một người mới",
  cutOpenCall: cut.reason === "feature_disabled",
  usageUnchanged: JSON.stringify(beforeUsage) === JSON.stringify(afterUsage),
}));
