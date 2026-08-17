import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { isDbConnectionError } from "@/lib/db-errors";
import { ALL_LISTENING_CLIPS } from "@/lib/listening/session-catalog";
import { rowToListeningClip } from "@/lib/listening/clip-mapper";
import { ensureListeningSchema } from "@/lib/listening/ensure-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureListeningSchema();
    const [rows] = await pool.query(
      `SELECT * FROM listening_clips WHERE is_published = 1
       ORDER BY CASE WHEN slug LIKE 'headway-%' THEN 0 ELSE 1 END, sort_order ASC, id ASC`
    );
    const clips = rows.map(rowToListeningClip).filter(Boolean);
    return NextResponse.json({ success: true, data: clips, source: "database" });
  } catch (error) {
    console.error("[api/listening/clips] GET", error?.message || error);
    if (isDbConnectionError(error)) {
      return NextResponse.json({
        success: true,
        data: ALL_LISTENING_CLIPS,
        source: "catalog",
        degraded: true,
      });
    }
    return NextResponse.json(
      { success: false, message: "Không tải được bài luyện nghe." },
      { status: 500 }
    );
  }
}
