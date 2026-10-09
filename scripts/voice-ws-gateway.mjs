/**
 * SaaS WS Gateway (Phase 1):
 * - JWT auth on connect (token + sessionId)
 * - Session state + memory window in Redis
 * - STT in gateway (Azure), LLM+TTS in BullMQ workers
 * - Streaming via Redis Pub/Sub channel voice:chan:{sessionId}
 * - Cancel/interrupt end-to-end via Redis cancel keys
 */

import { createRequire } from "node:module";
import { WebSocketServer } from "ws";
import Redis from "ioredis";
import fs from "node:fs";
import path from "node:path";
import {
  learnAiCallBindingMatches,
  learnAiCallClockKey,
  learnAiCallGateOpen,
  learnAiCallContextKey,
  learnAiCallLevelOnePrompt,
  learnAiCallSessionKey,
  learnAiCallSocketAllowed,
  learnAiCallSummary,
  learnAiCallUsageKey,
  reserveLearnCallPackage,
  resolveLearnCallClock,
  settleLearnCallHold,
} from "../lib/beego/learn/ai-call-access.js";

const require = createRequire(import.meta.url);
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const jwt = require("jsonwebtoken");
const { Queue } = require("bullmq");

function tryLoadEnvLocal() {
  // Support running without `node --env-file=.env.local`
  try {
    const p = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(p)) return;
    const raw = fs.readFileSync(p, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const idx = t.indexOf("=");
      if (idx <= 0) continue;
      const k = t.slice(0, idx).trim();
      const v = t.slice(idx + 1).trim();
      if (!k) continue;
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch (_e) {
    /* ignore */
  }
}

tryLoadEnvLocal();

const PORT = Number(process.env.VOICE_WS_PORT || 3031);
const HOST = process.env.VOICE_WS_HOST || "127.0.0.1";
const REDIS_URL = String(process.env.REDIS_URL || "").trim();
const JWT_SECRET = String(process.env.VOICE_JWT_SECRET || "").trim();

const AZURE_KEY = String(process.env.AZURE_SPEECH_KEY || "").trim();
const AZURE_REGION = String(process.env.AZURE_SPEECH_REGION || "").trim();
const USE_AZURE = Boolean(AZURE_KEY && AZURE_REGION);

const PARTIAL_DEBOUNCE_MS_RAW = Number(process.env.VOICE_PARTIAL_DEBOUNCE_MS || 160);
const PARTIAL_DEBOUNCE_MS = Math.max(120, Math.min(200, Number.isFinite(PARTIAL_DEBOUNCE_MS_RAW) ? PARTIAL_DEBOUNCE_MS_RAW : 160));

if (!REDIS_URL) {
  // eslint-disable-next-line no-console
  console.error("[voice-gateway] Missing REDIS_URL. Set REDIS_URL=redis://127.0.0.1:6379 in .env.local");
  process.exit(1);
}
if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error("[voice-gateway] Missing VOICE_JWT_SECRET. Add a strong secret (32+ bytes) in .env.local");
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  // eslint-disable-next-line no-console
  console.error("[voice-gateway] VOICE_JWT_SECRET is too short. Use 32+ bytes random secret.");
  process.exit(1);
}

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const pub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

const llmQueue = new Queue(process.env.VOICE_LLM_QUEUE || "voice-llm", { connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null }) });
const ttsQueue = new Queue(process.env.VOICE_TTS_QUEUE || "voice-tts", { connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null }) });
const usageQueue = new Queue(process.env.VOICE_USAGE_QUEUE || "voice-usage", { connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null }) });

// Ensure Redis is reachable before accepting WS.
try {
  await redis.ping();
} catch (e) {
  // eslint-disable-next-line no-console
  console.error("[voice-gateway] Redis connection failed. Is Redis running?", e?.message || e);
  process.exit(1);
}

function kSess(sessionId) {
  return `voice:sess:${sessionId}`;
}
function kMem(sessionId) {
  return `voice:mem:${sessionId}`;
}
function kChan(sessionId) {
  return `voice:chan:${sessionId}`;
}
function kCancel(sessionId, requestId) {
  return `voice:cancel:${sessionId}:${requestId}`;
}
function keyUsageDaily(userId, ymd) {
  return `voice:usage:daily:${userId}:${ymd}`;
}
function keyUsageMonth(userId, ym) {
  return `voice:usage:month:${userId}:${ym}`;
}

function utcYmd() {
  const t = new Date();
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
function utcYm() {
  const t = new Date();
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function safeSend(ws, obj) {
  if (ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (_e) {}
  }
}

function normalizeRequestId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function sendBinaryTts(ws, requestId, chunkU8) {
  if (ws.readyState !== 1) return;
  const rid = normalizeRequestId(requestId);
  const out = new Uint8Array(1 + 4 + chunkU8.length);
  out[0] = 0x02;
  out[1] = rid & 0xff;
  out[2] = (rid >>> 8) & 0xff;
  out[3] = (rid >>> 16) & 0xff;
  out[4] = (rid >>> 24) & 0xff;
  out.set(chunkU8, 5);
  ws.send(out);
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || typeof decoded !== "object") return null;
    const sub = decoded.sub ? String(decoded.sub).trim() : "";
    if (!sub) return null;
    return {
      userId: sub,
      plan: decoded.plan ? String(decoded.plan) : "expired",
      purpose: decoded.purpose ? String(decoded.purpose) : "",
      sid: decoded.sid ? String(decoded.sid) : "",
      learnAllow: Number(decoded.learnAllow) === 1 ? 1 : 0,
    };
  } catch {
    return null;
  }
}

function planLimits(plan) {
  const p = String(plan || "expired");
  // Conservative defaults; can be moved to settings later.
  if (p === "vip") {
    return {
      maxConcurrentSessions: 4,
      maxStartsPerMin: 120,
      cap: {
        stt_ms_day: 6 * 60 * 60 * 1000,
        stt_ms_month: 120 * 60 * 60 * 1000,
        llm_tokens_day: 200000,
        llm_tokens_month: 4000000,
        tts_bytes_day: 250000000,
        tts_bytes_month: 5000000000,
      },
    };
  }
  if (p === "pro" || p === "trial") {
    return {
      maxConcurrentSessions: 2,
      maxStartsPerMin: 60,
      cap: {
        stt_ms_day: 60 * 60 * 1000,
        stt_ms_month: 20 * 60 * 60 * 1000,
        llm_tokens_day: 30000,
        llm_tokens_month: 600000,
        tts_bytes_day: 30000000,
        tts_bytes_month: 800000000,
      },
    };
  }
  return {
    maxConcurrentSessions: 1,
    maxStartsPerMin: 25,
    cap: {
      stt_ms_day: 10 * 60 * 1000,
      stt_ms_month: 3 * 60 * 60 * 1000,
      llm_tokens_day: 3000,
      llm_tokens_month: 60000,
      tts_bytes_day: 3000000,
      tts_bytes_month: 80000000,
    },
  };
}

function keyUserSessions(userId) {
  return `voice:user:sessions:${userId}`;
}

function keyRateMin(userId) {
  const t = new Date();
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  const hh = String(t.getUTCHours()).padStart(2, "0");
  const mm = String(t.getUTCMinutes()).padStart(2, "0");
  return `voice:rl:start:${userId}:${y}${m}${d}${hh}${mm}`;
}

let quotaCache = { loadedAt: 0, plans: null };

async function loadQuotaPlanFromRedis(plan) {
  const p = String(plan || "expired");
  const now = Date.now();
  if (quotaCache.plans && now - quotaCache.loadedAt < 10_000) {
    return quotaCache.plans[p] || quotaCache.plans.expired || null;
  }
  try {
    const plans = {};
    for (const k of ["expired", "trial", "pro", "vip"]) {
      // Hash fields set by /api/admin/voice/quota
      // voice:quota:plan:{plan}
      // maxStartsPerMin, maxConcurrentSessions, stt_ms_day, stt_ms_month, llm_tokens_day, llm_tokens_month, tts_bytes_day, tts_bytes_month
      const h = await redis.hgetall(`voice:quota:plan:${k}`);
      if (h && Object.keys(h).length) {
        plans[k] = {
          maxStartsPerMin: Number(h.maxStartsPerMin || 0),
          maxConcurrentSessions: Number(h.maxConcurrentSessions || 0),
          cap: {
            stt_ms_day: Number(h.stt_ms_day || 0),
            stt_ms_month: Number(h.stt_ms_month || 0),
            llm_tokens_day: Number(h.llm_tokens_day || 0),
            llm_tokens_month: Number(h.llm_tokens_month || 0),
            tts_bytes_day: Number(h.tts_bytes_day || 0),
            tts_bytes_month: Number(h.tts_bytes_month || 0),
          },
        };
      }
    }
    quotaCache = { loadedAt: now, plans };
    return plans[p] || plans.expired || null;
  } catch {
    return null;
  }
}

async function planLimitsDynamic(plan) {
  const fromRedis = await loadQuotaPlanFromRedis(plan);
  if (fromRedis && fromRedis.maxStartsPerMin && fromRedis.maxConcurrentSessions) {
    return {
      maxStartsPerMin: fromRedis.maxStartsPerMin,
      maxConcurrentSessions: fromRedis.maxConcurrentSessions,
      cap: fromRedis.cap,
    };
  }
  return planLimits(plan);
}

async function enforceRateLimit({ userId, plan }) {
  const lim = await planLimitsDynamic(plan);
  const key = keyRateMin(userId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 120);
  }
  return count <= lim.maxStartsPerMin;
}

async function enforceConcurrency({ userId, sessionId, plan }) {
  const lim = await planLimitsDynamic(plan);
  const key = keyUserSessions(userId);
  await redis.sadd(key, sessionId);
  await redis.expire(key, 3600);
  const n = await redis.scard(key);
  return n <= lim.maxConcurrentSessions;
}

async function readUsage(userId) {
  const ymd = utcYmd();
  const ym = utcYm();
  const dailyKey = keyUsageDaily(userId, ymd);
  const monthKey = keyUsageMonth(userId, ym);
  const [d, m] = await Promise.all([redis.hgetall(dailyKey), redis.hgetall(monthKey)]);
  const num = (o, k) => {
    const v = Number(o?.[k] || 0);
    return Number.isFinite(v) ? v : 0;
  };
  return {
    ymd,
    ym,
    dailyKey,
    monthKey,
    daily: {
      stt_audio_ms: num(d, "stt_audio_ms"),
      llm_tokens_in: num(d, "llm_tokens_in"),
      llm_tokens_out: num(d, "llm_tokens_out"),
      tts_bytes: num(d, "tts_bytes"),
    },
    month: {
      stt_audio_ms: num(m, "stt_audio_ms"),
      llm_tokens_in: num(m, "llm_tokens_in"),
      llm_tokens_out: num(m, "llm_tokens_out"),
      tts_bytes: num(m, "tts_bytes"),
    },
  };
}

async function enforceCaps({ ws, requestId, scope }) {
  const lim = await planLimitsDynamic(ws.userPlan);
  const usage = await readUsage(ws.userId);
  const cap = lim.cap;
  const usedDay =
    scope === "stt"
      ? usage.daily.stt_audio_ms
      : scope === "llm"
      ? usage.daily.llm_tokens_in + usage.daily.llm_tokens_out
      : usage.daily.tts_bytes;
  const usedMonth =
    scope === "stt"
      ? usage.month.stt_audio_ms
      : scope === "llm"
      ? usage.month.llm_tokens_in + usage.month.llm_tokens_out
      : usage.month.tts_bytes;
  const limitDay = scope === "stt" ? cap.stt_ms_day : scope === "llm" ? cap.llm_tokens_day : cap.tts_bytes_day;
  const limitMonth = scope === "stt" ? cap.stt_ms_month : scope === "llm" ? cap.llm_tokens_month : cap.tts_bytes_month;
  const ok = usedDay <= limitDay && usedMonth <= limitMonth;
  if (ok) return true;

  const msg = {
    type: "quota_exceeded",
    requestId,
    scope,
    used_day: usedDay,
    limit_day: limitDay,
    used_month: usedMonth,
    limit_month: limitMonth,
    plan: ws.userPlan,
  };
  safeSend(ws, msg);
  pub.publish(kChan(ws.sessionId), JSON.stringify(msg)).catch(() => {});
  await setCancelled(ws.sessionId, requestId);
  pub.publish(kChan(ws.sessionId), JSON.stringify({ type: "interrupt", requestId, reason: "quota_exceeded" })).catch(() => {});
  safeSend(ws, { type: "interrupt", requestId, reason: "quota_exceeded" });
  return false;
}

async function setCancelled(sessionId, requestId) {
  const rid = normalizeRequestId(requestId);
  if (!rid) return;
  await redis.set(kCancel(sessionId, rid), "1", "EX", 120);
}

async function getMemory(sessionId, maxTurns = 10) {
  const raw = await redis.lrange(kMem(sessionId), 0, maxTurns * 2 - 1);
  const out = [];
  for (const s of raw) {
    try {
      const j = JSON.parse(s);
      if (j && typeof j === "object" && j.role && j.content) out.push(j);
    } catch (_e) {}
  }
  return out.slice(-maxTurns * 2);
}

function withLearnMemory(ws, memory) {
  const base = Array.isArray(memory) ? memory : [];
  if (!ws?.learnPrompt) return base;
  return [{ role: "system", content: ws.learnPrompt }, ...base];
}

async function pushTurn(sessionId, role, content, extra = null) {
  const item = JSON.stringify(extra ? { role, content, ...extra } : { role, content });
  await redis.lpush(kMem(sessionId), item);
  await redis.ltrim(kMem(sessionId), 0, 19); // 10 turns = 20 messages
  await redis.expire(kMem(sessionId), 60 * 60);
}

async function updateMemory(sessionId, mutator) {
  const key = kMem(sessionId);
  const raw = await redis.lrange(key, 0, 19);
  let changed = false;
  const next = [];
  for (const entry of raw) {
    try {
      const parsed = JSON.parse(entry);
      const result = mutator(parsed);
      if (result === null) {
        changed = true;
        continue;
      }
      if (result !== parsed) {
        changed = true;
        next.push(JSON.stringify(result));
        continue;
      }
    } catch (_e) {
      /* keep the original entry */
    }
    next.push(entry);
  }
  if (!changed) return;
  await redis.del(key);
  for (let i = next.length - 1; i >= 0; i -= 1) await redis.lpush(key, next[i]);
  await redis.expire(key, 60 * 60);
}

async function markAssistantPlayback(sessionId, requestId, playback) {
  const rid = normalizeRequestId(requestId);
  if (!rid || (playback !== "complete" && playback !== "interrupted")) return;
  let done = false;
  await updateMemory(sessionId, (item) => {
    if (done) return item;
    if (item?.role !== "assistant" || Number(item.requestId) !== rid) return item;
    if (item.playback === "complete" || item.playback === "interrupted") return item;
    done = true;
    return { ...item, playback };
  });
}

async function emitLearnSummary(ws, reason) {
  if (!ws?.learnPrompt || ws.summarySent) return null;
  ws.summarySent = true;
  const startedRaw = await redis.hget(kSess(ws.sessionId), "connectedAt");
  const memory = await getMemory(ws.sessionId, 10);
  const summary = learnAiCallSummary({
    memory,
    startedAt: startedRaw == null || startedRaw === "" ? null : Number(startedRaw),
    endedAt: Date.now(),
    lesson: ws.learnLesson,
  });
  safeSend(ws, { type: "call_summary", reason, summary });
  return summary;
}

function toArrayBuffer(buf) {
  if (buf instanceof ArrayBuffer) return buf;
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function disposeSession(ws) {
  const s = ws.session;
  if (!s) return;
  s.accepting = false;
  s.preRoll = [];
  s.preRollBytes = 0;
  if (s.recognizer) {
    try {
      s.recognizer.stopContinuousRecognitionAsync(
        () => {
          try {
            s.recognizer.close();
          } catch (_e) {}
        },
        () => {
          try {
            s.recognizer.close();
          } catch (_e2) {}
        }
      );
    } catch (_e) {
      try {
        s.recognizer.close();
      } catch (_e2) {}
    }
  }
  try {
    s.pushStream?.close?.();
  } catch (_e) {}
  ws.session = null;
}

function flushPreRoll(ws) {
  const s = ws.session;
  if (!s?.pushStream || !s.preRoll?.length) return;
  for (const chunk of s.preRoll) {
    try {
      s.pushStream.write(toArrayBuffer(chunk));
    } catch (_e) {}
  }
  s.preRoll = [];
  s.preRollBytes = 0;
}

function appendPreRoll(ws, data) {
  const s = ws.session;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const max = 2_000_000;
  if (!s.preRoll) s.preRoll = [];
  if (s.preRollBytes + buf.length > max) return;
  s.preRoll.push(buf);
  s.preRollBytes += buf.length;
}

function handleBinary(ws, data) {
  const s = ws.session;
  if (!s?.active) return;
  // Usage tracking (Phase 2): approximate audio ms from raw PCM bytes.
  try {
    const len = Buffer.isBuffer(data) ? data.length : data.byteLength;
    const ms = Math.floor((len * 1000) / (2 * 16000));
    if (ms > 0 && !ws.learnPrompt) {
      const ymd = utcYmd();
      const ym = utcYm();
      redis.hincrby(keyUsageDaily(ws.userId, ymd), "stt_audio_ms", ms).catch(() => {});
      redis.expire(keyUsageDaily(ws.userId, ymd), 60 * 60 * 24 * 7).catch(() => {});
      redis.hincrby(keyUsageMonth(ws.userId, ym), "stt_audio_ms", ms).catch(() => {});
      redis.expire(keyUsageMonth(ws.userId, ym), 60 * 60 * 24 * 40).catch(() => {});
    }
  } catch (_e) {}

  // Hard stop if STT quota exceeded mid-stream.
  if (ws.currentRequestId) {
    enforceCaps({ ws, requestId: ws.currentRequestId, scope: "stt" }).catch(() => {});
  }
  if (s.accepting && s.pushStream) {
    try {
      s.pushStream.write(toArrayBuffer(data));
    } catch (_e) {}
    return;
  }
  appendPreRoll(ws, data);
}

async function startAzureStt(ws, requestId) {
  disposeSession(ws);
  const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(format);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
  speechConfig.speechRecognitionLanguage = "en-US";
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  const sid = ws.sessionId;

  const session = { active: true, accepting: false, pushStream, recognizer, preRoll: [], preRollBytes: 0 };
  ws.session = session;

  let lastPartial = "";
  let debounce = null;

  recognizer.canceled = (_s, e) => {
    if (requestId !== ws.currentRequestId) return;
    const details = e?.errorDetails ? String(e.errorDetails) : "";
    const reason = e?.reason != null ? String(e.reason) : "canceled";
    const code = e?.errorCode != null ? String(e.errorCode) : "";
    // eslint-disable-next-line no-console
    console.error("[voice-gateway][azure-stt] canceled", {
      requestId,
      reason,
      code,
      details: details ? details.slice(0, 500) : "",
    });
    safeSend(ws, {
      type: "error",
      requestId,
      message: details
        ? `Azure STT canceled (reason=${reason}${code ? ` code=${code}` : ""}): ${details}`
        : `Azure STT canceled (reason=${reason}${code ? ` code=${code}` : ""}).`,
    });
    safeSend(ws, { type: "interrupt", requestId, reason: "stt_canceled" });
    disposeSession(ws);
  };

  recognizer.sessionStopped = () => {
    if (requestId !== ws.currentRequestId) return;
    safeSend(ws, { type: "interrupt", requestId, reason: "stt_session_stopped" });
  };

  recognizer.recognizing = async (_s, e) => {
    const text = e.result?.text ? String(e.result.text) : "";
    if (!text) return;
    if (requestId !== ws.currentRequestId) return;
    safeSend(ws, { type: "partial_transcript", requestId, text });
    lastPartial = text;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      if (requestId !== ws.currentRequestId) return;
      const t = String(lastPartial).trim();
      if (t.length < 4) return;
      const memory = await getMemory(sid, 10);
      await llmQueue.add(
        `spec-${sid}-${requestId}`,
        { kind: "spec", sessionId: sid, requestId, text: t, memory: withLearnMemory(ws, memory), skipSharedUsage: Boolean(ws.learnPrompt) },
        { removeOnComplete: 1000, removeOnFail: 500 }
      );
    }, PARTIAL_DEBOUNCE_MS);
  };

  recognizer.recognized = async (_s, e) => {
    const text = e.result?.text ? String(e.result.text) : "";
    if (requestId !== ws.currentRequestId) return;
    safeSend(ws, { type: "final_transcript", requestId, text });
    if (debounce) clearTimeout(debounce);
    debounce = null;
    const ft = text.trim();
    if (!ft) return;
    await pushTurn(sid, "user", ft);
    const memory = await getMemory(sid, 10);
    await llmQueue.add(
      `final-${sid}-${requestId}`,
      { kind: "final", sessionId: sid, requestId, text: ft, memory: withLearnMemory(ws, memory), skipSharedUsage: Boolean(ws.learnPrompt) },
      { removeOnComplete: 1000, removeOnFail: 500 }
    );
  };

  recognizer.startContinuousRecognitionAsync(
    () => {
      session.accepting = true;
      flushPreRoll(ws);
      safeSend(ws, { type: "recognition_started", requestId });
    },
    (err) => {
      safeSend(ws, { type: "error", requestId, message: err?.message || String(err) });
      disposeSession(ws);
    }
  );
}

const learnLiveSockets = new Set();
const wss = new WebSocketServer({ port: PORT, host: HOST });
if (process.env.LEARN_AI_CALL_RUNTIME_GATE === "1") {
  setInterval(() => {
    learnAiCallGateOpen(redis)
      .then((open) => {
        if (open) return;
        for (const socket of learnLiveSockets) {
          safeSend(socket, { type: "call_ended", reason: "feature_disabled" });
          try {
            socket.close(1000, "feature_disabled");
          } catch (_e) {}
        }
      })
      .catch(() => {});
  }, 2000).unref();
}

wss.on("connection", async (ws, req) => {
  const u = new URL(req.url || "/", "http://localhost");
  const token = u.searchParams.get("token") || "";
  const sessionId = u.searchParams.get("sessionId") || "";
  const auth = verifyToken(token);
  if (!auth || !sessionId) {
    try {
      ws.close(1008, "unauthorized");
    } catch (_e) {}
    return;
  }

  let learnCtx = null;
  const learnGate = learnAiCallSocketAllowed(auth);
  if (learnGate.applies) {
    if (!learnGate.allowed || learnGate.sid !== sessionId) {
      try {
        ws.close(1008, "unauthorized");
      } catch (_e) {}
      return;
    }
    try {
      const boundUser = await redis.get(learnAiCallSessionKey(sessionId));
      if (!learnAiCallBindingMatches(boundUser, auth.userId)) {
        ws.close(1008, "unauthorized");
        return;
      }
      const rawCtx = await redis.get(learnAiCallContextKey(sessionId));
      learnCtx = rawCtx ? JSON.parse(String(rawCtx)) : null;
    } catch (_e) {
      try {
        ws.close(1011, "unavailable");
      } catch (_e2) {}
      return;
    }
    if (!learnCtx || String(learnCtx.userId || "") !== String(auth.userId)) {
      try {
        ws.close(1008, "unauthorized");
      } catch (_e) {}
      return;
    }
    if (process.env.LEARN_AI_CALL_RUNTIME_GATE === "1" && !(await learnAiCallGateOpen(redis))) {
      safeSend(ws, { type: "call_ended", reason: "feature_disabled" });
      try {
        ws.close(1000, "feature_disabled");
      } catch (_e) {}
      return;
    }
    ws.learnPrompt = learnAiCallLevelOnePrompt(learnCtx);
    ws.learnLesson = {
      lessonId: String(learnCtx.lessonId || ""),
      title: String(learnCtx.title || ""),
      objective: String(learnCtx.objective || ""),
    };
    const minutes = Number(learnCtx.maxMinutes);
    const sessionCapMs = Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 2 * 60 * 1000;
    ws.learnMaxMs = sessionCapMs;
    ws.learnStopReason = "time_limit";
    const packageHold = await reserveLearnCallPackage(redis, {
      userId: auth.userId,
      plan: auth.plan,
      sessionId,
      sessionCapMs,
    });
    ws.learnPackage = packageHold.status === "unmetered" ? null : packageHold;
    if (packageHold.status === "denied") {
      safeSend(ws, {
        type: "call_ended",
        reason: "package_quota",
        packageQuota: packageHold,
      });
      try {
        ws.close(1000, "package_quota");
      } catch (_e) {}
      return;
    }
    if (packageHold.status === "granted" || packageHold.status === "reused") {
      ws.learnMaxMs = packageHold.reservedMs;
      if (packageHold.reservedMs < sessionCapMs) ws.learnStopReason = "package_quota";
    }
    const clockKey = learnAiCallClockKey(sessionId);
    let storedClock = null;
    try {
      const rawClock = await redis.get(clockKey);
      storedClock = rawClock ? JSON.parse(String(rawClock)) : null;
    } catch (_e) {
      storedClock = null;
    }
    let clock = resolveLearnCallClock({ now: Date.now(), maxMs: ws.learnMaxMs, existing: storedClock });
    if (!clock.reused) {
      const saved = await redis.set(
        clockKey,
        JSON.stringify({ startedAt: clock.startedAt, deadlineAt: clock.deadlineAt }),
        "EX",
        60 * 60,
        "NX"
      );
      if (saved !== "OK") {
        const rawClock = await redis.get(clockKey);
        storedClock = rawClock ? JSON.parse(String(rawClock)) : null;
        clock = resolveLearnCallClock({ now: Date.now(), maxMs: ws.learnMaxMs, existing: storedClock });
      }
    }
    ws.learnClock = clock;
    if (clock.remainingMs <= 0) {
      ws.userId = auth.userId;
      ws.sessionId = sessionId;
      try {
        await settleLearnCallHold(redis, { userId: auth.userId, sessionId, startedAt: clock.startedAt });
      } catch (_e) {}
      safeSend(ws, {
        type: "call_ended",
        reason: ws.learnStopReason || "time_limit",
        callClock: clock,
        packageQuota: ws.learnPackage || null,
      });
      try {
        ws.close(1000, ws.learnStopReason || "time_limit");
      } catch (_e) {}
      return;
    }
  }

  ws.userId = auth.userId;
  ws.sessionId = sessionId;
  ws.userPlan = auth.plan || "expired";
  ws.currentRequestId = 0;

  // Concurrency guard (Phase 2)
  const okConc = await enforceConcurrency({
    userId: ws.userId,
    sessionId,
    plan: ws.userPlan,
  });
  if (!okConc) {
    safeSend(ws, { type: "error", message: "Too many active voice sessions for your plan." });
    try {
      ws.close(1013, "rate_limited");
    } catch (_e) {}
    return;
  }

  // Persist session state (Phase 1)
  const connectedAt = ws.learnClock ? String(ws.learnClock.startedAt) : String(Date.now());
  await redis.hset(kSess(sessionId), {
    userId: String(auth.userId),
    currentRequestId: "0",
    connectedAt,
    plan: String(ws.userPlan),
  });
  await redis.expire(kSess(sessionId), 60 * 60);

  if (ws.learnPrompt) learnLiveSockets.add(ws);
  safeSend(ws, {
    type: "hello",
    useAzure: USE_AZURE,
    pcmHz: 16000,
    channels: 1,
    encoding: "pcm_s16le",
    hasOpenAi: true,
    sessionId,
    plan: ws.userPlan,
    lesson: learnCtx
      ? {
          lessonId: String(learnCtx.lessonId || ""),
          title: String(learnCtx.title || ""),
          objective: String(learnCtx.objective || ""),
          level: Number(learnCtx.level) || 1,
          maxMinutes: Number(learnCtx.maxMinutes) || 2,
        }
      : null,
    callClock: ws.learnClock
      ? {
          startedAt: ws.learnClock.startedAt,
          deadlineAt: ws.learnClock.deadlineAt,
          remainingMs: ws.learnClock.remainingMs,
        }
      : null,
    packageQuota: ws.learnPackage || null,
  });

  // Subscribe to worker events and stream to this WS
  const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  await sub.subscribe(kChan(sessionId));
  if (ws.learnPrompt) {
    ws.currentRequestId = 1;
    await redis.hset(kSess(sessionId), { currentRequestId: "1" });
    await llmQueue.add(
      `greet-${sessionId}`,
      {
        kind: "final",
        sessionId,
        requestId: 1,
        text: "The learner just joined. Greet them and ask one simple question about the lesson.",
        memory: withLearnMemory(ws, []),
        skipSharedUsage: true,
      },
      { removeOnComplete: 1000, removeOnFail: 500 }
    );
    ws.learnTimer = setTimeout(() => {
      (async () => {
        const reason = ws.learnStopReason || "time_limit";
        await emitLearnSummary(ws, reason);
        safeSend(ws, { type: "call_ended", reason, packageQuota: ws.learnPackage || null });
        try {
          ws.close(1000, reason);
        } catch (_e) {}
      })().catch(() => {});
    }, Math.max(0, ws.learnClock?.remainingMs ?? ws.learnMaxMs));
  }
  sub.on("message", async (_ch, raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch (_e) {
      return;
    }
    const rid = normalizeRequestId(msg?.requestId);
    if (rid && rid !== ws.currentRequestId) return;
    if (msg.type === "tts_chunk") {
      const b64 = String(msg.data_b64 || "");
      if (!b64) return;
      const u8 = Buffer.from(b64, "base64");
      sendBinaryTts(ws, rid, u8);
      return;
    }
    if (msg.type === "llm_done_for_tts") {
      const text = String(msg.text || "").trim();
      if (!text) return;
      if (ws.learnPrompt) {
        await pushTurn(sessionId, "assistant", text, { requestId: rid, playback: "pending" });
      } else {
        await pushTurn(sessionId, "assistant", text);
      }
      await ttsQueue.add(
        `tts-${sessionId}-${rid}`,
        { sessionId, requestId: rid, text, skipSharedUsage: Boolean(ws.learnPrompt) },
        { removeOnComplete: 1000, removeOnFail: 500 }
      );
      return;
    }
    if (msg.type === "tts_end" && ws.learnPrompt) {
      await markAssistantPlayback(sessionId, rid, "complete");
    }
    safeSend(ws, msg);
  });

  ws.on("message", async (data, isBinary) => {
    if (isBinary) {
      handleBinary(ws, data);
      return;
    }
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch (_e) {
      return;
    }
    const t = msg?.type;
    if (t === "interrupt") {
      const rid = normalizeRequestId(msg?.requestId) || ws.currentRequestId;
      await setCancelled(sessionId, rid);
      if (ws.learnPrompt) await markAssistantPlayback(sessionId, rid, "interrupted");
      pub.publish(kChan(sessionId), JSON.stringify({ type: "interrupt", requestId: rid, reason: String(msg.reason || "client") })).catch(() => {});
      safeSend(ws, { type: "interrupt_ack", requestId: rid, reason: String(msg.reason || "client") });
      return;
    }
    if (t === "end_call" && ws.learnPrompt) {
      await emitLearnSummary(ws, "client_end");
      safeSend(ws, { type: "call_ended", reason: "client_end" });
      return;
    }
    if (t === "repeat_last" && ws.learnPrompt) {
      const memory = await getMemory(sessionId, 10);
      const last = [...memory].reverse().find((item) => item?.role === "assistant" && String(item.content || "").trim());
      if (!last) {
        safeSend(ws, { type: "error", message: "Chưa có câu để nghe lại." });
        return;
      }
      const rid = ws.currentRequestId || 1;
      await ttsQueue.add(
        `repeat-${sessionId}-${rid}-${Date.now()}`,
        { sessionId, requestId: rid, text: String(last.content).slice(0, 500), skipSharedUsage: true },
        { removeOnComplete: 1000, removeOnFail: 500 }
      );
      safeSend(ws, { type: "repeat_started", requestId: rid });
      return;
    }
    if (t === "recognition_start") {
      const rid = normalizeRequestId(msg?.requestId);
      if (!rid) return;

      const okRate = await enforceRateLimit({ userId: ws.userId, plan: ws.userPlan });
      if (!okRate) {
        safeSend(ws, { type: "error", requestId: rid, message: "Rate limit exceeded. Try again shortly." });
        return;
      }

      const okQuota = await enforceCaps({ ws, requestId: rid, scope: "stt" });
      if (!okQuota) return;

      ws.currentRequestId = rid;
      await redis.hset(kSess(sessionId), { currentRequestId: String(rid) });
      await setCancelled(sessionId, rid); // cancel any previous request keys quickly
      await redis.del(kCancel(sessionId, rid)); // clear cancel for this rid (fresh)
      if (USE_AZURE) {
        await startAzureStt(ws, rid);
      } else {
        safeSend(ws, { type: "error", requestId: rid, message: "Azure STT not configured." });
      }
      return;
    }
    if (t === "recognition_end") {
      // stop STT accepting audio (Azure will finalize soon)
      const s = ws.session;
      if (s) {
        s.accepting = false;
        try {
          s.pushStream?.close?.();
        } catch (_e) {}
      }
      return;
    }

    // Fallback path: client-side STT (Web Speech API) sends transcripts directly.
    if (t === "client_partial_transcript") {
      const rid = normalizeRequestId(msg?.requestId) || ws.currentRequestId;
      const text = String(msg?.text || "").trim();
      if (!rid || !text) return;
      ws.currentRequestId = rid;
      await redis.hset(kSess(sessionId), { currentRequestId: String(rid) });
      // Forward to UI for consistency + speculative LLM
      safeSend(ws, { type: "partial_transcript", requestId: rid, text });
      if (!ws.learnPrompt) {
        const okQuota = await enforceCaps({ ws, requestId: rid, scope: "llm" });
        if (!okQuota) return;
      }
      const memory = await getMemory(sessionId, 10);
      await llmQueue.add(
        `spec-client-${sessionId}-${rid}-${Date.now()}`,
        { kind: "spec", sessionId, requestId: rid, text, memory: withLearnMemory(ws, memory), skipSharedUsage: Boolean(ws.learnPrompt) },
        { removeOnComplete: 1000, removeOnFail: 500 }
      );
      return;
    }

    if (t === "client_final_transcript") {
      const rid = normalizeRequestId(msg?.requestId) || ws.currentRequestId;
      const text = String(msg?.text || "").trim();
      if (!rid || !text) return;
      ws.currentRequestId = rid;
      await redis.hset(kSess(sessionId), { currentRequestId: String(rid) });
      safeSend(ws, { type: "final_transcript", requestId: rid, text });
      if (!ws.learnPrompt) {
        const okQuota = await enforceCaps({ ws, requestId: rid, scope: "llm" });
        if (!okQuota) return;
      }
      await pushTurn(sessionId, "user", text);
      const memory = await getMemory(sessionId, 10);
      await llmQueue.add(
        `final-client-${sessionId}-${rid}-${Date.now()}`,
        { kind: "final", sessionId, requestId: rid, text, memory: withLearnMemory(ws, memory), skipSharedUsage: Boolean(ws.learnPrompt) },
        { removeOnComplete: 1000, removeOnFail: 500 }
      );
      return;
    }
  });

  ws.on("close", () => {
    learnLiveSockets.delete(ws);
    if (ws.learnTimer) clearTimeout(ws.learnTimer);
    try {
      redis.srem(keyUserSessions(ws.userId), sessionId);
    } catch (_e) {}
    if (ws.learnPrompt) {
      const flushUserId = ws.userId;
      const flushSessionId = sessionId;
      setTimeout(() => {
        redis
          .sismember(keyUserSessions(flushUserId), flushSessionId)
          .then(async (active) => {
            if (active) return;
            const startedAt = Number(ws.learnClock?.startedAt);
            await settleLearnCallHold(redis, { userId: flushUserId, sessionId: flushSessionId, startedAt });
            await redis.set(learnAiCallUsageKey(flushSessionId), "1", "EX", 60 * 60, "NX");
          })
          .catch(() => {});
      }, 2000);
    } else {
      try {
        const ymd = utcYmd();
        usageQueue.add(
          `flush-${ws.userId}-${ymd}`,
          { userId: ws.userId, ymd },
          { removeOnComplete: 1000, removeOnFail: 500 }
        );
      } catch (_e) {}
    }
    try {
      sub.quit();
    } catch (_e) {}
    disposeSession(ws);
  });
});

wss.on("listening", () => {
  // eslint-disable-next-line no-console
  console.log(`[voice-gateway] ws://${HOST}:${PORT} | azure=${USE_AZURE ? "on" : "off"} | redis=on | jwt=on`);
});

