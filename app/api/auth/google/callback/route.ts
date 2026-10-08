import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import type { ResultSetHeader } from "mysql2";
import pool from "@/lib/db";
import { ensureUsersAuthColumns } from "@/lib/auth/ensure-verification-schema";
import { ensureGoogleAuthColumns } from "@/lib/auth/ensure-google-auth-columns";
import { hashPassword } from "@/lib/auth";
import { SESSION_COOKIE_NAME, sessionCookieOptions, setSessionOnResponse } from "@/lib/auth/create-session";
import { resolveCookieSecure } from "@/lib/auth/resolve-cookie-secure";
import { createAppSession } from "@/lib/auth/app-session";
import { createInitialSubscriptionForNewUser } from "@/lib/subscriptions/subscription-service";
import { getGoogleCallbackUrl, getGoogleClientConfig, publicOrigin } from "@/lib/auth/google-oauth-config";
import { findDuplicateRegistrationEmail, validateRegistrationEmail } from "@/lib/auth/gmail-registration";
import {
  consumeAndroidOAuthState,
  issueNativeAuthCode,
} from "@/lib/auth/google-oauth-android";

type GoogleProfile = {
  id?: string;
  email?: string;
  name?: string;
  verified_email?: boolean;
  picture?: string;
};

type UserRow = {
  id: number;
  name: string;
  email: string | null;
  google_id: string | null;
};

function safeNextPath(raw: string | undefined, fallback = "/dashboard") {
  if (!raw || typeof raw !== "string") return fallback;
  const p = raw.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return fallback;
  if (p.includes("..") || p.includes("\\")) return fallback;
  if (p === "/auth" || p.startsWith("/auth?") || p.startsWith("/auth/")) return fallback;
  return p;
}

export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const fail = (code: string) => NextResponse.redirect(new URL(`/auth?notice=${code}`, origin));

  const err = request.nextUrl.searchParams.get("error");
  if (err) {
    return fail("google_denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("google_oauth_state")?.value;
  const nextPath = request.cookies.get("google_oauth_next")?.value;
  const cookiePlatform = request.cookies.get("google_oauth_platform")?.value;

  const androidState = state ? await consumeAndroidOAuthState(state) : null;
  const isAndroid = Boolean(androidState) || cookiePlatform === "android";

  if (!code || !state) {
    return fail("google_state");
  }
  // Web: require cookie state. Android: cookie OR DB-backed state (Custom Tabs).
  if (!isAndroid && (!cookieState || state !== cookieState)) {
    return fail("google_state");
  }
  if (isAndroid && cookieState && state !== cookieState && !androidState) {
    return fail("google_state");
  }
  if (isAndroid && !androidState && (!cookieState || state !== cookieState)) {
    return fail("google_state");
  }

  const config = getGoogleClientConfig();
  if (!config) {
    return fail("google_off");
  }

  const redirectUri = getGoogleCallbackUrl(request);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !tokenJson.access_token) {
    return fail("google_token");
  }

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profile = (await profileRes.json()) as GoogleProfile;

  if (profile.verified_email !== true) {
    return fail("google_email_unverified");
  }

  const emailRaw = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
  const googleId = typeof profile.id === "string" ? profile.id.trim() : "";
  const gName = typeof profile.name === "string" ? profile.name.trim() : "";
  const picture = typeof profile.picture === "string" ? profile.picture.trim() : null;

  if (!googleId) {
    return fail("google_profile");
  }
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return fail("google_email");
  }

  const emailValidation = validateRegistrationEmail(emailRaw);

  await ensureUsersAuthColumns(pool);
  await ensureGoogleAuthColumns();

  let userId: number;

  const [byGoogleRows] = await pool.query(
    "SELECT id, name, email, google_id FROM users WHERE google_id = ? LIMIT 1",
    [googleId]
  );
  const byGoogle = (byGoogleRows as UserRow[])[0];

  if (byGoogle) {
    userId = Number(byGoogle.id);
    await pool.query(
      `UPDATE users SET
         last_login_at = NOW(),
         email_verified = 1,
         avatar_url = COALESCE(?, avatar_url),
         auth_provider = 'google'
       WHERE id = ?`,
      [picture, userId]
    );
  } else {
    const dup = await findDuplicateRegistrationEmail(pool, emailRaw);
    const byEmail = dup.existing as UserRow | undefined;

    if (byEmail) {
      userId = Number(byEmail.id);
      await pool.query(
        `UPDATE users SET
           google_id = ?,
           auth_provider = 'google',
           email_verified = 1,
           last_login_at = NOW(),
           avatar_url = COALESCE(?, avatar_url),
           name = CASE WHEN ? <> '' THEN ? ELSE name END
         WHERE id = ?`,
        [googleId, picture, gName, gName, userId]
      );
    } else if (!emailValidation.ok) {
      return fail("google_gmail_invalid");
    } else {
      const email = emailValidation.email!;
      const placeholderPw = hashPassword(crypto.randomBytes(32).toString("hex"));
      const displayName = gName || email.split("@")[0] || "User";
      const [ins] = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, google_id, auth_provider, email_verified, avatar_url, last_login_at)
         VALUES (?, ?, NULL, ?, ?, 'google', 1, ?, NOW())`,
        [displayName, email, placeholderPw, googleId, picture]
      );
      userId = Number((ins as ResultSetHeader).insertId);
      if (Number.isFinite(userId) && userId > 0) {
        try {
          await createInitialSubscriptionForNewUser(userId);
        } catch {
          /* non-fatal */
        }
      }
    }
  }

  if (!Number.isFinite(userId) || userId <= 0) {
    return fail("google_user");
  }

  const dest = safeNextPath(androidState?.nextPath || nextPath);

  // Android Capacitor: issue one-time code → App Link /auth/native-callback
  if (isAndroid) {
    const session = await createAppSession(userId, {
      platform: "android",
      deviceId: androidState?.deviceId || null,
      userAgent: request.headers.get("user-agent"),
    });
    const nativeCode = await issueNativeAuthCode({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      userId,
    });
    const bridge = new URL("/auth/native-callback", origin);
    bridge.searchParams.set("code", nativeCode);
    bridge.searchParams.set("next", dest);
    const res = NextResponse.redirect(bridge);
    const secure = resolveCookieSecure(request);
    const expiresAt = new Date(session.expires_at);
    res.cookies.set(
      SESSION_COOKIE_NAME,
      session.access_token,
      sessionCookieOptions(expiresAt, secure)
    );
    res.cookies.delete("google_oauth_state");
    res.cookies.delete("google_oauth_next");
    res.cookies.delete("google_oauth_platform");
    return res;
  }

  const res = NextResponse.redirect(new URL(dest, origin));
  res.cookies.delete("google_oauth_state");
  res.cookies.delete("google_oauth_next");
  res.cookies.delete("google_oauth_platform");
  await setSessionOnResponse(res, userId, request);
  return res;
}
