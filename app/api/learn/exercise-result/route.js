import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  getLearnMasterySnapshot,
  recordLearnExerciseResult,
} from "@/lib/beego/learn/mastery-mistake-engine";
import { invalidateLearnDerivedCaches } from "@/lib/beego/learn/invalidate-learn-caches";
import { getLessonExerciseByRef } from "@/lib/beego/learn/get-lesson-exercise";
import {
  checkAnswer,
  getCorrectAnswerDisplay,
  scoreSpeakingAttempt,
} from "@/lib/beego/learn/exercise-check";
import { gradeMatchAnswer, matchSummary } from "@/lib/beego/learn/match-pairs";
import { findServedMixExercise } from "@/lib/beego/learn/lesson-mix-session-store";
import { getPassageAttempt } from "@/lib/beego/learn/passage-attempt-store";

export const dynamic = "force-dynamic";

/**
 * Server-side grade + post-submit reveal fields (never returned on Lesson GET).
 * Resolves the exact catalog exercise — never guesses by type/index.
 */
function assertListeningAligned(ex) {
  const type = String(ex?.type || "");
  if (type !== "listening_choice" && type !== "listening_fill") return { ok: true };
  const target = String(
    ex.extensions?.gradingTarget ||
      ex.extensions?.ttsText ||
      ex.ttsText ||
      ex.listenText ||
      ex.extensions?.transcript ||
      ex.extensions?.audioScript ||
      ""
  ).trim();
  if (!target) {
    return {
      ok: false,
      code: "LISTENING_MISALIGNED",
      message: "Listening exercise missing audio target.",
    };
  }
  const correctOpt = (ex.options || []).find((o) => String(o.id) === String(ex.correctAnswer));
  if (!correctOpt) {
    return {
      ok: false,
      code: "LISTENING_MISALIGNED",
      message: "Listening correct option missing.",
    };
  }
  if (type === "listening_choice") {
    const mode = String(ex.extensions?.listeningMode || "");
    // Comprehension: EN audio + VI/meaning options. Word-match items still require option === audio.
    const comprehension = mode === "comprehension" || mode === "meaning";
    if (!comprehension && String(correctOpt.text).trim() !== target) {
      return {
        ok: false,
        code: "LISTENING_MISALIGNED",
        message: "Listening audio target does not match correct option.",
      };
    }
  }
  if (type === "listening_fill") {
    const gapText = String(correctOpt.text || "");
    if (gapText && !target.toLowerCase().includes(gapText.toLowerCase())) {
      return {
        ok: false,
        code: "LISTENING_MISALIGNED",
        message: "Listening fill gap not present in audio target.",
      };
    }
  }
  return { ok: true };
}

async function gradeExerciseServerSide({ lessonId, questionId, answer, sourceLessonId, sourceQuestionId, userId }) {
  const lid = String(sourceLessonId || lessonId || "").trim();
  const qid = String(sourceQuestionId || questionId || "").trim();
  if (!lid || !qid) {
    return {
      ok: false,
      status: 400,
      message: "lesson_id and question_id required.",
      code: "INVALID_INPUT",
    };
  }

  const loaded = getLessonExerciseByRef(lid, qid, {
    sourceLessonId: lid,
    sourceQuestionId: qid,
  });
  if (!loaded?.exercise) {
    return {
      ok: false,
      status: 400,
      message: "Unknown exercise — cannot grade.",
      code: "UNKNOWN_EXERCISE",
    };
  }

  // Reject if caller claimed a source pair that does not match what we resolved
  if (
    sourceLessonId &&
    sourceQuestionId &&
    (String(loaded.sourceLessonId) !== String(sourceLessonId) ||
      String(loaded.exercise.id) !== String(sourceQuestionId))
  ) {
    return {
      ok: false,
      status: 400,
      message: "Exercise reference mismatch.",
      code: "EXERCISE_REF_MISMATCH",
    };
  }

  const align = assertListeningAligned(loaded.exercise);
  if (!align.ok) {
    return { ok: false, status: 500, message: align.message, code: align.code };
  }

  const ex = loaded.exercise;
  const type = String(ex.type || "");
  let isCorrect = false;
  let speakScored = null;
  if (type === "passage_read") {
    const attemptId = String(answer?.passageAttemptId || "").trim();
    const row = userId && attemptId ? await getPassageAttempt(userId, attemptId) : null;
    if (!row || row.attemptKey !== attemptId || String(row.lessonId || "") !== lid) {
      return {
        ok: false,
        status: 400,
        message: "Cần chấm audio Azure trước khi nộp câu đọc.",
        code: "PASSAGE_ATTEMPT_REQUIRED",
      };
    }
    isCorrect = Boolean(row.passed);
    speakScored = {
      feedbackVi: row.feedbackVi,
      softPass: true,
      passed: row.passed,
    };
  } else if (type === "speaking" || type === "pronunciation") {
    const transcript =
      answer && typeof answer === "object"
        ? String(answer.transcript || answer.text || "")
        : String(answer || "");
    if (!transcript.trim()) {
      return {
        ok: false,
        status: 400,
        message: "transcript required for speaking.",
        code: "ANSWER_REQUIRED",
      };
    }
    speakScored = scoreSpeakingAttempt(ex, transcript);
    isCorrect = Boolean(speakScored.passed);
  } else {
    if (answer == null) {
      return {
        ok: false,
        status: 400,
        message: "answer required.",
        code: "ANSWER_REQUIRED",
      };
    }
    // Never trust client is_correct / passed flags
    isCorrect = Boolean(checkAnswer(ex, answer));
    if (!isCorrect && type === "matching_pairs" && userId) {
      const served = await findServedMixExercise(userId, lessonId, ex.id);
      if (served && gradeMatchAnswer(served, answer).accurate) {
        isCorrect = true;
      }
    }
  }

  const correctAnswerId =
    type === "word_order" ||
    type === "speaking" ||
    type === "pronunciation" ||
    type === "matching_pairs" ||
    type === "listening_dictation" ||
    type === "translation" ||
    (type === "context_cloze" && ex.extensions?.inputMode === "text")
      ? null
      : ex.correctAnswer ?? null;
  const matchText =
    type === "matching_pairs"
      ? isCorrect
        ? matchSummary(Array.isArray(ex.pairs) ? ex.pairs.length : 0, Number(answer?.mistakeCount) || 0)
        : (ex.pairs || []).map((pair) => `${pair.en} = ${pair.vi}`).join("; ")
      : "";
  const speakExplain = speakScored?.feedbackVi || null;
  const speakHint =
    speakScored && !isCorrect && Array.isArray(speakScored.focusMissing) && speakScored.focusMissing.length
      ? `Cần dùng: ${speakScored.focusMissing.join(", ")}`
      : null;

  return {
    ok: true,
    isCorrect,
    correctAnswerDisplay: matchText || speakHint || getCorrectAnswerDisplay(ex),
    correctAnswerId,
    explanation:
      matchText || speakExplain || (ex.explanation ? String(ex.explanation) : null),
    soft_pass: Boolean(speakScored?.softPass),
    storyVi: type === "story_comprehension" ? String(ex.storyVi || ex.extensions?.storyVi || "") : "",
    gradedLessonId: loaded.sourceLessonId,
    gradedQuestionId: ex.id,
    contentRevision: ex.extensions?.contentRevision || null,
  };
}

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }
    const snapshot = await getLearnMasterySnapshot(user.id);
    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load mastery.${detail}`.trim() },
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
    const rl = await checkRateLimit(request, {
      key: "learn_exercise_result",
      windowMs: 60_000,
      max: 120,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const user = await getSessionUserFromRequest(request);
    if (user && user.is_active !== 1) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const attemptKey = String(body.attempt_key || body.attemptKey || "").trim();
    const lessonId = String(body.lesson_id || body.lessonId || "").trim();
    const questionId = String(body.question_id || body.questionId || "").trim();
    const lessonType = String(body.lesson_type || body.lessonType || "").trim();
    const exerciseType = String(body.exercise_type || body.exerciseType || "unknown").trim();
    const skillLabel = String(body.skill_label || body.skillLabel || "").trim();
    const activityStage = String(body.activity_stage || body.activityStage || "").trim();
    const difficulty = String(body.difficulty || "").trim();
    const answer = body.answer !== undefined ? body.answer : body.user_answer;
    const sourceLessonId = String(
      body.source_lesson_id || body.sourceLessonId || ""
    ).trim();
    const sourceQuestionId = String(
      body.source_question_id || body.sourceQuestionId || ""
    ).trim();
    const assessmentSessionId = String(
      body.assessment_session_id || body.assessmentSessionId || ""
    ).trim();

    const graded = await gradeExerciseServerSide({
      lessonId,
      questionId,
      answer,
      sourceLessonId,
      sourceQuestionId,
      userId: user?.id,
    });
    if (!graded.ok) {
      return NextResponse.json(
        { success: false, message: graded.message, code: graded.code },
        { status: graded.status }
      );
    }

    const reveal = {
      is_correct: graded.isCorrect,
      correct_answer_display: graded.correctAnswerDisplay,
      correct_answer_id: graded.correctAnswerId,
      explanation: graded.explanation,
      soft_pass: Boolean(graded.soft_pass),
      story_vi: graded.storyVi || "",
      graded_server: true,
    };

    // Guest: grade + reveal only (no mastery / no XP)
    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          ...reveal,
          recorded: false,
          duplicate: false,
          guest: true,
        },
      });
    }

    const replayRequested = body.replay === true || body.replay === 1 || body.replay === "1";
    if (replayRequested) {
      const [progress] = await pool.query(
        `SELECT status FROM user_lesson_progress WHERE user_id = ? AND lesson_id = ? LIMIT 1`,
        [user.id, lessonId]
      );
      if (String(progress[0]?.status || "") === "completed") {
        return NextResponse.json({
          success: true,
          data: {
            ...reveal,
            recorded: false,
            duplicate: false,
            replay: true,
          },
        });
      }
    }

    if (!attemptKey) {
      return NextResponse.json(
        { success: false, message: "attempt_key required.", code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const result = await recordLearnExerciseResult(user.id, {
      attemptKey,
      lessonId,
      questionId,
      lessonType,
      exerciseType,
      skillLabel,
      isCorrect: graded.isCorrect,
      activityStage,
      difficulty,
      contentRevision: graded.contentRevision,
      assessmentSessionId,
    });

    try {
      await invalidateLearnDerivedCaches(user.id);
    } catch {
      /* non-blocking */
    }

    return NextResponse.json({
      success: true,
      data: {
        recorded: result.recorded,
        duplicate: result.duplicate,
        skill_key: result.skill_key,
        mastery_score: result.mastery_score,
        mastery_level: result.mastery_level,
        mastery_phase: result.mastery_phase,
        accuracy_pct: result.accuracy_pct,
        ...reveal,
        is_correct: graded.isCorrect,
      },
    });
  } catch (error) {
    if (error?.code === "INVALID_INPUT") {
      return NextResponse.json({ success: false, message: error.message, code: error.code }, { status: 400 });
    }
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to record exercise.${detail}`.trim() },
      { status: 500 }
    );
  }
}
