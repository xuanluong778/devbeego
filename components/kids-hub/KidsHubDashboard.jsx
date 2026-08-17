"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KIDS_VOCAB_LESSONS } from "@/lib/kids-vocabulary/curriculum";
import { buildTodayPath } from "@/lib/kids-hub/today-path";
import { BADGE_DEFS, loadRewards } from "@/lib/kids-hub/rewards";
import { KIDS_SAFETY_NOTE } from "@/lib/kids-hub/ai-teacher";
import styles from "./KidsHub.module.css";

const ACTIONS = [
  { href: "/kids-learn-vocabulary", icon: "📚", label: "Học từ", bg: "#ffc8dd" },
  { href: "/kids/games", icon: "🎮", label: "Chơi game", bg: "#ffd166" },
  { href: "/kids/ai-teacher", icon: "🐝", label: "Nói AI", bg: "#06d6a0" },
  { href: "/kids-fun-stories", icon: "📖", label: "Truyện", bg: "#118ab2", color: "#fff" },
  { href: "#rewards", icon: "⭐", label: "Thưởng", bg: "#cdb4db" },
  { href: "/kids/parents", icon: "👨‍👩‍👧", label: "Phụ huynh", bg: "#bde0fe" },
];

export default function KidsHubDashboard() {
  const [childName, setChildName] = useState("bé");
  const [todayPath, setTodayPath] = useState([]);
  const [rewards, setRewards] = useState(null);

  useEffect(() => {
    document.body.classList.add("page-kids-hub");
    return () => document.body.classList.remove("page-kids-hub");
  }, []);

  useEffect(() => {
    function refresh() {
      setTodayPath(buildTodayPath());
      setRewards(loadRewards());
      try {
        const raw = window.localStorage.getItem("kids_child_name");
        if (raw && raw.length <= 20) setChildName(raw);
      } catch (_e) {}
    }
    refresh();
    window.addEventListener("kids_rewards_updated", refresh);
    window.addEventListener("kids_vocab_progress", refresh);
    return () => {
      window.removeEventListener("kids_rewards_updated", refresh);
      window.removeEventListener("kids_vocab_progress", refresh);
    };
  }, []);

  const badgeLabels = (rewards?.badges || [])
    .map((id) => BADGE_DEFS.find((b) => b.id === id))
    .filter(Boolean);

  return (
    <main className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.homeLink}>
            🏠 Về Beego
          </Link>
          <span style={{ fontWeight: 900, fontSize: "0.85rem", opacity: 0.7 }}>3–12 tuổi</span>
        </div>

        <header className={styles.hero}>
          <span className={styles.mascot} aria-hidden>
            🐝
          </span>
          <h1 className={styles.heroTitle}>Xin chào {childName}!</h1>
          <p className={styles.heroSub}>Beego Kids — học tiếng Anh vui vẻ mỗi ngày</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🗺️ Lộ trình hôm nay</h2>
          <div className={styles.todayGrid}>
            {todayPath.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={styles.todayCard}
                style={{ background: `${item.color}33` }}
              >
                <span className={styles.todayEmoji}>{item.emoji}</span>
                <span className={styles.todayLabel}>{item.title}</span>
                <span className={styles.todayDesc}>{item.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🎯 Chọn hoạt động</h2>
          <div className={styles.actionGrid}>
            {ACTIONS.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={styles.actionCard}
                style={{ background: a.bg, color: a.color || "#1a1a2e" }}
              >
                <span className={styles.actionIcon}>{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>🎨 Chủ đề</h2>
          <div className={styles.topicGrid}>
            {KIDS_VOCAB_LESSONS.map((lesson) => (
              <Link
                key={lesson.id}
                href={`/kids-learn-vocabulary/${lesson.id}`}
                className={styles.topicCard}
                style={{ background: `${lesson.color}44` }}
              >
                <span className={styles.topicEmoji}>{lesson.emoji}</span>
                {lesson.titleVi}
              </Link>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: "0.65rem" }}>
            <Link href="/kids-learn-vocabulary" className={styles.parentBtn}>
              Xem tất cả bài học →
            </Link>
          </p>
        </section>

        <section className={styles.section} id="rewards">
          <h2 className={styles.sectionTitle}>🏆 Phần thưởng của bé</h2>
          <div className={styles.rewardsPanel}>
            <div className={styles.rewardStat}>
              <div className={styles.rewardNum}>⭐ {rewards?.stars ?? 0}</div>
              <div className={styles.rewardLabel}>Sao thưởng</div>
            </div>
            <div className={styles.rewardStat}>
              <div className={styles.rewardNum}>🔥 {rewards?.streak?.count ?? 0}</div>
              <div className={styles.rewardLabel}>Ngày liên tiếp</div>
            </div>
            <div className={styles.rewardStat}>
              <div className={styles.rewardNum}>🏅 {badgeLabels.length}</div>
              <div className={styles.rewardLabel}>Huy hiệu</div>
            </div>
            <div className={styles.petBox}>
              <span style={{ fontSize: "2.5rem" }}>🐝</span>
              <div>
                <strong>{rewards?.pet?.name || "BeeBee"}</strong>
                <div style={{ fontSize: "0.82rem", fontWeight: 800 }}>
                  Cấp {rewards?.pet?.level ?? 1} · Vui {rewards?.pet?.happiness ?? 70}%
                </div>
              </div>
            </div>
            {badgeLabels.length > 0 ? (
              <div className={styles.badgeRow}>
                {badgeLabels.map((b) => (
                  <span key={b.id} className={styles.badge}>
                    {b.emoji} {b.label}
                  </span>
                ))}
              </div>
            ) : null}
            {(rewards?.stickers || []).length > 0 ? (
              <div className={styles.stickerRow}>
                {rewards.stickers.map((s) => (
                  <span key={s} className={styles.sticker}>
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ gridColumn: "1 / -1", textAlign: "center", fontWeight: 800, fontSize: "0.85rem", margin: 0 }}>
                Học thêm để nhận sticker nhé!
              </p>
            )}
          </div>
        </section>

        <p className={styles.safetyNote}>{KIDS_SAFETY_NOTE}</p>
      </div>
    </main>
  );
}
