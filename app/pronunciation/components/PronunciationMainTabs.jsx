"use client";

const TABS = [
  { id: "practice", label: "Luyện phát âm" },
  { id: "chart", label: "Bảng IPA" },
];

export default function PronunciationMainTabs({ active, onChange }) {
  return (
    <div className="pron-mainTabs" role="tablist" aria-label="Chế độ luyện phát âm">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`pron-mainTab${active === tab.id ? " pron-mainTab--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
