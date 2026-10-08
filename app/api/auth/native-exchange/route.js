import { NextResponse } from "next/server";
import { exchangeNativeAuthCode } from "@/lib/auth/google-oauth-android";
import {
  loadUserPayload,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  SESSION_DAYS,
} from "@/lib/auth/create-session";
import { resolveCookieSecure } from "@/lib/auth/resolve-cookie-secure";

export const dynamic = "force-dynamic";

/**
 * Exchange one-time OAuth native code → Bearer tokens (Android).
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").trim();
    if (!code || code.length < 32) {
      return NextResponse.json({ success: false, message: "Invalid code." }, { status: 400 });
    }
    const tokens = await exchangeNativeAuthCode(code);
    if (!tokens) {
      return NextResponse.json(
        { success: false, message: "Code expired or already used." },
        { status: 401 }
      );
    }
    const user = await loadUserPayload(tokens.user_id);
    const res = NextResponse.json({
      success: true,
      data: {
        user,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: "Bearer",
        platform: "android",
      },
    });
    const secure = resolveCookieSecure(request);
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    res.cookies.set(
      SESSION_COOKIE_NAME,
      tokens.access_token,
      sessionCookieOptions(expiresAt, secure)
    );
    return res;
  } catch (e) {
    console.error("[auth/native-exchange]", e);
    return NextResponse.json({ success: false, message: "Exchange failed." }, { status: 500 });
  }
}
