"use client";

import { PASS_SCORE } from "@/lib/pronunciation/drill-catalog";
import { getLessonProgress } from "@/lib/pronunciation/lesson-groups";

export default function PronunciationLessonCard({ group, progressMap, selected, onSelect }) {
  const { done, total, avgScore } = getLessonProgress(group, progressMap);
  const passed = done >= total && total > 0;
  const partial = avgScore != null && avgScore < PASS_SCORE;

  return (
    <button
      type="button"
      className={`pron-lessonCard${selected ? " pron-lessonCard--selected" : ""}`}
      onClick={() => onSelect(group)}
    >
      <span className="pron-lessonCard__ipaBox">{group.ipaFocus}</span>
      <span className="pron-lessonCard__body">
        <strong className="pron-lessonCard__title">{group.title}</strong>
        <span className="pron-lessonCard__words">{group.exampleWords}</span>
        <span className="pron-lessonCard__meta">
          <span className="pron-lessonCard__level">{group.level}</span>
          {avgScore != null ? (
            <span className={`pron-lessonCard__score pron-lessonCard__score--${passed ? "ok" : partial ? "warn" : "ok"}`}>
              {passed ? "✓" : partial ? "○" : "✓"} {avgScore}/100
            </span>
          ) : (
            <span className="pron-lessonCard__score pron-lessonCard__score--new">Chưa luyện</span>
          )}
        </span>
      </span>
    </button>
  );
}
