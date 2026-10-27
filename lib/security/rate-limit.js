import { checkIpRateLimit } from "@/lib/security/ip-rate-limit";
import { checkRedisRateLimit } from "@/lib/security/redis-rate-limit";

/**
 * One limiter per request (no double count).
 * Redis hit (allow or deny) is final — shared across replicas.
 * Redis missing or error → in-process memory only, and the next request retries Redis.
 */
export async function checkRateLimit(request, opts = {}) {
  const redisResult = await checkRedisRateLimit(request, opts);
  if (redisResult.backend === "redis") {
    return redisResult;
  }
  const mem = checkIpRateLimit(request, opts);
  return {
    ...mem,
    backend: redisResult.backend === "redis_error" ? "memory_after_redis_error" : "memory",
  };
}
