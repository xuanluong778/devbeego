/**
 * Import từ docs/Từ vựng tổng hợp chuẩn.txt → chủ đề "Từ vựng Cơ Bản".
 * Bộ từ riêng (vocab_source=co_ban_txt), không ghi đè từ Beego có sẵn.
 * Chạy: node --env-file=.env.local scripts/import-tong-hop-vocabulary.mjs
 */
import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";
import { buildBasicExample } from "../lib/vocabulary/basic-example-generator.js";
import { lookupCuratedImage } from "../lib/vocabulary/curated-vocab-images.js";
import { buildStableVocabImageUrl } from "../lib/vocabulary/stable-image-url.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FILE = path.join("docs", "Từ vựng tổng hợp chuẩn.txt");
const TOPIC = "Từ vựng Cơ Bản";
const VOCAB_SOURCE = "co_ban_txt";
const LEGACY_TOPICS = ["Từ vựng tổng hợp", TOPIC];
const EXPECTED_ROWS = 999;

function getConfig() {
  if (process.env.DATABASE_URL) {
    const parsed = new URL(process.env.DATABASE_URL);
    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ""),
    };
  }
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "english_app",
  };
}

function toDisplayWord(word) {
  const w = String(word || "").trim();
  if (!w) return w;
  return w
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeWordKey(word) {
  return String(word || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cleanWordToken(word) {
  return normalizeWordKey(word).replace(/[^a-z' -]/g, "").trim();
}

function normalizeIpa(ipa) {
  const raw = String(ipa || "").trim();
  if (!raw) return "";
  const inner = raw.replace(/^\/+|\/+$/g, "");
  return inner ? `/${inner}/` : "";
}

function fallbackImage(row) {
  return lookupCuratedImage(row) || buildStableVocabImageUrl(row);
}

function fallbackAudio(word) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(word)}`;
}

function buildQuestion(word) {
  return `What does "${word}" mean in Vietnamese?`;
}

function buildSentenceAudio(sentence) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(sentence)}`;
}

function buildSentenceIpa(sentence, ipaMap) {
  const tokens = String(sentence || "").match(/[A-Za-z']+|[^A-Za-z'\s]+/g) || [];
  const parts = tokens.map((token) => {
    if (!/^[A-Za-z']+$/.test(token)) return token;
    return ipaMap.get(token.toLowerCase()) || `/${token.toLowerCase()}/`;
  });
  return parts.join(" ").replace(/\s+([.,!?;:])/g, "$1");
}

function parseTableLine(line, lineNo) {
  const parts = line.split("|").map((s) => s.trim());
  if (parts.length < 4) return null;

  const [unitRaw, wordRaw, ipaRaw, viRaw] = parts;
  if (!/^\d+$/.test(unitRaw)) return null;

  const wordKey = cleanWordToken(wordRaw);
  if (!wordKey || wordKey.length < 2) return null;
  if (/^(từ vựng|---)$/i.test(wordKey)) return null;

  const unit = Number(unitRaw);
  const word = toDisplayWord(wordRaw);
  const ipa = normalizeIpa(ipaRaw);
  const vi = String(viRaw || "").trim();
  const base = {
    lineNo,
    unit,
    word,
    wordKey,
    ipa: ipa || `/${wordKey}/`,
    vietnamese_meaning: vi,
    part_of_speech: "other",
    question_text: buildQuestion(wordKey),
    topic: TOPIC,
  };
  const examples = buildBasicExample(base);

  return {
    ...base,
    ...examples,
  };
}

async function parseVocabularyFromFile() {
  const filePath = path.join(root, SOURCE_FILE);
  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const items = [];

  for (let i = 0; i < lines.length; i += 1) {
    const item = parseTableLine(lines[i], i + 1);
    if (item) items.push(item);
  }

  return items;
}

async function ensureSchema(db) {
  const alters = [
    ["question_text", "ALTER TABLE vocabulary ADD COLUMN question_text VARCHAR(255) NULL AFTER example_sentence"],
    ["topic", "ALTER TABLE vocabulary ADD COLUMN topic VARCHAR(120) NULL AFTER question_text"],
    ["vocab_source", "ALTER TABLE vocabulary ADD COLUMN vocab_source VARCHAR(32) NOT NULL DEFAULT 'beego' AFTER topic"],
    ["basic_unit", "ALTER TABLE vocabulary ADD COLUMN basic_unit INT NOT NULL DEFAULT 0 AFTER vocab_source"],
    ["example_audio_url", "ALTER TABLE vocabulary ADD COLUMN example_audio_url VARCHAR(500) NULL AFTER audio_url"],
    ["example_sentence_ipa", "ALTER TABLE vocabulary ADD COLUMN example_sentence_ipa VARCHAR(500) NULL AFTER example_sentence"],
    ["example_sentence_vi", "ALTER TABLE vocabulary ADD COLUMN example_sentence_vi VARCHAR(500) NULL AFTER example_sentence"],
    ["vietnamese_meaning", "ALTER TABLE vocabulary ADD COLUMN vietnamese_meaning VARCHAR(255) NULL AFTER ipa"],
    ["part_of_speech", "ALTER TABLE vocabulary ADD COLUMN part_of_speech VARCHAR(20) NULL AFTER vietnamese_meaning"],
  ];

  const [colRows] = await db.query("SHOW COLUMNS FROM vocabulary");
  const colSet = new Set(colRows.map((r) => String(r.Field || "")));

  for (const [name, sql] of alters) {
    if (colSet.has(name)) continue;
    try {
      await db.query(sql);
      colSet.add(name);
    } catch (e) {
      if (e?.code === "ER_DUP_FIELDNAME") colSet.add(name);
      else throw e;
    }
  }

  const [unitIndex] = await db.query(
    "SHOW INDEX FROM vocabulary WHERE Key_name = 'uq_vocabulary_word_level_source_unit'"
  );
  if (!unitIndex.length) {
    try {
      await db.query("ALTER TABLE vocabulary DROP INDEX uq_vocabulary_word_level_source");
    } catch {
      /* ignore */
    }
    try {
      await db.query("ALTER TABLE vocabulary DROP INDEX uq_vocabulary_word_level");
    } catch {
      /* ignore */
    }
    await db.query(
      "ALTER TABLE vocabulary ADD UNIQUE KEY uq_vocabulary_word_level_source_unit (word, level, vocab_source, basic_unit)"
    );
  }
}

async function main() {
  const db = await mysql.createConnection(getConfig());
  await ensureSchema(db);
  const items = await parseVocabularyFromFile();
  if (!items.length) throw new Error(`No vocabulary parsed from ${SOURCE_FILE}.`);
  if (items.length !== EXPECTED_ROWS) {
    console.warn(`Warning: expected ${EXPECTED_ROWS} rows, parsed ${items.length}`);
  }

  console.log(`Parsed ${items.length} words from ${SOURCE_FILE}`);

  const topicPlaceholders = LEGACY_TOPICS.map(() => "?").join(", ");
  await db.query(
    `UPDATE vocabulary SET topic = NULL
     WHERE vocab_source = 'beego'
       AND topic IN (${topicPlaceholders})
       AND level = 'beginner'`,
    LEGACY_TOPICS
  );

  await db.query("DELETE FROM vocabulary WHERE vocab_source = ? AND level = 'beginner'", [VOCAB_SOURCE]);

  const ipaMap = new Map();
  for (const item of items) {
    if (item.wordKey && item.ipa) ipaMap.set(item.wordKey, item.ipa);
  }

  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const ph = chunk
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'beginner', ?, ?)")
      .join(", ");
    const sql = `INSERT INTO vocabulary
      (word, ipa, vietnamese_meaning, part_of_speech, example_sentence, example_sentence_vi, example_sentence_ipa, question_text, topic, image_url, audio_url, example_audio_url, level, vocab_source, basic_unit)
      VALUES ${ph}`;

    const params = [];
    for (const item of chunk) {
      const word = item.wordKey;
      const sentence = item.example_sentence;
      params.push(
        item.word,
        item.ipa || `/${word}/`,
        item.vietnamese_meaning || "",
        item.part_of_speech || "other",
        sentence,
        item.example_sentence_vi || "",
        buildSentenceIpa(sentence, ipaMap),
        item.question_text || buildQuestion(word),
        TOPIC,
        fallbackImage({ word: item.word, wordKey, vietnamese_meaning: item.vietnamese_meaning, topic: TOPIC, id: item.lineNo }),
        fallbackAudio(word),
        buildSentenceAudio(sentence),
        VOCAB_SOURCE,
        item.unit
      );
    }

    await db.query(sql, params);
    inserted += chunk.length;
    console.log(`Inserted ${inserted}/${items.length}`);
  }

  const [rows] = await db.query(
    "SELECT COUNT(*) AS total FROM vocabulary WHERE vocab_source = ? AND level = 'beginner'",
    [VOCAB_SOURCE]
  );
  const [sample] = await db.query(
    `SELECT word, example_sentence, example_sentence_vi, basic_unit
     FROM vocabulary WHERE vocab_source = ? AND word IN ('Apple', 'Because', 'Please', 'Have')
     ORDER BY word, basic_unit`,
    [VOCAB_SOURCE]
  );
  console.table(sample);
  console.log(`Done. "${TOPIC}": ${rows[0]?.total || 0} từ (file chuẩn 999).`);
  await db.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
