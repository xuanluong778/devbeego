import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireSystemOwner } from "@/lib/admin/require-admin";
import { clipInputToDbFields, rowToListeningClip } from "@/lib/listening/clip-mapper";
import { ensureListeningSchema } from "@/lib/listening/ensure-schema";
import { normalizeMediaUrl } from "@/lib/media-url";
import { getVocabularyTableColumnSet } from "@/lib/vocabulary/vocabulary-columns";

export const dynamic = "force-dynamic";

async function getClipById(id) {
  const [rows] = await pool.query(`SELECT * FROM listening_clips WHERE id = ? LIMIT 1`, [id]);
  return rows[0] || null;
}

export async function PATCH(request, { params }) {
  try {
    const admin = await requireSystemOwner(request);
    if (admin instanceof NextResponse) return admin;
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    await ensureListeningSchema();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "Invalid id." }, { status: 400 });
    }

    const existing = await getClipById(id);
    if (!existing) {
      return NextResponse.json({ success: false, message: "Clip not found." }, { status: 404 });
    }

    const body = await request.json();
    const action = String(body.action || "").trim();

    if (action === "from_vocabulary") {
      const vocabId = Number(body.vocabularyId || body.vocabulary_id);
      if (!Number.isInteger(vocabId) || vocabId <= 0) {
        return NextResponse.json({ success: false, message: "vocabularyId không hợp lệ." }, { status: 400 });
      }
      const cols = await getVocabularyTableColumnSet();
      const audioCol = cols.has("audio_url") ? "audio_url" : null;
      const exampleCol = cols.has("example_sentence") ? "example_sentence" : null;
      const exampleViCol = cols.has("example_sentence_vi") ? "example_sentence_vi" : null;
      const wordCol = "word";

      const selectParts = ["id", `${wordCol} AS word`];
      if (audioCol) selectParts.push(`${audioCol} AS audio_url`);
      if (exampleCol) selectParts.push(`${exampleCol} AS example_sentence`);
      if (exampleViCol) selectParts.push(`${exampleViCol} AS example_sentence_vi`);

      const [vrows] = await pool.query(
        `SELECT ${selectParts.join(", ")} FROM vocabulary WHERE id = ? LIMIT 1`,
        [vocabId]
      );
      const vocab = vrows[0];
      if (!vocab) {
        return NextResponse.json({ success: false, message: "Không tìm thấy từ vựng." }, { status: 404 });
      }

      const audioUrl = normalizeMediaUrl(vocab.audio_url) || "";
      if (!audioUrl) {
        return NextResponse.json(
          { success: false, message: "Từ vựng này chưa có audio_url." },
          { status: 400 }
        );
      }

      const transcript = String(vocab.example_sentence || vocab.word || "").trim();
      const transcriptVi = String(vocab.example_sentence_vi || "").trim();

      await pool.query(
        `UPDATE listening_clips
         SET audio_url = ?, vocabulary_id = ?, transcript = COALESCE(NULLIF(transcript, ''), ?),
             transcript_vi = COALESCE(NULLIF(transcript_vi, ''), ?)
         WHERE id = ?`,
        [audioUrl, vocabId, transcript, transcriptVi, id]
      );

      const updated = await getClipById(id);
      return NextResponse.json({
        success: true,
        data: rowToListeningClip(updated),
        message: `Đã gắn audio từ từ vựng #${vocabId} (${vocab.word}).`,
      });
    }

    const fields = clipInputToDbFields(body);
    const audioUrl = body.audioUrl != null ? normalizeMediaUrl(String(body.audioUrl || "")) : null;
    await pool.query(
      `UPDATE listening_clips SET
         slug = COALESCE(NULLIF(?, ''), slug),
         title = COALESCE(NULLIF(?, ''), title),
         level = ?,
         audio_url = COALESCE(?, audio_url),
         tts_text = ?,
         vocabulary_id = ?,
         keywords_json = ?,
         question_text = COALESCE(NULLIF(?, ''), question_text),
         option_a = COALESCE(NULLIF(?, ''), option_a),
         option_b = COALESCE(NULLIF(?, ''), option_b),
         option_c = ?,
         option_d = ?,
         correct_option = ?,
         explanation = ?,
         transcript = ?,
         transcript_vi = ?,
         sort_order = ?,
         is_published = ?
       WHERE id = ?`,
      [
        fields.slug,
        fields.title,
        fields.level,
        audioUrl,
        fields.tts_text,
        fields.vocabulary_id,
        fields.keywords_json,
        fields.question_text,
        fields.option_a,
        fields.option_b,
        fields.option_c,
        fields.option_d,
        fields.correct_option,
        fields.explanation,
        fields.transcript,
        fields.transcript_vi,
        fields.sort_order,
        fields.is_published,
        id,
      ]
    );

    const updated = await getClipById(id);
    return NextResponse.json({ success: true, data: rowToListeningClip(updated) });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to update clip." },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const admin = await requireSystemOwner(request);
    if (admin instanceof NextResponse) return admin;
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    await ensureListeningSchema();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "Invalid id." }, { status: 400 });
    }
    await pool.query(`DELETE FROM listening_clips WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to delete clip." },
      { status: 500 }
    );
  }
}
