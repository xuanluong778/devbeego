"use client";

import Link from "next/link";
import styles from "./KidsVocabulary.module.css";

export default function RewardScreen({ stars, points, lessonTitle }) {
  const s = Math.max(1, Math.min(3, stars));
  return (
    <div className={styles.cardInner}>
      <p className={styles.stars}>{"⭐".repeat(s)}</p>
      <h2 className={styles.wordTitle} style={{ fontSize: "1.5rem" }}>
        Hoàn thành: {lessonTitle}
      </h2>
      <p style={{ fontWeight: 900, color: "#334" }}>Điểm thưởng: {points} điểm</p>
      <div className={styles.badgeRow}>
        <span className={styles.badge}>🏅 Học giỏi</span>
        <span className={styles.badge}>🎨 Sticker</span>
        <span className={styles.badge}>🌈 Siêu nhân từ vựng</span>
      </div>
      <div className={styles.row}>
        <Link href="/kids" className={`${styles.bigBtn} ${styles.bigBtnPrimary}`}>
          Về Beego Kids
        </Link>
        <Link href="/kids-learn-vocabulary" className={`${styles.bigBtn} ${styles.bigBtnGhost}`}>
          Chọn bài khác
        </Link>
      </div>
    </div>
  );
}
