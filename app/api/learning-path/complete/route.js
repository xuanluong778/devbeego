import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { completeLessonForUser } from "@/lib/beego/learning-path-progress";
import { clearLessonMixSession } from "@/lib/beego/learn/lesson-mix-session-store";
import { applySmartProgressionAfterLessonComplete } from "@/lib/beego/learn/smart-progression";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import { invalidateLearnDerivedCaches } from "@/lib/beego/learn/invalidate-learn-caches";
import { evaluateAndUnlockAchievements } from "@/lib/beego/learn/achievements-engine";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }
    const rl = await checkRateLimit(request, { key: "learning_path_complete", windowMs: 60_000, max: 60 });
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
    if (user.is_active !== 1) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const lessonId = String(body.lesson_id || body.lessonId || "").trim();
    const score = body.score != null ? Number(body.score) : undefined;
    const assessmentSessionId = String(
      body.assessment_session_id || body.assessmentSessionId || ""
    ).trim();
    if (!lessonId) {
      return NextResponse.json({ success: false, message: "lesson_id required." }, { status: 400 });
    }

    const result = await completeLessonForUser(user.id, lessonId, { score, assessmentSessionId });
    let smartProgression = null;
    if (!result.already_completed) {
      try {
        await clearLessonMixSession(user.id, lessonId);
      } catch {
        /* non-blocking */
      }
    }
    try {
      const lesson = getLessonContentById(lessonId);
      smartProgression = await applySmartProgressionAfterLessonComplete(
        user.id,
        lessonId,
        lesson?.type || ""
      );
    } catch {
      /* non-blocking */
    }
    let newlyUnlocked = [];
    try {
      const ev = await evaluateAndUnlockAchievements(user.id);
      newlyUnlocked = ev.newlyUnlocked || [];
    } catch {
      /* non-blocking */
    }
    try {
      await invalidateLearnDerivedCaches(user.id);
    } catch {
      /* non-blocking */
    }
    return NextResponse.json({
      success: true,
      data: {
        already_completed: result.already_completed,
        xp_awarded: result.xp_awarded ?? 0,
        honey_awarded: result.honey_awarded ?? 0,
        next_lesson_id: result.next_lesson_id ?? result.path?.activeLessonId,
        path: result.path,
        progress: result.path?.progress ?? null,
        smart_progression: smartProgression,
        daily_motivation: result.daily_motivation || result.path?.daily_motivation || null,
        achievements_unlocked: newlyUnlocked,
      },
    });
  } catch (error) {
    const code = error?.code;
    if (code === "UNKNOWN_LESSON") {
      return NextResponse.json({ success: false, message: "Unknown lesson_id.", code }, { status: 404 });
    }
    if (code === "LESSON_LOCKED" || code === "REQUIRED_QUESTIONS_SKIPPED") {
      return NextResponse.json({ success: false, message: error.message, code }, { status: 403 });
    }
    if (code === "GATE_TEST_FAILED") {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          code,
          score: error.score,
          required_score: error.requiredScore,
          remediation_lesson_id: error.remediationLessonId,
          unmet_competencies: error.unmetCompetencies || [],
        },
        { status: 422 }
      );
    }
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to complete lesson.${detail}`.trim() },
      { status: 500 }
    );
  }
}
