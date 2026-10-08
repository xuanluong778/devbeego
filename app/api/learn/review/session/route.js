import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { buildPersonalizedReviewSession } from "@/lib/beego/learn/personalized-review-engine";
import { getLessonContentById, toPlayerLessonPayload } from "@/lib/beego/learn/get-lesson-content";
import { sanitizeLessonForClient } from "@/lib/beego/learn/sanitize-lesson-for-client";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lessonId = String(searchParams.get("lessonId") || searchParams.get("lesson_id") || "").trim();
    if (!lessonId) {
      return NextResponse.json({ success: false, message: "lessonId required." }, { status: 400 });
    }

    const base = getLessonContentById(lessonId);
    if (!base) {
      return NextResponse.json({ success: false, message: "Lesson not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    if (base.type !== "review") {
      return NextResponse.json({ success: false, message: "Lesson is not a review node.", code: "NOT_REVIEW" }, { status: 400 });
    }

    const session = await buildPersonalizedReviewSession(user.id, lessonId);
    const payload = sanitizeLessonForClient(
      toPlayerLessonPayload({
        ...base,
        questions: session.questions?.length ? session.questions : base.questions,
        contentSource:
          session.mode === "personalized"
            ? "personalized_review"
            : session.mode === "gate_curriculum"
              ? "review_gate_curriculum"
              : "review_fallback",
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        session: {
          mode: session.mode,
          sessionId: session.sessionId,
          questionCount: session.questions?.length || 0,
        },
        lesson: payload,
      },
    });
  } catch (error) {
    if (error?.code === "NOT_REVIEW") {
      return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: 400 });
    }
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to build review session.${detail}`.trim() },
      { status: 500 }
    );
  }
}
