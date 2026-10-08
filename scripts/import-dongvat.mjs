import fs from "fs/promises";
import path from "path";
import mysql from "mysql2/promise";

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

function extractWord(raw) {
  const cleaned = String(raw || "").replace(/^[\-\•\*\d\.\)\s]+/, "").trim();
  const match = cleaned.match(/^[A-Za-z][A-Za-z\s'()\-]*/);
  const word = (match?.[0] || "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return word;
}

function parseLine(line) {
  const raw = line.trim();
  if (!raw) return null;
  if (/^từ vựng/i.test(raw) || /^\d+(\.\d+)+/.test(raw)) return null;
  if (!/[A-Za-z]/.test(raw)) return null;

  let word = "";
  let ipa = "";
  let meaning = "";

  const ipaMatch = raw.match(/^(.+?)\s*\/([^/]+)\/\s*[:\-]?\s*(.+)$/);
  if (ipaMatch) {
    word = extractWord(ipaMatch[1]);
    ipa = `/${ipaMatch[2].trim()}/`;
    meaning = ipaMatch[3].trim();
  } else {
    const colon = raw.match(/^(.+?)\s*[:\-]\s*(.+)$/);
    if (!colon) return null;
    word = extractWord(colon[1]);
    meaning = colon[2].trim();
  }

  meaning = meaning.replace(/^-+\s*/, "").trim();
  if (!word || !meaning) return null;
  if (word.length < 2) return null;

  const lower = word.toLowerCase();
  const article = /^[aeiou]/.test(lower) ? "an" : "a";
  const sentence = `I can see ${article} ${lower}.`;
  const sentenceVi = `Em có thể nhìn thấy ${meaning}.`;

  return {
    word: word
      .split(" ")
      .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p))
      .join(" "),
    ipa: ipa || `/${lower}/`,
    vietnamese_meaning: meaning,
    part_of_speech: "noun",
    example_sentence: sentence,
    example_sentence_vi: sentenceVi,
    question_text: `What is the Vietnamese meaning of "${lower}"?`,
    topic: "Động vật",
    level: "beginner",
  };
}

function fallbackImage(word) {
  const seed = encodeURIComponent(String(word).toLowerCase());
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

function fallbackAudio(text) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(
    text
  )}`;
}

async function main() {
  const filePath = path.join(process.cwd(), "dongvat.txt");
  const raw = await fs.readFile(filePath);
  const content = raw.toString("utf8");
  const lines = content.split(/\r?\n/);

  const dedupMap = new Map();
  for (const line of lines) {
    const item = parseLine(line);
    if (!item) continue;
    dedupMap.set(item.word.toLowerCase(), item);
  }

  const items = [...dedupMap.values()];
  if (!items.length) {
    throw new Error("No valid vocabulary entries parsed from dongvat.txt");
  }

  const db = await mysql.createConnection(getConfig());
  const alters = [
    "ALTER TABLE vocabulary ADD COLUMN question_text VARCHAR(255) NULL AFTER example_sentence",
    "ALTER TABLE vocabulary ADD COLUMN topic VARCHAR(120) NULL AFTER question_text",
    "ALTER TABLE vocabulary ADD COLUMN example_audio_url VARCHAR(500) NULL AFTER audio_url",
    "ALTER TABLE vocabulary ADD COLUMN example_sentence_ipa VARCHAR(500) NULL AFTER example_sentence",
    "ALTER TABLE vocabulary ADD COLUMN example_sentence_vi VARCHAR(500) NULL AFTER example_sentence",
    "ALTER TABLE vocabulary ADD COLUMN vietnamese_meaning VARCHAR(255) NULL AFTER ipa",
    "ALTER TABLE vocabulary ADD COLUMN part_of_speech VARCHAR(20) NULL AFTER vietnamese_meaning",
  ];
  for (const sql of alters) {
    try {
      await db.query(sql);
    } catch {
      /* column may already exist */
    }
  }

  const batchSize = 200;
  let imported = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
    const sql = `INSERT INTO vocabulary
      (word, ipa, vietnamese_meaning, part_of_speech, example_sentence, example_sentence_vi, example_sentence_ipa, question_text, topic, image_url, audio_url, example_audio_url, level)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE
      ipa = VALUES(ipa),
      vietnamese_meaning = VALUES(vietnamese_meaning),
      part_of_speech = VALUES(part_of_speech),
      example_sentence = VALUES(example_sentence),
      example_sentence_vi = VALUES(example_sentence_vi),
      example_sentence_ipa = VALUES(example_sentence_ipa),
      question_text = VALUES(question_text),
      topic = VALUES(topic),
      image_url = VALUES(image_url),
      audio_url = VALUES(audio_url),
      example_audio_url = VALUES(example_audio_url),
      level = VALUES(level),
      updated_at = CURRENT_TIMESTAMP`;

    const params = [];
    for (const item of chunk) {
      params.push(
        item.word,
        item.ipa,
        item.vietnamese_meaning,
        item.part_of_speech,
        item.example_sentence,
        item.example_sentence_vi,
        "",
        item.question_text,
        item.topic,
        fallbackImage(item.word),
        fallbackAudio(item.word),
        fallbackAudio(item.example_sentence),
        item.level
      );
    }
    await db.query(sql, params);
    imported += chunk.length;
  }

  const [countRows] = await db.query(
    "SELECT COUNT(*) AS total_animals FROM vocabulary WHERE level='beginner' AND topic = 'Động vật'"
  );
  console.log(`Imported/updated: ${imported} animal words.`);
  console.log(`Total animal-topic words in DB: ${countRows[0]?.total_animals || 0}`);
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
