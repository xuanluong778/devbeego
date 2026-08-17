import { clearVocabularyTableColumnCache } from "@/lib/vocabulary/vocabulary-columns";
import { getVocabularyTableColumnSet } from "@/lib/vocabulary/vocabulary-columns";

/**
 * Đồng bộ cột bảng vocabulary với API (DB cũ / import tay thường thiếu cột → SELECT lỗi).
 * Chạy tối đa một lần mỗi process; ALTER IF NOT EXISTS là no-op khi đã có.
 */
let ensured = false;

async function migrateVocabularyUniqueIndex(pool) {
  try {
    await safeAddColumn(
      pool,
      await getVocabularyTableColumnSet(),
      "basic_unit",
      "ALTER TABLE vocabulary ADD COLUMN basic_unit INT NOT NULL DEFAULT 0 AFTER vocab_source"
    );
    clearVocabularyTableColumnCache();

    const [unitIndex] = await pool.query(
      "SHOW INDEX FROM vocabulary WHERE Key_name = 'uq_vocabulary_word_level_source_unit'"
    );
    if (unitIndex.length) return;

    try {
      await pool.query("ALTER TABLE vocabulary DROP INDEX uq_vocabulary_word_level_source");
    } catch {
      /* ignore */
    }
    try {
      await pool.query("ALTER TABLE vocabulary DROP INDEX uq_vocabulary_word_level");
    } catch {
      /* ignore */
    }
    await pool.query(
      "ALTER TABLE vocabulary ADD UNIQUE KEY uq_vocabulary_word_level_source_unit (word, level, vocab_source, basic_unit)"
    );
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    if (code === "ER_DUP_ENTRY" || code === "ER_DUP_KEYNAME") return;
    throw e;
  }
}

async function safeAddColumn(pool, cols, columnName, alterSql) {
  if (cols.has(columnName)) return;
  try {
    await pool.query(alterSql);
  } catch (e) {
    // Ignore duplicate-column errors (MySQL variants).
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    const errno = e && typeof e === "object" && "errno" in e ? Number(e.errno) : 0;
    if (code === "ER_DUP_FIELDNAME" || errno === 1060) return;
    throw e;
  }
}

export async function ensureVocabularySchema(pool) {
  if (ensured) return;
  clearVocabularyTableColumnCache();
  const cols = await getVocabularyTableColumnSet();

  // Ensure meaning column exists (API requires either `meaning` or `vietnamese_meaning`).
  await safeAddColumn(
    pool,
    cols,
    "vietnamese_meaning",
    "ALTER TABLE vocabulary ADD COLUMN vietnamese_meaning VARCHAR(255) NULL AFTER ipa"
  );
  cols.add("vietnamese_meaning");

  // Thứ tự khớp app/api/admin/import-vocabulary/route.js
  await safeAddColumn(
    pool,
    cols,
    "part_of_speech",
    "ALTER TABLE vocabulary ADD COLUMN part_of_speech VARCHAR(20) NULL AFTER vietnamese_meaning"
  );
  await safeAddColumn(
    pool,
    cols,
    "example_sentence_vi",
    "ALTER TABLE vocabulary ADD COLUMN example_sentence_vi VARCHAR(500) NULL AFTER example_sentence"
  );
  await safeAddColumn(
    pool,
    cols,
    "example_sentence_ipa",
    "ALTER TABLE vocabulary ADD COLUMN example_sentence_ipa VARCHAR(500) NULL AFTER example_sentence"
  );
  await safeAddColumn(
    pool,
    cols,
    "question_text",
    "ALTER TABLE vocabulary ADD COLUMN question_text VARCHAR(255) NULL AFTER example_sentence"
  );
  await safeAddColumn(
    pool,
    cols,
    "topic",
    "ALTER TABLE vocabulary ADD COLUMN topic VARCHAR(120) NULL AFTER question_text"
  );
  await safeAddColumn(
    pool,
    cols,
    "vocab_source",
    "ALTER TABLE vocabulary ADD COLUMN vocab_source VARCHAR(32) NOT NULL DEFAULT 'beego' AFTER topic"
  );
  cols.add("vocab_source");
  await safeAddColumn(
    pool,
    cols,
    "example_audio_url",
    "ALTER TABLE vocabulary ADD COLUMN example_audio_url VARCHAR(500) NULL AFTER audio_url"
  );
  await safeAddColumn(
    pool,
    cols,
    "image_url",
    "ALTER TABLE vocabulary ADD COLUMN image_url VARCHAR(500) NULL AFTER example_audio_url"
  );
  cols.add("image_url");

  await migrateVocabularyUniqueIndex(pool);

  await safeAddColumn(
    pool,
    cols,
    "semantic_hint",
    "ALTER TABLE vocabulary ADD COLUMN semantic_hint VARCHAR(500) NULL AFTER image_url"
  );
  await safeAddColumn(
    pool,
    cols,
    "image_prompt",
    "ALTER TABLE vocabulary ADD COLUMN image_prompt TEXT NULL AFTER semantic_hint"
  );
  await safeAddColumn(
    pool,
    cols,
    "image_style",
    "ALTER TABLE vocabulary ADD COLUMN image_style VARCHAR(80) NULL AFTER image_prompt"
  );
  await safeAddColumn(
    pool,
    cols,
    "image_source",
    "ALTER TABLE vocabulary ADD COLUMN image_source VARCHAR(40) NULL AFTER image_style"
  );
  cols.add("image_source");
  await safeAddColumn(
    pool,
    cols,
    "image_status",
    "ALTER TABLE vocabulary ADD COLUMN image_status VARCHAR(20) NULL DEFAULT 'pending' AFTER image_source"
  );

  ensured = true;
  clearVocabularyTableColumnCache();
}
