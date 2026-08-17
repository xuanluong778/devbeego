"use client";

import Link from "next/link";
import { getLessonHref, findActiveNode, getUpcomingReward } from "@/lib/beego/learning-path";
import { LISTENING_PATH } from "@/lib/beego/routes";

export default function LearnRightPanel({ sections, streak, honeyPoints, missionsDone, missionsTotal, loading }) {
  const active = findActiveNode(sections);
  const reward = getUpcomingReward(sections);
  const ctaHref = active ? getLessonHref(active.node) || LISTENING_PATH : LISTENING_PATH;

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

      <div className="beego-learn-panel__card">
        <h3 className="beego-learn-panel__title">Nhiệm vụ hôm nay</h3>
        <div className="beego-learn-panel__mission-bar">
          <span
            className="beego-learn-panel__mission-fill"
            style={{ width: `${missionsTotal ? (missionsDone / missionsTotal) * 100 : 0}%` }}
          />
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
              <span className="beego-learn-panel__reward-tag">+{reward.honeyReward} 🍯</span>
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
        Học tiếp 5 phút <span aria-hidden>▶</span>
      </Link>
    </aside>
  );
}
