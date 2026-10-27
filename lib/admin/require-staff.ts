import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextResponseImpl } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { ensureStudentAdminSchema } from "@/lib/admin/ensure-student-admin-schema";
import {
  type AdminPermission,
  type StaffRole,
  hasPermission,
  normalizeStaffRole,
  permissionsForRole,
} from "@/lib/admin/rbac";
import pool from "@/lib/db";

export type StaffSession = {
  id: number;
  email: string;
  name: string;
  staffRole: StaffRole;
  permissions: AdminPermission[];
};

async function emailBootstrapBlocked(email: string): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT 1 FROM admin_staff_bootstrap_block WHERE email = ? LIMIT 1`,
    [email]
  );
  return (rows as unknown[]).length > 0;
}

export async function resolveStaffSession(request: NextRequest): Promise<StaffSession | null> {
  const user = await getSessionUserFromRequest(request);
  if (!user || user.is_active !== 1) return null;

  await ensureStudentAdminSchema();
  const [rows] = await pool.query(
    `SELECT id, name, email, staff_role FROM users WHERE id = ? LIMIT 1`,
    [user.id]
  );
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) return null;

  const email = String(row.email || user.email || "").trim().toLowerCase();
  const explicit = String(row.staff_role || "").trim();
  let staffRole = normalizeStaffRole(row.staff_role, email);
  if (!explicit && (await emailBootstrapBlocked(email))) {
    staffRole = null;
  }
  if (!staffRole) return null;

  return {
    id: Number(row.id),
    email,
    name: String(row.name || user.name || ""),
    staffRole,
    permissions: permissionsForRole(staffRole),
  };
}

export async function requireStaffPermission(
  request: NextRequest,
  permission: AdminPermission
): Promise<StaffSession | NextResponse | null> {
  const method = String(request.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    const rl = await checkRateLimit(request, { key: "staff_mutation", windowMs: 60_000, max: 120 });
    if (!rl.ok) {
      return NextResponseImpl.json(
        { success: false, message: "Too many requests.", code: "RATE_LIMIT" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }
  }
  const staff = await resolveStaffSession(request);
  if (!staff || !hasPermission(staff.staffRole, permission)) return null;
  return staff;
}

/** @deprecated Prefer requireStaffPermission — giữ tương thích route admin cũ. */
export async function requireStaffWithAdminAccess(
  request: NextRequest
): Promise<StaffSession | NextResponse | null> {
  return requireStaffPermission(request, "admin.access");
}
