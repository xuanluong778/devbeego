"use client";

export default function LessonTopBar({ progress, lives, onExit }) {
  return (
    <header className="beego-lesson-topbar">
      <button type="button" className="beego-lesson-topbar__exit" onClick={onExit} aria-label="Thoát">
        ✕
      </button>
      <div className="beego-lesson-topbar__progress">
        <div className="beego-lesson-topbar__track">
          <span className="beego-lesson-topbar__fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="beego-lesson-topbar__lives" aria-label={`${lives} lượt sai còn lại`}>
        {Array.from({ length: Math.max(lives, 0) }).map((_, i) => (
          <span key={i} className="beego-lesson-topbar__heart" aria-hidden>
            ❤️
          </span>
        ))}
        {lives === 0 ? <span className="beego-lesson-topbar__heart beego-lesson-topbar__heart--empty">💔</span> : null}
      </div>
    </header>
  );
}
