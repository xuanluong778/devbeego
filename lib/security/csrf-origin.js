/**
 * Cookie-session mutation guard: require same-site Origin/Referer.
 * Bearer-only (Android) skips — token is not sent cross-site by browser.
 */

import { isAllowedMutationHost, isAllowedMutationOrigin } from "./app-allowed-origins.js";

/**
 * @param {import('next/server').NextRequest | Request} request
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
function hasSessionCookie(request) {
  const fromCookie = request.cookies?.get?.("session_token")?.value;
  if (fromCookie) return true;
  const raw = typeof request.headers?.get === "function" ? request.headers.get("cookie") || "" : "";
  return /(?:^|;\s*)session_token=/.test(raw);
}

export function assertMutationOrigin(request) {
  const cookiePresent = hasSessionCookie(request);
  // Bearer-only (no cookie) is not a browser CSRF vector.
  // A Bearer header must NOT skip this check when a session cookie is also sent:
  // handlers may still authenticate with the cookie if the bearer is ignored or invalid.
  if (!cookiePresent) {
    return { ok: true };
  }

  const origin = request.headers?.get?.("origin") || request.headers?.get?.("Origin");
  if (origin && isAllowedMutationOrigin(origin)) {
    return { ok: true };
  }

  const referer = request.headers?.get?.("referer") || request.headers?.get?.("Referer");
  if (referer) {
    try {
      const u = new URL(referer);
      if (isAllowedMutationHost(u.hostname)) return { ok: true };
    } catch {
      /* ignore */
    }
  }

  return {
    ok: false,
    code: "CSRF_ORIGIN",
    message: "Invalid or missing Origin for cookie-authenticated request.",
  };
}
