import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission, type StaffSession } from "@/lib/admin/require-staff";
import { teacherCanAccessStudent } from "@/lib/admin/teacher-scope";
import type { StaffRole } from "@/lib/admin/rbac";
import {
  applyPublishedTemplateToAssignment,
  assignPathToStudent,
  getStudentLearningPathView,
  updateStudentPathPersonal,
} from "@/lib/admin/student-path-service";
import { getStudentProfile } from "@/lib/admin/student-admin-service";

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
  const data = await getStudentLearningPathView(studentId);
  return NextResponse.json({ success: true, data });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "paths.assign");
  if (staff instanceof NextResponse) return staff;
  if (!staff) return NextResponse.json({ success: false, message: "Không có quyền gán lộ trình." }, { status: 403 });
  const studentId = Number(params.id);
  if (!(await assertStudentAccess(staff, studentId))) {
    return NextResponse.json({ success: false, message: "Không có quyền với học viên này." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    templateId?: number;
    goalText?: string;
    dueAt?: string | null;
    assignmentId?: number;
    reason?: string;
    disableLessonIds?: string[];
    addItems?: { lessonId: string }[];
  };

  if (body.action === "apply_template_update") {
    const perm = await requireStaffPermission(request, "paths.apply_update");
    if (perm instanceof NextResponse) return perm;
    if (!perm) return NextResponse.json({ success: false, message: "Không có quyền áp dụng cập nhật mẫu." }, { status: 403 });
    const result = await applyPublishedTemplateToAssignment({
      studentUserId: studentId,
      assignmentId: Number(body.assignmentId),
      actorUserId: staff.id,
      reason: body.reason || "",
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, message: "Không áp dụng được.", code: result.code }, { status: 422 });
    }
    return NextResponse.json({
      success: true,
      message: `Đã thêm ${result.addedItems} bài từ mẫu mới. Tiến độ cũ được giữ.`,
      data: await getStudentLearningPathView(studentId),
    });
  }

  if (body.action === "personal_update") {
    const perm = await requireStaffPermission(request, "paths.assign.personal");
    if (perm instanceof NextResponse) return perm;
    if (!perm) return NextResponse.json({ success: false, message: "Không có quyền chỉnh lộ trình cá nhân." }, { status: 403 });
    const result = await updateStudentPathPersonal({
      studentUserId: studentId,
      assignmentId: Number(body.assignmentId),
      actorUserId: staff.id,
      reason: body.reason || "",
      goalText: body.goalText,
      dueAt: body.dueAt,
      disableLessonIds: body.disableLessonIds,
      addItems: body.addItems,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          message: ("message" in result && result.message) || "Lỗi",
          code: result.code,
        },
        { status: 422 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Đã cập nhật lộ trình cá nhân.",
      data: await getStudentLearningPathView(studentId),
    });
  }

  const result = await assignPathToStudent({
    studentUserId: studentId,
    templateId: Number(body.templateId),
    actorUserId: staff.id,
    goalText: body.goalText,
    dueAt: body.dueAt,
  });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, message: result.message || "Không gán được lộ trình.", code: result.code },
      { status: 422 }
    );
  }
  const profile = await getStudentProfile(studentId, { userId: staff.id, role: staff.staffRole });
  return NextResponse.json({
    success: true,
    message: "Đã gán lộ trình cho học viên (bản chụp riêng, không ảnh hưởng học viên khác).",
    data: profile?.learningPath,
  });
}
