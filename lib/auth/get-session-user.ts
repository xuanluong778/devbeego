import type { NextRequest } from "next/server";
import pool from "@/lib/db";
import { ensureRoleSchema } from "@/lib/auth/ensure-role-schema";
import { ensureUserProfileColumns } from "@/lib/users/ensure-user-profile-columns";
import { ensureUserSessionsTable } from "@/lib/auth/ensure-session-schema";
import { resolveSessionToken } from "@/lib/auth/resolve-session-token";
import type { UserRole } from "@/lib/auth/user-role";

export type SessionUser = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: number;
  avatar_url?: string | null;
};

export async function getSessionUserFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = resolveSessionToken(request);
  if (!token) return null;

  await ensureUserSessionsTable();
  await ensureRoleSchema();
  await ensureUserProfileColumns();

  let rows: Record<string, unknown>[];
  try {
    const [r] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.avatar_url
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > NOW()
         AND (s.revoked_at IS NULL)
       LIMIT 1`,
      [token]
    );
    rows = r as Record<string, unknown>[];
  } catch {
    const [r] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.avatar_url
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    rows = r as Record<string, unknown>[];
  }
  const row = rows[0];
  if (!row) return null;
  if (Number(row.is_active ?? 1) !== 1) return null;

  try {
    await pool.query(`UPDATE user_sessions SET last_seen_at = NOW() WHERE token = ? LIMIT 1`, [token]);
  } catch {
    /* optional column */
  }

  const role = String(row.role || "user").toLowerCase() as UserRole;
  const email = row.email != null ? String(row.email) : null;

  return {
    id: Number(row.id),
    name: String(row.name || ""),
    email,
    phone: row.phone != null ? String(row.phone) : null,
    role,
    is_active: Number(row.is_active ?? 1),
    avatar_url: row.avatar_url != null ? String(row.avatar_url) : null,
  };
}
