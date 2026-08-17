"use client";

export default function VocabularyDashboardHeader({ stats, loading }) {
  const totalWords = Number(stats?.total_words || 0);
  const streak = Number(stats?.streak_days || 0);
  const xp = Number(stats?.xp_total || 0);
  const level = Number(stats?.level || 1);
  const reviewDue = Number(stats?.review_due || 0);

  return (
    <header className="vocab-dash-header">
      <div className="vocab-dash-header__intro">
        <p className="vocab-dash-header__eyebrow">Beego Vocabulary</p>
        <h1 className="vocab-dash-header__title">Học từ vựng thông minh</h1>
        <p className="vocab-dash-header__desc">
          {loading
            ? "Đang tải thư viện từ vựng…"
            : totalWords
            ? `${totalWords.toLocaleString("vi-VN")} từ · Flashcard · SRS · Luyện phát âm`
            : "Flashcard · SRS · Luyện phát âm theo chủ đề"}
        </p>
      </div>

      <div className="vocab-dash-metrics" aria-label="Thống kê học tập">
        <div className="vocab-dash-metric">
          <span className="vocab-dash-metric__icon" aria-hidden>🔥</span>
          <div>
            <span className="vocab-dash-metric__label">Streak</span>
            <strong className="vocab-dash-metric__value">{loading ? "…" : `${streak} ngày`}</strong>
          </div>
        </div>
        <div className="vocab-dash-metric">
          <span className="vocab-dash-metric__icon" aria-hidden>⚡</span>
          <div>
            <span className="vocab-dash-metric__label">XP</span>
            <strong className="vocab-dash-metric__value">{loading ? "…" : xp.toLocaleString("vi-VN")}</strong>
          </div>
        </div>
        <div className="vocab-dash-metric">
          <span className="vocab-dash-metric__icon" aria-hidden>🏅</span>
          <div>
            <span className="vocab-dash-metric__label">Level</span>
            <strong className="vocab-dash-metric__value">{loading ? "…" : level}</strong>
          </div>
        </div>
        <div className="vocab-dash-metric vocab-dash-metric--accent">
          <span className="vocab-dash-metric__icon" aria-hidden>🔄</span>
          <div>
            <span className="vocab-dash-metric__label">Cần ôn</span>
            <strong className="vocab-dash-metric__value">{loading ? "…" : `${reviewDue} từ`}</strong>
          </div>
        </div>
      </div>
    </header>
  );
}
