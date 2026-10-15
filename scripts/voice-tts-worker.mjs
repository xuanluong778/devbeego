/**
 * BullMQ worker: streams OpenAI TTS PCM and publishes to Redis channel voice:chan:{sessionId}.
 * Publishes:
 *  - { type:"tts_chunk", requestId, format:"pcm_s16le", sampleRate:24000, data_b64:"..." }
 *  - { type:"tts_end", requestId }
 */

import { Worker } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = String(process.env.REDIS_URL || "").trim();
const OPENAI_KEY = String(process.env.OPENAI_API_KEY || "").trim();

if (!REDIS_URL) {
  // eslint-disable-next-line no-console
  console.error("[voice-tts-worker] Missing REDIS_URL");
  process.exit(1);
}

const pub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

function utcYmd() {
  const t = new Date();
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function keyUsageDaily(userId, ymd) {
  return `voice:usage:daily:${userId}:${ymd}`;
}
function keyUsageMonth(userId, ym) {
  return `voice:usage:month:${userId}:${ym}`;
}
function utcYm() {
  const t = new Date();
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function chan(sessionId) {
  return `voice:chan:${sessionId}`;
}
function cancelKey(sessionId, requestId) {
  return `voice:cancel:${sessionId}:${requestId}`;
}
async function isCancelled(sessionId, requestId) {
  const v = await redis.get(cancelKey(sessionId, requestId));
  return v === "1";
}

async function lookupUserId(sessionId) {
  try {
    const userId = await redis.hget(`voice:sess:${sessionId}`, "userId");
    return userId ? String(userId) : "";
  } catch {
    return "";
  }
}
async function lookupPlan(sessionId) {
  try {
    const plan = await redis.hget(`voice:sess:${sessionId}`, "plan");
    return plan ? String(plan) : "expired";
  } catch {
    return "expired";
  }
}

function planCaps(plan) {
  const p = String(plan || "expired");
  if (p === "vip") return { tts_bytes_day: 250000000, tts_bytes_month: 5000000000 };
  if (p === "pro" || p === "trial") return { tts_bytes_day: 30000000, tts_bytes_month: 800000000 };
  return { tts_bytes_day: 3000000, tts_bytes_month: 80000000 };
}

async function getUsageTts(userId) {
  const ymd = utcYmd();
  const ym = utcYm();
  const [d, m] = await Promise.all([redis.hgetall(keyUsageDaily(userId, ymd)), redis.hgetall(keyUsageMonth(userId, ym))]);
  const num = (o, k) => {
    const v = Number(o?.[k] || 0);
    return Number.isFinite(v) ? v : 0;
  };
  return { ymd, ym, day: num(d, "tts_bytes"), month: num(m, "tts_bytes") };
}

async function quotaCheckAndSignal({ sessionId, requestId, userId, plan }) {
  const cap = planCaps(plan);
  const u = await getUsageTts(userId);
  if (u.day <= cap.tts_bytes_day && u.month <= cap.tts_bytes_month) return true;
  pubJson(sessionId, {
    type: "quota_exceeded",
    requestId,
    scope: "tts",
    used_day: u.day,
    limit_day: cap.tts_bytes_day,
    used_month: u.month,
    limit_month: cap.tts_bytes_month,
    plan,
  });
  pubJson(sessionId, { type: "interrupt", requestId, reason: "quota_exceeded" });
  await redis.set(cancelKey(sessionId, requestId), "1", "EX", 120);
  return false;
}

function pubJson(sessionId, obj) {
  pub.publish(chan(sessionId), JSON.stringify(obj)).catch(() => {});
}

async function streamOpenAITtsPcm({ text, onChunk, signal }) {
  if (!OPENAI_KEY) throw new Error("Missing OPENAI_API_KEY");
  const body = {
    model: "tts-1",
    input: String(text).slice(0, 4096),
    voice: "alloy",
    response_format: "pcm",
    stream: true,
  };
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenAI TTS failed (${res.status})`);
  }
  const reader = res.body.getReader();
  let firstSent = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (signal.aborted) return;
    if (done) break;
    if (!value?.length) continue;
    const u8 = value;
    // Await each chunk so the caller's tts_end is published after the last tts_chunk.
    if (!firstSent && u8.length > 2048) {
      await onChunk(u8.subarray(0, 2048));
      await onChunk(u8.subarray(2048));
      firstSent = true;
      continue;
    }
    await onChunk(u8);
    firstSent = true;
  }
}

const worker = new Worker(
  process.env.VOICE_TTS_QUEUE || "voice-tts",
  async (job) => {
    const { sessionId, requestId, text, skipSharedUsage } = job.data || {};
    const rid = Number(requestId);
    const sid = String(sessionId || "").trim();
    const t = String(text || "").trim();
    if (!sid || !rid || !t) return;
    const userId = await lookupUserId(sid);
    const plan = await lookupPlan(sid);
    const ymd = utcYmd();
    const ym = utcYm();
    if (userId && skipSharedUsage !== true) {
      const okQuota = await quotaCheckAndSignal({ sessionId: sid, requestId: rid, userId, plan });
      if (!okQuota) return;
    }

    const ac = new AbortController();
    await streamOpenAITtsPcm({
      text: t,
      signal: ac.signal,
      onChunk: async (chunkU8) => {
        if (await isCancelled(sid, rid)) {
          ac.abort();
          pubJson(sid, { type: "interrupt_ack", requestId: rid, reason: "cancelled" });
          return;
        }
        if (userId && skipSharedUsage !== true) {
          const okQuota = await quotaCheckAndSignal({ sessionId: sid, requestId: rid, userId, plan });
          if (!okQuota) {
            ac.abort();
            return;
          }
        }
        if (userId && skipSharedUsage !== true) {
          redis.hincrby(keyUsageDaily(userId, ymd), "tts_bytes", chunkU8.length).catch(() => {});
          redis.expire(keyUsageDaily(userId, ymd), 60 * 60 * 24 * 7).catch(() => {});
          redis.hincrby(keyUsageMonth(userId, ym), "tts_bytes", chunkU8.length).catch(() => {});
          redis.expire(keyUsageMonth(userId, ym), 60 * 60 * 24 * 40).catch(() => {});
        }
        pubJson(sid, {
          type: "tts_chunk",
          requestId: rid,
          format: "pcm_s16le",
          sampleRate: 24000,
          data_b64: Buffer.from(chunkU8).toString("base64"),
        });
      },
    });

    pubJson(sid, { type: "tts_end", requestId: rid });
  },
  {
    connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null }),
    concurrency: 6,
  }
);

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error("[voice-tts-worker] job failed", job?.id, err?.message || err);
});

// eslint-disable-next-line no-console
console.log("[voice-tts-worker] started");

