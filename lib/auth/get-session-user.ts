import type { NextRequest } from "next/server";
import pool from "@/lib/db";
import { ensureRoleSchema } from "@/lib/auth/ensure-role-schema";
import { ensureUserProfileColumns } from "@/lib/users/ensure-user-profile-columns";
import { ensureUserSessionsTable } from "@/lib/auth/ensure-session-schema";
import { isAdminUser, resolveRoleForEmail, type UserRole } from "@/lib/auth/user-role";

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
  const token = request.cookies.get("session_token")?.value;
  if (!token) return null;

  await ensureUserSessionsTable();
  await ensureRoleSchema();
  await ensureUserProfileColumns();

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.is_active, u.avatar_url
     FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) return null;

  let role = String(row.role || "user").toLowerCase() as UserRole;
  const email = row.email != null ? String(row.email) : null;
  const expected = resolveRoleForEmail(email);
  if (role !== expected) {
    role = expected;
    await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, row.id]);
  }
  if (role !== "admin" && isAdminUser(email)) {
    role = "admin";
    await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [row.id]);
  }

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
