/**
 * BullMQ worker: streams LLM tokens and publishes to Redis pubsub channel voice:chan:{sessionId}.
 * Jobs: { kind: "spec"|"final", sessionId, requestId, text, memory }
 * Learn Call jobs also carry learn: { system, memory, directive }; only that prompt is used for them.
 */

import { Worker } from "bullmq";
import Redis from "ioredis";
import { LEARN_CALL_MAX_REPLY_TOKENS, buildLearnCallMessages } from "../lib/beego/learn/learn-call-tutor.js";

const REDIS_URL = String(process.env.REDIS_URL || "").trim();
const OPENAI_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini").trim();

if (!REDIS_URL) {
  // eslint-disable-next-line no-console
  console.error("[voice-llm-worker] Missing REDIS_URL");
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
  if (p === "vip") return { llm_tokens_day: 200000, llm_tokens_month: 4000000 };
  if (p === "pro" || p === "trial") return { llm_tokens_day: 30000, llm_tokens_month: 600000 };
  return { llm_tokens_day: 3000, llm_tokens_month: 60000 };
}

async function getUsageTokens(userId) {
  const ymd = utcYmd();
  const ym = utcYm();
  const [d, m] = await Promise.all([redis.hgetall(keyUsageDaily(userId, ymd)), redis.hgetall(keyUsageMonth(userId, ym))]);
  const num = (o, k) => {
    const v = Number(o?.[k] || 0);
    return Number.isFinite(v) ? v : 0;
  };
  const day = num(d, "llm_tokens_in") + num(d, "llm_tokens_out");
  const month = num(m, "llm_tokens_in") + num(m, "llm_tokens_out");
  return { ymd, ym, day, month };
}

async function quotaCheckAndSignal({ sessionId, requestId, userId, plan }) {
  const cap = planCaps(plan);
  const u = await getUsageTokens(userId);
  if (u.day <= cap.llm_tokens_day && u.month <= cap.llm_tokens_month) return true;
  pubJson(sessionId, {
    type: "quota_exceeded",
    requestId,
    scope: "llm",
    used_day: u.day,
    limit_day: cap.llm_tokens_day,
    used_month: u.month,
    limit_month: cap.llm_tokens_month,
    plan,
  });
  pubJson(sessionId, { type: "interrupt", requestId, reason: "quota_exceeded" });
  await redis.set(cancelKey(sessionId, requestId), "1", "EX", 120);
  return false;
}

async function streamOpenAIChat({ messages, onToken, signal, maxTokens = 512 }) {
  if (!OPENAI_KEY) throw new Error("Missing OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      stream: true,
      messages,
      max_tokens: maxTokens,
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`OpenAI chat failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let carry = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (signal.aborted) return;
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const lines = carry.split("\n");
    carry = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) onToken(delta);
      } catch (_e) {}
    }
  }
}

function pubJson(sessionId, obj) {
  pub.publish(chan(sessionId), JSON.stringify(obj)).catch(() => {});
}

const worker = new Worker(
  process.env.VOICE_LLM_QUEUE || "voice-llm",
  async (job) => {
    const { kind, sessionId, requestId, text, memory, skipSharedUsage, learn } = job.data || {};
    const rid = Number(requestId);
    const sid = String(sessionId || "").trim();
    const userText = String(text || "").trim();
    const mem = Array.isArray(memory) ? memory : [];
    if (!sid || !rid || !userText) return;

    const speculative = kind === "spec";
    const system = speculative
      ? "You are a concise English tutor. The learner may still be speaking—reply in at most 2 short sentences."
      : "You are a friendly English tutor. Keep answers under 5 short sentences. Correct gently and ask one follow-up when natural.";

    const learnJob = !speculative && learn && typeof learn.system === "string" && learn.system.trim();
    const messages = learnJob
      ? buildLearnCallMessages({ system: learn.system, memory: learn.memory, directive: learn.directive })
      : [{ role: "system", content: system }, ...mem, { role: "user", content: userText }];

    const ac = new AbortController();
    let acc = "";
    const userId = await lookupUserId(sid);
    const plan = await lookupPlan(sid);
    const ymd = utcYmd();
    const ym = utcYm();
    if (userId && skipSharedUsage !== true) {
      const okQuota = await quotaCheckAndSignal({ sessionId: sid, requestId: rid, userId, plan });
      if (!okQuota) return;
    }
    if (userId && skipSharedUsage !== true) {
      // Rough token estimate (chars/4) for cost control; can be replaced with real token accounting later.
      const estIn = Math.max(1, Math.round(userText.length / 4));
      redis.hincrby(keyUsageDaily(userId, ymd), "llm_tokens_in", estIn).catch(() => {});
      redis.expire(keyUsageDaily(userId, ymd), 60 * 60 * 24 * 7).catch(() => {});
      redis.hincrby(keyUsageMonth(userId, ym), "llm_tokens_in", estIn).catch(() => {});
      redis.expire(keyUsageMonth(userId, ym), 60 * 60 * 24 * 40).catch(() => {});
    }
    await streamOpenAIChat({
      messages,
      signal: ac.signal,
      maxTokens: learnJob ? LEARN_CALL_MAX_REPLY_TOKENS : 512,
      onToken: async (tok) => {
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
        acc += tok;
        pubJson(sid, { type: "ai_stream", requestId: rid, token: tok, speculative });
      },
    });

    if (speculative) {
      pubJson(sid, { type: "ai_speculative_done", requestId: rid });
      return;
    }

    if (userId && skipSharedUsage !== true) {
      const estOut = Math.max(1, Math.round(acc.length / 4));
      redis.hincrby(keyUsageDaily(userId, ymd), "llm_tokens_out", estOut).catch(() => {});
      redis.expire(keyUsageDaily(userId, ymd), 60 * 60 * 24 * 7).catch(() => {});
      redis.hincrby(keyUsageMonth(userId, ym), "llm_tokens_out", estOut).catch(() => {});
      redis.expire(keyUsageMonth(userId, ym), 60 * 60 * 24 * 40).catch(() => {});
    }
    // learn: 1 tells the gateway this reply used the Learn prompt; an older worker omits it.
    const marker = learnJob ? { learn: 1 } : {};
    pubJson(sid, { type: "ai_done", requestId: rid, text: acc, ...marker });
    // Enqueue TTS in separate queue via Redis key (gateway will do in phase 1.5).
    pubJson(sid, { type: "llm_done_for_tts", requestId: rid, text: acc, ...marker });
  },
  {
    connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null }),
    concurrency: 8,
  }
);

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error("[voice-llm-worker] job failed", job?.id, err?.message || err);
});

// eslint-disable-next-line no-console
console.log("[voice-llm-worker] started");

