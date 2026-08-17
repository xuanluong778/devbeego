import { normalizeMediaUrl } from "@/lib/media-url";

export function rowToListeningClip(row) {
  if (!row) return null;
  const options = [row.option_a, row.option_b, row.option_c, row.option_d].filter(
    (o) => String(o || "").trim()
  );
  let keywords = [];
  try {
    const raw = row.keywords_json;
    keywords = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
  } catch {
    keywords = [];
  }

  const slug = row.slug || String(row.id);
  const headwayNum = slug.match(/^headway-(\d+)$/);
  const number = headwayNum ? Number(headwayNum[1]) : undefined;

  return {
    id: slug,
    dbId: Number(row.id),
    number,
    title: row.title,
    level: row.level || "A2",
    audioUrl: normalizeMediaUrl(row.audio_url) || "",
    ttsText: row.tts_text || row.transcript || "",
    vocabularyId: row.vocabulary_id ? Number(row.vocabulary_id) : null,
    keywords,
    question: {
      text: row.question_text || "",
      options,
      correctIndex: Math.min(Math.max(0, Number(row.correct_option) || 0), Math.max(0, options.length - 1)),
      explanation: row.explanation || "",
    },
    transcript: row.transcript || "",
    transcriptVi: row.transcript_vi || "",
    isPublished: Number(row.is_published) === 1,
    sortOrder: Number(row.sort_order) || 0,
  };
}

export function clipInputToDbFields(body = {}) {
  const opts = Array.isArray(body.options) ? body.options : [];
  return {
    slug: String(body.slug || body.id || "").trim(),
    title: String(body.title || "").trim(),
    level: String(body.level || "A2").trim(),
    tts_text: String(body.ttsText || body.tts_text || "").trim(),
    vocabulary_id: body.vocabularyId || body.vocabulary_id ? Number(body.vocabularyId || body.vocabulary_id) : null,
    keywords_json: JSON.stringify(Array.isArray(body.keywords) ? body.keywords : []),
    question_text: String(body.questionText || body.question_text || "").trim(),
    option_a: String(opts[0] || body.option_a || "").trim(),
    option_b: String(opts[1] || body.option_b || "").trim(),
    option_c: String(opts[2] || body.option_c || "").trim(),
    option_d: String(opts[3] || body.option_d || "").trim(),
    correct_option: Math.min(3, Math.max(0, Number(body.correctIndex ?? body.correct_option) || 0)),
    explanation: String(body.explanation || "").trim(),
    transcript: String(body.transcript || "").trim(),
    transcript_vi: String(body.transcriptVi || body.transcript_vi || "").trim(),
    sort_order: Number(body.sortOrder ?? body.sort_order) || 0,
    is_published: body.isPublished === false || body.is_published === 0 ? 0 : 1,
  };
}
