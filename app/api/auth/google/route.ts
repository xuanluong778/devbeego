import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { resolveCookieSecure } from "@/lib/auth/resolve-cookie-secure";
import { getGoogleCallbackUrl, getGoogleClientConfig, publicOrigin } from "@/lib/auth/google-oauth-config";
import { saveAndroidOAuthState } from "@/lib/auth/google-oauth-android";

export async function GET(request: NextRequest) {
  const config = getGoogleClientConfig();
  if (!config) {
    const platform = request.nextUrl.searchParams.get("platform");
    if (platform === "android") {
      return NextResponse.json(
        {
          success: false,
          code: "GOOGLE_OAUTH_NOT_CONFIGURED",
          message: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET chưa cấu hình trên server.",
        },
        { status: 503 }
      );
    }
    return NextResponse.redirect(new URL("/auth?notice=google_off", publicOrigin(request)));
  }

  const redirectUri = getGoogleCallbackUrl(request);
  const state = crypto.randomBytes(16).toString("hex");
  const platform = (request.nextUrl.searchParams.get("platform") || "web").toLowerCase();
  const deviceId = request.nextUrl.searchParams.get("device_id");
  const next = request.nextUrl.searchParams.get("next");

  if (platform === "android") {
    await saveAndroidOAuthState({
      state,
      redirectUri,
      deviceId: deviceId || null,
      nextPath: next && next.startsWith("/") && !next.startsWith("//") ? next : "/",
    });
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  const cookieSecure = resolveCookieSecure(request);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/",
    maxAge: 600,
  });
  res.cookies.set("google_oauth_platform", platform === "android" ? "android" : "web", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure,
    path: "/",
    maxAge: 600,
  });
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    res.cookies.set("google_oauth_next", next, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
      maxAge: 600,
    });
  } else {
    res.cookies.delete("google_oauth_next");
  }
  return res;
}
