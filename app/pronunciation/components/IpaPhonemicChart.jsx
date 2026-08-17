"use client";

import { useState } from "react";
import { IPA_CHART_TITLE, IPA_PHONEMIC_CHART } from "@/lib/ipa/phonemic-chart";
import { speakPronunciationEnglish } from "@/lib/pronunciation/pronunciation-audio";

function ChartCell({ cell, kind, active, onSelect }) {
  if (!cell?.ipa) {
    return <span className="ipaChart__cell ipaChart__cell--empty" aria-hidden />;
  }

  return (
    <button
      type="button"
      className={`ipaChart__cell ipaChart__cell--${kind}${active ? " ipaChart__cell--active" : ""}`}
      onClick={() => onSelect(cell)}
      aria-label={`${cell.ipa}, ví dụ: ${cell.word}`}
    >
      <span className="ipaChart__symbol">{cell.ipa}</span>
      <span className="ipaChart__word">{cell.word}</span>
      {cell.voiced != null ? (
        <span
          className={`ipaChart__voice ipaChart__voice--${cell.voiced ? "on" : "off"}`}
          title={cell.voiced ? "Hữu thanh" : "Vô thanh"}
          aria-hidden
        />
      ) : null}
    </button>
  );
}

export default function IpaPhonemicChart() {
  const [activeKey, setActiveKey] = useState(null);

  const handleSelect = (cell) => {
    const key = `${cell.ipa}:${cell.word}`;
    setActiveKey(key);
    speakPronunciationEnglish(cell.word);
  };

  return (
    <section className="ipaChart" aria-label={IPA_CHART_TITLE}>
      <div className="ipaChart__layout">
        <aside className="ipaChart__spine" aria-hidden>
          <span className="ipaChart__spineText">{IPA_CHART_TITLE}</span>
        </aside>

        <div className="ipaChart__body">
          <header className="ipaChart__head">
            <div>
              <h2 className="ipaChart__title">Phonemic Chart</h2>
              <p className="ipaChart__hint">Bấm vào ô để nghe phát âm mẫu tiếng Anh (Mỹ).</p>
            </div>
            <div className="ipaChart__legend" aria-label="Chú thích">
              <span>
                <i className="ipaChart__legendDot ipaChart__legendDot--off" /> Vô thanh
              </span>
              <span>
                <i className="ipaChart__legendDot ipaChart__legendDot--on" /> Hữu thanh
              </span>
            </div>
          </header>

          <div className="ipaChart__section ipaChart__section--vowels">
            <div className="ipaChart__sectionLabel" aria-hidden>
              VOWELS
            </div>
            <div className="ipaChart__sectionMain">
              {IPA_PHONEMIC_CHART.vowels.sections.map((sec) => (
                <div key={sec.label} className="ipaChart__block">
                  <p className="ipaChart__blockLabel">{sec.label}</p>
                  <div className="ipaChart__grid ipaChart__grid--4">
                    {sec.rows.map((row, ri) =>
                      row.map((cell, ci) => (
                        <ChartCell
                          key={`${sec.label}-${ri}-${ci}`}
                          cell={cell}
                          kind={sec.kind}
                          active={activeKey === (cell?.ipa ? `${cell.ipa}:${cell.word}` : "")}
                          onSelect={handleSelect}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ipaChart__section ipaChart__section--consonants">
            <div className="ipaChart__sectionLabel" aria-hidden>
              CONSONANTS
            </div>
            <div className="ipaChart__sectionMain">
              <div className="ipaChart__grid ipaChart__grid--8">
                {IPA_PHONEMIC_CHART.consonants.rows.map((row, ri) =>
                  row.map((cell, ci) => (
                    <ChartCell
                      key={`con-${ri}-${ci}`}
                      cell={cell}
                      kind="consonant"
                      active={activeKey === `${cell.ipa}:${cell.word}`}
                      onSelect={handleSelect}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
