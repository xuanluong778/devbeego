import type { NextRequest } from "next/server";

export function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  if (!host) return new URL(request.url).origin;
  return `${proto}://${host}`;
}

/** Redirect URI gửi lên Google — ưu tiên GOOGLE_CALLBACK_URL, rồi NEXT_PUBLIC_APP_URL, fallback theo host request. */
export function getGoogleCallbackUrl(request: NextRequest): string {
  const fromEnv = process.env.GOOGLE_CALLBACK_URL?.trim();
  if (fromEnv) return fromEnv;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (appUrl) return `${appUrl}/api/auth/google/callback`;
  return `${publicOrigin(request)}/api/auth/google/callback`;
}

export function getGoogleClientConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
