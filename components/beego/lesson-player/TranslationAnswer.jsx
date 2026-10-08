"use client";

import { playLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";

export default function TranslationAnswer({ exercise, answer, onAnswerChange, feedback, onCheck }) {
  const source = exercise?.extensions?.sourceText || "";
  const context = exercise?.extensions?.context || "";
  const textMode = exercise?.extensions?.inputMode === "text";
  const value = typeof answer === "string" ? answer : "";

  const onKeyDown = (event) => {
    if (event.key !== "Enter") return;
    if (event.nativeEvent?.isComposing || event.isComposing) return;
    if (!value.trim() || feedback) return;
    event.preventDefault();
    onCheck?.();
  };

  return (
    <div className="beego-lesson-translation">
      <p className="beego-lesson-question__sentence">{source}</p>
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
