"use client";

import Link from "next/link";
import styles from "./LessonAiConversation.module.css";

/**
 * @param {object} props
 * @param {{ title?: string }} props.lesson
 * @param {number} props.correctCount
 * @param {number} props.total
 * @param {number} props.livesLeft
 * @param {boolean} props.saving
 * @param {boolean} props.guest
 * @param {string} [props.errorMessage]
 * @param {number} props.xpAwarded
 * @param {number} props.honeyAwarded
 * @param {number|null} [props.streak]
 * @param {boolean} props.alreadyCompleted
 * @param {boolean} [props.replay]
 * @param {boolean} [props.showAiPractice]
 * @param {boolean} [props.celebrate]
 * @param {import("react").ReactNode} [props.callSlot]
 * @param {{ status: "absent" | "met" | "not_met", text: string } | null} [props.masteryEvidence]
 */
export default function LessonCompleteScreen({
  lesson,
  correctCount,
  total,
  livesLeft,
  saving = false,
  guest = false,
  errorMessage = "",
  xpAwarded = 0,
  honeyAwarded = 0,
  streak = null,
  alreadyCompleted = false,
  replay = false,
  showAiPractice = false,
  celebrate = false,
  callSlot = null,
  masteryEvidence = null,
  onAiPractice,
}) {
  const title = lesson?.title || "Bài học Beego";

  return (
    <div className={`beego-lesson-complete${celebrate ? " beego-lesson-complete--celebrate" : ""}`}>
      <div className="beego-lesson-complete__card">
        <span className="beego-lesson-complete__bee" aria-hidden>
          🐝
        </span>
        <h1>{saving ? "Đang lưu tiến độ…" : replay ? "Đã học lại bài này" : "Hoàn thành bài học!"}</h1>
        <p className="beego-lesson-complete__title">{title}</p>
        <ul className="beego-lesson-complete__stats">
          <li>
            ✓ {correctCount}/{total} câu đúng
          </li>
          {saving ? (
            <li>⏳ Đồng bộ lộ trình…</li>
          ) : guest ? (
            <li>🔐 Đăng nhập để lưu XP, Honey và mở bài tiếp theo.</li>
          ) : errorMessage ? (
            <li>⚠️ {errorMessage}</li>
          ) : (
            <>
              <li>
                🍯 {replay ? "Không cộng thêm Honey" : `+${honeyAwarded} Honey${alreadyCompleted ? " (đã hoàn thành trước đó)" : ""}`}
              </li>
              {replay ? null : (
                <li>
                  ⭐ +{xpAwarded} XP
                </li>
              )}
              {streak != null ? <li>🔥 Streak: {streak} ngày</li> : null}
            </>
          )}
          {livesLeft > 0 ? <li>❤️ Còn {livesLeft} tim</li> : null}
        </ul>
        {masteryEvidence ? (
          <p className={`beego-lesson-evidence beego-lesson-evidence--${masteryEvidence.status}`}>
            {masteryEvidence.text}
          </p>
        ) : null}
        <p className="beego-lesson-complete__msg">
          {saving
            ? "Vui lòng đợi trong giây lát."
            : guest
              ? "Bạn vẫn có thể xem lại bài; tiến độ lưu khi đã đăng nhập."
              : errorMessage
                ? "Thử quay lại lộ trình hoặc học lại sau."
                : replay
                  ? "Bài vẫn được tính là đã hoàn thành."
                  : "Beego tự hào về bạn! Học tiếp nào."}
        </p>
        <Link
          href="/"
          className="beego-lesson-complete__cta"
          aria-disabled={saving}
          onClick={(e) => {
            if (saving) e.preventDefault();
          }}
        >
          Về lộ trình học
        </Link>
        {callSlot || null}
        {showAiPractice ? (
          <button type="button" className={styles.secondaryCta} onClick={onAiPractice}>
            Thực hành với AI
          </button>
        ) : null}
      </div>
    </div>
  );
}
