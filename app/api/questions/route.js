import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lessonIdParam = searchParams.get("lesson_id");
    const lessonId = Number(lessonIdParam);

    if (!lessonIdParam || !Number.isInteger(lessonId) || lessonId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid lesson_id query parameter is required.",
        },
        { status: 400 }
      );
    }

    const [rows] = await pool.query(
      `SELECT
        id,
        lesson_id,
        question_text,
        question_type,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation
       FROM questions
       WHERE lesson_id = ?
       ORDER BY id ASC`,
      [lessonId]
    );

    const isAdmin = user.role === "admin";
    const data = isAdmin
      ? rows
      : rows.map(({ correct_option, explanation, ...rest }) => ({
          ...rest,
          explanation: explanation || null,
        }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch questions.",
      },
      { status: 500 }
    );
  }
}
