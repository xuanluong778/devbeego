"use client";

export default function LessonBottomBar({ canCheck, onSkip, onCheck, keyboardMode, onToggleKeyboard }) {
  return (
    <footer className="beego-lesson-bottombar">
      <button type="button" className="beego-lesson-bottombar__link" onClick={onSkip}>
        Bỏ qua
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
        Kiểm tra
      </button>
    </footer>
  );
}
