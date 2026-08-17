import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { createAssignment, listAssignments } from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const classroomId =
      Number(new URL(request.url).searchParams.get("classroom_id") || 0) || undefined;
    const data = await listAssignments(auth, { classroom_id: classroomId });
    return jsonOk(data);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const body = await request.json();
    const data = await createAssignment(auth, {
      classroom_id: Number(body?.classroom_id),
      set_id: Number(body?.set_id),
      title: body?.title,
      instructions: body?.instructions,
      due_at: body?.due_at || null,
    });
    return jsonOk(data, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
