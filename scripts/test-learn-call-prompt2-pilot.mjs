/**
 * Prompt 2: Learn Call pilot lock, close, settlement, usage ledger, and Prompt 1 pedagogy still holds.
 * In-memory Redis only — does not touch DEV Redis or live OpenAI.
 */
import assert from "node:assert/strict";
import {
  claimLearnCallOpenLock,
  closeLearnCallAccounting,
  learnAiCallHoldKey,
  learnAiCallOpenUserKey,
  learnAiCallSettledKey,
  releaseLearnCallHold,
  releaseLearnCallOpenLock,
  reserveLearnCallPackage,
  settleLearnCallHold,
} from "../lib/beego/learn/ai-call-access.js";
import { learnCallClassifyAnswer, nextRetriesByTarget } from "../lib/beego/learn/learn-call-answer.js";
import {
  learnCallClaimOpening,
  learnCallOpeningClaimed,
  learnCallOpeningKey,
  learnCallReleaseOpening,
} from "../lib/beego/learn/learn-call-opening.js";
import {
  ingestLearnCallPilotSnapshot,
  learnCallExperienceSummary,
  learnCallLedgerKey,
  learnCallSessionCost,
  mergeLearnCallUsage,
  percentile,
  readLearnCallLedger,
  sanitizePilotLedger,
} from "../lib/beego/learn/learn-call-pilot.js";
import {
  REALTIME_ACTIVE_CALLS_SET,
  REALTIME_MAX_HANGUP_RETRIES,
  reserveRealtimeSession,
  rollbackRealtimeSession,
  settleRealtimeSession,
  terminateRealtimeSession,
  realtimeSessionKey,
} from "../lib/beego/learn/learn-call-realtime.js";

function createPilotRedis() {
  const kv = new Map();
  const hashes = new Map();
  const sets = new Map();
  const sorted = new Map();
  const lists = new Map();
  const published = [];

  function hashOf(key) {
    const k = String(key);
    if (!hashes.has(k)) hashes.set(k, new Map());
    return hashes.get(k);
  }

  return {
    published,
    async get(key) {
      return kv.has(String(key)) ? kv.get(String(key)) : null;
    },
    async set(key, value, ...args) {
      const nx = args.includes("NX");
      if (nx && kv.has(String(key))) return null;
      kv.set(String(key), String(value));
      return "OK";
    },
    async del(...keys) {
      let n = 0;
      for (const key of keys) {
        if (kv.delete(String(key))) n += 1;
        hashes.delete(String(key));
        sets.delete(String(key));
        sorted.delete(String(key));
      }
      return n;
    },
    async expire() {
      return 1;
    },
    async publish(channel, message) {
      published.push({ channel, message });
      return 1;
    },
    async hget(key, field) {
      const h = hashes.get(String(key));
      return h?.get(String(field)) ?? null;
    },
    async hset(key, field, value) {
      hashOf(key).set(String(field), String(value));
      return 1;
    },
    async hgetall(key) {
      const h = hashes.get(String(key));
      if (!h) return {};
      return Object.fromEntries(h.entries());
    },
    async hdel(key, field) {
      const h = hashes.get(String(key));
      return h?.delete(String(field)) ? 1 : 0;
    },
    async hincrby(key, field, amount) {
      const h = hashOf(key);
      const next = (Number(h.get(String(field)) || 0) || 0) + Number(amount);
      h.set(String(field), String(next));
      return next;
    },
    async sadd(key, member) {
      const k = String(key);
      if (!sets.has(k)) sets.set(k, new Set());
      const before = sets.get(k).size;
      sets.get(k).add(String(member));
      return sets.get(k).size > before ? 1 : 0;
    },
    async zadd(key, score, member) {
      if (!sorted.has(String(key))) sorted.set(String(key), new Map());
      sorted.get(String(key)).set(String(member), Number(score));
      return 1;
    },
    async zrem(key, member) {
      return sorted.get(String(key))?.delete(String(member)) ? 1 : 0;
    },
    async zrange(key) {
      const set = sorted.get(String(key));
      return set ? Array.from(set.keys()) : [];
    },
    async lpush(key, value) {
      const k = String(key);
      if (!lists.has(k)) lists.set(k, []);
      lists.get(k).unshift(String(value));
      return lists.get(k).length;
    },
    async eval(script, numKeys, ...rest) {
      const keys = rest.slice(0, numKeys).map(String);
      const args = rest.slice(numKeys).map(String);
      const text = String(script);
      if (text.includes("sessionCap")) {
        const [sessionId, allowance, sessionCap] = args;
        const budget = hashOf(keys[0]);
        const hold = hashOf(keys[1]);
        const used = Number(budget.get("usedMs") || 0) || 0;
        const existing = Number(hold.get(sessionId) || 0) || 0;
        if (existing > 0) {
          let held = 0;
          for (const v of hold.values()) held += Number(v) || 0;
          return ["reused", existing, Number(allowance), used, held];
        }
        let held = 0;
        for (const v of hold.values()) held += Number(v) || 0;
        const free = Number(allowance) - used - held;
        const cap = Number(sessionCap);
        if (free <= 0 || cap <= 0) return ["denied", 0, Number(allowance), used, held];
        const grant = Math.min(cap, free);
        hold.set(sessionId, String(grant));
        return ["granted", grant, Number(allowance), used, held + grant];
      }
      if (text.includes("existing") && text.includes("~= ARGV[1]")) {
        const existing = kv.get(keys[0]);
        if (existing && existing !== args[0]) return ["0", existing];
        kv.set(keys[0], args[0]);
        return ["1", args[0]];
      }
      if (text.includes("DEL") && text.includes("ARGV[1]") && numKeys === 1) {
        if (kv.get(keys[0]) === args[0]) {
          kv.delete(keys[0]);
          return 1;
        }
        return 0;
      }
      if (text.includes("SET") && text.includes("NX") && text.includes("consumed")) {
        if (kv.has(keys[2])) {
          const used = Number(hashOf(keys[0]).get("usedMs") || 0) || 0;
          return ["duplicate", 0, used];
        }
        kv.set(keys[2], "1");
        const reserved = Number(hashOf(keys[1]).get(args[0]) || 0) || 0;
        const elapsed = Math.max(0, Number(args[1]) || 0);
        const consumed = Math.min(reserved, elapsed);
        const budget = hashOf(keys[0]);
        let used = Number(budget.get("usedMs") || 0) || 0;
        if (consumed > 0) {
          used += consumed;
          budget.set("usedMs", String(used));
        }
        hashOf(keys[1]).delete(args[0]);
        return ["settled", consumed, used];
      }
      return 1;
    },
  };
}

function failingHangupFetch() {
  return async () => ({ ok: false, status: 500, text: async () => "provider hangup failed" });
}

function okHangupFetch() {
  return async () => ({ ok: true, status: 200, text: async () => "" });
}

const topic = { topic: "Chào hỏi", title: "Chào hỏi và làm quen", sectionId: "p1-g1" };

console.log("Prompt 2 pilot tests");

{
  const first = mergeLearnCallUsage({}, { audioInTokens: 10, audioOutTokens: 20 }, { mode: "delta", responseId: "r1" });
  const dup = mergeLearnCallUsage(first, { audioInTokens: 10, audioOutTokens: 20 }, { mode: "delta", responseId: "r1" });
  assert.equal(dup.duplicate, true);
  assert.equal(dup.audioInTokens, 10);
  const late = mergeLearnCallUsage(dup, { audioInTokens: 5 }, { mode: "delta", responseId: "r2" });
  assert.equal(late.audioInTokens, 15);
  const snap = mergeLearnCallUsage(late, { audioInTokens: 12, audioOutTokens: 40 }, { mode: "snapshot" });
  assert.equal(snap.audioInTokens, 15);
  assert.equal(snap.audioOutTokens, 40);
  console.log("  [PASS] usage merge: duplicate dropped, late delta added, snapshot keeps max");
}

{
  const provider = learnCallSessionCost({
    transport: "realtime",
    model: "gpt-realtime-mini",
    usage: { audioInTokens: 1000, audioOutTokens: 2000, textInTokens: 100, textOutTokens: 200 },
  });
  assert.equal(provider.quality, "provider");
  assert.ok(provider.totalUsd > 0);
  const estimate = learnCallSessionCost({
    transport: "ws",
    usage: { sttAudioMs: 60_000, ttsChars: 1000 },
  });
  assert.equal(estimate.quality, "estimate");
  const missing = learnCallSessionCost({ transport: "realtime", usage: {} });
  assert.equal(missing.quality, "missing");
  const ledger = sanitizePilotLedger({
    sessionId: "s1",
    transport: "realtime",
    usage: { audioInTokens: 1 },
    experience: { openingMs: 800 },
    secretTranscript: "My name is Lan",
  });
  assert.equal(ledger.sessionId, "s1");
  assert.equal(ledger.secretTranscript, undefined);
  console.log("  [PASS] cost quality provider/estimate/missing; ledger has no transcript");
}

{
  const ready = 1_000;
  const summary = learnCallExperienceSummary({
    callReadyAt: ready,
    openingAudibleAt: ready + 900,
    firstValidLearnerAt: ready + 8_000,
    turnLatenciesMs: [200, 400, 800, 1200, 3000],
    achieved: ["name"],
    retryExhausted: 0,
  });
  assert.equal(summary.openingMs, 900);
  assert.equal(summary.firstValidWithin20s, true);
  assert.equal(summary.turnLatencyP50Ms, 800);
  assert.equal(summary.turnLatencyP95Ms, 3000);
  assert.equal(percentile([10, 20, 30], 50), 20);
  const late = learnCallExperienceSummary({
    callReadyAt: ready,
    firstValidLearnerAt: ready + 21_000,
  });
  assert.equal(late.firstValidWithin20s, false);
  console.log("  [PASS] experience 20s window and p50/p95");
}

{
  const redis = createPilotRedis();
  const userId = "u-lock";
  const a = await claimLearnCallOpenLock(redis, { userId, sessionId: "sid-a", ttlSeconds: 180 });
  const b = await claimLearnCallOpenLock(redis, { userId, sessionId: "sid-b", ttlSeconds: 180 });
  assert.equal(a.granted, true);
  assert.equal(b.granted, false);
  assert.equal(await redis.get(learnAiCallOpenUserKey(userId)), "sid-a");
  console.log("  [PASS] one open lock; second tab/stream denied");
}

{
  const redis = createPilotRedis();
  const userId = "u-pkg";
  const sid = "sid-pkg";
  const testEnv = { LEARN_AI_CALL_QUOTA_MODE: "test" };
  const granted = await reserveLearnCallPackage(redis, {
    userId,
    plan: "pro",
    sessionId: sid,
    sessionCapMs: 120_000,
    env: testEnv,
  });
  assert.equal(granted.status, "granted");
  const reused = await reserveLearnCallPackage(redis, {
    userId,
    plan: "pro",
    sessionId: sid,
    sessionCapMs: 120_000,
    env: testEnv,
  });
  assert.equal(reused.status, "reused");
  const now = Date.now();
  const startedAt = now - 40_000;
  const first = await settleLearnCallHold(redis, { userId, sessionId: sid, startedAt, now });
  const second = await settleLearnCallHold(redis, { userId, sessionId: sid, startedAt, now });
  assert.equal(first.status, "settled");
  assert.equal(first.consumedMs, 40_000);
  assert.equal(second.status, "duplicate");
  assert.equal(second.consumedMs, 0);
  assert.equal(first.usedMs, second.usedMs);
  assert.equal(await redis.get(learnAiCallSettledKey(sid)), "1");
  console.log("  [PASS] package settle NX: same session charged once");
}

{
  const redis = createPilotRedis();
  const userId = "u-close";
  const sid = "sid-close";
  await claimLearnCallOpenLock(redis, { userId, sessionId: sid, ttlSeconds: 180 });
  await reserveLearnCallPackage(redis, { userId, plan: "pro", sessionId: sid, sessionCapMs: 120_000, env: { LEARN_AI_CALL_QUOTA_MODE: "test" } });
  const startedAt = Date.now() - 15_000;
  const client = await closeLearnCallAccounting(redis, { userId, sessionId: sid, startedAt });
  const watchdog = await closeLearnCallAccounting(redis, { userId, sessionId: sid, startedAt });
  assert.equal(client.settle.status, "settled");
  assert.equal(watchdog.settle.status, "duplicate");
  assert.equal(await redis.get(learnAiCallOpenUserKey(userId)), null);
  console.log("  [PASS] client + watchdog close: lock released, quota charged once");
}

{
  const redis = createPilotRedis();
  const userId = "u-roll";
  const sid = "sid-roll";
  await claimLearnCallOpenLock(redis, { userId, sessionId: sid, ttlSeconds: 180 });
  await learnCallClaimOpening(redis, sid);
  await reserveLearnCallPackage(redis, { userId, plan: "pro", sessionId: sid, sessionCapMs: 120_000, env: { LEARN_AI_CALL_QUOTA_MODE: "test" } });
  assert.equal(await learnCallOpeningClaimed(redis, sid), true);
  await rollbackRealtimeSession(redis, { userId, sessionId: sid });
  assert.equal(await redis.get(learnAiCallOpenUserKey(userId)), null);
  assert.equal(await redis.get(learnCallOpeningKey(sid)), null);
  const hold = await redis.hgetall(learnAiCallHoldKey(userId));
  assert.equal(hold[sid], undefined);
  const retryOpening = await learnCallClaimOpening(redis, sid);
  assert.equal(retryOpening.claimed, true);
  await learnCallReleaseOpening(redis, sid);
  console.log("  [PASS] failed create rolls back lock, opening NX, and package hold");
}

{
  const redis = createPilotRedis();
  const userId = "u-rt";
  const sid = "sid-rt-dual";
  await reserveRealtimeSession(redis, { userId, sessionId: sid, callId: "call_1", deadlineAt: Date.now() + 60_000 });
  await reserveLearnCallPackage(redis, { userId, plan: "pro", sessionId: sid, sessionCapMs: 120_000, env: { LEARN_AI_CALL_QUOTA_MODE: "test" } });
  const first = await settleRealtimeSession(redis, { userId, sessionId: sid, reason: "user_hangup" });
  const second = await settleRealtimeSession(redis, { userId, sessionId: sid, reason: "client_disconnect_liveness_timeout" });
  assert.equal(first.settled, true);
  assert.equal(second.alreadySettled, true);
  const active = await redis.zrange(REALTIME_ACTIVE_CALLS_SET);
  assert.equal(active.includes(sid), false);
  const term = await terminateRealtimeSession(redis, {
    sessionId: sid,
    userId,
    apiKey: "sk-test",
    fetchFn: okHangupFetch(),
  });
  assert.equal(term.alreadySettled, true);
  console.log("  [PASS] Realtime dual close and terminate after settle are idempotent");
}

{
  const redis = createPilotRedis();
  const userId = "u-hang";
  const sid = "sid-hang";
  await claimLearnCallOpenLock(redis, { userId, sessionId: sid, ttlSeconds: 180 });
  await reserveRealtimeSession(redis, { userId, sessionId: sid, callId: "call_hang", deadlineAt: Date.now() + 60_000 });
  await reserveLearnCallPackage(redis, { userId, plan: "pro", sessionId: sid, sessionCapMs: 120_000, env: { LEARN_AI_CALL_QUOTA_MODE: "test" } });
  let last = null;
  for (let i = 0; i < REALTIME_MAX_HANGUP_RETRIES; i += 1) {
    last = await terminateRealtimeSession(redis, {
      sessionId: sid,
      userId,
      apiKey: "sk-test",
      fetchFn: failingHangupFetch(),
    });
  }
  assert.equal(last.reconciliationNeeded, true);
  const raw = JSON.parse(await redis.get(realtimeSessionKey(sid)));
  assert.equal(raw.settled, false);
  assert.equal(raw.beegoSettled, true);
  assert.equal(await redis.get(learnAiCallOpenUserKey(userId)), null);
  const hold = await redis.hgetall(learnAiCallHoldKey(userId));
  assert.equal(hold[sid], undefined);
  console.log("  [PASS] hangup retries then Beego lock/quota released; provider hangup stays unresolved");
}

{
  const redis = createPilotRedis();
  const sid = "sid-ledger";
  await ingestLearnCallPilotSnapshot(redis, {
    sessionId: sid,
    transport: "realtime",
    model: "gpt-realtime-mini",
    usage: { audioInTokens: 100, audioOutTokens: 200 },
    experience: { callReadyAt: 1, openingAudibleAt: 900, firstValidLearnerAt: 5_000 },
  });
  await ingestLearnCallPilotSnapshot(redis, {
    sessionId: sid,
    transport: "realtime",
    model: "gpt-realtime-mini",
    usage: { audioInTokens: 80, audioOutTokens: 250 },
    endReason: "user_hangup",
    quotaChargedMs: 30_000,
  });
  const ledger = await readLearnCallLedger(redis, sid);
  assert.equal(ledger.usage.audioInTokens, 100);
  assert.equal(ledger.usage.audioOutTokens, 250);
  assert.equal(ledger.costQuality, "provider");
  assert.equal(ledger.endReason, "user_hangup");
  assert.equal(ledger.quotaChargedMs, 30_000);
  assert.equal(ledger.experience.firstValidWithin20s, true);
  assert.ok(await redis.get(learnCallLedgerKey(sid)));
  console.log("  [PASS] per-session ledger accumulates usage and keeps cost quality");
}

{
  const pending = { intent: "name", text: "What is your name?" };
  const acceptAlias = learnCallClassifyAnswer("I'm Lan", { pendingQuestion: pending, topicCtx: topic });
  assert.equal(acceptAlias.kind, "accept");
  const unclear = learnCallClassifyAnswer("...uh", { pendingQuestion: pending, topicCtx: topic, unclear: true });
  assert.equal(unclear.kind, "unclear");
  const gap = learnCallClassifyAnswer("She my friend", { pendingQuestion: { intent: "job", text: "What do you do?" }, topicCtx: topic });
  assert.equal(gap.kind, "correct");
  const retries = nextRetriesByTarget({}, gap);
  const exhausted = learnCallClassifyAnswer("She my friend", {
    pendingQuestion: { intent: "job", text: "What do you do?" },
    topicCtx: topic,
    retriesByTarget: retries,
  });
  assert.equal(exhausted.kind, "correct_exhausted");
  const third = learnCallClassifyAnswer("She my friend", {
    pendingQuestion: { intent: "job", text: "What do you do?" },
    topicCtx: topic,
    retriesByTarget: nextRetriesByTarget(retries, exhausted),
  });
  assert.equal(third.kind, "correct_exhausted");
  console.log("  [PASS] Prompt 1: accept non-template, no correction from unclear, one retry only");
}

{
  const redis = createPilotRedis();
  await releaseLearnCallHold(redis, { userId: "nobody", sessionId: "missing" });
  console.log("  [PASS] release hold on missing session is a no-op");
}

console.log("Prompt 2 pilot tests passed.");
