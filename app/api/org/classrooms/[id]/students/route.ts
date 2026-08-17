import type { NextRequest } from "next/server";
import { getAuthContext, canManageClassroom } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { addClassroomStudents, listClassroomStudents } from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const classroomId = Number(params.id);
    const data = await listClassroomStudents(auth, classroomId);
    return jsonOk(data);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const classroomId = Number(params.id);
    const body = await request.json();
    const userIds = Array.isArray(body?.user_ids)
      ? body.user_ids.map(Number)
      : body?.user_id
      ? [Number(body.user_id)]
      : [];
    const data = await addClassroomStudents(auth, classroomId, userIds);
    return jsonOk(data, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
