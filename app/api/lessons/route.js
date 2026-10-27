import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { isDbConnectionError } from "@/lib/db-errors";
import { normalizeMediaUrl } from "@/lib/media-url";
import { requireSystemOwner } from "@/lib/admin/require-admin";

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         word,
         image,
         audio,
         created_at,
         updated_at
       FROM lessons
       ORDER BY id ASC`
    );

    const normalizedRows = rows.map((lesson) => ({
      ...lesson,
      image: normalizeMediaUrl(lesson.image),
      audio: normalizeMediaUrl(lesson.audio),
    }));

    return NextResponse.json({
      success: true,
      data: normalizedRows,
    });
  } catch (error) {
    console.error("[api/lessons] GET failed", error?.message || error);

    if (isDbConnectionError(error)) {
      return NextResponse.json({
        success: true,
        data: [],
        degraded: true,
        message: "Database is offline — showing built-in lesson content.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch lessons.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await requireSystemOwner(request);
    if (admin instanceof NextResponse) return admin;
    if (!admin) {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const word = typeof body.word === "string" ? body.word.trim() : "";
    const image = normalizeMediaUrl(body.image);
    const audio = normalizeMediaUrl(body.audio);

    if (!word || !image || !audio) {
      return NextResponse.json(
        {
          success: false,
          message: "word, image, and audio are required.",
        },
        { status: 400 }
      );
    }

    const [result] = await pool.query(
      `INSERT INTO lessons (word, image, audio)
       VALUES (?, ?, ?)`,
      [word, image, audio]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Lesson created successfully.",
        data: {
          id: result.insertId,
          word,
          image,
          audio,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/lessons] POST failed", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create lesson.",
      },
      { status: 500 }
    );
  }
}
