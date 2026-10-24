import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getLessonExerciseByRef } from "@/lib/beego/learn/get-lesson-exercise";
import { assessPassageWav, PASSAGE_WAV_MAX_BYTES } from "@/lib/beego/learn/passage-pronunciation";
import { getPassageAttempt, passageScoreSummary, savePassageAttempt } from "@/lib/beego/learn/passage-attempt-store";
import { getSettingSync } from "@/lib/runtime-settings/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function speechConfig() {
  const key = String(process.env.AZURE_SPEECH_KEY || getSettingSync("AZURE_SPEECH_KEY") || "").trim();
  const region = String(process.env.AZURE_SPEECH_REGION || getSettingSync("AZURE_SPEECH_REGION") || "").trim();
  return { key, region };
}

export async function POST(request) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }
    const rl = await checkRateLimit(request, { key: "learn_passage_score", windowMs: 600_000, max: 12 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Bạn chấm quá nhiều lần. Thử lại sau vài phút.", code: "RATE_LIMIT" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }
    const user = await getSessionUserFromRequest(request);
    if (!user?.id) {
      return NextResponse.json({ success: false, message: "Cần đăng nhập.", code: "AUTH" }, { status: 401 });
    }

    const form = await request.formData();
    const lessonId = String(form.get("lessonId") || "").trim();
    const questionId = String(form.get("questionId") || "").trim();
    const attemptKey = String(form.get("attemptKey") || "").trim();
    const file = form.get("audio");
    if (!lessonId || !questionId || !attemptKey || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, message: "Thiếu bài đọc hoặc file audio.", code: "BAD_REQUEST" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(attemptKey)) {
      return NextResponse.json({ success: false, message: "Mã lần thử không hợp lệ.", code: "BAD_ATTEMPT" }, { status: 400 });
    }
    if (file.size > PASSAGE_WAV_MAX_BYTES) {
      return NextResponse.json({ success: false, message: "File ghi âm quá lớn.", code: "AUDIO_TOO_LARGE" }, { status: 413 });
    }

    const existing = await getPassageAttempt(user.id, attemptKey);
    if (existing) {
      const summary = await passageScoreSummary(user.id, lessonId, questionId);
      return NextResponse.json({ success: true, data: { ...existing, summary, duplicate: true } });
    }

    const loaded = getLessonExerciseByRef(lessonId, questionId);
    const exercise = loaded?.exercise;
    if (!exercise || exercise.type !== "passage_read") {
      return NextResponse.json({ success: false, message: "Không tìm thấy bài đọc.", code: "NOT_FOUND" }, { status: 404 });
    }
    const referenceText = String(exercise.extensions?.referenceText || "").trim();
    const wav = Buffer.from(await file.arrayBuffer());
    const { key, region } = speechConfig();
    const assessed = await assessPassageWav({
      wavBuffer: wav,
      referenceText,
      speechKey: key,
      speechRegion: region,
    });
    if (!assessed.ok) {
      const status = assessed.code === "PRONUNCIATION_UNCONFIGURED" ? 503 : 422;
      return NextResponse.json(
        { success: false, message: assessed.message, code: assessed.code },
        { status }
      );
    }
    const saved = await savePassageAttempt({
      userId: user.id,
      attemptKey,
      lessonId,
      questionId,
      contentRevision: exercise.extensions?.contentRevision || null,
      scores: assessed.scores,
    });
    const summary = await passageScoreSummary(user.id, lessonId, questionId);
    return NextResponse.json({ success: true, data: { ...saved, summary, duplicate: false } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không chấm được.";
    return NextResponse.json({ success: false, message, code: "PASSAGE_SCORE_FAILED" }, { status: 500 });
  }
}
