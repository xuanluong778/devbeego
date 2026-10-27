/**
 * Redis-backed rate limit (shared across PM2 workers).
 */
import Redis from "ioredis";

let redis = null;

function getRedis() {
  if (redis) return redis;
  const url = process.env.REDIS_URL || "";
  if (!url) return null;
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 8 ? null : Math.min(times * 200, 2000)),
    });
    redis.on("error", () => {
      /* transient — fall back to memory limiter per request */
    });
    return redis;
  } catch {
    return null;
  }
}

import { clientIpFromRequest } from "./client-ip.js";

/**
 * @returns {Promise<{ ok: boolean, retryAfterSec?: number, backend?: string }>}
 */
export async function checkRedisRateLimit(request, opts = {}) {
  const r = getRedis();
  if (!r) return { ok: true, backend: "none" };

  const ip = clientIpFromRequest(request);
  const scope = opts.key || "default";
  const windowSec = Math.max(1, Math.ceil((opts.windowMs ?? 60_000) / 1000));
  const max = opts.max ?? 60;
  const redisKey = `beego:rl:${scope}:${ip}`;

  try {
    if (r.status !== "ready") await r.connect().catch(() => {});
    const n = await r.incr(redisKey);
    if (n === 1) await r.expire(redisKey, windowSec);
    if (n > max) {
      const ttl = await r.ttl(redisKey);
      return { ok: false, retryAfterSec: ttl > 0 ? ttl : windowSec, backend: "redis" };
    }
    return { ok: true, backend: "redis" };
  } catch {
    return { ok: true, backend: "redis_error" };
  }
}
