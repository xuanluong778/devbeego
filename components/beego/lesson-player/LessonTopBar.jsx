"use client";

import { useEffect, useState } from "react";
import { lessonSfxEnabled, setLessonSfxEnabled, subscribeLessonSfx } from "@/lib/beego/learn/lesson-sfx";

function ExitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function SoundIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
      <path d="M4 10h3l4-3v10l-4-3H4z" fill="currentColor" />
      {on ? (
        <path d="M16 9a4 4 0 0 1 0 6" fill="none" stroke="currentColor" strokeWidth="2" />
      ) : (
        <path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="2" />
      )}
    </svg>
  );
}

export default function LessonTopBar({ progress, lives, onExit, stepLabel = "" }) {
  const [sfxOn, setSfxOn] = useState(true);

  useEffect(() => {
    setSfxOn(lessonSfxEnabled());
    return subscribeLessonSfx(setSfxOn);
  }, []);

  return (
    <header className="beego-lesson-topbar">
      <button type="button" className="beego-lesson-topbar__exit" onClick={onExit} aria-label="Thoát bài học">
        <ExitIcon />
      </button>
      <div className="beego-lesson-topbar__progress">
        <div
          className="beego-lesson-topbar__track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến độ bài học"
        >
          <span className="beego-lesson-topbar__fill" style={{ width: `${progress}%` }} />
        </div>
        {stepLabel ? (
          <span className="beego-lesson-topbar__step" aria-live="polite">
            {stepLabel}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="beego-lesson-topbar__sfx"
        aria-pressed={sfxOn}
        aria-label={sfxOn ? "Tắt âm hiệu ứng" : "Bật âm hiệu ứng"}
        title={sfxOn ? "Tắt âm hiệu ứng" : "Bật âm hiệu ứng"}
        onClick={() => setLessonSfxEnabled(!sfxOn)}
      >
        <SoundIcon on={sfxOn} />
      </button>
      <div className="beego-lesson-topbar__lives" aria-label={`${lives} lượt sai còn lại`}>
        <span className="beego-lesson-topbar__heart" aria-hidden>
          {lives}
        </span>
        <span>tim</span>
      </div>
    </header>
  );
}
