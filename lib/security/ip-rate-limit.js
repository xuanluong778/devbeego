/**
 * Lightweight in-memory rate limit (per process). Use at API edges; Redis optional later.
 */

const buckets = new Map();

function clientIp(request) {
  const h = request.headers;
  const xf = h?.get?.("x-forwarded-for") || h?.get?.("X-Forwarded-For");
  if (xf) return String(xf).split(",")[0].trim();
  const real = h?.get?.("x-real-ip") || h?.get?.("X-Real-IP");
  if (real) return String(real).trim();
  return "unknown";
}

/**
 * @param {Request} request
 * @param {{ key?: string, windowMs?: number, max?: number }} opts
 * @returns {{ ok: boolean, retryAfterSec?: number }}
 */
export function checkIpRateLimit(request, opts = {}) {
  const ip = clientIp(request);
  const key = opts.key ? `${opts.key}:${ip}` : ip;
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 60;
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > max) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true };
}
