/**
 * Server-Side Watchdog Worker for Realtime Calls (AI Tutor Stage 3)
 *
 * Responsibility:
 * Actively monitors active Realtime sessions in Redis (REALTIME_ACTIVE_CALLS_SET).
 * When a learner closes the browser tab, disconnects network, or abandons the call
 * without sending DELETE /api/learn/ai-call/realtime/session, or when the server deadline
 * expires, or when an admin closes the runtime gate (voice:learn-call-gate):
 *
 * 1. Queries expired calls from Redis sorted set by deadlineAt.
 * 2. Proactively calls OpenAI official hangup endpoint:
 *    POST https://api.openai.com/v1/realtime/calls/{call_id}/hangup
 * 3. Idempotently settles the session and releases the single-session lock.
 *
 * Note: Can run as a standalone daemon under PM2, or execute a single scan tick via `--once`.
 */

import Redis from "ioredis";
import {
  isRealtimeEnabled,
  scanAndHangupExpiredRealtimeCalls,
  REALTIME_ACTIVE_CALLS_SET,
} from "../lib/beego/learn/learn-call-realtime.js";

const REDIS_URL = String(process.env.REDIS_URL || "redis://127.0.0.1:6379").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const POLL_INTERVAL_MS = 5000;

export async function runWatchdogTick(redis, { apiKey = OPENAI_API_KEY, fetchFn = fetch, now = Date.now() } = {}) {
  return await scanAndHangupExpiredRealtimeCalls(redis, { apiKey, fetchFn, now });
}

export async function checkWatchdogHealth(redis) {
  try {
    const ping = await redis.ping();
    const activeCount = await redis.zcard(REALTIME_ACTIVE_CALLS_SET).catch(() => 0);
    return {
      status: ping === "PONG" ? "healthy" : "unhealthy",
      redis: ping === "PONG" ? "connected" : "error",
      realtimeEnabled: isRealtimeEnabled(),
      activeCallsCount: Number(activeCount) || 0,
      timestamp: Date.now(),
    };
  } catch (err) {
    return {
      status: "unhealthy",
      redis: "disconnected",
      error: err?.message || "Redis ping failed",
      realtimeEnabled: isRealtimeEnabled(),
      activeCallsCount: 0,
      timestamp: Date.now(),
    };
  }
}

async function main() {
  const isHealthCheck = process.argv.includes("--health");
  const isOnce = process.argv.includes("--once");

  if (isHealthCheck) {
    const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
    const health = await checkWatchdogHealth(redis);
    console.log(JSON.stringify(health, null, 2));
    await redis.quit();
    process.exit(health.status === "healthy" ? 0 : 1);
  }

  if (!isRealtimeEnabled()) {
    console.log("[realtime-watchdog] Feature flag LEARN_AI_CALL_REALTIME_ENABLED is disabled. Exiting.");
    process.exit(0);
  }

  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  console.log(`[realtime-watchdog] Started Realtime call watchdog (poll interval: ${POLL_INTERVAL_MS}ms)`);

  const tick = async () => {
    try {
      const result = await runWatchdogTick(redis);
      if (result.terminated > 0) {
        console.log(`[realtime-watchdog] Proactively terminated ${result.terminated} expired call(s):`, result.expiredSessionIds);
      }
    } catch (err) {
      console.error("[realtime-watchdog] Error during watchdog tick:", err?.message);
    }
  };

  await tick();
  if (isOnce) {
    await redis.quit();
    process.exit(0);
  }

  const intervalId = setInterval(tick, POLL_INTERVAL_MS);

  const cleanup = async () => {
    clearInterval(intervalId);
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

// Only auto-run if executed directly as script or under PM2 process manager
const isTestRunner = process.argv.some((arg) => typeof arg === "string" && arg.includes("test"));
const isWatchdogEntry =
  !isTestRunner &&
  (process.env.name === "beego-voice-realtime-watchdog" ||
    process.argv.some((arg) => typeof arg === "string" && arg.includes("voice-realtime-watchdog.mjs")));

if (isWatchdogEntry) {
  main().catch((err) => {
    console.error("[realtime-watchdog] Fatal error:", err);
    process.exit(1);
  });
}

