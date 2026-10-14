/**
 * Summary check on the preview gateway. Ends a real greeting after TTS.
 * Does not send a client transcript and does not print secrets.
 */
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import WebSocket from "ws";
import { loadLearnCallTestEnv } from "./learn-call-test-env.mjs";
import { learnAiCallContextKey, learnAiCallSessionKey } from "../lib/beego/learn/ai-call-access.js";

const env = loadLearnCallTestEnv();
const userId = "900000001";
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

function tokenFor(sid) {
  return jwt.sign({ sub: userId, plan: "pro", purpose: "learn_ai_call", sid, learnAllow: 1 }, env.VOICE_JWT_SECRET, { expiresIn: 120 });
}
function open(sid) {
  const ws = new WebSocket(`ws://127.0.0.1:${env.wsPort}/?token=${encodeURIComponent(tokenFor(sid))}&sessionId=${encodeURIComponent(sid)}`);
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
    }, 100);
  });
}
async function bind(sid, maxMinutes) {
  await redis.set(learnAiCallSessionKey(sid), userId, "EX", 120);
  await redis.set(
    learnAiCallContextKey(sid),
    JSON.stringify({ userId, lessonId: "p1-g1-n01", title: "Chào một người mới", objective: "Nói tên", level: 1, maxMinutes }),
    "EX",
    120
  );
}

const heardId = `learn-summary-heard-${Date.now()}`;
await bind(heardId, 2);
const heard = await open(heardId);
await waitFor(heard.messages, (item) => item.type === "tts_end" && item.requestId === 1, 20000);
heard.ws.send(JSON.stringify({ type: "end_call" }));
const heardSummary = await waitFor(heard.messages, (item) => item.type === "call_summary", 5000);
heard.ws.close();

const cutId = `learn-summary-cut-${Date.now()}`;
await bind(cutId, 2);
const cut = await open(cutId);
await waitFor(cut.messages, (item) => item.type === "hello", 4000);
cut.ws.send(JSON.stringify({ type: "interrupt", requestId: 1, reason: "barge_in" }));
await new Promise((r) => setTimeout(r, 1500));
cut.ws.send(JSON.stringify({ type: "end_call" }));
const cutSummary = await waitFor(cut.messages, (item) => item.type === "call_summary", 5000);
cut.ws.close();

await redis.del(learnAiCallSessionKey(heardId), learnAiCallContextKey(heardId), learnAiCallSessionKey(cutId), learnAiCallContextKey(cutId));
const member = await redis.sismember(`voice:user:sessions:${userId}`, heardId);
await redis.quit();

const a = heardSummary.summary || {};
const b = cutSummary.summary || {};
console.log(JSON.stringify({
  heardScore: a.score,
  heardPronunciation: a.pronunciation,
  heardCorrection: a.correctionNote,
  heardDuration: a.durationSeconds,
  // No playback_ack is sent, so the played greeting must stay unconfirmed, never complete.
  heardTutorPlayback: a.tutorPlayback || null,
  heardLearnerCount: Array.isArray(a.learnerQuotes) ? a.learnerQuotes.length : null,
  heardLesson: a.lessonTitle,
  cutTutorPlayback: b.tutorPlayback || null,
  cutScore: b.score,
  sessionReleased: member === 0,
}));
