"use client";

export const DEFAULT_ANSWER_CHIPS = [
  "Hello! How are you?",
  "I'm not sure",
  "Can you repeat that?",
  "Let me think",
];

export default function AnswerSuggestions({ suggestions = [], onPick, disabled = false }) {
  const chips = suggestions.length ? suggestions : DEFAULT_ANSWER_CHIPS;

  return (
    <aside className="speaking-hint-chips" aria-label="Gợi ý trả lời">
      <p className="speaking-hint-chips__label speaking-side-panel__title">Gợi ý trả lời</p>
      <div className="speaking-hint-chips__scroll" role="list">
        {chips.map((text) => (
          <button
            key={text}
            type="button"
            role="listitem"
            className="speaking-hint-chips__chip speaking-side-panel__item"
            onClick={() => onPick?.(text)}
            disabled={disabled}
          >
            {text}
          </button>
        ))}
      </div>
    </aside>
  );
}
