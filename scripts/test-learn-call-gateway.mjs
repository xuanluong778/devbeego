/**
 * Preview-gateway check for Learn Call level 1.
 * Uses a synthetic user id that must not exist in the database.
 * Does not update any account row.
 */
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import mysql from "mysql2/promise";
import WebSocket from "ws";
import { loadLearnCallTestEnv } from "./learn-call-test-env.mjs";
import { learnAiCallContextKey, learnAiCallSessionKey } from "../lib/beego/learn/ai-call-access.js";

const env = loadLearnCallTestEnv();

const userId = "900000001";
const otherId = "900000002";
const port = env.wsPort;
const conn = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});
const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM users WHERE id IN (?, ?)`, [userId, otherId]);
await conn.end();
if (Number(rows[0].n) !== 0) {
  console.error("REFUSING synthetic ids because they exist in the database");
  process.exit(1);
}

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const sessionId = `learn-preview-${Date.now()}`;
const title = "PreviewGreetings";
await redis.set(learnAiCallSessionKey(sessionId), userId, "EX", 120);
await redis.set(
  learnAiCallContextKey(sessionId),
  JSON.stringify({
    userId,
    lessonId: "p1-g1-n01",
    title,
    objective: "Say hello",
    level: 1,
    maxMinutes: 2,
  }),
  "EX",
  120
);

function tokenFor(sub, sid, extra = {}) {
  return jwt.sign({ sub, plan: "pro", purpose: "learn_ai_call", sid, learnAllow: 1, ...extra }, env.VOICE_JWT_SECRET, { expiresIn: 120 });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages = [];
    ws.on("message", (data, isBinary) => {
      if (isBinary) {
        messages.push({ type: "binary", bytes: data.length || data.byteLength || 0 });
        return;
      }
      try {
        messages.push(JSON.parse(String(data)));
      } catch (_e) {}
    });
    ws.on("error", reject);
    ws.once("open", () => resolve({ ws, messages }));
  });
}

const good = await connect(
  `ws://127.0.0.1:${port}/?token=${encodeURIComponent(tokenFor(userId, sessionId))}&sessionId=${encodeURIComponent(sessionId)}`
);
const hello = await waitFor(good.messages, (m) => m.type === "hello", 4000);
if (hello.lesson?.title !== title) throw new Error(`missing lesson context: ${JSON.stringify(hello.lesson || null)}`);
const greeting = await waitFor(good.messages, (m) => m.type === "ai_done" && m.requestId === 1, 25000);
if (!String(greeting.text || "").trim()) throw new Error("greeting was empty");
good.ws.send(JSON.stringify({ type: "interrupt", requestId: 1, reason: "barge_in" }));
await waitFor(good.messages, (m) => m.type === "interrupt_ack", 4000);
// Learn accepts only gateway STT; a browser transcript must not produce a reply.
good.ws.send(JSON.stringify({ type: "client_final_transcript", requestId: 2, text: "My name is Lan." }));
await new Promise((r) => setTimeout(r, 4000));
const reply = good.messages.find((m) => m.type === "ai_done" && m.requestId === 2) || null;
const audio = good.messages.some((m) => m.type === "binary" && m.bytes > 0);
good.ws.close(1000, "client");
await new Promise((r) => good.ws.once("close", r));

const wrong = new WebSocket(
  `ws://127.0.0.1:${port}/?token=${encodeURIComponent(tokenFor(otherId, sessionId))}&sessionId=${encodeURIComponent(sessionId)}`
);
const wrongCode = await new Promise((resolve) => {
  wrong.once("close", (code) => resolve(code));
});

const legacyId = `legacy-preview-${Date.now()}`;
const legacyToken = jwt.sign({ sub: userId, plan: "trial" }, env.VOICE_JWT_SECRET, { expiresIn: 60 });
const legacy = await connect(
  `ws://127.0.0.1:${port}/?token=${encodeURIComponent(legacyToken)}&sessionId=${encodeURIComponent(legacyId)}`
);
const legacyHello = await waitFor(legacy.messages, (m) => m.type === "hello", 4000);
if (legacyHello.lesson) throw new Error("old token received a lesson context");
legacy.ws.close(1000, "client");

const shortId = `learn-short-${Date.now()}`;
await redis.set(learnAiCallSessionKey(shortId), userId, "EX", 120);
await redis.set(
  learnAiCallContextKey(shortId),
  JSON.stringify({ userId, lessonId: "p1-g1-n01", title, objective: "Say hello", level: 1, maxMinutes: 0.03 }),
  "EX",
  120
);
const short = await connect(
  `ws://127.0.0.1:${port}/?token=${encodeURIComponent(tokenFor(userId, shortId))}&sessionId=${encodeURIComponent(shortId)}`
);
const ended = await waitFor(short.messages, (m) => m.type === "call_ended", 5000);

const stillMember = await redis.sismember(`voice:user:sessions:${userId}`, sessionId);
await redis.del(learnAiCallSessionKey(sessionId), learnAiCallContextKey(sessionId), learnAiCallSessionKey(shortId), learnAiCallContextKey(shortId));
await redis.quit();

console.log(
  JSON.stringify({
    helloTitle: hello.lesson.title,
    greetingChars: String(greeting.text).trim().length,
    clientTranscriptIgnored: reply === null,
    audioChunks: audio,
    otherUserClose: wrongCode,
    legacyHello: legacyHello.type,
    legacyLesson: legacyHello.lesson,
    timeLimit: ended.reason,
    sessionReleased: stillMember === 0,
  })
);

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
        reject(new Error(`timeout waiting for message; saw ${list.map((m) => m.type).join(",")}`));
      }
    }, 100);
  });
}
