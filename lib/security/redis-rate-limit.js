/**
 * Redis-backed rate limit (shared across PM2 workers).
 */
import Redis from "ioredis";

let redis = null;
let redisFailed = false;

function getRedis() {
  if (redisFailed) return null;
  if (redis) return redis;
  const url = process.env.REDIS_URL || "";
  if (!url) {
    redisFailed = true;
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    redis.on("error", () => {
      redisFailed = true;
    });
    return redis;
  } catch {
    redisFailed = true;
    return null;
  }
}

function clientIp(request) {
  const xf = request.headers?.get?.("x-forwarded-for") || request.headers?.get?.("X-Forwarded-For");
  if (xf) return String(xf).split(",")[0].trim();
  const real = request.headers?.get?.("x-real-ip") || request.headers?.get?.("X-Real-IP");
  if (real) return String(real).trim();
  return "unknown";
}

/**
 * @returns {Promise<{ ok: boolean, retryAfterSec?: number, backend?: string }>}
 */
export async function checkRedisRateLimit(request, opts = {}) {
  const r = getRedis();
  if (!r) return { ok: true, backend: "none" };

  const ip = clientIp(request);
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
    return { ok: true, backend: "redis_error_fallback" };
  }
}
