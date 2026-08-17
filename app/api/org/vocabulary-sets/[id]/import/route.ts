import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { addVocabularySetWords } from "@/lib/org-vocab/service";
import { parseImportBuffer, parseImportJsonBody } from "@/lib/org-vocab/import-words";
import type { ImportWordInput } from "@/lib/org-vocab/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const setId = Number(params.id);

    const contentType = request.headers.get("content-type") || "";
    let words: ImportWordInput[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return jsonErr("Vui lòng upload file CSV hoặc Excel.", 400);
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = "name" in file ? String(file.name || "") : "";
      words = parseImportBuffer(buffer, filename);
    } else {
      const body = await request.json();
      words = parseImportJsonBody(body?.rows || body?.words || body);
    }

    if (!words.length) {
      return jsonErr(
        "Không đọc được từ hợp lệ. Cột bắt buộc: word, meaning_vi (hoặc meaning).",
        400
      );
    }

    const data = await addVocabularySetWords(auth, setId, words);
    return jsonOk({ ...data, parsed: words.length });
  } catch (error) {
    return mapServiceError(error);
  }
}
