import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureUserWordProgressTable } from "@/lib/srs/ensure-schema";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";

export const dynamic = "force-dynamic";

/** Add a vocabulary word to the user's SRS review queue. */
export async function POST(request) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const wordId = Number(body?.word_id);
    if (!Number.isFinite(wordId) || wordId <= 0) {
      return NextResponse.json({ success: false, message: "word_id is required." }, { status: 400 });
    }

    await ensureUserWordProgressTable();

    const [exists] = await pool.query(`SELECT id FROM vocabulary WHERE id = ? LIMIT 1`, [wordId]);
    if (!exists?.[0]) {
      return NextResponse.json({ success: false, message: "Word not found." }, { status: 404 });
    }

    await pool.query(
      `INSERT INTO user_word_progress
        (user_id, word_id, mastery_level, next_review_at, correct_streak, wrong_count, status)
       VALUES (?, ?, 0, NOW(), 0, 0, 'learning')
       ON DUPLICATE KEY UPDATE
        status = IF(status = 'new' OR status IS NULL, 'learning', status),
        next_review_at = IF(next_review_at IS NULL, NOW(), next_review_at),
        updated_at = CURRENT_TIMESTAMP`,
      [userId, wordId]
    );

    return NextResponse.json({ success: true, data: { word_id: wordId, queued: true } });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to enqueue review.${detail}`.trim() },
      { status: 500 }
    );
  }
}
