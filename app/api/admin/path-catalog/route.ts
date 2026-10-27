import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import { getCurriculumCatalogTree } from "@/lib/admin/path-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staff = await requireStaffPermission(request, "paths.catalog.read");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Không có quyền xem danh mục nội dung." }, { status: 403 });
  }
  return NextResponse.json({ success: true, data: getCurriculumCatalogTree() });
}
