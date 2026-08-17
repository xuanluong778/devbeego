"use client";

import AnswerOption from "./AnswerOption";
import WordBankAnswer from "./WordBankAnswer";

function ListeningPrompt({ question }) {
  const play = () => {
    if (question.audioUrl) {
      const audio = new Audio(question.audioUrl);
      audio.play().catch(() => {});
    }
  };

  return (
    <button type="button" className="beego-lesson-listen-btn" onClick={play} aria-label="Phát audio">
      <span aria-hidden>🔊</span> Nghe lại
    </button>
  );
}

export default function QuestionRenderer({
  question,
  answer,
  onAnswerChange,
  feedback,
  correctId,
}) {
  const optionState = (id) => {
    if (!feedback) return null;
    if (id === correctId) return "correct";
    if (id === answer && feedback === "wrong") return "wrong";
    return null;
  };

  return (
    <div className="beego-lesson-question">
      <p className="beego-lesson-question__skill">{question.skillLabel}</p>
      <h2 className="beego-lesson-question__prompt">{question.prompt}</h2>

      {question.imageEmoji ? (
        <div className="beego-lesson-question__visual" aria-hidden>
          <span>{question.imageEmoji}</span>
        </div>
      ) : (
        <div className="beego-lesson-question__mascot" aria-hidden>
          <span className="beego-lesson-question__bee">🐝</span>
        </div>
      )}

      {question.type === "translate_word_bank" ? (
        <WordBankAnswer
          question={question}
          selected={Array.isArray(answer) ? answer : []}
          onChange={onAnswerChange}
          state={feedback}
        />
      ) : null}

      {question.type === "listening_fill" ? <ListeningPrompt question={question} /> : null}

      {question.options && question.type !== "translate_word_bank" ? (
        <div
          className={`beego-lesson-options${
            question.type === "vocabulary_choice" ? " beego-lesson-options--grid" : ""
          }`}
        >
          {question.options.map((opt) => (
            <AnswerOption
              key={opt.id}
              option={opt}
              selected={answer === opt.id}
              state={optionState(opt.id)}
              onSelect={onAnswerChange}
              layout={question.type === "vocabulary_choice" ? "grid" : "default"}
            />
          ))}
        </div>
      ) : null}

      {question.sentenceTemplate && question.type === "translate_word_bank" ? (
        <p className="beego-lesson-question__hint">{question.sentenceTemplate}</p>
      ) : null}
    </div>
  );
}
