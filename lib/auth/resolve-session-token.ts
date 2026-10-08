import type { NextRequest } from "next/server";

const COOKIE_NAME = "session_token";

/**
 * Resolve session token from httpOnly cookie (Web) or Authorization: Bearer (Android/App).
 */
export function resolveSessionToken(request: {
  cookies?: { get: (name: string) => { value?: string } | undefined };
  headers?: Headers | { get: (name: string) => string | null };
}): string | null {
  const cookieToken = request.cookies?.get?.(COOKIE_NAME)?.value;
  if (cookieToken) return cookieToken;

  const headers = request.headers;
  if (!headers?.get) return null;
  const auth = headers.get("authorization") || headers.get("Authorization");
  if (!auth) return null;
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  return token || null;
}

export function resolveSessionTokenFromNextRequest(request: NextRequest): string | null {
  return resolveSessionToken(request);
}
