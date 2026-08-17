"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BEEGO_BRAND } from "@/lib/beego/brand";
import { readOnboardingProfile } from "@/lib/beego/onboarding-storage";
import { LISTENING_PATH } from "@/lib/beego/routes";
import DailyMissionCard from "@/components/beego/DailyMissionCard";
import { getDisplayName, getSuggestedLesson } from "@/lib/beego/today-home";

function GuestHome() {
  return (
    <div className="bh-today bh-today--guest">
      <section className="bh-guest-hero">
        <span className="bh-guest-hero__bee" aria-hidden>
          🐝
        </span>
        <h1>Hôm nay học gì?</h1>
        <p>{BEEGO_BRAND.tagline}</p>
        <Link href="/onboarding" className="bh-yellow-cta">
          <span aria-hidden>▶</span> Bắt đầu học 5 phút
        </Link>
      </section>
    </div>
  );
}

function TodayHome({ profile, userName, loggedIn, dash, dashLoading }) {
  const lesson = getSuggestedLesson(profile);
  const [streakFreeze, setStreakFreeze] = useState(true);

  const streak = Number(dash?.streak ?? 7);
  const honeyPoints = Number(dash?.xp_total ?? 1250);
  const firstName = getDisplayName(userName);

  const lessonCurrent = lesson.progressCurrent ?? 2;
  const lessonTotal = lesson.progressTotal ?? 5;
  const lessonPct = Math.round((lessonCurrent / lessonTotal) * 100);

  return (
    <div className="bh-today bh-today--desk">
      <div className="bh-today__bg" aria-hidden>
        <span className="bh-today__cloud bh-today__cloud--1" />
        <span className="bh-today__cloud bh-today__cloud--2" />
        <span className="bh-today__drop bh-today__drop--1">🍯</span>
        <span className="bh-today__drop bh-today__drop--2">🍯</span>
      </div>

      <header className="bh-desk-header">
        <div className="bh-desk-header__copy">
          <h1 className="bh-desk-header__title">
            Xin chào, {firstName}! <span aria-hidden>👋</span>
          </h1>
          <p className="bh-desk-header__sub bh-desk-header__sub--desk">
            Hôm nay bạn muốn học gì nào?
          </p>
          <p className="bh-desk-header__sub bh-desk-header__sub--mobile">
            Hoàn thành nhiệm vụ mỗi ngày để tiến bộ nhanh hơn nhé!
          </p>
        </div>
        <div className="bh-desk-header__mascot" aria-hidden>
          <span className="bh-desk-header__bee">🐝</span>
          <span className="bh-desk-header__wand">🍯</span>
        </div>
        <div className="bh-desk-header__actions">
          <div className="bh-header-pills">
            <span className="bh-header-pill bh-header-pill--honey">
              <span aria-hidden>🍯</span>
              {dashLoading ? "…" : honeyPoints.toLocaleString("vi-VN")}
              <Link href="/progress" className="bh-header-pill__plus" aria-label="Xem điểm">
                +
              </Link>
            </span>
            <span className="bh-header-pill bh-header-pill--streak">
              <span aria-hidden>🔥</span>
              {dashLoading ? "…" : streak} ngày liên tiếp
            </span>
          </div>
          <button type="button" className="bh-icon-btn bh-icon-btn--desk" aria-label="Thông báo (3)">
            🔔
            <span className="bh-icon-btn__badge">3</span>
          </button>
          <Link href="/account" className="bh-avatar-btn" aria-label="Tài khoản">
            <span aria-hidden>👤</span>
          </Link>
        </div>
      </header>

      <div className="bh-desk-grid">
        <div className="bh-desk-col bh-desk-col--main">
          <div className="bh-mini-stats">
            <div className="bh-mini-stat bh-mini-stat--streak">
              <div className="bh-mini-stat__top">
                <span className="bh-mini-stat__label">🔥 Streak</span>
                <span className="bh-mini-stat__bee" aria-hidden>
                  🐝
                </span>
              </div>
              <strong className="bh-mini-stat__value">{dashLoading ? "…" : streak}</strong>
              <span className="bh-mini-stat__unit">ngày liên tiếp</span>
            </div>
            <div className="bh-mini-stat bh-mini-stat--honey">
              <div className="bh-mini-stat__top">
                <span className="bh-mini-stat__label">🍯 Honey Point</span>
                <Link href="/progress" className="bh-mini-stat__plus" aria-label="Xem điểm thưởng">
                  +
                </Link>
              </div>
              <strong className="bh-mini-stat__value">
                {dashLoading ? "…" : honeyPoints.toLocaleString("vi-VN")}
              </strong>
            </div>
          </div>

          <section className="bh-lesson-today">
            <h2 className="bh-card-title">
              <span aria-hidden>📖</span> Bài học hôm nay
            </h2>
            <div className="bh-lesson-today__body">
              <div className="bh-lesson-today__info">
                <span className="bh-pill">{lesson.badge}</span>
                <h3 className="bh-lesson-today__name">{lesson.lessonName}</h3>
                <p className="bh-lesson-today__level">Trình độ: {lesson.levelLabel}</p>
                <div className="bh-lesson-today__progress">
                  <div className="bh-purple-bar">
                    <div className="bh-purple-bar__fill" style={{ width: `${lessonPct}%` }} />
                  </div>
                  <span className="bh-lesson-today__progress-label">
                    {lessonCurrent}/{lessonTotal}
                  </span>
                </div>
              </div>
              <div className="bh-lesson-today__art" aria-hidden>
                {lesson.emoji}
              </div>
            </div>
            <Link href={lesson.href || LISTENING_PATH} className="bh-yellow-cta bh-yellow-cta--full">
              <span aria-hidden>▶</span> {lesson.cta || "Bắt đầu học 5 phút"}
            </Link>
          </section>

          <section className="bh-chest-card bh-chest-card--desk">
            <div className="bh-chest-card__copy">
              <p className="bh-chest-card__text">
                Hoàn thành nhiệm vụ bên phải để mở rương thưởng hôm nay!
              </p>
            </div>
            <span className="bh-chest-card__icon" aria-hidden>
              🎁
            </span>
          </section>
        </div>

        <aside className="bh-desk-col bh-desk-col--side">
          <DailyMissionCard
            profile={profile}
            dash={dash}
            dashLoading={dashLoading}
            variant="sidebar"
          />

          <section className="bh-freeze-card">
            <span className="bh-freeze-card__icon" aria-hidden>
              ❄️
            </span>
            <div className="bh-freeze-card__copy">
              <strong>Streak Freeze</strong>
              <p>Bảo vệ chuỗi học của bạn khỏi bị gián đoạn.</p>
            </div>
            <button
              type="button"
              className={`bh-toggle${streakFreeze ? " bh-toggle--on" : ""}`}
              role="switch"
              aria-checked={streakFreeze}
              aria-label="Bật Streak Freeze"
              onClick={() => setStreakFreeze((v) => !v)}
            >
              <span className="bh-toggle__knob" />
            </button>
          </section>

          {loggedIn === false ? (
            <p className="bh-login-hint">
              <Link href="/auth">Đăng nhập</Link> để lưu streak và điểm thưởng.
            </p>
          ) : null}
        </aside>
      </div>

      {/* Mobile: mission card + lesson CTA */}
      <div className="bh-mobile-missions">
        <DailyMissionCard
          profile={profile}
          dash={dash}
          dashLoading={dashLoading}
          variant="standalone"
        />
        <Link href={lesson.href || LISTENING_PATH} className="bh-yellow-cta bh-yellow-cta--full bh-mobile-lesson-cta">
          <span aria-hidden>▶</span> Bắt đầu học 5 phút
        </Link>
      </div>
    </div>
  );
}

export default function BeegoLearnHome() {
  const [profile, setProfile] = useState(null);
  const [loggedIn, setLoggedIn] = useState(null);
  const [userName, setUserName] = useState("");
  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    const load = () => setProfile(readOnboardingProfile());
    load();
    window.addEventListener("beego:onboarding", load);
    return () => window.removeEventListener("beego:onboarding", load);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled) {
          const ok = res.ok && json.success;
          setLoggedIn(ok);
          setUserName(ok ? json.data?.name || "" : "");
        }
      } catch {
        if (!cancelled) {
          setLoggedIn(false);
          setUserName("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || !profile) return;
    let cancelled = false;
    setDashLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store", credentials: "same-origin" });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.success) setDash(json.data);
      } catch {
        /* fallback */
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loggedIn, profile]);

  if (!profile) return <GuestHome />;

  return (
    <TodayHome
      profile={profile}
      userName={userName}
      loggedIn={loggedIn}
      dash={dash}
      dashLoading={dashLoading}
    />
  );
}
