import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdminUser } from "@/lib/admin/require-admin";

async function ensureChatLogTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS lesson_chat_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      source VARCHAR(20) NOT NULL DEFAULT 'text',
      message TEXT NOT NULL,
      ai_reply TEXT NOT NULL,
      spoken_text TEXT NULL,
      pronunciation_score INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_created (user_id, created_at),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

export async function GET(request) {
  try {
    const currentUser = await requireAdminUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access only." },
        { status: 403 }
      );
    }

    await ensureChatLogTable();
    const { searchParams } = new URL(request.url);
    const userId = Number(searchParams.get("user_id") || 0);
    if (!userId) {
      return NextResponse.json({ success: false, message: "user_id is required." }, { status: 400 });
    }

    const [dailyRows] = await pool.query(
      `SELECT
         DATE(created_at) AS date_key,
         COUNT(*) AS total_messages,
         SUM(CASE WHEN source = 'voice' THEN 1 ELSE 0 END) AS voice_messages,
         ROUND(AVG(CASE WHEN pronunciation_score IS NOT NULL THEN pronunciation_score END), 0) AS avg_pronunciation
       FROM lesson_chat_logs
       WHERE user_id = ?
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at) DESC
       LIMIT 30`,
      [userId]
    );

    const [recentRows] = await pool.query(
      `SELECT id, source, message, ai_reply, spoken_text, pronunciation_score, created_at
       FROM lesson_chat_logs
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      data: {
        daily: dailyRows,
        recent: recentRows,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch student progress." },
      { status: 500 }
    );
  }
}
