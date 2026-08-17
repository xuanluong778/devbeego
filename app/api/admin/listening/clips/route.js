import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { clipInputToDbFields, rowToListeningClip } from "@/lib/listening/clip-mapper";
import { ensureListeningSchema, seedDefaultListeningClips, seedHeadwayListeningClips } from "@/lib/listening/ensure-schema";
import { HEADWAY_LISTENING_CLIPS } from "@/lib/listening/headway-clips";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const admin = await requireAdminUser(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    await ensureListeningSchema();
    const [rows] = await pool.query(
      `SELECT * FROM listening_clips
       ORDER BY CASE WHEN slug LIKE 'headway-%' THEN 0 ELSE 1 END, sort_order ASC, id ASC`
    );
    return NextResponse.json({
      success: true,
      data: rows.map(rowToListeningClip),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load clips." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await requireAdminUser(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    await ensureListeningSchema();
    const body = await request.json();
    const action = String(body.action || "create").trim();

    if (action === "seed") {
      await seedDefaultListeningClips();
      return NextResponse.json({ success: true, message: "Đã nạp bài mẫu." });
    }

    if (action === "seed_headway") {
      await seedHeadwayListeningClips();
      return NextResponse.json({ success: true, message: `Đã nạp ${HEADWAY_LISTENING_CLIPS.length} bài Headway Elementary.` });
    }

    const fields = clipInputToDbFields(body);
    if (!fields.slug || !fields.title || !fields.question_text) {
      return NextResponse.json(
        { success: false, message: "slug, title và question_text là bắt buộc." },
        { status: 400 }
      );
    }
    if (!fields.option_a || !fields.option_b) {
      return NextResponse.json(
        { success: false, message: "Cần ít nhất 2 đáp án (option_a, option_b)." },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO listening_clips
        (slug, title, level, audio_url, tts_text, vocabulary_id, keywords_json, question_text,
         option_a, option_b, option_c, option_d, correct_option, explanation,
         transcript, transcript_vi, sort_order, is_published)
       VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        fields.slug,
        fields.title,
        fields.level,
        fields.tts_text,
        fields.vocabulary_id,
        fields.keywords_json,
        fields.question_text,
        fields.option_a,
        fields.option_b,
        fields.option_c,
        fields.option_d,
        fields.correct_option,
        fields.explanation,
        fields.transcript,
        fields.transcript_vi,
        fields.sort_order,
        fields.is_published,
      ]
    );

    const [rows] = await pool.query(`SELECT * FROM listening_clips WHERE id = ? LIMIT 1`, [
      result.insertId,
    ]);
    return NextResponse.json({ success: true, data: rowToListeningClip(rows[0]) });
  } catch (error) {
    const code = error?.code;
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ success: false, message: "Slug đã tồn tại." }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to create clip." },
      { status: 500 }
    );
  }
}
