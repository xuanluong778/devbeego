import { NextResponse } from "next/server";
import pool from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import fallbackWords from "@/data/basic-1000-words.json";
import { decodeVietnameseBuffer } from "@/lib/decode-vietnamese";
import { requireSystemOwner } from "@/lib/admin/require-admin";

export const runtime = "nodejs";

function toTitleCase(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

import { buildStableVocabImageUrl } from "@/lib/vocabulary/stable-image-url";

function fallbackImage(word) {
  return buildStableVocabImageUrl({ word });
}

function fallbackAudio(word) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(
    word
  )}`;
}

function buildSentence(word) {
  return `I learn the word "${word}" today.`;
}

function buildSentenceVi(word, meaning) {
  if (meaning) {
    return `Hôm nay em học từ "${word}", nghĩa là "${meaning}".`;
  }
  return `Hôm nay em học từ "${word}".`;
}

function buildQuestion(word) {
  return `What does "${word}" mean in Vietnamese?`;
}

function mapPos(rawPos) {
  const pos = String(rawPos || "").toLowerCase();
  if (pos === "n" || pos === "pl") return "noun";
  if (pos === "v") return "verb";
  if (pos === "adj") return "adjective";
  return "other";
}

function buildSentenceAudio(sentence) {
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(
    sentence
  )}`;
}

function buildSentenceIpa(sentence, ipaMap) {
  const tokens = String(sentence || "").match(/[A-Za-z']+|[^A-Za-z'\s]+/g) || [];
  const parts = tokens.map((token) => {
    if (!/^[A-Za-z']+$/.test(token)) {
      return token;
    }
    const normalized = token.toLowerCase();
    return ipaMap.get(normalized) || `/${normalized}/`;
  });
  return parts.join(" ").replace(/\s+([.,!?;:])/g, "$1");
}

async function requireAuthenticatedUser(request) {
  const token = request.cookies.get("session_token")?.value;
  if (!token) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email
     FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

async function parseVocabularyFromFile(limit = 1000) {
  const filePath = path.join(process.cwd(), "1000_tu_vung_co_ban.txt");
  const rawBuffer = await fs.readFile(filePath);
  const content = decodeVietnameseBuffer(rawBuffer);
  const lines = content.split(/\r?\n/);

  const items = [];
  let current = null;
  let currentTopic = "General";

  const numberedLineRegex = /^\s*(\d+)\.\s+(.+?)\s*-\s*(.*)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const numbered = line.match(numberedLineRegex);
    if (numbered) {
      if (current) {
        items.push(current);
      }
      const headPart = numbered[2].trim();
      const posMatch = headPart.match(/\b(n|v|adj|adv|prep|pron|conj|int|aux|det|pl)\b/i);
      const ipaMatch = headPart.match(/\[(.*?)\]/);
      const ipa = ipaMatch?.[1]?.trim() || "";

      const withoutIpa = headPart.replace(/\[(.*?)\]/g, " ").replace(/\s+/g, " ").trim();
      const cleanedWord = withoutIpa
        .replace(/\s+(n|v|adj|adv|prep|pron|conj|int|aux|det|pl)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const word = cleanedWord.replace(/[^a-z' -]/g, "").trim();
      if (!word) {
        current = null;
        continue;
      }

      current = {
        word: toTitleCase(word),
        ipa: ipa || `/${word}/`,
        example_sentence: buildSentence(word),
        example_sentence_vi: buildSentenceVi(word, numbered[3]?.trim() || ""),
        question_text: buildQuestion(word),
        vietnamese_meaning: numbered[3]?.trim() || "",
        part_of_speech: mapPos(posMatch?.[1]),
        topic: currentTopic,
      };
      continue;
    }

    const topicMatch = line.match(/^CHỦ ĐỀ\s+\d+:\s*(.+?)(?:\(|$)/i);
    if (topicMatch) {
      const topic = topicMatch[1].trim();
      if (topic) {
        if (current) {
          items.push(current);
          current = null;
        }
        currentTopic = topic;
      }
      continue;
    }

    if (current && line.startsWith("→")) {
      const englishExample = line
        .replace(/^→\s*/, "")
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim();
      if (englishExample) {
        current.example_sentence = englishExample;
      }
    }

  }

  if (current) {
    items.push(current);
  }

  const deduped = [];
  const seen = new Set();

  for (const item of items) {
    const key = item.word.toLowerCase();
    if (!seen.has(key)) {
      deduped.push(item);
      seen.add(key);
    }
    if (deduped.length >= limit) {
      break;
    }
  }

  if (deduped.length < limit) {
    for (const extraRaw of fallbackWords) {
      const extra = String(extraRaw || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z' -]/g, "");
      if (!extra) {
        continue;
      }
      const key = extra;
      if (seen.has(key)) {
        continue;
      }
      deduped.push({
        word: toTitleCase(extra),
        ipa: `/${extra}/`,
        example_sentence: buildSentence(extra),
        example_sentence_vi: buildSentenceVi(extra, ""),
        question_text: buildQuestion(extra),
        vietnamese_meaning: "",
        part_of_speech: "other",
        topic: "General",
      });
      seen.add(key);
      if (deduped.length >= limit) {
        break;
      }
    }
  }

  return deduped;
}

function buildChunkInsertQuery(chunkSize) {
  const placeholders = Array(chunkSize)
    .fill("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'beginner')")
    .join(", ");
  return `
    INSERT INTO vocabulary
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
      updated_at = CURRENT_TIMESTAMP
  `;
}

async function runImport(onProgress) {
  const items = await parseVocabularyFromFile(1000);
  if (items.length === 0) {
    throw new Error("Word source is empty.");
  }

  const batchSize = 200;
  let processed = 0;

  await pool.query(
    "ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS question_text VARCHAR(255) NULL AFTER example_sentence"
  );
  await pool.query(
    "ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS topic VARCHAR(120) NULL AFTER question_text"
  );
  await pool.query(
    "ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS example_audio_url VARCHAR(500) NULL AFTER audio_url"
  );
  await pool.query(
    "ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS example_sentence_ipa VARCHAR(500) NULL AFTER example_sentence"
  );
  await pool.query(
    "ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS example_sentence_vi VARCHAR(500) NULL AFTER example_sentence"
  );
  await pool.query(
    "ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS vietnamese_meaning VARCHAR(255) NULL AFTER ipa"
  );
  await pool.query(
    "ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS part_of_speech VARCHAR(20) NULL AFTER vietnamese_meaning"
  );
  await pool.query("DELETE FROM vocabulary WHERE level = 'beginner'");

  const ipaMap = new Map();
  items.forEach((item) => {
    const key = String(item.word || "").toLowerCase().trim();
    if (key && item.ipa) {
      ipaMap.set(key, item.ipa);
    }
  });

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const params = [];

    chunk.forEach((item) => {
      const word = item.word.toLowerCase();
      params.push(
        item.word,
        item.ipa || `/${word}/`,
        item.vietnamese_meaning || "",
        item.part_of_speech || "other",
        item.example_sentence || buildSentence(word),
        item.example_sentence_vi || buildSentenceVi(word, item.vietnamese_meaning || ""),
        buildSentenceIpa(item.example_sentence || buildSentence(word), ipaMap),
        item.question_text || buildQuestion(word),
        item.topic || "General",
        fallbackImage(word),
        fallbackAudio(word),
        buildSentenceAudio(item.example_sentence || buildSentence(word))
      );
    });

    const query = buildChunkInsertQuery(chunk.length);
    await pool.query(query, params);
    processed += chunk.length;

    if (onProgress) {
      const percent = Math.round((processed / items.length) * 100);
      onProgress({ type: "progress", processed, total: items.length, percent });
    }
  }

  return { imported_count: processed };
}

export async function POST(request) {
  try {
    const user = await requireSystemOwner(request);
    if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access only." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const streamMode = searchParams.get("stream") === "1";

    if (streamMode) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          (async () => {
            try {
              controller.enqueue(encoder.encode(`${JSON.stringify({ type: "start", percent: 0 })}\n`));
              const result = await runImport((payload) => {
                controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
              });
              controller.enqueue(
                encoder.encode(
                  `${JSON.stringify({
                    type: "done",
                    success: true,
                    imported_count: result.imported_count,
                    percent: 100,
                  })}\n`
                )
              );
              controller.close();
            } catch (error) {
              controller.enqueue(
                encoder.encode(
                  `${JSON.stringify({
                    type: "error",
                    message:
                      process.env.NODE_ENV === "production"
                        ? "Import failed. Please try again."
                        : `Import failed: ${error.message}`,
                  })}\n`
                )
              );
              controller.close();
            }
          })();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const result = await runImport();

    return NextResponse.json({
      success: true,
      message: "Import completed successfully.",
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          process.env.NODE_ENV === "production"
            ? "Import failed. Please try again."
            : `Import failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}
