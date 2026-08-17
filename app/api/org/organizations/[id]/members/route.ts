import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { addOrganizationMember, listOrganizationMembers } from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const orgId = Number(params.id);
    const data = await listOrganizationMembers(auth, orgId);
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
    const orgId = Number(params.id);
    const body = await request.json();
    const data = await addOrganizationMember(auth, orgId, {
      user_id: Number(body?.user_id),
      role: body?.role,
    });
    return jsonOk(data, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
