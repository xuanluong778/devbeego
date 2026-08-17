"use client";

import Link from "next/link";

export default function LessonCompleteScreen({ lesson, correctCount, total, livesLeft }) {
  return (
    <div className="beego-lesson-complete">
      <div className="beego-lesson-complete__card">
        <span className="beego-lesson-complete__bee" aria-hidden>
          🐝
        </span>
        <h1>Hoàn thành bài học!</h1>
        <p className="beego-lesson-complete__title">{lesson.title}</p>
        <ul className="beego-lesson-complete__stats">
          <li>
            ✓ {correctCount}/{total} câu đúng
          </li>
          <li>🍯 +{lesson.honeyReward} Honey</li>
          <li>⭐ +{lesson.xpReward} XP</li>
          {livesLeft > 0 ? <li>❤️ Còn {livesLeft} tim</li> : null}
        </ul>
        <p className="beego-lesson-complete__msg">Beego tự hào về bạn! Học tiếp nào.</p>
        <Link href="/" className="beego-lesson-complete__cta">
          Về lộ trình học
        </Link>
      </div>
    </div>
  );
}
