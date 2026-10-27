"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LessonTopBar from "./LessonTopBar";
import ExerciseRenderer from "./ExerciseRenderer";
import LessonBottomBar from "./LessonBottomBar";
import LessonFeedbackBar from "./LessonFeedbackBar";
import LessonCompleteScreen from "./LessonCompleteScreen";
import LearnLessonCall from "./LearnLessonCall";
import LessonAiConversation from "./LessonAiConversation";
import { isLessonSuitableForAiPractice } from "@/lib/beego/learn/learn-ai-practice-eligibility";
import {
  hasAnswerSelected,
} from "@/lib/beego/lesson-player";
import {
  notifyLearningPathUpdated,
  postLearningPathComplete,
} from "@/lib/beego/learn/complete-lesson-client";
import { fetchLessonForPlayer } from "@/lib/beego/learn/fetch-lesson-for-player";
import { postLearnExerciseResult } from "@/lib/beego/learn/post-exercise-result-client";
import { stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import { playLessonSfx, stopLessonSfx } from "@/lib/beego/learn/lesson-sfx";
import { assessP1MasteryEvidence } from "@/lib/beego/learn/p1-g1-plan";
import { gradeListenDictation } from "@/lib/beego/learn/listen-dictation";
import { pickLoadingTip } from "@/lib/beego/learn/praise-messages";

function masteryEvidenceForSession(lesson, attempts) {
  const rubric = lesson?.masteryRubric;
  if (!rubric) return null;
  if (!attempts?.length) {
    return {
      status: "absent",
      text: "Kết quả luyện tập trong phiên: lượt này chưa có câu luyện. Trạng thái hoàn thành không đổi.",
    };
  }
  const result = assessP1MasteryEvidence(attempts);
  const expected = { recognition: 0, application: 0 };
  for (const question of lesson.questions || []) {
    const role = question?.extensions?.evidenceRole;
    if (role === "recognition" || role === "application") expected[role] += 1;
  }
  const complete =
    result.recognitionCount === expected.recognition &&
    result.applicationCount === expected.application;
  const met = result.mastered && complete;
  return {
    status: met ? "met" : "not_met",
    text: met
      ? "Kết quả luyện tập trong phiên: phần nhận biết và phần vận dụng đều đúng. Đây không phải kết luận thành thạo, và transcript không chứng minh phát âm đạt."
      : "Kết quả luyện tập trong phiên: phần nhận biết hoặc phần vận dụng còn câu chưa đúng. Đây không phải kết luận thành thạo.",
  };
}

function previewDictation(question, answer) {
  if (question?.type !== "listening_dictation") return null;
  const transcript = String(question.extensions?.transcript || question.ttsText || "").trim();
  if (!transcript) return null;
  const typed = answer && typeof answer === "object" ? answer.text ?? answer.value : answer;
  return {
    ok: gradeListenDictation(transcript, typed),
    transcript,
  };
}

function isGate1Lesson(lesson, lessonId) {
  if (Number(lesson?.gateNumber) === 1) return true;
  return /^g01/i.test(String(lesson?.lessonId || lessonId || ""));
}

function LessonAim({ rubric }) {
  return (
    <section className="beego-lesson-aim" aria-label="Mục tiêu bài">
      <p>
        <strong>{rubric.roleLabel}.</strong> {rubric.goal}
      </p>
      {rubric.newItems?.length ? <p>Mới: {rubric.newItems.join(", ")}</p> : <p>Bài này không thêm mục mới.</p>}
      {rubric.reviewItems?.length ? <p>Ôn: {rubric.reviewItems.join(", ")}</p> : null}
    </section>
  );
}

export default function LessonPlayer({ lessonId, replay = false }) {
  const router = useRouter();

  const [loadState, setLoadState] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [lesson, setLesson] = useState(null);
  const [contentSource, setContentSource] = useState("");

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [checking, setChecking] = useState(false);
  const [lives, setLives] = useState(3);
  const [correctCount, setCorrectCount] = useState(0);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [phase, setPhase] = useState("playing");

  const [completeSaving, setCompleteSaving] = useState(false);
  const [completeGuest, setCompleteGuest] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [xpAwarded, setXpAwarded] = useState(0);
  const [honeyAwarded, setHoneyAwarded] = useState(0);
  const [streak, setStreak] = useState(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [aiPracticeOn, setAiPracticeOn] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const exerciseAttemptKeyRef = useRef(null);
  const exerciseResultSentRef = useRef(false);

  const completeSubmitRef = useRef(false);
  const scoreAtFinishRef = useRef(0);
  const correctAtFinishRef = useRef(0);
  const correctRef = useRef(0);
  const canPersistCompleteRef = useRef(false);
  const assessmentSessionIdRef = useRef(null);
  const [celebrate, setCelebrate] = useState(false);
  const fanfarePlayedRef = useRef(false);
  const evidenceAttemptsRef = useRef([]);

  const gate1 = isGate1Lesson(lesson, lessonId);
  const total = lesson?.questions?.length ?? 0;
  const question = lesson?.questions?.[index];
  const progress = phase === "complete" ? 100 : total ? Math.round((index / total) * 100) : 0;
  const stepLabel = total > 0 ? `Hoạt động ${Math.min(index + 1, total)}/${total}` : "";

  const canCheck = question && hasAnswerSelected(question, answer) && !feedback && !checking;
  const skipDisabled = Boolean(question?.required);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setLoadError("");
    setLesson(null);
    setPhase("playing");
    setIndex(0);
    setAnswer(null);
    setFeedback(null);
    setReveal(null);
    correctRef.current = 0;
    setCorrectCount(0);
    completeSubmitRef.current = false;
    exerciseAttemptKeyRef.current = null;
    exerciseResultSentRef.current = false;
    canPersistCompleteRef.current = false;
    assessmentSessionIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    (async () => {
      const result = await fetchLessonForPlayer(lessonId);
      if (cancelled) return;
      if (!result.ok) {
        setLoadState("error");
        setLoadError(result.message || "Không tải được bài học.");
        return;
      }
      setLesson(result.lesson);
      setLives(result.lesson.lives ?? 3);
      setContentSource(result.source);
      const resume = result.lesson.resume;
      const questionCount = result.lesson.questions?.length || 0;
      const resumeCorrect = Number(resume?.correctCount) || 0;
      if (replay) {
        canPersistCompleteRef.current = false;
        setAlreadyCompleted(Boolean(resume?.completed));
        setIndex(0);
        setPhase("playing");
      } else if (resume?.completed) {
        canPersistCompleteRef.current = false;
        correctRef.current = resumeCorrect;
        setCorrectCount(resumeCorrect);
        correctAtFinishRef.current = resumeCorrect;
        scoreAtFinishRef.current = questionCount ? Math.round((resumeCorrect / questionCount) * 100) : 0;
        setPhase("complete");
      } else {
        canPersistCompleteRef.current = true;
        const startIndex = Number(resume?.startIndex) || 0;
        if (startIndex > 0 && startIndex < questionCount) {
          correctRef.current = resumeCorrect;
          setCorrectCount(resumeCorrect);
          setIndex(startIndex);
        } else if (startIndex >= questionCount && questionCount > 0 && resume?.answeredQuestionIds?.length) {
          // All questions answered but progress not saved yet — finish screen will persist unlock.
          correctRef.current = resumeCorrect;
          setCorrectCount(resumeCorrect);
          correctAtFinishRef.current = resumeCorrect;
          scoreAtFinishRef.current = Math.round((resumeCorrect / questionCount) * 100);
          setPhase("complete");
        }
      }
      setLoadState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [lessonId, replay]);

  const goToCompletePhase = useCallback(
    (finalCorrect) => {
      const n = total > 0 ? finalCorrect : 0;
      correctAtFinishRef.current = n;
      scoreAtFinishRef.current = total > 0 ? Math.round((n / total) * 100) : 0;
      if (!fanfarePlayedRef.current) {
        fanfarePlayedRef.current = true;
        setCelebrate(true);
        playLessonSfx("fanfare");
      }
      setPhase("complete");
    },
    [total]
  );

  const handleCheck = useCallback(async () => {
    if (!canCheck || checking) return;
    setChecking(true);
    const localDictation = previewDictation(question, answer);
    if (localDictation) {
      setFeedback(localDictation.ok ? "correct" : "wrong");
      setReveal({
        correctAnswerText: localDictation.transcript,
        explanation: null,
        correctAnswerId: null,
        storyVi: "",
      });
    }

    if (!exerciseAttemptKeyRef.current) {
      exerciseAttemptKeyRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${lessonId}-${question?.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const gradeLessonId =
      question?.activityMeta?.sourceLessonId ||
      question?.reviewMeta?.sourceLessonId ||
      lessonId;
    const gradeQuestionId = String(
      question?.activityMeta?.sourceQuestionId ||
        question?.reviewMeta?.sourceQuestionId ||
        question?.id ||
        `q-${index}`
    );

    try {
      if (!exerciseResultSentRef.current) {
        exerciseResultSentRef.current = true;
        const result = await postLearnExerciseResult({
          attemptKey: exerciseAttemptKeyRef.current,
          lessonId: gradeLessonId,
          questionId: gradeQuestionId,
          lessonType:
            question?.activityMeta?.sourceLessonType ||
            question?.reviewMeta?.sourceLessonType ||
            lesson?.type ||
            "",
          exerciseType: question?.type || "unknown",
          skillLabel: question?.skillLabel || "",
          activityStage: question?.activityMeta?.stage || "",
          difficulty: question?.activityMeta?.difficulty || "",
          answer,
          replay,
          assessmentSessionId: assessmentSessionIdRef.current,
        });

        if (!result.ok) {
          exerciseResultSentRef.current = false;
          setFeedback("wrong");
          setReveal({
            correctAnswerText: "Không chấm được — thử lại.",
            explanation: result.message || null,
            correctAnswerId: null,
          });
          return;
        }

        const ok = Boolean(result.data?.is_correct);
        setFeedback(ok ? "correct" : "wrong");
        setReveal({
          correctAnswerText: result.data?.correct_answer_display || "—",
          explanation: result.data?.explanation || answer?.feedbackVi || null,
          correctAnswerId: result.data?.correct_answer_id ?? null,
          storyVi: result.data?.story_vi || "",
          softPraise: Boolean(
            result.data?.soft_pass ||
              answer?.softPass ||
              question?.extensions?.gradingMode === "communicative_rubric"
          ),
        });
        if (ok) {
          correctRef.current += 1;
          setCorrectCount(correctRef.current);
        } else if (lives > 0) {
          // Mic/nhận dạng lỗi không tính là sai kiến thức (không trừ tim khi là speaking/pronunciation)
          const isSpeech =
            question?.type === "speaking" ||
            question?.type === "pronunciation" ||
            question?.type === "passage_read";
          if (!isSpeech) {
            setLives((l) => l - 1);
          }
        }
        const activity = Number(question?.extensions?.activity);
        if (activity) evidenceAttemptsRef.current.push({ activity, correct: ok });
        if (question?.type !== "matching_pairs") playLessonSfx(ok ? "ding" : "soft");
      }
    } finally {
      setChecking(false);
    }
  }, [canCheck, checking, question, answer, lives, lessonId, lesson?.type, index, replay]);

  const handleContinue = useCallback(() => {
    if (index >= total - 1) {
      goToCompletePhase(correctRef.current);
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
    setFeedback(null);
    setReveal(null);
    exerciseAttemptKeyRef.current = null;
    exerciseResultSentRef.current = false;
  }, [index, total, goToCompletePhase]);

  const handleRetry = useCallback(() => {
    setFeedback(null);
    setReveal(null);
    setAnswer(null);
    exerciseAttemptKeyRef.current = null;
    exerciseResultSentRef.current = false;
  }, []);

  const handleSkip = useCallback(() => {
    if (feedback || checking) return;
    if (question?.required) return;
    // Câu nói tùy chọn: bỏ qua không nộp, không trừ tim, không ghi sai.
    if (index >= total - 1) {
      goToCompletePhase(correctRef.current);
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
    setReveal(null);
  }, [feedback, checking, index, total, goToCompletePhase, question?.required]);

  const handleExit = useCallback(() => {
    const message = replay
      ? "Thoát bài học lại? Tiến độ và phần thưởng của bài này không đổi."
      : "Bạn muốn thoát bài học? Các câu đã nộp vẫn được giữ.";
    if (window.confirm(message)) {
      stopLessonTts();
      stopLessonSfx();
      router.push("/");
    }
  }, [router, replay]);

  useEffect(() => {
    stopLessonTts();
    if (phase !== "complete") stopLessonSfx();
  }, [index, phase]);

  useEffect(() => {
    if (!gate1 || typeof window === "undefined" || !window.visualViewport) return undefined;
    const viewport = window.visualViewport;
    const apply = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--beego-keyboard-inset", `${Math.round(inset)}px`);
    };
    viewport.addEventListener("resize", apply);
    viewport.addEventListener("scroll", apply);
    apply();
    return () => {
      viewport.removeEventListener("resize", apply);
      viewport.removeEventListener("scroll", apply);
      document.documentElement.style.removeProperty("--beego-keyboard-inset");
    };
  }, [gate1]);

  useEffect(() => {
    if (question?.type !== "matching_pairs") return;
    if (!answer?.completed || feedback || checking) return;
    void handleCheck();
  }, [question?.id, question?.type, answer, feedback, checking, handleCheck]);

  useEffect(() => {
    if (phase !== "complete") return;
    if (!canPersistCompleteRef.current) return;
    if (completeSubmitRef.current) return;
    completeSubmitRef.current = true;

    let cancelled = false;
    setCompleteSaving(true);
    setCompleteGuest(false);
    setCompleteError("");

    (async () => {
      const result = await postLearningPathComplete(lessonId, {
        score: scoreAtFinishRef.current,
        assessmentSessionId: assessmentSessionIdRef.current,
      });
      if (cancelled) return;

      setCompleteSaving(false);

      if (!result.ok) {
        if (result.status === 401) {
          setCompleteGuest(true);
          return;
        }
        if (result.code === "LESSON_LOCKED") {
          setCompleteError("Bài chưa mở khóa — hoàn thành bài trước trên lộ trình.");
          return;
        }
        setCompleteError(result.message || "Không lưu được tiến độ.");
        return;
      }

      const data = result.data;
      const idempotent = Boolean(data.already_completed);
      setAlreadyCompleted(idempotent);
      setXpAwarded(Number(data.xp_awarded ?? 0));
      setHoneyAwarded(Number(data.honey_awarded ?? 0));
      const prog = data.progress || data.path?.progress;
      if (prog?.streak != null) {
        setStreak(Number(prog.streak));
      }
      notifyLearningPathUpdated(data);
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, lessonId]);

  useEffect(() => {
    if (phase !== "complete" || !isLessonSuitableForAiPractice(lesson)) {
      setAiPracticeOn(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/learn/chat/status", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setAiPracticeOn(Boolean(res.ok && json?.data?.enabled));
      } catch {
        if (!cancelled) setAiPracticeOn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, lesson]);

  if (loadState === "loading") {
    const tip = pickLoadingTip(String(lessonId || "").length);
    return (
      <div className={`beego-lesson-player beego-lesson-player--loading${isGate1Lesson(null, lessonId) ? " beego-lesson-player--gate1" : ""}`} aria-busy="true">
        <span className="beego-lesson-loading__bee" aria-hidden>
          🐝
        </span>
        <p className="beego-lesson-loading__title">Đang tải bài học…</p>
        {tip ? <p className="beego-lesson-loading__tip">{tip}</p> : null}
      </div>
    );
  }

  if (loadState === "error" || !lesson) {
    return (
      <div className={`beego-lesson-player beego-lesson-player--error${isGate1Lesson(null, lessonId) ? " beego-lesson-player--gate1" : ""}`}>
        <div className="beego-lesson-complete__card">
          <h1>Không mở được bài học</h1>
          <p>{loadError || "Nội dung không khả dụng."}</p>
          <Link href="/" className="beego-lesson-complete__cta">
            Về lộ trình học
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className={`beego-lesson-player beego-lesson-player--complete${gate1 ? " beego-lesson-player--gate1" : ""}`}>
        <LessonCompleteScreen
          lesson={lesson}
          correctCount={correctAtFinishRef.current}
          total={total}
          livesLeft={lives}
          saving={completeSaving}
          guest={completeGuest}
          errorMessage={completeError}
          xpAwarded={xpAwarded}
          honeyAwarded={honeyAwarded}
          streak={streak}
          alreadyCompleted={alreadyCompleted || replay}
          masteryEvidence={masteryEvidenceForSession(lesson, evidenceAttemptsRef.current)}
          celebrate={celebrate}
          gate1={gate1}
          replay={replay}
          showAiPractice={aiPracticeOn}
          onAiPractice={() => setAiPanelOpen(true)}
          callSlot={
            <LearnLessonCall lessonId={lesson.lessonId} lessonType={lesson.type} />
          }
        />
        {aiPanelOpen ? (
          <LessonAiConversation lessonId={lessonId} onClose={() => setAiPanelOpen(false)} />
        ) : null}
      </div>
    );
  }

  return (
    <div className={`beego-lesson-player${keyboardMode ? " beego-lesson-player--keyboard" : ""}${gate1 ? " beego-lesson-player--gate1" : ""}`}>
      <LessonTopBar progress={progress} lives={lives} onExit={handleExit} stepLabel={stepLabel} />

      <main className="beego-lesson-player__main">
        {lesson.versionNotice ? (
          <div
            role="status"
            className="beego-lesson-version-notice"
            style={{
              background: "#eff6ff",
              color: "#1e40af",
              border: "1px solid #bfdbfe",
              padding: "10px 14px",
              borderRadius: "10px",
              marginBottom: "16px",
              fontSize: "13px",
              lineHeight: "1.4",
            }}
          >
            💡 {lesson.versionNotice}
          </div>
        ) : null}
        {lives === 0 && lessonId !== "p1-g1-n08" && lessonId !== "p1-g1-n15" ? (
          <div
            role="status"
            className="beego-lesson-guided-banner"
            style={{
              background: "#fffbeb",
              color: "#92400e",
              border: "1px solid #fde68a",
              padding: "10px 14px",
              borderRadius: "10px",
              marginBottom: "16px",
              fontSize: "13px",
              lineHeight: "1.4",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span aria-hidden="true">🛡️</span>
            <span>
              <strong>Chế độ luyện có hướng dẫn:</strong> Bạn đã dùng hết tim nhưng vẫn tiếp tục luyện trọn vẹn bài học để củng cố kiến thức.
            </span>
          </div>
        ) : null}
        {lesson.masteryRubric ? <LessonAim rubric={lesson.masteryRubric} /> : null}
        <div key={question?.id || index} className={gate1 ? "beego-gate1-stage" : undefined}>
        <ExerciseRenderer
          exercise={question}
          lessonId={lesson?.lessonId || lessonId}
          activityType={lesson?.type}
          answer={answer}
          onAnswerChange={setAnswer}
          feedback={feedback}
          storySupportVi={reveal?.storyVi || ""}
          revealCorrectId={reveal?.correctAnswerId ?? null}
          onCheck={handleCheck}
          livelyUi={gate1}
        />
        </div>
        {keyboardMode && question?.type !== "listening_dictation" ? (
          <input
            type="text"
            className="beego-lesson-keyboard-input"
            placeholder="Nhập đáp án..."
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!!feedback || checking}
          />
        ) : null}
      </main>

      {feedback ? (
        <LessonFeedbackBar
          correct={feedback === "correct"}
          correctAnswerText={reveal?.correctAnswerText || "—"}
          explanation={reveal?.explanation}
          onContinue={handleContinue}
          onRetry={handleRetry}
          continueDisabled={checking}
          praiseSeed={`${question?.id || index}-${correctCount}`}
          softPraise={Boolean(reveal?.softPraise)}
          mascot={gate1}
        />
      ) : (
        <LessonBottomBar
          canCheck={canCheck}
          busy={checking}
          onSkip={handleSkip}
          onCheck={handleCheck}
          keyboardMode={keyboardMode}
          onToggleKeyboard={() => setKeyboardMode((v) => !v)}
          skipDisabled={skipDisabled}
          skipLabel={Number(question?.extensions?.activity) === 11 ? "Bỏ qua câu nói" : "Bỏ qua"}
          gate1={gate1}
        />
      )}
    </div>
  );
}
