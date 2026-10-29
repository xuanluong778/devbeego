"use client";

/**
 * Compact motivation strip: streak + daily goal + XP today.
 * Guest-safe (shows zeros / defaults when loading/missing).
 */
function MiniIcon({ kind }) {
  const common = { viewBox: "0 0 24 24", width: 18, height: 18, "aria-hidden": true };
  if (kind === "streak") {
    return (
      <svg {...common}>
        <path fill="#FF8A3D" d="M12 3c1 3 3 4 6 5-3 1-4 3-5 6-1-3-3-5-6-6 3-1 5-2 5-5z" />
      </svg>
    );
  }
  if (kind === "goal") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" fill="none" stroke="#58CC02" strokeWidth="2.4" />
        <circle cx="12" cy="12" r="3" fill="#58CC02" />
      </svg>
    );
  }
  if (kind === "xp") {
    return (
      <svg {...common}>
        <path fill="#FFC944" d="M12 3l2.2 5.2L20 9l-4 3.6L17.2 18 12 15.2 6.8 18 8 12.6 4 9l5.8-.8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path fill="#FFC944" stroke="#C48A00" strokeWidth="1.2" d="M8 4h8l2 4-6 12L6 8l2-4z" />
    </svg>
  );
}

export default function LearnMobileStats({
  streak,
  honeyPoints,
  xpToday = 0,
  dailyGoalXp = 30,
  dailyGoalPct = 0,
  dailyGoalCompleted = false,
  celebrate = false,
  loading,
}) {
  const pct = Math.max(0, Math.min(100, Number(dailyGoalPct) || 0));

  return (
    <div
      className={`beego-learn-mobile-stats${celebrate || dailyGoalCompleted ? " beego-learn-mobile-stats--celebrate" : ""}`}
      aria-label="Mục tiêu học hôm nay"
    >
      <div className="beego-learn-mobile-stats__item beego-learn-mobile-stats__item--streak">
        <span className="beego-learn-mobile-stats__icon" aria-hidden>
          <MiniIcon kind="streak" />
        </span>
        <span className="beego-learn-mobile-stats__value">{loading ? "…" : streak}</span>
        <span className="beego-learn-mobile-stats__label">streak</span>
      </div>

      <div className="beego-learn-mobile-stats__item beego-learn-mobile-stats__item--goal">
        <span className="beego-learn-mobile-stats__icon" aria-hidden>
          <MiniIcon kind="goal" />
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
          <MiniIcon kind="xp" />
        </span>
        <span className="beego-learn-mobile-stats__value">
          {loading ? "…" : `${Number(xpToday || 0)}/${Number(dailyGoalXp || 30)}`}
        </span>
        <span className="beego-learn-mobile-stats__label">XP hôm nay</span>
      </div>

      <div className="beego-learn-mobile-stats__item beego-learn-mobile-stats__item--honey">
        <span className="beego-learn-mobile-stats__icon" aria-hidden>
          <MiniIcon kind="honey" />
        </span>
        <span className="beego-learn-mobile-stats__value">
          {loading ? "…" : Number(honeyPoints || 0).toLocaleString("vi-VN")}
        </span>
        <span className="beego-learn-mobile-stats__label">Honey</span>
      </div>
    </div>
  );
}
