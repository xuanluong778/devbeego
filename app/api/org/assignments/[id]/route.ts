import type { NextRequest } from "next/server";
import { getAuthContext, canViewAssignment } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { getAssignmentReport, getStudentAssignmentDetail } from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const assignmentId = Number(params.id);
    if (!(await canViewAssignment(auth, assignmentId))) {
      return jsonErr("Bạn không có quyền xem bài giao này.", 403);
    }
    const data = await getStudentAssignmentDetail(auth, assignmentId);
    return jsonOk(data);
  } catch (error) {
    return mapServiceError(error);
  }
}
