"use client";

import { useEffect, useRef, useState } from "react";
import {
  dictationMarkLabel,
  dictationRecordsAttempt,
  dictationTokenDiff,
  shouldSubmitDictation,
} from "@/lib/beego/learn/listen-dictation";

function MarkedSentence({ marks }) {
  return (
    <p className="beego-lesson-dictation__marks">
      {marks.map((mark, index) => (
        <span key={`${mark.kind}-${index}`} className={`beego-lesson-dictation__mark beego-lesson-dictation__mark--${mark.kind}`}>
          {dictationMarkLabel(mark)}
        </span>
      ))}
    </p>
  );
}

export default function ListenDictationExercise({ exercise, answer, onAnswerChange, feedback, onCheck }) {
  const transcript = String(exercise?.extensions?.transcript || exercise?.correctAnswer || "");
  const [practiceText, setPracticeText] = useState("");
  const [practiceMarks, setPracticeMarks] = useState(null);
  const [hintOpen, setHintOpen] = useState(false);
  const composingRef = useRef(false);
  const firstMarksRef = useRef(null);
  const hint = exercise?.extensions?.hintMode === "count" ? `Câu có ${exercise.extensions.wordCount} từ.` : "";

  useEffect(() => {
    firstMarksRef.current = null;
    setPracticeText("");
    setPracticeMarks(null);
    setHintOpen(false);
  }, [exercise?.id]);

  if (feedback && !firstMarksRef.current) {
    const typed = typeof answer === "string" ? answer : "";
    firstMarksRef.current = dictationTokenDiff(transcript, typed);
  }

  const submitPractice = (value) => {
    if (dictationRecordsAttempt("practice")) return;
    setPracticeMarks(dictationTokenDiff(transcript, value));
  };

  const onKeyDown = (event) => {
    const value = event.currentTarget.value;
    const composing = event.nativeEvent?.isComposing || composingRef.current;
    if (!shouldSubmitDictation({ key: event.key, isComposing: composing, value })) return;
    event.preventDefault();
    if (feedback) {
      submitPractice(value);
      return;
    }
    onCheck?.();
  };

  return (
    <div className="beego-lesson-dictation">
      <p className="beego-lesson-question__hint">Gõ lại đúng câu bạn nghe. Dấu câu cuối câu không bị tính sai.</p>
      {hint ? (
        <button type="button" className="beego-lesson-listen-btn" onClick={() => setHintOpen((open) => !open)}>
          {hintOpen ? "Ẩn gợi ý" : "Gợi ý"}
        </button>
      ) : null}
      {hintOpen && hint ? <p className="beego-lesson-question__hint">{hint}</p> : null}
      <label className="beego-lesson-dictation__label" htmlFor={`dictation-${exercise?.id || "answer"}`}>
        Câu bạn nghe
      </label>
      <input
        id={`dictation-${exercise?.id || "answer"}`}
        type="text"
        className="beego-lesson-keyboard-input"
        placeholder="Nhập câu bạn nghe"
        value={feedback ? practiceText : typeof answer === "string" ? answer : ""}
        onChange={(event) => {
          if (feedback) {
            setPracticeText(event.target.value);
            return;
          }
          onAnswerChange(event.target.value);
        }}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        onKeyDown={onKeyDown}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {feedback && firstMarksRef.current ? (
        <div className="beego-lesson-dictation__result">
          <p>Lần đầu</p>
          <p>Câu đúng: {transcript}</p>
          {exercise?.extensions?.meaning ? <p>Nghĩa: {exercise.extensions.meaning}</p> : null}
          <MarkedSentence marks={firstMarksRef.current} />
          <button type="button" className="beego-lesson-listen-btn" onClick={() => submitPractice(practiceText)}>
            Luyện tập
          </button>
          {practiceMarks ? (
            <>
              <p>Luyện tập</p>
              <MarkedSentence marks={practiceMarks} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
