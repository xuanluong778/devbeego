import pool from "@/lib/db";
import { ensureRoleSchema } from "@/lib/auth/ensure-role-schema";
import { ensureGoogleAuthColumns } from "@/lib/auth/ensure-google-auth-columns";
import { isAdminUser } from "@/lib/auth/is-admin-user";

export type UserRole = "admin" | "user";
export { isAdminUser, parseAdminEmails } from "@/lib/auth/is-admin-user";

export function resolveRoleForEmail(email: string | null | undefined): UserRole {
  return isAdminUser(email) ? "admin" : "user";
}

/** @deprecated Use isAdminUser */
export function isAdminEmail(email: string | null | undefined): boolean {
  return isAdminUser(email);
}

/** Cập nhật last_login_at. Không đổi role theo email (tránh tự cấp hoặc thu hồi admin lúc đăng nhập). */
export async function syncLoginMeta(userId: number, _email: string | null | undefined): Promise<UserRole> {
  await ensureRoleSchema();
  await ensureGoogleAuthColumns();
  await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [userId]);
  const [rows] = await pool.query(`SELECT role FROM users WHERE id = ? LIMIT 1`, [userId]);
  const role = String((rows as { role?: string }[])[0]?.role || "user").toLowerCase();
  return role === "admin" ? "admin" : "user";
}
