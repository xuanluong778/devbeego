"use client";

import { PRACTICE_MODES } from "@/lib/vocabulary/practice-modes";

export default function VocabularyPracticeModePicker({
  stats,
  loading,
  onSelectMode,
  sessionLoading = false,
}) {
  return (
    <section className="vocab-practice" aria-label="Chế độ luyện tập">
      <div className="vocab-practice__head">
        <div>
          <p className="vocab-practice__eyebrow">Luyện tập</p>
          <h2 className="vocab-practice__title">Chọn chế độ học</h2>
          <p className="vocab-practice__desc">
            8 cách luyện từ vựng — cùng dữ liệu thư viện, phù hợp mọi phong cách học.
          </p>
        </div>
      </div>

      <div className="vocab-practice__grid">
        {PRACTICE_MODES.map((mode) => {
          const statVal = mode.statKey ? Number(stats?.[mode.statKey] ?? 0) : null;
          return (
            <button
              key={mode.id}
              type="button"
              className={`vocab-practice-card vocab-practice-card--${mode.accent}`}
              onClick={() => onSelectMode?.(mode.id)}
              disabled={sessionLoading}
            >
              <span className="vocab-practice-card__icon" aria-hidden>
                {mode.icon}
              </span>
              <span className="vocab-practice-card__body">
                <strong className="vocab-practice-card__label">{mode.label}</strong>
                <span className="vocab-practice-card__desc">{mode.desc}</span>
              </span>
              {statVal != null ? (
                <span className="vocab-practice-card__badge">
                  {loading ? "…" : statVal}
                </span>
              ) : (
                <span className="vocab-practice-card__arrow" aria-hidden>
                  →
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
