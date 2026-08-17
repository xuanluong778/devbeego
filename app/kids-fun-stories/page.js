"use client";

import Link from "next/link";
import StoryList from "@/components/kids-stories/StoryList";
import styles from "@/components/kids-vocabulary/KidsVocabulary.module.css";

export default function KidsFunStoriesPage() {
  return (
    <main className={styles.wrap}>
      <header className={styles.hero}>
        <h1>Học tiếng Anh qua câu truyện 📖</h1>
        <p>
          Đọc truyện song ngữ — Truyện cho bé, Truyện Hay, Truyện cười vui nhộn. Tra từ khi đọc, nghe đọc,
          trả lời câu hỏi và chơi mini game!
        </p>
        <div className={styles.row} style={{ marginTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <Link href="/" className={`${styles.bigBtn} ${styles.bigBtnGhost}`}>
            ← Trang chủ
          </Link>
          <Link href="/vocabulary" className={`${styles.bigBtn} ${styles.bigBtnGhost}`}>
            Từ vựng
          </Link>
          <Link href="/kids" className={`${styles.bigBtn} ${styles.bigBtnGhost}`}>
            🐝 Beego Kids
          </Link>
        </div>
      </header>
      <StoryList />
    </main>
  );
}
