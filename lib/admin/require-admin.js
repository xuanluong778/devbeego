import { NextResponse } from "next/server";

/**
 * JS routes resolve this file (not the .ts twin).
 * No email fallback. Teachers cannot use unscoped legacy handlers.
 */
export async function requireAdminUser(request, permission = "admin.access") {
  const { requireStaffPermission } = await import("@/lib/admin/require-staff");
  const staff = await requireStaffPermission(request, permission);
  if (staff instanceof NextResponse) return staff;
  if (!staff || staff.staffRole === "teacher") return null;
  return { id: staff.id, email: staff.email, role: "admin" };
}

export async function requireSystemOwner(request) {
  const { requireStaffPermission } = await import("@/lib/admin/require-staff");
  const staff = await requireStaffPermission(request, "admin.access");
  if (staff instanceof NextResponse) return staff;
  if (!staff || staff.staffRole !== "system_owner") return null;
  return { id: staff.id, email: staff.email, role: "admin" };
}
