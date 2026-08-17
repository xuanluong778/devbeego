import type { NextRequest } from "next/server";
import { getAuthContext, canViewVocabularySet, canManageVocabularySet } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import { getVocabularySetWords } from "@/lib/org-vocab/service";
import pool from "@/lib/db";
import { ensureOrgVocabSchema } from "@/lib/org-vocab/ensure-schema";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const setId = Number(params.id);
    if (!(await canViewVocabularySet(auth, setId))) {
      return jsonErr("Bạn không có quyền xem bộ từ này.", 403);
    }
    await ensureOrgVocabSchema();
    const [[setRow]] = await pool.query(`SELECT * FROM vocabulary_sets WHERE id = ? LIMIT 1`, [setId]);
    const words = await getVocabularySetWords(setId);
    return jsonOk({ set: setRow, words });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const setId = Number(params.id);
    if (!(await canManageVocabularySet(auth, setId))) {
      return jsonErr("Bạn không có quyền sửa bộ từ này.", 403);
    }
    const body = await request.json();
    await ensureOrgVocabSchema();
    await pool.query(
      `UPDATE vocabulary_sets SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        level = COALESCE(?, level),
        topic = COALESCE(?, topic),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body?.title?.trim() || null,
        body?.description != null ? String(body.description).trim() : null,
        body?.level?.trim() || null,
        body?.topic?.trim() || null,
        setId,
      ]
    );
    const [[row]] = await pool.query(`SELECT * FROM vocabulary_sets WHERE id = ? LIMIT 1`, [setId]);
    return jsonOk(row);
  } catch (error) {
    return mapServiceError(error);
  }
}
