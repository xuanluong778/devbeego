import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import {
  duplicatePathTemplate,
  getPathTemplate,
  publishPathTemplate,
  savePathTemplateDraft,
} from "@/lib/admin/path-template-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "paths.templates.read");
  if (staff instanceof NextResponse) return staff;
  if (!staff) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const data = await getPathTemplate(id);
  if (!data) return NextResponse.json({ success: false, message: "Không tìm thấy." }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "paths.templates.write");
  if (staff instanceof NextResponse) return staff;
  if (!staff) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    description?: string | null;
    items?: { lessonId: string; sortIndex?: number; required?: boolean }[];
  };
  const result = await savePathTemplateDraft({
    templateId: id,
    actorUserId: staff.id,
    title: body.title,
    description: body.description,
    items: body.items,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: ("message" in result && result.message) || "Không lưu được.",
        code: result.code,
      },
      { status: result.code === "NOT_FOUND" ? 404 : 422 }
    );
  }
  const data = await getPathTemplate(id);
  return NextResponse.json({ success: true, message: "Đã lưu nháp.", data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "paths.templates.publish");
  if (staff instanceof NextResponse) return staff;
  if (!staff) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const id = Number(params.id);
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action === "duplicate") {
    const dup = await duplicatePathTemplate(id, staff.id);
    if (!dup.ok) return NextResponse.json({ success: false, message: "Không nhân bản được." }, { status: 404 });
    return NextResponse.json({ success: true, data: { id: dup.id } });
  }
  const pub = await publishPathTemplate(id, staff.id);
  if (!pub.ok) {
    return NextResponse.json(
      {
        success: false,
        message: ("message" in pub && pub.message) || "Không xuất bản được.",
        code: pub.code,
      },
      { status: 422 }
    );
  }
  const data = await getPathTemplate(id);
  return NextResponse.json({ success: true, message: "Đã xuất bản lộ trình mẫu.", data });
}
