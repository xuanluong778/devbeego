/**
 * Learn Call session lifecycle without production Redis, gateway, or a microphone.
 */
import assert from "node:assert/strict";
import {
  claimLearnCallOpenLock,
  finalizeLearnCallSession,
  learnAiCallClockKey,
  learnAiCallContextKey,
  learnAiCallEndedKey,
  learnAiCallOpenUserKey,
  learnCallBindingTtlSeconds,
  learnCallEventIsCurrent,
  learnCallMediaStillAllowed,
  learnCallOpenLockTtlSeconds,
  learnCallReconnectAllowed,
  learnCallSocketCloseKind,
  releaseLearnCallOpenLock,
  resolveLearnCallClock,
} from "../lib/beego/learn/ai-call-access.js";

class MemRedis {
  constructor() {
    this.kv = new Map();
    this.published = [];
  }
  async get(key) {
    return this.kv.has(key) ? this.kv.get(key) : null;
  }
  async set(key, value) {
    this.kv.set(key, String(value));
    return "OK";
  }
  async del(...keys) {
    let n = 0;
    for (const key of keys) {
      if (this.kv.delete(key)) n += 1;
    }
    return n;
  }
  async publish(channel, message) {
    this.published.push({ channel, message });
    return 1;
  }
  async eval(script, _keyCount, key, arg1) {
    if (String(script).includes("existing")) {
      const existing = this.kv.get(key);
      if (existing) return ["0", existing];
      this.kv.set(key, String(arg1));
      return ["1", String(arg1)];
    }
    if (this.kv.get(key) === String(arg1)) {
      this.kv.delete(key);
      return 1;
    }
    return 0;
  }
}

const redis = new MemRedis();
const userId = "lifecycle-user";
const firstId = "session-a";
const secondId = "session-b";
const ttl = learnCallOpenLockTtlSeconds(2);

assert.equal(ttl, 180);
assert.notEqual(ttl, 600);

const [first, second] = await Promise.all([
  claimLearnCallOpenLock(redis, { userId, sessionId: firstId, ttlSeconds: ttl }),
  claimLearnCallOpenLock(redis, { userId, sessionId: secondId, ttlSeconds: ttl }),
]);
const granted = [first, second].filter((item) => item.granted);
assert.equal(granted.length, 1);
assert.equal(await redis.get(learnAiCallOpenUserKey(userId)), granted[0].holder);

const loser = first.granted ? secondId : firstId;
assert.equal(await releaseLearnCallOpenLock(redis, { userId, sessionId: loser }), false);
assert.equal(await redis.get(learnAiCallOpenUserKey(userId)), granted[0].holder);

const winner = granted[0].holder;
await redis.set(learnAiCallContextKey(winner), JSON.stringify({ userId, title: "Chào" }));
await redis.set(learnAiCallClockKey(winner), JSON.stringify({ startedAt: 1_000, deadlineAt: 121_000 }));
const ended = await finalizeLearnCallSession(redis, { userId, sessionId: winner });
assert.equal(ended.ended, true);
assert.equal(ended.released, true);
assert.equal(await redis.get(learnAiCallEndedKey(winner)), "1");
assert.equal(await redis.get(learnAiCallOpenUserKey(userId)), null);
assert.equal(JSON.parse(await redis.get(learnAiCallContextKey(winner))).title, "Chào");
assert.equal(JSON.parse(await redis.get(learnAiCallClockKey(winner))).deadlineAt, 121_000);
const again = await finalizeLearnCallSession(redis, { userId, sessionId: winner });
assert.equal(again.ended, true);
assert.equal(again.released, false);

const clock = resolveLearnCallClock({
  now: 30_000,
  maxMs: 120_000,
  existing: { startedAt: 1_000, deadlineAt: 121_000 },
});
assert.equal(clock.reused, true);
assert.equal(clock.deadlineAt, 121_000);
assert.equal(clock.remainingMs, 91_000);
assert.equal(
  learnCallReconnectAllowed({ ended: true, bindingMatches: true, remainingMs: clock.remainingMs }),
  false
);
assert.equal(
  learnCallReconnectAllowed({ ended: false, bindingMatches: true, remainingMs: clock.remainingMs }),
  true
);
assert.equal(learnCallReconnectAllowed({ ended: false, bindingMatches: true, remainingMs: 0 }), false);

assert.equal(learnCallSocketCloseKind({ code: 1000, reason: "client" }), "intentional");
assert.equal(learnCallSocketCloseKind({ code: 1000, reason: "reconnect" }), "intentional");
assert.equal(learnCallSocketCloseKind({ code: 1006, reason: "" }), "unexpected");
assert.equal(learnCallEventIsCurrent(1, 2), false);
assert.equal(learnCallEventIsCurrent(2, 2), true);

const lateMic = { tracksStopped: false };
function grantMicAfterExit(closed) {
  if (!learnCallMediaStillAllowed({ closed, deadlineAt: 121_000, now: 50_000 })) {
    lateMic.tracksStopped = true;
    return false;
  }
  return true;
}
assert.equal(grantMicAfterExit(true), false);
assert.equal(lateMic.tracksStopped, true);
assert.equal(learnCallMediaStillAllowed({ closed: false, deadlineAt: 121_000, now: 121_000 }), false);
assert.equal(learnCallMediaStillAllowed({ closed: false, deadlineAt: 121_000, now: 50_000 }), true);

const reclaimed = await claimLearnCallOpenLock(redis, { userId, sessionId: "session-c", ttlSeconds: ttl });
assert.equal(reclaimed.granted, true);

const postAt = 1_000_000;
const connectAt = postAt + 90_000;
const maxMs = 120_000;
const slowClock = resolveLearnCallClock({ now: connectAt, maxMs, existing: null });
const preHelloEnd = postAt + learnCallOpenLockTtlSeconds(2) * 1000;
assert.equal(slowClock.deadlineAt - slowClock.startedAt, maxMs);
assert.ok(preHelloEnd > connectAt);
assert.ok(preHelloEnd < slowClock.deadlineAt);
const boundTtl = learnCallBindingTtlSeconds({ deadlineAt: slowClock.deadlineAt, now: connectAt });
assert.ok(connectAt + boundTtl * 1000 >= slowClock.deadlineAt);
assert.ok(boundTtl < 600);
const rejoin = resolveLearnCallClock({ now: connectAt + 10_000, maxMs, existing: slowClock });
assert.equal(rejoin.deadlineAt, slowClock.deadlineAt);
assert.ok(rejoin.remainingMs < slowClock.remainingMs);

console.log(JSON.stringify({
  concurrentGranted: granted.length,
  lockTtlSeconds: ttl,
  endedBlocksReconnect: true,
  sameDeadline: clock.deadlineAt === 121_000,
  unexpectedClose: learnCallSocketCloseKind({ code: 1006, reason: "" }),
  lateMicStopped: lateMic.tracksStopped,
  slowConnectCallMs: slowClock.deadlineAt - slowClock.startedAt,
  bindingReachesDeadline: connectAt + boundTtl * 1000 >= slowClock.deadlineAt,
  bindingShorterThanToken: boundTtl < 600,
}));
