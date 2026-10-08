"use client";

import { useEffect, useRef, useState } from "react";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import {
  clearWordBank,
  createWordBank,
  placeToken,
  returnToken,
  undoWordBank,
  wordBankAnswerTexts,
  wordOrderMeaning,
  wordOrderModel,
} from "@/lib/beego/learn/word-bank";

export default function WordBankAnswer({ question, onChange, state }) {
  const [bank, setBank] = useState(() => createWordBank(question?.wordBank || []));
  const bankRef = useRef(bank);
  const locked = Boolean(state);

  useEffect(() => {
    const next = createWordBank(question?.wordBank || []);
    bankRef.current = next;
    setBank(next);
  }, [question?.id]);

  useEffect(() => () => stopLessonTts(), [question?.id]);

  const commit = (next) => {
    bankRef.current = next;
    setBank(next);
    onChange(wordBankAnswerTexts(next));
  };

  const place = (id) => {
    if (locked) return;
    commit(placeToken(bankRef.current, id));
  };

  const putBack = (id) => {
    if (locked) return;
    commit(returnToken(bankRef.current, id));
  };

  const undo = () => {
    if (locked) return;
    commit(undoWordBank(bankRef.current));
  };

  const clear = () => {
    if (locked) return;
    commit(clearWordBank(bankRef.current));
  };

  const onKeyDown = (event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      undo();
      return;
    }
    const buttons = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      buttons[(index + 1) % buttons.length]?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    }
  };

  const placedTokens = bank.placed
    .map((id) => bank.tokens.find((token) => token.id === id))
    .filter(Boolean);
  const used = new Set(bank.placed);
  const model = wordOrderModel(question);
  const meaning = wordOrderMeaning(question);

  return (
    <div className="beego-lesson-wordbank" onKeyDown={onKeyDown}>
      <div className="beego-lesson-wordbank__sentence" role="list" aria-label="Câu đang ghép">
        {placedTokens.length === 0 ? (
          <span className="beego-lesson-wordbank__placeholder">Chạm các từ bên dưới để ghép câu</span>
        ) : (
          placedTokens.map((token) => (
            <button
              key={token.id}
              type="button"
              role="listitem"
              className="beego-lesson-wordbank__chip beego-lesson-wordbank__chip--placed"
              onClick={() => putBack(token.id)}
              disabled={locked}
            >
              {token.text}
            </button>
          ))
        )}
      </div>
      <div className="beego-lesson-wordbank__tools">
        <button type="button" className="beego-lesson-wordbank__tool" onClick={undo} disabled={locked || placedTokens.length === 0}>
          Hoàn tác
        </button>
        <button type="button" className="beego-lesson-wordbank__tool" onClick={clear} disabled={locked || placedTokens.length === 0}>
          Xóa
        </button>
      </div>
      <div className="beego-lesson-wordbank__bank" role="group" aria-label="Ngân từ">
        {bank.tokens.map((token) => (
          <button
            key={token.id}
            type="button"
            className={`beego-lesson-wordbank__chip${used.has(token.id) ? " beego-lesson-wordbank__chip--used" : ""}`}
            onClick={() => place(token.id)}
            disabled={locked || used.has(token.id)}
            aria-pressed={used.has(token.id)}
          >
            {token.text}
          </button>
        ))}
      </div>
      {locked ? (
        <div className="beego-lesson-wordbank__result">
          <p>Câu mẫu: {model}</p>
          {meaning ? <p>Nghĩa: {meaning}</p> : null}
          <button type="button" className="beego-lesson-listen-btn" onClick={() => playLessonTts({ text: model, lang: "en" })}>
            Nghe
          </button>
        </div>
      ) : null}
    </div>
  );
}
