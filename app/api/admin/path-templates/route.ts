import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import { createPathTemplate, listPathTemplates } from "@/lib/admin/path-template-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staff = await requireStaffPermission(request, "paths.templates.read");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Không có quyền." }, { status: 403 });
  }
  const status = new URL(request.url).searchParams.get("status") || "all";
  const data = await listPathTemplates(status === "draft" || status === "published" ? status : "all");
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const staff = await requireStaffPermission(request, "paths.templates.write");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Không có quyền tạo lộ trình." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { title?: string; description?: string };
  const result = await createPathTemplate({
    title: body.title || "",
    description: body.description,
    createdBy: staff.id,
  });
  if (!result.ok) {
    return NextResponse.json({ success: false, message: "Cần tiêu đề lộ trình.", code: result.code }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: { id: result.id } });
}
