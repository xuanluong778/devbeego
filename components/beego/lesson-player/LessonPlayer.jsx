"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LessonTopBar from "./LessonTopBar";
import QuestionRenderer from "./QuestionRenderer";
import LessonBottomBar from "./LessonBottomBar";
import LessonFeedbackBar from "./LessonFeedbackBar";
import LessonCompleteScreen from "./LessonCompleteScreen";
import {
  checkAnswer,
  getCorrectAnswerDisplay,
  hasAnswerSelected,
  loadLesson,
} from "@/lib/beego/lesson-player";

export default function LessonPlayer({ lessonId }) {
  const router = useRouter();
  const lesson = useMemo(() => loadLesson(lessonId), [lessonId]);
  const total = lesson.questions.length;

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [lives, setLives] = useState(lesson.lives);
  const [correctCount, setCorrectCount] = useState(0);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [phase, setPhase] = useState("playing");

  const question = lesson.questions[index];
  const progress = phase === "complete" ? 100 : Math.round((index / total) * 100);

  const canCheck = hasAnswerSelected(question, answer) && !feedback;

  const handleCheck = useCallback(() => {
    if (!canCheck) return;
    const ok = checkAnswer(question, answer);
    setFeedback(ok ? "correct" : "wrong");
    if (ok) {
      setCorrectCount((c) => c + 1);
    } else if (lives > 0) {
      setLives((l) => l - 1);
    }
  }, [canCheck, question, answer, lives]);

  const handleContinue = useCallback(() => {
    if (index >= total - 1) {
      setPhase("complete");
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
    setFeedback(null);
  }, [index, total]);

  const handleSkip = useCallback(() => {
    if (feedback) return;
    if (index >= total - 1) {
      setPhase("complete");
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
  }, [feedback, index, total]);

  const handleExit = useCallback(() => {
    if (window.confirm("Bạn muốn thoát bài học? Tiến độ sẽ không được lưu.")) {
      router.push("/");
    }
  }, [router]);

  if (phase === "complete") {
    return (
      <div className="beego-lesson-player beego-lesson-player--complete">
        <LessonCompleteScreen
          lesson={lesson}
          correctCount={correctCount}
          total={total}
          livesLeft={lives}
        />
      </div>
    );
  }

  return (
    <div className={`beego-lesson-player${keyboardMode ? " beego-lesson-player--keyboard" : ""}`}>
      <LessonTopBar progress={progress} lives={lives} onExit={handleExit} />

      <main className="beego-lesson-player__main">
        <QuestionRenderer
          question={question}
          answer={answer}
          onAnswerChange={setAnswer}
          feedback={feedback}
          correctId={
            question.type === "translate_word_bank" ? null : question.correctAnswer
          }
        />
        {keyboardMode ? (
          <input
            type="text"
            className="beego-lesson-keyboard-input"
            placeholder="Nhập đáp án..."
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={!!feedback}
          />
        ) : null}
      </main>

      {feedback ? (
        <LessonFeedbackBar
          correct={feedback === "correct"}
          correctAnswerText={getCorrectAnswerDisplay(question)}
          explanation={question.explanation}
          onContinue={handleContinue}
        />
      ) : (
        <LessonBottomBar
          canCheck={canCheck}
          onSkip={handleSkip}
          onCheck={handleCheck}
          keyboardMode={keyboardMode}
          onToggleKeyboard={() => setKeyboardMode((v) => !v)}
        />
      )}
    </div>
  );
}
