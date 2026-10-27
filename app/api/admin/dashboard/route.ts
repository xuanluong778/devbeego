import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import { getAdminDashboardStats } from "@/lib/admin/dashboard-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staff = await requireStaffPermission(request, "dashboard.read");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Không có quyền xem dashboard." }, { status: 403 });
  }
  try {
    const data = await getAdminDashboardStats({ userId: staff.id, role: staff.staffRole });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Không tải được dashboard." }, { status: 500 });
  }
}
