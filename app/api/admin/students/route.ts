import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import { listStudents, type AccountStatusFilter } from "@/lib/admin/student-admin-service";
import type { UserFilter } from "@/lib/admin/users-service-filters";

export const dynamic = "force-dynamic";

const FILTERS: UserFilter[] = [
  "all",
  "new",
  "activated",
  "not_activated",
  "trial",
  "paid",
  "expired",
  "inactive_7d",
];

const STATUS_FILTERS: AccountStatusFilter[] = ["all", "active", "blocked"];

export async function GET(request: NextRequest) {
  const staff = await requireStaffPermission(request, "students.list");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json(
      { success: false, message: "Không có quyền xem danh sách học viên.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const rawFilter = searchParams.get("filter") || "all";
    const rawStatus = searchParams.get("account_status") || "all";
    const filter = FILTERS.includes(rawFilter as UserFilter) ? (rawFilter as UserFilter) : "all";
    const accountStatus = STATUS_FILTERS.includes(rawStatus as AccountStatusFilter)
      ? (rawStatus as AccountStatusFilter)
      : "all";
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);
    const data = await listStudents({
      q,
      filter,
      accountStatus,
      page,
      limit,
      staffUserId: staff.id,
      staffRole: staff.staffRole,
    });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: "Không tải được danh sách học viên." },
      { status: 500 }
    );
  }
}
