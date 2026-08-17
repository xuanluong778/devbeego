import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/org-vocab/access";
import { jsonOk, jsonErr, mapServiceError } from "@/lib/org-vocab/http";
import {
  endAssignmentSession,
  recordAssignmentResult,
  startAssignmentSession,
} from "@/lib/org-vocab/service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return jsonErr("Đăng nhập để tiếp tục.", 401);
    const assignmentId = Number(params.id);
    const body = await request.json();
    const action = String(body?.action || "result");

    if (action === "start_session") {
      const data = await startAssignmentSession(auth, assignmentId);
      return jsonOk(data, 201);
    }

    if (action === "end_session") {
      const data = await endAssignmentSession(auth, assignmentId, Number(body?.session_id), {
        words_studied: Number(body?.words_studied || 0),
        correct_count: Number(body?.correct_count || 0),
        wrong_count: Number(body?.wrong_count || 0),
      });
      return jsonOk(data);
    }

    const data = await recordAssignmentResult(auth, assignmentId, {
      set_word_id: Number(body?.set_word_id),
      is_correct: Boolean(body?.is_correct),
      answer_type: body?.answer_type,
      duration_seconds: Number(body?.duration_seconds || 0),
      session_id: body?.session_id ? String(body.session_id) : undefined,
    });
    return jsonOk(data, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
