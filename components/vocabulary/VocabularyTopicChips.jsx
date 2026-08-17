"use client";

export default function VocabularyTopicChips({ chips = [], selectedTopic = "", onSelect, disabled = false }) {
  return (
    <div className="vocab-dash-topics">
      <span className="vocab-dash-topics__label">Chủ đề</span>
      <div className="vocab-dash-topics__row" role="group" aria-label="Lọc theo chủ đề">
        <button
          type="button"
          className={`vocab-dash-topicChip${!selectedTopic ? " vocab-dash-topicChip--active" : ""}`}
          onClick={() => onSelect?.("")}
          disabled={disabled}
        >
          <span aria-hidden>📚</span> Tất cả
        </button>
        {chips.map((chip) => {
          const active = selectedTopic === chip.topic;
          return (
            <button
              key={chip.label}
              type="button"
              className={`vocab-dash-topicChip${active ? " vocab-dash-topicChip--active" : ""}${chip.disabled ? " vocab-dash-topicChip--muted" : ""}`}
              onClick={() => chip.topic && onSelect?.(chip.topic)}
              disabled={disabled || chip.disabled}
              title={chip.topic || "Chưa có chủ đề khớp"}
            >
              <span aria-hidden>{chip.icon}</span>
              {chip.label}
              {chip.count > 0 ? <span className="vocab-dash-topicChip__count">{chip.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
