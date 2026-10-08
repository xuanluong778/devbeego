"use client";

import Link from "next/link";
import { getLessonHref, findActiveNode, getUpcomingReward } from "@/lib/beego/learning-path";
import { LISTENING_PATH } from "@/lib/beego/routes";

export default function LearnRightPanel({
  sections,
  streak,
  honeyPoints,
  missionsDone,
  missionsTotal,
  loading,
  xpToday = 0,
  dailyGoalXp = 30,
  dailyGoalPct = 0,
  dailyGoalCompleted = false,
}) {
  const active = findActiveNode(sections);
  const reward = getUpcomingReward(sections);
  const ctaHref = active ? getLessonHref(active.node) || LISTENING_PATH : LISTENING_PATH;
  const questPct = missionsTotal ? Math.round((missionsDone / missionsTotal) * 100) : 0;
  const goalPct = Math.max(0, Math.min(100, Number(dailyGoalPct) || 0));

  return (
    <aside className="beego-learn-panel" aria-label="Tiến độ học">
      <div className="beego-learn-panel__stats">
        <div className="beego-learn-panel__stat beego-learn-panel__stat--streak">
          <span aria-hidden>🔥</span>
          <div>
            <strong>{loading ? "…" : streak}</strong>
            <small>ngày streak</small>
          </div>
        </div>
        <div className="beego-learn-panel__stat beego-learn-panel__stat--honey">
          <span aria-hidden>🍯</span>
          <div>
            <strong>{loading ? "…" : honeyPoints.toLocaleString("vi-VN")}</strong>
            <small>Honey Point</small>
          </div>
        </div>
      </div>

      <div className="beego-learn-panel__card beego-learn-panel__card--daily-goal">
        <h3 className="beego-learn-panel__title">
          <span aria-hidden>🎯</span> Daily Goal
          {dailyGoalCompleted ? (
            <span className="beego-learn-panel__goal-done"> Đạt rồi</span>
          ) : null}
        </h3>
        <div
          className="beego-learn-panel__mission-bar"
          role="progressbar"
          aria-valuenow={goalPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="beego-learn-panel__mission-fill" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="beego-learn-panel__meta">
          <span aria-hidden>⭐</span> {loading ? "…" : xpToday}/{dailyGoalXp} XP hôm nay · {goalPct}%
        </p>
      </div>

      <div className="beego-learn-panel__card">
        <h3 className="beego-learn-panel__title">Nhiệm vụ hôm nay</h3>
        <div className="beego-learn-panel__mission-bar" role="progressbar" aria-valuenow={questPct} aria-valuemin={0} aria-valuemax={100}>
          <span className="beego-learn-panel__mission-fill" style={{ width: `${questPct}%` }} />
        </div>
        <p className="beego-learn-panel__meta">
          {missionsDone}/{missionsTotal} hoàn thành
        </p>
      </div>

      {reward ? (
        <div className="beego-learn-panel__card beego-learn-panel__card--chest">
          <span className="beego-learn-panel__chest-icon" aria-hidden>
            🎁
          </span>
          <div>
            <strong>Rương sắp mở</strong>
            <p>{reward.hint}</p>
            {reward.honeyReward ? (
              <span className="beego-learn-panel__reward-tag">+{reward.honeyReward} Honey</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {active ? (
        <div className="beego-learn-panel__card beego-learn-panel__card--active">
          <p className="beego-learn-panel__eyebrow">Bài đang học</p>
          <strong>{active.node.title}</strong>
          {active.section.level ? (
            <span className="beego-learn-panel__level">{active.section.level}</span>
          ) : null}
        </div>
      ) : null}

      <Link className="beego-learn-panel__cta" href={ctaHref}>
        Continue Learning <span aria-hidden>▶</span>
      </Link>
    </aside>
  );
}
