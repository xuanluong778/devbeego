"use client";

export default function LessonBottomBar({
  canCheck,
  busy = false,
  onSkip,
  onCheck,
  keyboardMode,
  onToggleKeyboard,
  skipDisabled = false,
  skipLabel = "Bỏ qua",
}) {
  return (
    <footer className="beego-lesson-bottombar">
      <button
        type="button"
        className="beego-lesson-bottombar__link"
        onClick={onSkip}
        disabled={skipDisabled}
        aria-disabled={skipDisabled}
        title={skipDisabled ? "Bài bắt buộc — không bỏ qua" : undefined}
      >
        {skipLabel}
      </button>
      <button type="button" className="beego-lesson-bottombar__link" onClick={onToggleKeyboard}>
        {keyboardMode ? "Ẩn bàn phím" : "Sử dụng bàn phím"}
      </button>
      <button
        type="button"
        className={`beego-lesson-bottombar__check${canCheck ? " beego-lesson-bottombar__check--active" : ""}`}
        onClick={onCheck}
        disabled={!canCheck}
      >
        {busy ? "Đang chấm..." : "Kiểm tra"}
      </button>
    </footer>
  );
}
