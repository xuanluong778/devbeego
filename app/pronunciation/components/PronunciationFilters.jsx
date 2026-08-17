"use client";

import { PRON_FILTERS } from "@/lib/pronunciation/drill-catalog";
import { PRON_LEVELS } from "@/lib/pronunciation/lesson-groups";

export default function PronunciationFilters({ active, level, onChange, onLevelChange, disabled }) {
  return (
    <div className="pron-filterBar">
      <div className="pron-filters" role="tablist" aria-label="Lọc bài luyện">
        {PRON_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={active === f.id}
            className={`pron-filter${active === f.id ? " pron-filter--active" : ""}`}
            onClick={() => onChange(f.id)}
            disabled={disabled}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="pron-levelSelect">
        <span>Cấp độ:</span>
        <select value={level} onChange={(e) => onLevelChange(e.target.value)} disabled={disabled}>
          {PRON_LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
