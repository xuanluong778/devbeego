import type { NextRequest } from "next/server";

const COOKIE_NAME = "session_token";

/**
 * Resolve session token from httpOnly cookie (Web) or Authorization: Bearer (Android/App).
 */
function bearerToken(request: {
  headers?: Headers | { get: (name: string) => string | null };
}): string | null {
  const headers = request.headers;
  if (!headers?.get) return null;
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (!auth) return null;
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  return token || null;
}

/**
 * Cookie (web) or Bearer (app).
 * If Authorization Bearer is present, it is exclusive: an invalid bearer is not
 * replaced by the cookie (prevents cookie+fake-Authorization mutation).
 */
export function resolveSessionToken(request: {
  cookies?: { get: (name: string) => { value?: string } | undefined };
  headers?: Headers | { get: (name: string) => string | null };
}): string | null {
  const bearer = bearerToken(request);
  if (bearer) return bearer;
  const cookieToken = request.cookies?.get?.(COOKIE_NAME)?.value;
  return cookieToken || null;
}

export function resolveSessionTokenFromNextRequest(request: NextRequest): string | null {
  return resolveSessionToken(request);
}
