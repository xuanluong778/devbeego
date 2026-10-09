"use client";

export default function LessonFeedbackBar({
  correct,
  correctAnswerText,
  explanation,
  onContinue,
  continueDisabled = false,
}) {
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
            <strong>Giỏi quá!</strong>
          </>
        ) : (
          <>
            <strong>Chưa đúng</strong>
            <p>
              Đáp án đúng: <span>{correctAnswerText}</span>
            </p>
            {explanation ? <small>{explanation}</small> : null}
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
