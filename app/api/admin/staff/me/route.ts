import { NextRequest, NextResponse } from "next/server";
import { resolveStaffSession } from "@/lib/admin/require-staff";
import { staffRoleLabelVi } from "@/lib/admin/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staff = await resolveStaffSession(request);
  if (!staff) {
    return NextResponse.json(
      { success: false, message: "Bạn không có quyền truy cập khu vực quản trị.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }
  return NextResponse.json({
    success: true,
    data: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      staff_role: staff.staffRole,
      staff_role_label: staffRoleLabelVi(staff.staffRole),
      permissions: staff.permissions,
      can_access_admin: true,
    },
  });
}
