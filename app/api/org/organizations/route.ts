import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { createOrganization, listOrganizations } from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const data = await listOrganizations(auth);
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
    const data = await createOrganization(auth, {
      name: body?.name,
      slug: body?.slug,
    });
    return jsonOk(data, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
