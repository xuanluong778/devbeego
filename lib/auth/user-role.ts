import pool from "@/lib/db";
import { ensureRoleSchema } from "@/lib/auth/ensure-role-schema";
import { ensureGoogleAuthColumns } from "@/lib/auth/ensure-google-auth-columns";
import { isAdminUser, parseAdminEmails } from "@/lib/auth/is-admin-user";

export type UserRole = "admin" | "user";
export { isAdminUser, parseAdminEmails, DEFAULT_ADMIN_EMAILS } from "@/lib/auth/is-admin-user";

export function resolveRoleForEmail(email: string | null | undefined): UserRole {
  return isAdminUser(email) ? "admin" : "user";
}

/** @deprecated Use isAdminUser */
export function isAdminEmail(email: string | null | undefined): boolean {
  return isAdminUser(email);
}

/** Đồng bộ role theo ADMIN_EMAILS + cập nhật last_login_at khi đăng nhập. */
export async function syncLoginMeta(userId: number, email: string | null | undefined): Promise<UserRole> {
  await ensureRoleSchema();
  await ensureGoogleAuthColumns();
  const role = resolveRoleForEmail(email);
  await pool.query("UPDATE users SET role = ?, last_login_at = NOW() WHERE id = ?", [role, userId]);
  return role;
}
