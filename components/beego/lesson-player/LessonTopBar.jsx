"use client";

import { useEffect, useState } from "react";
import { lessonSfxEnabled, setLessonSfxEnabled, subscribeLessonSfx } from "@/lib/beego/learn/lesson-sfx";

export default function LessonTopBar({ progress, lives, onExit }) {
  const [sfxOn, setSfxOn] = useState(true);

  useEffect(() => {
    setSfxOn(lessonSfxEnabled());
    return subscribeLessonSfx(setSfxOn);
  }, []);

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
      <button
        type="button"
        className="beego-lesson-topbar__sfx"
        aria-pressed={sfxOn}
        aria-label={sfxOn ? "Tắt âm hiệu ứng" : "Bật âm hiệu ứng"}
        title={sfxOn ? "Tắt âm hiệu ứng" : "Bật âm hiệu ứng"}
        onClick={() => setLessonSfxEnabled(!sfxOn)}
      >
        {sfxOn ? "🔔" : "🔕"}
      </button>
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
