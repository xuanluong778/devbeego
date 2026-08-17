import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { generateSessionToken } from "@/lib/auth";
import { resolveCookieSecure } from "@/lib/auth/resolve-cookie-secure";
import { ensureUserSessionsTable } from "@/lib/auth/ensure-session-schema";
import { ensureRoleSchema } from "@/lib/auth/ensure-role-schema";
import { syncLoginMeta } from "@/lib/auth/user-role";

export const SESSION_COOKIE_NAME = "session_token";
export const SESSION_DAYS = 7;

export type SessionUser = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
};

export function sessionCookieOptions(expiresAt: Date, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    expires: expiresAt,
  };
}

/** Inserts session row and sets httpOnly cookie on the response. */
export async function setSessionOnResponse(
  response: NextResponse,
  userId: number,
  request?: Pick<Request, "headers">
): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await ensureUserSessionsTable();
  await pool.query("INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)", [
    userId,
    token,
    expiresAt,
  ]);
  await ensureRoleSchema();
  const [emailRows] = await pool.query("SELECT email FROM users WHERE id = ? LIMIT 1", [userId]);
  const email = (emailRows as { email: string | null }[])[0]?.email ?? null;
  await syncLoginMeta(userId, email);
  const secure = resolveCookieSecure(request);
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt, secure));
  return token;
}

export async function loadUserPayload(userId: number): Promise<SessionUser | null> {
  const [rows] = await pool.query(
    "SELECT id, name, email, phone FROM users WHERE id = ? LIMIT 1",
    [userId]
  );
  const u = (rows as { id: number; name: string; email: string | null; phone: string | null }[])[0];
  if (!u) return null;
  return {
    id: Number(u.id),
    name: String(u.name),
    email: u.email != null ? String(u.email) : null,
    phone: u.phone != null ? String(u.phone) : null,
  };
}
