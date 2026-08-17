"use client";

import { VOCAB_ACTION_CARDS } from "@/lib/vocabulary/dashboard-config";

export default function VocabularyActionCards({
  stats,
  loading,
  activeFilter,
  onSelectFilter,
  onStartSession,
  sessionLoading = false,
}) {
  return (
    <div className="vocab-dash-actions" role="group" aria-label="Hành động học tập">
      {VOCAB_ACTION_CARDS.map((card) => {
        const active = activeFilter === card.filter;
        const statVal = Number(stats?.[card.statKey] ?? 0);
        return (
          <article
            key={card.id}
            className={`vocab-dash-action vocab-dash-action--${card.accent}${active ? " vocab-dash-action--active" : ""}`}
          >
            <button
              type="button"
              className="vocab-dash-action__main"
              onClick={() => onSelectFilter?.(card.filter)}
            >
              <span className="vocab-dash-action__icon" aria-hidden>
                {card.icon}
              </span>
              <div className="vocab-dash-action__body">
                <strong className="vocab-dash-action__title">{card.title}</strong>
                <span className="vocab-dash-action__desc">{card.desc}</span>
              </div>
              <span className="vocab-dash-action__stat">
                {loading ? "…" : statVal}
                <small>{card.statSuffix}</small>
              </span>
            </button>
            <button
              type="button"
              className={`vocab-dash-action__cta vocab-dash-action__cta--${card.accent}`}
              onClick={() => onStartSession?.(card.sessionMode)}
              disabled={sessionLoading}
            >
              {sessionLoading ? "Đang tải…" : card.ctaLabel}
            </button>
          </article>
        );
      })}
    </div>
  );
}
