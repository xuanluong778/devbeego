import pool from "@/lib/db";

let cache = null;

async function currentDatabaseName() {
  try {
    const [[row]] = await pool.query("SELECT DATABASE() AS d");
    const d = row?.d != null ? String(row.d).trim() : "";
    if (d) return d;
  } catch (_e) {
    /* ignore */
  }
  return String(process.env.DB_NAME || "").trim();
}

/**
 * Danh sách cột thật của bảng vocabulary (DB cũ / mới khác nhau).
 * Dùng INFORMATION_SCHEMA với TABLE_SCHEMA = DB_NAME (tránh DATABASE() null),
 * fallback SHOW COLUMNS nếu cần.
 * @returns {Promise<Set<string>>}
 */
export async function getVocabularyTableColumnSet() {
  if (cache) return cache;

  const schema = await currentDatabaseName();
  let rows = null;

  if (schema) {
    try {
      const [r] = await pool.query(
        `SELECT COLUMN_NAME AS n FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [schema, "vocabulary"]
      );
      rows = r;
    } catch (_e) {
      rows = [];
    }
  }

  if (!rows || rows.length === 0) {
    try {
      const [r2] = await pool.query("SHOW COLUMNS FROM vocabulary");
      cache = new Set(r2.map((x) => String(x.Field || "")));
      return cache;
    } catch (err) {
      clearVocabularyTableColumnCache();
      throw err;
    }
  }

  cache = new Set(rows.map((r) => String(r.n || "")));
  return cache;
}

export function clearVocabularyTableColumnCache() {
  cache = null;
}

/** Ưu tiên tên cột đầu tiên có trong bảng. */
export function firstExistingColumn(cols, ...candidates) {
  for (const c of candidates) {
    if (cols.has(c)) return c;
  }
  return null;
}

/**
 * SELECT list + alias cố định cho API (frontend giữ vietnamese_meaning, ipa).
 */
export function buildVocabularySelectFragments(cols) {
  const meaningCol = firstExistingColumn(cols, "meaning", "vietnamese_meaning");
  const ipaCol = firstExistingColumn(cols, "ipa", "pronunciation");

  const q = (name) => `\`${String(name).replace(/`/g, "")}\``;

  const parts = [
    `${q("id")}`,
    `${q("word")}`,
    meaningCol
      ? `TRIM(${q(meaningCol)}) AS vietnamese_meaning`
      : `'' AS vietnamese_meaning`,
    ipaCol ? `TRIM(${q(ipaCol)}) AS ipa` : `'' AS ipa`,
  ];

  const optional = [
    "part_of_speech",
    "example_sentence",
    "example_sentence_vi",
    "example_sentence_ipa",
    "question_text",
    "topic",
    "image_url",
    "semantic_hint",
    "image_prompt",
    "image_style",
    "image_source",
    "image_status",
    "audio_url",
    "example_audio_url",
    "level",
  ];

  for (const name of optional) {
    if (cols.has(name)) {
      parts.push(q(name));
    } else {
      parts.push(`NULL AS ${q(name)}`);
    }
  }

  return {
    selectList: parts.join(", "),
    meaningCol,
    ipaCol,
    hasLevel: cols.has("level"),
    hasTopic: cols.has("topic"),
    hasPos: cols.has("part_of_speech"),
    hasVocabSource: cols.has("vocab_source"),
  };
}
