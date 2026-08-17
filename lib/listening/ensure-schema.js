import pool from "@/lib/db";
import { LISTENING_CLIPS, ALL_LISTENING_CLIPS } from "@/lib/listening/session-catalog";
import { HEADWAY_LISTENING_CLIPS } from "@/lib/listening/headway-clips";

export { ALL_LISTENING_CLIPS };

let ensured = false;

export async function ensureListeningSchema() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS listening_clips (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(80) NOT NULL,
      title VARCHAR(200) NOT NULL,
      level VARCHAR(16) NOT NULL DEFAULT 'A2',
      audio_url VARCHAR(500) NOT NULL DEFAULT '',
      tts_text TEXT NULL,
      vocabulary_id INT UNSIGNED NULL,
      keywords_json JSON NULL,
      question_text TEXT NOT NULL,
      option_a VARCHAR(500) NOT NULL DEFAULT '',
      option_b VARCHAR(500) NOT NULL DEFAULT '',
      option_c VARCHAR(500) NOT NULL DEFAULT '',
      option_d VARCHAR(500) NOT NULL DEFAULT '',
      correct_option TINYINT UNSIGNED NOT NULL DEFAULT 0,
      explanation TEXT NULL,
      transcript TEXT NULL,
      transcript_vi TEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_listening_clips_slug (slug),
      KEY idx_listening_published_sort (is_published, sort_order, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [countRows] = await pool.query(`SELECT COUNT(*) AS n FROM listening_clips`);
  const count = Number(countRows[0]?.n || 0);
  if (count === 0) {
    await seedHeadwayListeningClips();
    await seedDefaultListeningClips();
  } else {
    await ensureHeadwayClipsSeeded();
    await repositionDemoClips();
  }
  ensured = true;
}

export async function seedClipList(clips, startOrder = 0) {
  let order = startOrder;
  for (const clip of clips) {
    const opts = clip.question?.options || [];
    await pool.query(
      `INSERT INTO listening_clips
        (slug, title, level, audio_url, tts_text, keywords_json, question_text,
         option_a, option_b, option_c, option_d, correct_option, explanation,
         transcript, transcript_vi, sort_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         level = VALUES(level),
         tts_text = VALUES(tts_text),
         keywords_json = VALUES(keywords_json),
         question_text = VALUES(question_text),
         option_a = VALUES(option_a),
         option_b = VALUES(option_b),
         option_c = VALUES(option_c),
         option_d = VALUES(option_d),
         correct_option = VALUES(correct_option),
         explanation = VALUES(explanation),
         transcript = VALUES(transcript),
         transcript_vi = VALUES(transcript_vi),
         sort_order = VALUES(sort_order),
         is_published = 1`,
      [
        clip.id,
        clip.title,
        clip.level || "A2",
        clip.audioUrl || "",
        clip.ttsText || "",
        JSON.stringify(clip.keywords || []),
        clip.question?.text || "",
        opts[0] || "",
        opts[1] || "",
        opts[2] || "",
        opts[3] || "",
        Number(clip.question?.correctIndex) || 0,
        clip.question?.explanation || "",
        clip.transcript || "",
        clip.transcriptVi || "",
        order,
      ]
    );
    order += 1;
  }
}

export async function seedDefaultListeningClips() {
  const start = HEADWAY_LISTENING_CLIPS.length;
  await seedClipList(LISTENING_CLIPS, start);
}

export async function repositionDemoClips() {
  const start = HEADWAY_LISTENING_CLIPS.length;
  let order = start;
  for (const clip of LISTENING_CLIPS) {
    await pool.query(`UPDATE listening_clips SET sort_order = ? WHERE slug = ?`, [order, clip.id]);
    order += 1;
  }
}

export async function seedHeadwayListeningClips() {
  await pool.query(`DELETE FROM listening_clips WHERE slug LIKE 'headway-%'`);
  await seedClipList(HEADWAY_LISTENING_CLIPS, 0);
  await repositionDemoClips();
}

export async function ensureHeadwayClipsSeeded() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM listening_clips WHERE slug LIKE 'headway-%'`
  );
  const count = Number(rows[0]?.n || 0);
  const expected = HEADWAY_LISTENING_CLIPS.length;
  if (count !== expected) {
    await seedHeadwayListeningClips();
  } else {
    await repositionDemoClips();
  }
}
