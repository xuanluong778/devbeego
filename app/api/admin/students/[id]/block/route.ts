import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import { teacherCanAccessStudent } from "@/lib/admin/teacher-scope";
import { getStudentProfile, setStudentBlocked } from "@/lib/admin/student-admin-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "students.lock");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Không có quyền khóa/mở khóa tài khoản." }, { status: 403 });
  }
  const studentId = Number(params.id);
  if (!Number.isFinite(studentId) || studentId <= 0) {
    return NextResponse.json({ success: false, message: "Mã học viên không hợp lệ." }, { status: 400 });
  }
  if (!(await teacherCanAccessStudent(staff.id, staff.staffRole, studentId))) {
    return NextResponse.json({ success: false, message: "Không có quyền với học viên này." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { block?: boolean; reason?: string };
  const result = await setStudentBlocked({
    studentId,
    actorUserId: staff.id,
    block: body.block !== false,
    reason: body.reason || "",
  });
  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "REASON_REQUIRED" || result.code === "SELF" ? 400 : 422;
    return NextResponse.json(
      { success: false, message: result.message || "Thao tác thất bại.", code: result.code },
      { status }
    );
  }
  const data = await getStudentProfile(studentId);
  return NextResponse.json({
    success: true,
    message: result.block ? "Đã khóa tài khoản học viên." : "Đã mở khóa tài khoản.",
    data,
  });
}
