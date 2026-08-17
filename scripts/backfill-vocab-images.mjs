/**
 * Backfill ảnh từ vựng qua image-resolver (ARASAAC/OpenMoji/Unsplash curated).
 * Chạy: node --env-file=.env.local scripts/backfill-vocab-images.mjs
 *       node --env-file=.env.local scripts/backfill-vocab-images.mjs --source=co_ban_txt --force
 */
import mysql from "mysql2/promise";
import { isPlaceholderImageUrl } from "../lib/vocabulary/placeholder-image.js";
import { buildVocabularyImageMetadata } from "../lib/vocabulary/image-prompt.js";

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

async function columnExists(db, name) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vocabulary' AND COLUMN_NAME = ?`,
    [name]
  );
  return Number(rows[0]?.c || 0) > 0;
}

async function main() {
  const sourceArg = process.argv.find((a) => a.startsWith("--source="));
  const sourceFilter = sourceArg ? sourceArg.split("=")[1] : "";
  const force = process.argv.includes("--force");

  const db = await mysql.createConnection(getConfig());
  const hasImageSource = await columnExists(db, "image_source");

  const where = ["word IS NOT NULL", "TRIM(word) <> ''"];
  const params = [];
  if (sourceFilter) {
    where.push("vocab_source = ?");
    params.push(sourceFilter);
  }

  const [rows] = await db.query(
    `SELECT id, word, vietnamese_meaning, part_of_speech, topic, example_sentence, example_sentence_vi,
            level, image_url, image_style, image_status, vocab_source, basic_unit
     FROM vocabulary
     WHERE ${where.join(" AND ")}
     ORDER BY id ASC`,
    params
  );

  let updated = 0;
  let skipped = 0;
  const sourceCounts = {};

  for (const row of rows) {
    const current = String(row.image_url || "").trim();
    const currentStatus = String(row.image_status || "").toLowerCase();
    if (!force && current && !isPlaceholderImageUrl(current) && currentStatus === "approved") {
      skipped += 1;
      continue;
    }

    const inputRow = force ? { ...row, image_status: "pending", image_url: "" } : row;
    const meta = buildVocabularyImageMetadata(inputRow);
    const imageStatus =
      meta.image_url && ["arasaac", "openmoji", "curated_unsplash"].includes(meta.image_source)
        ? "approved"
        : meta.image_status;

    const sets = [
      "image_url = ?",
      "semantic_hint = ?",
      "image_prompt = ?",
      "image_style = ?",
      "image_status = ?",
    ];
    const values = [
      meta.image_url,
      meta.semantic_hint,
      meta.image_prompt,
      meta.image_style,
      imageStatus,
    ];

    if (hasImageSource) {
      sets.push("image_source = ?");
      values.push(meta.image_source);
    }

    values.push(row.id);
    await db.query(`UPDATE vocabulary SET ${sets.join(", ")} WHERE id = ?`, values);

    sourceCounts[meta.image_source] = (sourceCounts[meta.image_source] || 0) + 1;
    updated += 1;

    if (updated % 100 === 0) {
      console.log(`Updated ${updated}/${rows.length}…`);
    }
  }

  console.log(`Done. Updated ${updated}, skipped ${skipped} (already approved).`);
  console.log("Sources:", sourceCounts);
  await db.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
