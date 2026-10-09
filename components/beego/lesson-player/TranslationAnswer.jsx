"use client";

import { useEffect } from "react";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";

function ListenCharacter() {
  return (
    <svg className="beego-lesson-listen-word__person" viewBox="0 0 120 156" aria-hidden>
      <ellipse cx="60" cy="148" rx="34" ry="6" fill="#e8eaef" />
      <path d="M36 86c2-16 12-24 24-24s22 8 24 24v36H36V86z" fill="#c47b3a" />
      <path d="M48 78h24c2 10 2 20 0 32H48c-2-12-2-22 0-32z" fill="#fffaf6" />
      <path d="M40 118h40v16c0 8-9 12-20 12s-20-4-20-12v-16z" fill="#8d5a34" />
      <circle cx="60" cy="46" r="22" fill="#f6d3b0" />
      <path d="M40 44c4-22 36-24 42-2-10-10-32-10-42 2z" fill="#2a2a2a" />
      <circle cx="52" cy="48" r="2.1" fill="#2a2a2a" />
      <circle cx="69" cy="48" r="2.1" fill="#2a2a2a" />
      <path d="M54 57c3.5 3 9 3 12.5 0" fill="none" stroke="#d08a55" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function TranslationAnswer({ exercise, answer, onAnswerChange, feedback, onCheck }) {
  const source = exercise?.extensions?.sourceText || "";
  const context = exercise?.extensions?.context || "";
  const textMode = exercise?.extensions?.inputMode === "text";
  const toVietnamese = exercise?.extensions?.translationDirection === "en-to-vi";
  const speak = exercise?.extensions?.speakText || source;
  const value = typeof answer === "string" ? answer : "";

  useEffect(() => {
    if (textMode || !toVietnamese || feedback) return undefined;
    const text = String(source || speak || "").trim();
    if (!text) return undefined;
    const timer = window.setTimeout(() => {
      playLessonTts({ text, lang: "en" });
    }, 80);
    return () => {
      window.clearTimeout(timer);
      stopLessonTts();
    };
  }, [exercise?.id, textMode, toVietnamese, source, speak, feedback]);

  const onKeyDown = (event) => {
    if (event.key !== "Enter") return;
    if (event.nativeEvent?.isComposing || event.isComposing) return;
    if (!value.trim() || feedback) return;
    event.preventDefault();
    onCheck?.();
  };

  return (
    <div className="beego-lesson-translation">
      {textMode ? <p className="beego-lesson-question__sentence">{source}</p> : (
        <div className="beego-lesson-listen-word">
          <ListenCharacter />
          <button
            type="button"
            className="beego-lesson-listen-word__bubble"
            onClick={() => playLessonTts({ text: speak, lang: "en" })}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path fill="currentColor" d="M4 9.2v5.6h3.6L12 19V5L7.6 9.2H4z" />
              <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M15.2 9.3a3.4 3.4 0 0 1 0 5.4" />
            </svg>
            <span className="beego-lesson-listen-word__said">
              {source}
              <span className="beego-lesson-listen-word__dots" />
            </span>
            <span className="beego-lesson-sr">Nghe</span>
          </button>
        </div>
      )}
      {context ? <p className="beego-lesson-question__hint">{context}</p> : null}
      {textMode ? (
        <>
          <label className="beego-lesson-dictation__label" htmlFor={`translation-${exercise?.id || "answer"}`}>
            Câu dịch
          </label>
          <input
            id={`translation-${exercise?.id || "answer"}`}
            type="text"
            className="beego-lesson-keyboard-input"
            placeholder="Nhập câu dịch"
            value={value}
            disabled={!!feedback}
            onChange={(event) => onAnswerChange(event.target.value)}
            onKeyDown={onKeyDown}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </>
      ) : null}
      {feedback ? (
        <div className="beego-lesson-translation__result">
          <p>Một cách nói tự nhiên: {exercise?.extensions?.modelSentence}</p>
          <p>{exercise?.explanation}</p>
          <button
            type="button"
            className="beego-lesson-listen-btn"
            onClick={() => playLessonTts({ text: exercise?.extensions?.speakText || "", lang: "en" })}
          >
            Nghe tiếng Anh
          </button>
        </div>
      ) : null}
    </div>
  );
}
