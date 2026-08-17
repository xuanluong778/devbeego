"use client";

export default function SpeakingPageHeader({
  streakDays = 7,
  minutesToday = 12,
  avgScore = null,
  onHistory,
  onRestart,
  restartDisabled = false,
}) {
  const scoreLabel = avgScore != null ? `${avgScore}/100` : "—";

  return (
    <header className="speaking-hero">
      <div className="speaking-hero__intro">
        <div className="speaking-hero__title-row">
          <span className="speaking-hero__mic-icon" aria-hidden>
            🎙️
          </span>
          <div>
            <h1 className="speaking-hero__title">
              <span className="speaking-hero__title-full">Beego Speaking AI</span>
              <span className="speaking-hero__title-short">Luyện nói AI</span>
            </h1>
            <p className="speaking-hero__subtitle">Luyện đàm thoại 2 chiều với AI mỗi ngày</p>
          </div>
        </div>
      </div>

      <div className="speaking-hero__stats" aria-label="Thống kê luyện nói">
        <div className="speaking-stat-chip">
          <span className="speaking-stat-chip__icon" aria-hidden>
            🔥
          </span>
          <span className="speaking-stat-chip__value">{streakDays} ngày</span>
        </div>
        <div className="speaking-stat-chip">
          <span className="speaking-stat-chip__icon" aria-hidden>
            ⏱️
          </span>
          <span className="speaking-stat-chip__value">{minutesToday} phút</span>
        </div>
        <div className="speaking-stat-chip speaking-stat-chip--score">
          <span className="speaking-stat-chip__icon" aria-hidden>
            ⭐
          </span>
          <span className="speaking-stat-chip__value">{scoreLabel}</span>
        </div>
      </div>

      <div className="speaking-hero__actions">
        <button type="button" className="speaking-hero__history" onClick={onHistory}>
          📋 Lịch sử luyện nói
        </button>
        <button
          type="button"
          className="speaking-hero__restart"
          onClick={onRestart}
          disabled={restartDisabled}
        >
          ↺ Làm lại
        </button>
      </div>
    </header>
  );
}
