import { NextResponse } from "next/server";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { buildPersonalizedReviewSession } from "@/lib/beego/learn/personalized-review-engine";
import { buildLessonMixFromContent } from "@/lib/beego/learn/lesson-mix-engine";
import { getOrCreateLessonMixSession } from "@/lib/beego/learn/lesson-mix-session-store";
import { sanitizeLessonForClient } from "@/lib/beego/learn/sanitize-lesson-for-client";
import { listLessonAttemptRows } from "@/lib/beego/learn/mastery-mistake-engine";
import { resumeStartIndex } from "@/lib/beego/learn/lesson-resume";
import { isCurriculum50LessonId } from "@/lib/beego/learn/curriculum-50/constants";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const lessonId = String(params?.lessonId || "").trim();
    if (!lessonId) {
      return NextResponse.json({ success: false, message: "lessonId required." }, { status: 400 });
    }

    const content = getLessonContentById(lessonId);
    if (!content) {
      return NextResponse.json({ success: false, message: "Lesson not found.", code: "NOT_FOUND" }, { status: 404 });
    }

    let data = content;
    const user = await getSessionUserFromRequest(request);
    // Curriculum-50 ships full 11-part banks — do not subsample via adaptive mix / personalized review.
    const keepFullCurriculumBank =
      isCurriculum50LessonId(lessonId) || content.contentSource === "curriculum-50";

    if (!keepFullCurriculumBank && user?.id && content.type === "review") {
      try {
        const session = await buildPersonalizedReviewSession(user.id, lessonId);
        if (session.questions?.length >= 1) {
          data = {
            ...content,
            questions: session.questions,
            contentSource:
              session.mode === "personalized"
                ? "personalized_review"
                : session.mode === "gate_curriculum"
                  ? "review_gate_curriculum"
                  : content.contentSource,
            reviewSession: {
              mode: session.mode,
              sessionId: session.sessionId,
            },
          };
        }
      } catch {
        /* keep catalog fallback */
      }
    } else if (!keepFullCurriculumBank && content.type !== "review") {
      try {
        if (user?.id) {
          const mix = await getOrCreateLessonMixSession(user.id, data);
          if (mix.questions?.length) {
            data = {
              ...data,
              questions: mix.questions,
              contentSource: content.contentSource || data.contentSource,
              lessonMix: {
                mixId: mix.mixId,
                mixFingerprint: mix.mixFingerprint,
                cached: mix.cached,
                delivery: mix.cached ? "adaptive_lesson_mix_cached" : "adaptive_lesson_mix",
                ...(mix.mixMeta || {}),
              },
            };
          }
        } else {
          const std = buildLessonMixFromContent(data, {});
          if (std.questions?.length) {
            data = {
              ...data,
              questions: std.questions,
              contentSource: content.contentSource || data.contentSource,
              lessonMix: {
                ...std.mixMeta,
                delivery: "lesson_mix_standard",
              },
            };
          }
        }
      } catch {
        /* catalog questions unchanged */
      }
    }

    if (user?.id && data.type !== "review") {
      try {
        const contentRevision = (data.questions || []).find((question) => question?.extensions?.contentRevision)?.extensions?.contentRevision;
        const rows = await listLessonAttemptRows(user.id, lessonId, contentRevision || undefined);
        const [progress] = await pool.query(
          `SELECT status FROM user_lesson_progress WHERE user_id = ? AND lesson_id = ? LIMIT 1`,
          [user.id, lessonId]
        );
        const answeredQuestionIds = rows.map((row) => String(row.question_id));
        const correctCount = rows.filter((row) => Number(row.is_correct) === 1).length;
        const isCompleted = String(progress[0]?.status || "") === "completed";
        let versionNotice = null;
        if (!isCompleted && rows.length === 0 && contentRevision) {
          const [older] = await pool.query(
            `SELECT COUNT(*) AS c FROM user_learn_exercise_attempts
             WHERE user_id = ? AND lesson_id = ? AND (content_revision IS NULL OR content_revision != ?)`,
            [user.id, lessonId, contentRevision]
          );
          if (Number(older[0]?.c || 0) > 0) {
            versionNotice =
              "Bài học đã được nâng cấp (thêm hội thoại mở đầu, mẫu câu và kết bài). Tiến độ cũ vẫn giữ; bạn làm phiên bản mới từ đầu các hoạt động của bản này.";
          }
        }
        data = {
          ...data,
          versionNotice: versionNotice || data.versionNotice || null,
          resume: {
            completed: isCompleted,
            answeredQuestionIds,
            correctCount,
            startIndex: resumeStartIndex(data.questions, answeredQuestionIds),
          },
        };
      } catch {
        /* resume is optional; the lesson still opens at the first question */
      }
    }

    return NextResponse.json({
      success: true,
      data: sanitizeLessonForClient(data),
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load lesson.${detail}`.trim() },
      { status: 500 }
    );
  }
}
