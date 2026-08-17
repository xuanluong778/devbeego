"use client";

import Link from "next/link";
import LessonList from "@/components/kids-vocabulary/LessonList";
import ProgressDashboard from "@/components/kids-vocabulary/ProgressDashboard";
import styles from "@/components/kids-vocabulary/KidsVocabulary.module.css";

export default function KidsLearnVocabularyPage() {
  return (
    <main className={styles.wrap}>
      <header className={styles.hero}>
        <h1>🐝 Beego Kids</h1>
        <p>Chọn chủ đề — học ngắn, có hình, có âm thanh, có thưởng sao!</p>
        <div className={styles.row} style={{ marginTop: "0.75rem", gap: "0.5rem", justifyContent: "center" }}>
          <Link href="/kids" className={`${styles.bigBtn} ${styles.bigBtnPrimary}`}>
            🏠 Trang Kids
          </Link>
          <Link href="/kids-fun-stories" className={`${styles.bigBtn} ${styles.bigBtnGhost}`}>
            📖 Truyện vui
          </Link>
        </div>
      </header>
      <LessonList />
      <ProgressDashboard />
    </main>
  );
}
