import { NextResponse } from "next/server";
import { resolveSessionToken } from "@/lib/auth/resolve-session-token";
import { revokeSessionByAccessToken } from "@/lib/auth/app-session";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const token = resolveSessionToken(request);
    const body = await request.json().catch(() => ({}));
    const refreshToken = body.refresh_token ? String(body.refresh_token) : null;

    if (token) await revokeSessionByAccessToken(token);
    if (refreshToken) {
      const { hashRefreshToken } = await import("@/lib/auth/app-session");
      const { default: pool } = await import("@/lib/db");
      const hash = hashRefreshToken(refreshToken);
      try {
        await pool.query(
          `UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token_hash = ?`,
          [hash]
        );
      } catch {
        /* ignore */
      }
    }

    return NextResponse.json({ success: true, message: "Session revoked." });
  } catch {
    return NextResponse.json({ success: false, message: "Revoke failed." }, { status: 500 });
  }
}
