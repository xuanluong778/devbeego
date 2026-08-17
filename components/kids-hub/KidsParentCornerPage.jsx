"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getParentStats } from "@/lib/kids-hub/rewards";
import { KIDS_SAFETY_NOTE } from "@/lib/kids-hub/ai-teacher";
import hubStyles from "./KidsHub.module.css";

export default function KidsParentCornerPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    function refresh() {
      setStats(getParentStats());
    }
    refresh();
    window.addEventListener("kids_rewards_updated", refresh);
    window.addEventListener("kids_vocab_progress", refresh);
    return () => {
      window.removeEventListener("kids_rewards_updated", refresh);
      window.removeEventListener("kids_vocab_progress", refresh);
    };
  }, []);

  if (!stats) {
    return (
      <main className={hubStyles.wrap}>
        <div className={hubStyles.inner}>
          <p style={{ textAlign: "center", fontWeight: 800 }}>Đang tải…</p>
        </div>
      </main>
    );
  }

  return (
    <main className={hubStyles.wrap}>
      <div className={hubStyles.inner}>
        <div className={hubStyles.topBar}>
          <Link href="/kids" className={hubStyles.homeLink}>
            ← Beego Kids
          </Link>
        </div>

        <header className={hubStyles.pageHeader}>
          <h1>👨‍👩‍👧 Góc phụ huynh</h1>
          <p style={{ fontWeight: 800, margin: 0 }}>Theo dõi tiến độ học trên máy này</p>
        </header>

        <div className={hubStyles.parentGrid}>
          <div className={hubStyles.statCard}>
            <strong>~{stats.studyMinutesEst} phút</strong>
            <span>Thời gian học ước tính</span>
          </div>
          <div className={hubStyles.statCard}>
            <strong>{stats.wordsLearned} từ</strong>
            <span>Từ đã học</span>
          </div>
          <div className={hubStyles.statCard}>
            <strong>{stats.lessonsCompleted} bài</strong>
            <span>Bài hoàn thành</span>
          </div>
          <div className={hubStyles.statCard}>
            <strong>{stats.storiesCompleted} truyện</strong>
            <span>Truyện đã đọc</span>
          </div>
          <div className={hubStyles.statCard}>
            <strong>{stats.avgPronunciation != null ? `${stats.avgPronunciation}%` : "—"}</strong>
            <span>Điểm phát âm TB</span>
          </div>
          <div className={hubStyles.statCard}>
            <strong>⭐ {stats.stars} · 🔥 {stats.streak} ngày</strong>
            <span>Sao & streak</span>
          </div>
        </div>

        <section className={hubStyles.section} style={{ marginTop: "1.25rem" }}>
          <h2 className={hubStyles.sectionTitle}>📊 Tiến độ theo chủ đề</h2>
          <div className={hubStyles.card}>
            {stats.topicStats.map((t) => (
              <div key={t.id} className={hubStyles.topicProgress}>
                <span style={{ minWidth: 90 }}>{t.titleVi}</span>
                <div className={hubStyles.bar}>
                  <div
                    className={hubStyles.barFill}
                    style={{ width: `${Math.round((100 * t.done) / Math.max(1, t.total))}%` }}
                  />
                </div>
                <span>
                  {t.done}/{t.total}
                </span>
              </div>
            ))}
          </div>
        </section>

        {stats.wordsWeak.length > 0 ? (
          <section className={hubStyles.section}>
            <h2 className={hubStyles.sectionTitle}>💡 Luyện thêm</h2>
            <div className={hubStyles.card}>
              <p style={{ margin: 0, fontWeight: 800 }}>
                Từ cần luyện: {stats.wordsWeak.join(", ")}
              </p>
              <Link href="/kids-learn-vocabulary" className={hubStyles.parentBtn} style={{ marginTop: "0.75rem" }}>
                Vào bài học →
              </Link>
            </div>
          </section>
        ) : null}

        <p className={hubStyles.safetyNote}>{KIDS_SAFETY_NOTE}</p>
        <p style={{ textAlign: "center", fontSize: "0.8rem", fontWeight: 700, opacity: 0.7 }}>
          Dữ liệu lưu trên trình duyệt — chưa đồng bộ cloud.
        </p>
      </div>
    </main>
  );
}
