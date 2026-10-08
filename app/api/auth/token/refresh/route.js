import { NextResponse } from "next/server";
import { refreshAppSession } from "@/lib/auth/app-session";
import { loadUserPayload } from "@/lib/auth/create-session";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = String(body.refresh_token || "").trim();
    if (!refreshToken) {
      return NextResponse.json({ success: false, message: "refresh_token required." }, { status: 400 });
    }
    const session = await refreshAppSession(refreshToken);
    if (!session) {
      return NextResponse.json({ success: false, message: "Invalid or expired refresh token." }, { status: 401 });
    }
    // Decode user from new access via DB
    const { default: pool } = await import("@/lib/db");
    const [rows] = await pool.query(
      `SELECT user_id FROM user_sessions WHERE token = ? LIMIT 1`,
      [session.access_token]
    );
    const userId = Number(rows[0]?.user_id);
    const user = userId ? await loadUserPayload(userId) : null;
    return NextResponse.json({ success: true, data: { user, ...session } });
  } catch (err) {
    console.error("[auth/token/refresh]", err);
    return NextResponse.json({ success: false, message: "Refresh failed." }, { status: 500 });
  }
}
