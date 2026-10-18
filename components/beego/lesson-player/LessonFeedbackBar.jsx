"use client";

import { useMemo } from "react";
import { nextCorrectPraise } from "@/lib/beego/learn/praise-messages";

export default function LessonFeedbackBar({
  correct,
  correctAnswerText,
  explanation,
  onContinue,
  continueDisabled = false,
  praiseSeed,
}) {
  const praise = useMemo(
    () => (correct ? nextCorrectPraise(praiseSeed) : ""),
    // Recompute only when a new correct result appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [correct, praiseSeed, correctAnswerText]
  );

  return (
    <footer
      className={`beego-lesson-feedback${correct ? " beego-lesson-feedback--correct" : " beego-lesson-feedback--wrong"}`}
      role="status"
    >
      <div className="beego-lesson-feedback__copy">
        {correct ? (
          <>
            <span className="beego-lesson-feedback__icon" aria-hidden>
              ✓
            </span>
            <strong className="beego-lesson-feedback__praise">{praise || "Giỏi quá!"}</strong>
          </>
        ) : (
          <>
            <strong>Chưa đúng</strong>
            <p>
              Đáp án đúng: <span>{correctAnswerText}</span>
            </p>
            {explanation ? <small>{explanation}</small> : null}
            <small className="beego-lesson-feedback__encourage">Không sao — sửa ngay sẽ nhớ lâu hơn.</small>
          </>
        )}
      </div>
      <button
        type="button"
        className="beego-lesson-feedback__continue"
        onClick={onContinue}
        disabled={continueDisabled}
      >
        {continueDisabled ? "Đang lưu..." : "Tiếp tục"}
      </button>
    </footer>
  );
}
