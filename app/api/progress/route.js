import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const [rows] = await pool.query(
      `SELECT
         p.lesson_id,
         COALESCE(NULLIF(l.word, ''), l.title) AS word,
         p.score,
         p.attempts,
         p.completed_at
       FROM progress p
       INNER JOIN lessons l ON l.id = p.lesson_id
       WHERE p.user_id = ?
       ORDER BY p.updated_at DESC`,
      [user.id]
    );

    const totalLessons = rows.length;
    const completedLessons = rows.filter((item) => item.completed_at !== null).length;
    const averageScore =
      totalLessons === 0
        ? 0
        : Math.round(rows.reduce((sum, item) => sum + Number(item.score || 0), 0) / totalLessons);

    return NextResponse.json({
      success: true,
      data: {
        completed_lessons: completedLessons,
        total_lessons: totalLessons,
        average_score: averageScore,
        lessons: rows,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch progress.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }
    const rl = await checkRateLimit(request, { key: "progress_post", windowMs: 60_000, max: 60 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const lessonId = Number(body.lesson_id);
    const score = Number(body.score);

    const isLessonIdValid = Number.isInteger(lessonId) && lessonId > 0;
    const isScoreValid = Number.isFinite(score) && score >= 0 && score <= 100;

    if (!isLessonIdValid || !isScoreValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid lesson_id and score (0-100) are required.",
        },
        { status: 400 }
      );
    }

    const userId = user.id;

    const [result] = await pool.query(
      `INSERT INTO progress (user_id, lesson_id, score, attempts, completed_at)
       VALUES (?, ?, ?, 1, IF(? >= 70, NOW(), NULL))
       ON DUPLICATE KEY UPDATE
         score = VALUES(score),
         attempts = attempts + 1,
         completed_at = IF(VALUES(score) >= 70, NOW(), completed_at),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, lessonId, score, score]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Progress saved successfully.",
        data: {
          user_id: userId,
          lesson_id: lessonId,
          score,
          affected_rows: result.affectedRows,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to save progress.",
      },
      { status: 500 }
    );
  }
}
