import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

/** Shared Redis limiter (falls back to memory only if Redis is down). Not used on learning routes. */
export async function authRateLimitResponse(request, key, max) {
  const rl = await checkRateLimit(request, { key, windowMs: 60_000, max });
  if (rl.ok) return null;
  return NextResponse.json(
    { success: false, message: "Too many requests.", code: "RATE_LIMIT" },
    { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
  );
}
