import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import { teacherCanAccessStudent } from "@/lib/admin/teacher-scope";
import { addStudentNote, getStudentProfile } from "@/lib/admin/student-admin-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "students.notes.write");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Không có quyền thêm ghi chú." }, { status: 403 });
  }
  const studentId = Number(params.id);
  if (!Number.isFinite(studentId) || studentId <= 0) {
    return NextResponse.json({ success: false, message: "Mã học viên không hợp lệ." }, { status: 400 });
  }
  if (!(await teacherCanAccessStudent(staff.id, staff.staffRole, studentId))) {
    return NextResponse.json({ success: false, message: "Không có quyền với học viên này." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { body?: string };
  const result = await addStudentNote({
    studentId,
    actorUserId: staff.id,
    body: body.body || "",
  });
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json(
      { success: false, message: result.message || "Không lưu được ghi chú.", code: result.code },
      { status }
    );
  }
  const data = await getStudentProfile(studentId);
  return NextResponse.json({ success: true, message: "Đã lưu ghi chú nội bộ.", data });
}
