"use client";

import { useEffect, useMemo, useRef } from "react";
import { nextCorrectPraise } from "@/lib/beego/learn/praise-messages";
import BeegoBee from "@/components/beego/learn/BeegoBee";

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export default function LessonFeedbackBar({
  correct,
  correctAnswerText,
  explanation,
  onContinue,
  onRetry,
  continueDisabled = false,
  praiseSeed,
  softPraise = false,
}) {
  const continueRef = useRef(null);
  const praise = useMemo(
    () => (correct ? nextCorrectPraise(praiseSeed, { soft: softPraise }) : ""),
    // Recompute only when a new correct result appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [correct, praiseSeed, correctAnswerText, softPraise]
  );

  useEffect(() => {
    continueRef.current?.focus();
  }, [correct, praiseSeed]);

  return (
    <footer
      className={`beego-lesson-feedback${correct ? " beego-lesson-feedback--correct" : " beego-lesson-feedback--wrong"}`}
      role="status"
      aria-live="polite"
    >
      <BeegoBee mood={correct ? "correct" : "coach"} />
      <div className="beego-lesson-feedback__copy">
        {correct ? (
          <>
            <span className="beego-lesson-feedback__icon" aria-hidden>
              <CheckMark />
            </span>
            <strong className="beego-lesson-feedback__praise">{praise || (softPraise ? "Ổn rồi!" : "Giỏi quá!")}</strong>
            {softPraise && explanation ? <small>{explanation}</small> : null}
          </>
        ) : (
          <>
            <strong>Chưa đúng</strong>
            <p>
              {correctAnswerText && correctAnswerText !== "—" ? (
                <>
                  Gợi ý: <span>{correctAnswerText}</span>
                </>
              ) : (
                "Xem lại câu rồi thử lần nữa."
              )}
            </p>
            {explanation ? <small>{explanation}</small> : null}
            <small className="beego-lesson-feedback__encourage">
              Bạn có thể thử lại hoặc sang câu tiếp theo.
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
          ref={continueRef}
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
