import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { createVocabularySet, listVocabularySets } from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const orgId = Number(new URL(request.url).searchParams.get("organization_id") || 0) || undefined;
    const data = await listVocabularySets(auth, orgId);
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
    const data = await createVocabularySet(auth, {
      organization_id: Number(body?.organization_id),
      title: body?.title,
      description: body?.description,
      level: body?.level,
      topic: body?.topic,
    });
    return jsonOk(data, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
