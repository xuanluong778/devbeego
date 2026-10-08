/**
 * Cookie-session mutation guard: require same-site Origin/Referer.
 * Bearer-only (Android) skips — token is not sent cross-site by browser.
 */

const ALLOWED_ORIGINS = new Set([
  "https://beego.vn",
  "https://www.beego.vn",
  "http://localhost:3025",
  "http://127.0.0.1:3025",
  "http://localhost:3099",
  "http://127.0.0.1:3099",
]);

function hostAllowed(hostname) {
  return hostname === "beego.vn" || hostname === "www.beego.vn" || hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * @param {import('next/server').NextRequest | Request} request
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function assertMutationOrigin(request) {
  const auth = request.headers?.get?.("authorization") || request.headers?.get?.("Authorization") || "";
  if (/^Bearer\s+\S+/i.test(auth)) {
    return { ok: true };
  }

  const cookieToken =
    request.cookies?.get?.("session_token")?.value ||
    (typeof request.headers?.get === "function" && request.headers.get("cookie")?.includes("session_token="));
  if (!cookieToken) {
    return { ok: true };
  }

  const origin = request.headers?.get?.("origin") || request.headers?.get?.("Origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return { ok: true };
  }

  const referer = request.headers?.get?.("referer") || request.headers?.get?.("Referer");
  if (referer) {
    try {
      const u = new URL(referer);
      if (hostAllowed(u.hostname)) return { ok: true };
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
