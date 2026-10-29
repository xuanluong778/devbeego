"use client";

import { useMemo } from "react";
import Link from "next/link";
import styles from "./LessonAiConversation.module.css";
import { nextCorrectPraise } from "@/lib/beego/learn/praise-messages";
import BeegoBee from "@/components/beego/learn/BeegoBee";

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
  gate1 = false,
  callSlot = null,
  onRetrySave,
  elapsedSeconds = null,
  masteryEvidence = null,
  onAiPractice,
}) {
  const title = lesson?.title || "Bài học Beego";
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : null;
  const elapsedLabel =
    Number.isFinite(elapsedSeconds) && elapsedSeconds > 0
      ? `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`
      : "";
  const celebrateLine = useMemo(
    () => (celebrate && !replay && !saving ? nextCorrectPraise(correctCount + total) : ""),
    [celebrate, replay, saving, correctCount, total]
  );

  return (
    <div
      className={`beego-lesson-complete${celebrate ? " beego-lesson-complete--celebrate" : ""}${gate1 ? " beego-lesson-complete--gate1" : ""}`}
      aria-busy={saving}
    >
      <div className="beego-lesson-complete__card">
        <span className="beego-lesson-complete__bee" aria-hidden>
          <BeegoBee mood={saving ? "encourage" : errorMessage ? "coach" : "complete"} />
        </span>
        <h1>{saving ? "Đang lưu tiến độ…" : replay ? "Đã học lại bài này" : "Hoàn thành bài học!"}</h1>
        {celebrateLine ? <p className="beego-lesson-complete__praise">{celebrateLine}</p> : null}
        <p className="beego-lesson-complete__title">{title}</p>
        <ul className="beego-lesson-complete__stats">
          <li>
            Đúng {correctCount}/{total}
            {accuracy != null ? ` · ${accuracy}%` : ""}
          </li>
          {elapsedLabel ? <li>Thời gian làm bài {elapsedLabel}</li> : null}
          {saving ? (
            <li>Đang lưu tiến độ. Chưa đồng bộ xong.</li>
          ) : guest ? (
            <li>Đăng nhập để lưu XP, Honey và mở bài tiếp theo.</li>
          ) : errorMessage ? (
            <li>{errorMessage}</li>
          ) : (
            <>
              <li>
                {replay
                  ? "Không cộng thêm Honey"
                  : `+${honeyAwarded} Honey${alreadyCompleted ? " (đã hoàn thành trước đó)" : ""}`}
              </li>
              {replay ? null : <li>+{xpAwarded} XP</li>}
              {streak != null ? <li>Chuỗi {streak} ngày</li> : null}
            </>
          )}
          {livesLeft > 0 ? (
            <li>Còn {livesLeft} tim</li>
          ) : (
            <li>Hoàn thành ở chế độ luyện có hướng dẫn</li>
          )}
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
                ? "Chưa lưu được. Bấm thử lưu lại, tiến độ chưa được cộng."
                : replay
                  ? "Bài vẫn được tính là đã hoàn thành."
                  : "Beego tự hào về bạn! Học tiếp nào."}
        </p>
        {errorMessage && typeof onRetrySave === "function" ? (
          <button type="button" className="beego-lesson-complete__cta" onClick={onRetrySave} disabled={saving}>
            Thử lưu lại
          </button>
        ) : null}
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
