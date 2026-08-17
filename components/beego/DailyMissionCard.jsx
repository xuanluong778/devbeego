"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MISSION_STATUS,
  buildDailyMissions,
  getMissionCta,
} from "@/lib/beego/daily-missions";

function MissionRow({ mission, celebrating }) {
  const pct = mission.progressTarget
    ? Math.min(100, Math.round((mission.progressCurrent / mission.progressTarget) * 100))
    : 0;

  const statusClass =
    mission.status === MISSION_STATUS.COMPLETED
      ? "dm-mission--done"
      : mission.status === MISSION_STATUS.IN_PROGRESS
        ? "dm-mission--active"
        : "";

  const barTone =
    mission.iconTone === "orange" && mission.status !== MISSION_STATUS.COMPLETED
      ? "dm-mission__bar--orange"
      : "";

  return (
    <Link
      href={mission.href}
      className={`dm-mission${statusClass ? ` ${statusClass}` : ""}${celebrating ? " dm-mission--celebrate" : ""}`}
    >
      <span className={`dm-mission__icon dm-mission__icon--${mission.iconTone || "purple"}`} aria-hidden>
        {mission.icon}
      </span>

      <span className="dm-mission__main">
        <span className="dm-mission__titles">
          <strong className="dm-mission__label">{mission.label}</strong>
          <small className="dm-mission__subtitle">{mission.subtitle}</small>
        </span>

        <span className="dm-mission__progress-row">
          <span className={`dm-mission__bar${barTone}${mission.status === MISSION_STATUS.COMPLETED ? " dm-mission__bar--done" : ""}`}>
            <span className="dm-mission__bar-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="dm-mission__count">{mission.progressLabel}</span>
        </span>

        <span className="dm-mission__reward">
          <span aria-hidden>🍯</span> +{mission.reward}
        </span>
      </span>

      <span
        className={`dm-mission__status dm-mission__status--${mission.status}${
          mission.status === MISSION_STATUS.IN_PROGRESS && mission.id === "quiz"
            ? " dm-mission__status--continue"
            : ""
        }`}
        aria-label={mission.statusLabel}
      >
        {mission.status === MISSION_STATUS.COMPLETED ? (
          <>
            <span aria-hidden>✓</span> {mission.statusLabel}
          </>
        ) : mission.status === MISSION_STATUS.IN_PROGRESS ? (
          mission.id === "quiz" ? (
            <>
              Tiếp tục <span aria-hidden>›</span>
            </>
          ) : (
            mission.statusLabel
          )
        ) : (
          mission.statusLabel
        )}
      </span>
    </Link>
  );
}

function CompletionToast({ visible, onDismiss }) {
  if (!visible) return null;

  return (
    <div className="dm-toast" role="status" aria-live="polite">
      <span className="dm-toast__spark" aria-hidden>
        ✨
      </span>
      <p>Tuyệt vời! Bạn vừa kiếm thêm mật ong 🍯</p>
      <button type="button" className="dm-toast__close" onClick={onDismiss} aria-label="Đóng">
        ×
      </button>
    </div>
  );
}

/**
 * Daily mission card — sidebar on desktop, compact vertical card on mobile.
 * @param {{ profile: object, dash?: object|null, dashLoading?: boolean, variant?: 'sidebar' | 'standalone' }} props
 */
export default function DailyMissionCard({
  profile,
  dash,
  dashLoading = false,
  variant = "sidebar",
}) {
  const missions = useMemo(() => buildDailyMissions(profile, dashLoading ? null : dash), [
    profile,
    dash,
    dashLoading,
  ]);
  const cta = useMemo(() => getMissionCta(missions), [missions]);

  const completedIds = useRef(new Set(missions.filter((m) => m.status === MISSION_STATUS.COMPLETED).map((m) => m.id)));
  const [celebratingId, setCelebratingId] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const newlyDone = missions.filter(
      (m) => m.status === MISSION_STATUS.COMPLETED && !completedIds.current.has(m.id)
    );
    if (!newlyDone.length) return;

    newlyDone.forEach((m) => completedIds.current.add(m.id));
    const first = newlyDone[0];
    setCelebratingId(first.id);
    setToastVisible(true);

    const t1 = window.setTimeout(() => setCelebratingId(null), 1400);
    const t2 = window.setTimeout(() => setToastVisible(false), 4500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [missions]);

  const doneCount = missions.filter((m) => m.status === MISSION_STATUS.COMPLETED).length;

  return (
    <section className={`dm-card dm-card--${variant}`}>
      <header className="dm-card__head">
        <div>
          <h2 className="dm-card__title">
            <span aria-hidden>📋</span> Nhiệm vụ hôm nay
          </h2>
          <p className="dm-card__sub">
            Hoàn thành tất cả để nhận phần thưởng hấp dẫn!{" "}
            <span className="dm-card__info" title="Hoàn thành 3 nhiệm vụ mỗi ngày để mở rương thưởng">
              ⓘ
            </span>
          </p>
        </div>
        <span className="dm-card__ratio" aria-label={`${doneCount} trên ${missions.length} nhiệm vụ`}>
          {doneCount}/{missions.length}
        </span>
      </header>

      <div className="dm-card__list">
        {missions.map((mission) => (
          <MissionRow
            key={mission.id}
            mission={mission}
            celebrating={celebratingId === mission.id}
          />
        ))}
      </div>

      <div className="dm-chest-banner">
        <div className="dm-chest-banner__visual" aria-hidden>
          <span className="dm-chest-banner__chest">🎁</span>
          <span className="dm-chest-banner__bee">🐝</span>
          <span className="dm-chest-banner__spark dm-chest-banner__spark--1">✨</span>
          <span className="dm-chest-banner__spark dm-chest-banner__spark--2">✨</span>
        </div>
        <div className="dm-chest-banner__copy">
          <p className="dm-chest-banner__eyebrow">Hoàn thành tất cả nhiệm vụ</p>
          <strong className="dm-chest-banner__title">Nhận rương thưởng</strong>
          <p className="dm-chest-banner__desc">Chứa tới 50 Honey Point và bất ngờ khác!</p>
        </div>
        <Link href={cta.href} className="dm-chest-banner__cta">
          {cta.label} <span aria-hidden>{cta.icon}</span>
        </Link>
      </div>

      <CompletionToast visible={toastVisible} onDismiss={() => setToastVisible(false)} />
    </section>
  );
}
