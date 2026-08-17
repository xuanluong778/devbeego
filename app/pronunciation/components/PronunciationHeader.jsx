"use client";

export default function PronunciationHeader({ stats, loading }) {
  return (
    <header className="pron-header">
      <div className="pron-header__intro">
        <p className="pron-header__eyebrow">Beego Pronunciation</p>
        <h1 className="pron-header__title">Luyện phát âm AI</h1>
        <p className="pron-header__desc">
          Sửa âm sai, luyện IPA và cải thiện giọng nói tiếng Anh mỗi ngày.
        </p>
      </div>
      <div className="pron-metrics" aria-label="Thống kê luyện tập">
        <div className="pron-metric">
          <span className="pron-metric__icon" aria-hidden>🔥</span>
          <div>
            <span className="pron-metric__label">Streak</span>
            <strong className="pron-metric__value">{loading ? "…" : `${stats.streak} ngày`}</strong>
          </div>
        </div>
        <div className="pron-metric">
          <span className="pron-metric__icon" aria-hidden>🎯</span>
          <div>
            <span className="pron-metric__label">Điểm TB</span>
            <strong className="pron-metric__value">
              {loading ? "…" : stats.avgScore != null ? `${stats.avgScore}/100` : "—"}
            </strong>
          </div>
        </div>
        <div className="pron-metric pron-metric--accent">
          <span className="pron-metric__icon" aria-hidden>📚</span>
          <div>
            <span className="pron-metric__label">Bài đã luyện</span>
            <strong className="pron-metric__value">{loading ? "…" : `${stats.sessionCount} bài`}</strong>
          </div>
        </div>
      </div>
    </header>
  );
}
