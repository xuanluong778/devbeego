"use client";

import { VOCAB_FILTERS } from "@/lib/vocabulary/dashboard-config";

export default function VocabularyTabFilters({ activeTab = "all", onChange, disabled = false }) {
  return (
    <div className="vocab-dash-filters" role="tablist" aria-label="Lọc trạng thái học">
      {VOCAB_FILTERS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`vocab-dash-filter${active ? " vocab-dash-filter--active" : ""}`}
            onClick={() => onChange?.(tab.id)}
            disabled={disabled}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
