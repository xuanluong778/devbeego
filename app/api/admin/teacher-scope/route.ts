import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import { listTeacherScope, setTeacherStudentScope } from "@/lib/admin/teacher-scope";
import { writeAdminAuditLog } from "@/lib/admin/audit-log";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staff = await requireStaffPermission(request, "teacher.scope.manage");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  const teacherId = Number(new URL(request.url).searchParams.get("teacher_user_id") || 0);
  if (!teacherId) {
    return NextResponse.json({ success: false, message: "teacher_user_id required" }, { status: 400 });
  }
  const data = await listTeacherScope(teacherId);
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const staff = await requireStaffPermission(request, "teacher.scope.manage");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    teacherUserId?: number;
    studentUserIds?: number[];
  };
  const teacherUserId = Number(body.teacherUserId);
  if (!teacherUserId) {
    return NextResponse.json({ success: false, message: "teacherUserId required" }, { status: 400 });
  }
  const result = await setTeacherStudentScope({
    teacherUserId,
    studentUserIds: body.studentUserIds || [],
    assignedBy: staff.id,
  });
  await writeAdminAuditLog({
    actorUserId: staff.id,
    action: "teacher.scope.set",
    meta: { teacher_user_id: teacherUserId, student_count: result.count },
  });
  return NextResponse.json({ success: true, message: "Đã cập nhật phạm vi giáo viên.", data: result });
}
