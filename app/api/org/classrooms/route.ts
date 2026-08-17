import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { createClassroom, listClassrooms } from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const orgId = Number(new URL(request.url).searchParams.get("organization_id") || 0) || undefined;
    const data = await listClassrooms(auth, orgId);
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
    const data = await createClassroom(auth, {
      organization_id: Number(body?.organization_id),
      name: body?.name,
      description: body?.description,
      teacher_user_id: body?.teacher_user_id ? Number(body.teacher_user_id) : undefined,
    });
    return jsonOk(data, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
