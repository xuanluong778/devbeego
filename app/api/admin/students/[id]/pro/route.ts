import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission, type StaffSession } from "@/lib/admin/require-staff";
import { teacherCanAccessStudent } from "@/lib/admin/teacher-scope";
import type { StaffRole } from "@/lib/admin/rbac";
import type { ProActivationSource } from "@/lib/admin/ensure-pro-admin-schema";
import {
  applyProPlanChange,
  getStudentProSummary,
  previewProPlanChange,
  type ProPlanAction,
} from "@/lib/admin/pro-plan-admin-service";

export const dynamic = "force-dynamic";

async function assertStudentAccess(staff: StaffSession, studentId: number) {
  return teacherCanAccessStudent(staff.id, staff.staffRole as StaffRole, studentId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "students.view");
  if (staff instanceof NextResponse) return staff;
  if (!staff) return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  const studentId = Number(params.id);
  if (!(await assertStudentAccess(staff, studentId))) {
    return NextResponse.json({ success: false, message: "Không có quyền với học viên này." }, { status: 403 });
  }
  const data = await getStudentProSummary(studentId);
  return NextResponse.json({ success: true, data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const studentId = Number(params.id);
  const body = (await request.json().catch(() => ({}))) as {
    mode?: "preview" | "apply";
    action?: ProPlanAction;
    plan?: "pro" | "vip";
    days?: number;
    activationSource?: ProActivationSource;
    externalRef?: string | null;
    reason?: string;
    idempotencyKey?: string;
  };

  if (body.mode === "preview") {
    const staff = await requireStaffPermission(request, "students.plan");
    if (staff instanceof NextResponse) return staff;
    if (!staff) return NextResponse.json({ success: false, message: "Không có quyền xem trước gói." }, { status: 403 });
    if (!(await assertStudentAccess(staff, studentId))) {
      return NextResponse.json({ success: false, message: "Không có quyền với học viên này." }, { status: 403 });
    }
    const action = body.action;
    if (!action || !["activate", "extend", "revoke"].includes(action)) {
      return NextResponse.json({ success: false, message: "action không hợp lệ." }, { status: 400 });
    }
    const preview = await previewProPlanChange({
      studentUserId: studentId,
      action,
      plan: body.plan,
      days: body.days,
    });
    return NextResponse.json({ success: true, data: preview });
  }

  const staff = await requireStaffPermission(request, "students.plan");

  if (staff instanceof NextResponse) return staff;
  if (!staff) return NextResponse.json({ success: false, message: "Không có quyền quản lý Pro." }, { status: 403 });
  if (!(await assertStudentAccess(staff, studentId))) {
    return NextResponse.json({ success: false, message: "Không có quyền với học viên này." }, { status: 403 });
  }

  const action = body.action;
  if (!action || !["activate", "extend", "revoke"].includes(action)) {
    return NextResponse.json({ success: false, message: "action không hợp lệ." }, { status: 400 });
  }

  const result = await applyProPlanChange({
    studentUserId: studentId,
    actorUserId: staff.id,
    action,
    plan: body.plan,
    days: body.days,
    activationSource: body.activationSource,
    externalRef: body.externalRef,
    reason: body.reason,
    idempotencyKey: body.idempotencyKey,
  });

  if (!result.ok) {
    const code = result.code;
    const message =
      code === "REASON_REQUIRED"
        ? "Thu hồi Pro cần nhập lý do."
        : code === "SOURCE_REQUIRED"
          ? "Chọn nguồn kích hoạt."
          : "Không thực hiện được.";
    return NextResponse.json({ success: false, message, code }, { status: 422 });
  }

  const data = await getStudentProSummary(studentId);
  return NextResponse.json({
    success: true,
    message: result.duplicate ? "Thao tác đã được ghi nhận trước đó (idempotency)." : "Đã cập nhật gói Pro.",
    duplicate: result.duplicate,
    data,
  });
}
