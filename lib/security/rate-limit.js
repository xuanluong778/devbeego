import { checkIpRateLimit } from "@/lib/security/ip-rate-limit";
import { checkRedisRateLimit } from "@/lib/security/redis-rate-limit";

/**
 * Prefer Redis (multi-PM2); fall back to in-process limiter.
 */
export async function checkRateLimit(request, opts = {}) {
  const redisResult = await checkRedisRateLimit(request, opts);
  if (redisResult.backend === "redis" && !redisResult.ok) {
    return redisResult;
  }
  if (redisResult.backend === "redis" && redisResult.ok) {
    return redisResult;
  }
  const mem = checkIpRateLimit(request, opts);
  return { ...mem, backend: mem.ok ? "memory" : "memory" };
}
