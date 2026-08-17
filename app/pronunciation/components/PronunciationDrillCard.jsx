"use client";

import { PASS_SCORE } from "@/lib/pronunciation/drill-catalog";

export default function PronunciationDrillCard({ drill, score, selected, onSelect }) {
  const passed = score >= PASS_SCORE;
  const tone = passed ? "passed" : score > 0 ? "retry" : "new";

  return (
    <button
      type="button"
      className={`pron-drillCard pron-drillCard--${tone}${selected ? " pron-drillCard--selected" : ""}`}
      onClick={() => onSelect(drill)}
    >
      <div className="pron-drillCard__top">
        <span className="pron-drillCard__ipa">{drill.ipa}</span>
        <span className={`pron-drillCard__status pron-drillCard__status--${tone}`}>
          {passed ? "Đạt" : score > 0 ? "Cần luyện lại" : "Chưa luyện"}
        </span>
      </div>
      <strong className="pron-drillCard__word">{drill.word}</strong>
      <p className="pron-drillCard__sentence">{drill.sampleSentence}</p>
      <div className="pron-drillCard__meta">
        <span className="pron-drillCard__level">{drill.level}</span>
        <span className="pron-drillCard__score">{score > 0 ? `${score}/100` : "—"}</span>
      </div>
    </button>
  );
}
