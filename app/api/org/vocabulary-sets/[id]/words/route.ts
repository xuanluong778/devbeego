import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { addVocabularySetWords } from "@/lib/org-vocab/service";
import type { ImportWordInput } from "@/lib/org-vocab/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const setId = Number(params.id);
    const body = await request.json();
    const words = Array.isArray(body?.words) ? (body.words as ImportWordInput[]) : [];
    const data = await addVocabularySetWords(auth, setId, words);
    return jsonOk(data, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
