"use client";

function CharWord({ marks, fallbackWord, ok = true, className = "" }) {
  if (marks?.length) {
    return (
      <span className={`vocab-session-pronMark ${className}`.trim()}>
        {marks.map((m, i) => (
          <span key={`${m.char}-${i}`} className={m.ok ? "vocab-session-pronMark__ok" : "vocab-session-pronMark__bad"}>
            {m.char}
          </span>
        ))}
      </span>
    );
  }
  if (!fallbackWord) return null;
  return (
    <span className={`vocab-session-pronMark ${className} ${ok ? "vocab-session-pronMark__ok" : "vocab-session-pronMark__bad"}`.trim()}>
      {fallbackWord}
    </span>
  );
}

function MarkedSentence({ marks }) {
  if (!marks?.length) return null;
  return (
    <p className="vocab-session-pronSentence">
      {marks.map((m, i) => (
        <span key={`${m.word}-${i}`}>
          <span className={m.ok ? "vocab-session-pronMark__ok" : "vocab-session-pronMark__bad"}>{m.word}</span>
          {i < marks.length - 1 ? " " : ""}
        </span>
      ))}
    </p>
  );
}

export default function HighlightedPronunciationText({ word, charMarks, wordOk, sentence, sentenceMarks, compact = false, hideLabels = false }) {
  return (
    <div className={`vocab-session-pronFeedback${compact ? " vocab-session-pronFeedback--compact" : ""}`}>
      {word ? (
        <div className="vocab-session-pronBlock">
          {!hideLabels ? <p className="vocab-session-pronBlock__label">Từ</p> : null}
          <p className="vocab-session-pronBlock__target">
            <CharWord marks={charMarks} fallbackWord={word} ok={wordOk} className="vocab-session-pronBlock__word" />
          </p>
        </div>
      ) : null}
      {sentence ? (
        <div className="vocab-session-pronBlock">
          {!hideLabels ? <p className="vocab-session-pronBlock__label">Câu ví dụ</p> : null}
          <MarkedSentence marks={sentenceMarks} />
        </div>
      ) : null}
    </div>
  );
}
