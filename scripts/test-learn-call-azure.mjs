/**
 * Azure STT check for the preview gateway. Audio goes in; no client transcript is sent.
 * Does not print secrets.
 */
import fs from "node:fs";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import WebSocket from "ws";
import { learnAiCallContextKey, learnAiCallSessionKey } from "../lib/beego/learn/ai-call-access.js";

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
const sessionId = `learn-azure-${Date.now()}`;
await redis.set(learnAiCallSessionKey(sessionId), userId, "EX", 180);
await redis.set(
  learnAiCallContextKey(sessionId),
  JSON.stringify({
    userId,
    lessonId: "p1-g1-n01",
    title: "Chào một người mới",
    objective: "Chào hỏi và nói tên.",
    level: 1,
    maxMinutes: 2,
  }),
  "EX",
  180
);

function tokenFor(sub, sid) {
  return jwt.sign({ sub, plan: "pro", purpose: "learn_ai_call", sid }, env.VOICE_JWT_SECRET, { expiresIn: 180 });
}

async function speakPcm(text) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice: "alloy", response_format: "pcm", input: text }),
  });
  if (!res.ok) throw new Error(`tts-source ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  const input = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
  const ratio = 24000 / 16000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i += 1) out[i] = input[Math.floor(i * ratio)] || 0;
  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}

function connect(sid) {
  const token = tokenFor(userId, sid);
  const ws = new WebSocket(`ws://127.0.0.1:3032/?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sid)}`);
  const messages = [];
  ws.on("message", (data, isBinary) => {
    if (isBinary) messages.push({ type: "binary", bytes: data.length });
    else {
      try {
        messages.push(JSON.parse(String(data)));
      } catch (_e) {}
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
        const types = list.map((item) => item.type).join(",");
        reject(new Error(`timeout; saw ${types}`));
      }
    }, 100);
  });
}

async function sendAudio(ws, pcm) {
  const silence = Buffer.alloc(16000 * 2);
  const frames = [pcm, silence];
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i += 3200) {
      ws.send(frame.subarray(i, i + 3200));
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

const conn = await connect(sessionId);
const hello = await waitFor(conn.messages, (item) => item.type === "hello", 4000);
if (hello.useAzure !== true) throw new Error("preview gateway did not enable Azure");
if (hello.lesson?.title !== "Chào một người mới") throw new Error("lesson context missing");
await waitFor(conn.messages, (item) => item.type === "ai_done" && item.requestId === 1, 25000);
conn.ws.send(JSON.stringify({ type: "repeat_last" }));
const repeated = await waitFor(conn.messages, (item) => item.type === "repeat_started" || (item.type === "binary" && item.bytes > 0), 15000);

conn.ws.send(JSON.stringify({ type: "recognition_start", requestId: 2 }));
await waitFor(conn.messages, (item) => item.type === "recognition_started" && item.requestId === 2, 8000);
const nameAudio = await speakPcm("My name is Lan.");
await sendAudio(conn.ws, nameAudio);
const heardName = await waitFor(
  conn.messages,
  (item) => item.type === "final_transcript" && item.requestId === 2 && String(item.text || "").trim(),
  20000
);
const nameReply = await waitFor(conn.messages, (item) => item.type === "ai_done" && item.requestId === 2, 25000);

conn.ws.send(JSON.stringify({ type: "recognition_start", requestId: 3 }));
await waitFor(conn.messages, (item) => item.type === "recognition_started" && item.requestId === 3, 8000);
const askAudio = await speakPcm("What is my name?");
await sendAudio(conn.ws, askAudio);
const heardAsk = await waitFor(
  conn.messages,
  (item) => item.type === "final_transcript" && item.requestId === 3 && String(item.text || "").trim(),
  20000
);
const askReply = await waitFor(conn.messages, (item) => item.type === "ai_done" && item.requestId === 3, 25000);
const audioChunks = conn.messages.filter((item) => item.type === "binary" && item.bytes > 0).length;
conn.ws.send(JSON.stringify({ type: "interrupt", requestId: 3, reason: "client_end" }));
conn.ws.close(1000, "client");
await new Promise((resolve) => conn.ws.once("close", resolve));

const shortId = `learn-azure-short-${Date.now()}`;
await redis.set(learnAiCallSessionKey(shortId), userId, "EX", 60);
await redis.set(
  learnAiCallContextKey(shortId),
  JSON.stringify({ userId, lessonId: "p1-g1-n01", title: "Chào một người mới", objective: "Chào hỏi", level: 1, maxMinutes: 0.03 }),
  "EX",
  60
);
const short = await connect(shortId);
const ended = await waitFor(short.messages, (item) => item.type === "call_ended", 5000);
short.ws.close();

const still = await redis.sismember(`voice:user:sessions:${userId}`, sessionId);
await redis.del(learnAiCallSessionKey(sessionId), learnAiCallContextKey(sessionId), learnAiCallSessionKey(shortId), learnAiCallContextKey(shortId));
await redis.quit();

console.log(JSON.stringify({
  azureHello: hello.useAzure,
  lesson: hello.lesson?.title,
  repeat: repeated.type,
  sttName: String(heardName.text || ""),
  sttAsk: String(heardAsk.text || ""),
  replyRemembersLan: /lan/i.test(String(askReply.text || "")),
  replyChars: String(askReply.text || "").trim().length,
  nameReplyChars: String(nameReply.text || "").trim().length,
  audioChunks,
  timeLimit: ended.reason,
  sessionReleased: still === 0,
}));
