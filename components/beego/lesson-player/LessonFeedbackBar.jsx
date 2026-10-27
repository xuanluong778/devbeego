"use client";

import { useMemo } from "react";
import { nextCorrectPraise } from "@/lib/beego/learn/praise-messages";

export default function LessonFeedbackBar({
  correct,
  correctAnswerText,
  explanation,
  onContinue,
  onRetry,
  continueDisabled = false,
  praiseSeed,
  softPraise = false,
  mascot = false,
}) {
  const praise = useMemo(
    () => (correct ? nextCorrectPraise(praiseSeed, { soft: softPraise }) : ""),
    // Recompute only when a new correct result appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [correct, praiseSeed, correctAnswerText, softPraise]
  );

  return (
    <footer
      className={`beego-lesson-feedback${correct ? " beego-lesson-feedback--correct" : " beego-lesson-feedback--wrong"}`}
      role="status"
    >
      {mascot ? (
        <span className={`beego-gate1-bee${correct ? " is-happy" : " is-coach"}`} aria-hidden>
          🐝
        </span>
      ) : null}
      <div className="beego-lesson-feedback__copy">
        {correct ? (
          <>
            <span className="beego-lesson-feedback__icon" aria-hidden>
              ✓
            </span>
            <strong className="beego-lesson-feedback__praise">{praise || (softPraise ? "Ổn rồi!" : "Giỏi quá!")}</strong>
            {softPraise && explanation ? <small>{explanation}</small> : null}
          </>
        ) : (
          <>
            <strong>Chưa đạt yêu cầu</strong>
            <p>
              {correctAnswerText && correctAnswerText !== "—" ? (
                <>
                  Gợi ý: <span>{correctAnswerText}</span>
                </>
              ) : (
                "Hãy nói lại theo đúng đề bài."
              )}
            </p>
            {explanation ? <small>{explanation}</small> : null}
            <small className="beego-lesson-feedback__encourage">
              Đọc gợi ý rồi thử lại, hoặc tiếp tục sang câu sau.
            </small>
          </>
        )}
      </div>
      <div className="beego-lesson-feedback__actions">
        {!correct && typeof onRetry === "function" ? (
          <button
            type="button"
            className="beego-lesson-feedback__retry"
            onClick={onRetry}
            disabled={continueDisabled}
          >
            Thử lại
          </button>
        ) : null}
        <button
          type="button"
          className="beego-lesson-feedback__continue"
          onClick={onContinue}
          disabled={continueDisabled}
        >
          {continueDisabled ? "Đang lưu..." : "Tiếp tục"}
        </button>
      </div>
    </footer>
  );
}
