import { NextRequest, NextResponse } from "next/server";
import { requireStaffPermission } from "@/lib/admin/require-staff";
import { teacherCanAccessStudent } from "@/lib/admin/teacher-scope";
import { getStudentProfile, updateStudentProfile } from "@/lib/admin/student-admin-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "students.view");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Không có quyền xem hồ sơ." }, { status: 403 });
  }
  const studentId = Number(params.id);
  if (!Number.isFinite(studentId) || studentId <= 0) {
    return NextResponse.json({ success: false, message: "Mã học viên không hợp lệ." }, { status: 400 });
  }
  try {
    const data = await getStudentProfile(studentId, { userId: staff.id, role: staff.staffRole });
    if (!data) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy học viên hoặc bạn không có quyền." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data, permissions: staff.permissions });
  } catch {
    return NextResponse.json({ success: false, message: "Không tải được hồ sơ học viên." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await requireStaffPermission(request, "students.edit");
  if (staff instanceof NextResponse) return staff;
  if (!staff) {
    return NextResponse.json({ success: false, message: "Không có quyền sửa thông tin." }, { status: 403 });
  }
  const studentId = Number(params.id);
  if (!Number.isFinite(studentId) || studentId <= 0) {
    return NextResponse.json({ success: false, message: "Mã học viên không hợp lệ." }, { status: 400 });
  }
  if (!(await teacherCanAccessStudent(staff.id, staff.staffRole, studentId))) {
    return NextResponse.json({ success: false, message: "Không có quyền với học viên này." }, { status: 403 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      phone?: string | null;
      reason?: string;
    };
    const result = await updateStudentProfile({
      studentId,
      actorUserId: staff.id,
      name: body.name,
      phone: body.phone,
      reason: body.reason,
    });
    if (!result.ok) {
      const status = result.code === "NOT_FOUND" ? 404 : 422;
      return NextResponse.json(
        { success: false, message: result.message || "Không cập nhật được.", code: result.code },
        { status }
      );
    }
    const data = await getStudentProfile(studentId, { userId: staff.id, role: staff.staffRole });
    return NextResponse.json({
      success: true,
      message: result.changed ? "Đã cập nhật thông tin học viên." : "Không có thay đổi.",
      data,
    });
  } catch {
    return NextResponse.json({ success: false, message: "Không cập nhật được hồ sơ." }, { status: 500 });
  }
}
