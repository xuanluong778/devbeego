import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AdminPermission } from "@/lib/admin/rbac";
import { hasPermission } from "@/lib/admin/rbac";
import { requireStaffPermission, resolveStaffSession } from "@/lib/admin/require-staff";

export type LegacyAdmin = { id: number; email: string; role: "admin" };

/**
 * Legacy admin routes stay on the same URLs.
 * Permission must be an RBAC grant the role actually has.
 * Teachers are rejected here because these handlers are not teacher-scoped.
 */
export async function requireAdminUser(
  request: NextRequest,
  permission: AdminPermission = "admin.access"
): Promise<LegacyAdmin | NextResponse | null> {
  const staff = await requireStaffPermission(request, permission);
  if (staff instanceof NextResponse) return staff;
  if (!staff || staff.staffRole === "teacher") return null;
  if (!hasPermission(staff.staffRole, permission)) return null;
  return { id: staff.id, email: staff.email, role: "admin" };
}

/** Content, payments, and settings that support_staff is not granted. */
export async function requireSystemOwner(
  request: NextRequest
): Promise<LegacyAdmin | NextResponse | null> {
  const staff = await requireStaffPermission(request, "admin.access");
  if (staff instanceof NextResponse) return staff;
  if (!staff || staff.staffRole !== "system_owner") return null;
  return { id: staff.id, email: staff.email, role: "admin" };
}

export { resolveStaffSession, requireStaffPermission } from "@/lib/admin/require-staff";
export { hasPermission };
