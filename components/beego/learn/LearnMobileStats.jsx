"use client";

/**
 * Compact motivation strip: streak + daily goal + XP today.
 * Guest-safe (shows zeros / defaults when loading/missing).
 */
export default function LearnMobileStats({
  streak,
  honeyPoints,
  xpToday = 0,
  dailyGoalXp = 30,
  dailyGoalPct = 0,
  dailyGoalCompleted = false,
  loading,
}) {
  const pct = Math.max(0, Math.min(100, Number(dailyGoalPct) || 0));

  return (
    <div className="beego-learn-mobile-stats" aria-label="Mục tiêu học hôm nay">
      <div className="beego-learn-mobile-stats__item beego-learn-mobile-stats__item--streak">
        <span className="beego-learn-mobile-stats__icon" aria-hidden>
          🔥
        </span>
        <span className="beego-learn-mobile-stats__value">{loading ? "…" : streak}</span>
        <span className="beego-learn-mobile-stats__label">streak</span>
      </div>

      <div className="beego-learn-mobile-stats__item beego-learn-mobile-stats__item--goal">
        <span className="beego-learn-mobile-stats__icon" aria-hidden>
          🎯
        </span>
        <span className="beego-learn-mobile-stats__value">
          {loading ? "…" : `${pct}%`}
        </span>
        <span className="beego-learn-mobile-stats__label">
          {dailyGoalCompleted ? "đạt goal" : "daily goal"}
        </span>
        <span
          className="beego-learn-mobile-stats__bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="beego-learn-mobile-stats__bar-fill" style={{ width: `${pct}%` }} />
        </span>
      </div>

      <div className="beego-learn-mobile-stats__item beego-learn-mobile-stats__item--xp">
        <span className="beego-learn-mobile-stats__icon" aria-hidden>
          ⭐
        </span>
        <span className="beego-learn-mobile-stats__value">
          {loading ? "…" : `${Number(xpToday || 0)}/${Number(dailyGoalXp || 30)}`}
        </span>
        <span className="beego-learn-mobile-stats__label">XP hôm nay</span>
      </div>

      <div className="beego-learn-mobile-stats__item beego-learn-mobile-stats__item--honey">
        <span className="beego-learn-mobile-stats__icon" aria-hidden>
          🍯
        </span>
        <span className="beego-learn-mobile-stats__value">
          {loading ? "…" : Number(honeyPoints || 0).toLocaleString("vi-VN")}
        </span>
        <span className="beego-learn-mobile-stats__label">Honey</span>
      </div>
    </div>
  );
}
