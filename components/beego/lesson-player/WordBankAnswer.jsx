"use client";

import { useEffect, useRef, useState } from "react";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import {
  clearWordBank,
  createWordBank,
  displayWordBank,
  placeToken,
  reorderWordBank,
  returnToken,
  undoWordBank,
  wordBankAnswerTexts,
  wordOrderMeaning,
  wordOrderModel,
} from "@/lib/beego/learn/word-bank";

function tilesFor(question) {
  const answer = Array.isArray(question?.correctAnswer)
    ? question.correctAnswer
    : Array.isArray(question?.acceptedAnswers?.[0])
      ? question.acceptedAnswers[0]
      : [];
  return displayWordBank(question?.wordBank || [], question?.id || "", answer);
}

export default function WordBankAnswer({ question, onChange, state, lined = false, speakOnPlace = false }) {
  const [bank, setBank] = useState(() => createWordBank(tilesFor(question)));
  const [draggingId, setDraggingId] = useState("");
  const [freshIds, setFreshIds] = useState(() => new Set());
  const seenPlacedRef = useRef(new Set());
  const bankRef = useRef(bank);
  const dragRef = useRef(null);
  const locked = Boolean(state);

  useEffect(() => {
    const next = createWordBank(tilesFor(question));
    bankRef.current = next;
    setBank(next);
  }, [question?.id]);

  useEffect(() => () => stopLessonTts(), [question?.id]);

  useEffect(() => {
    const now = new Set(bank.placed);
    const added = [...now].filter((id) => !seenPlacedRef.current.has(id));
    const returned = [...seenPlacedRef.current].filter((id) => !now.has(id));
    seenPlacedRef.current = now;
    if (!added.length && !returned.length) return undefined;
    setFreshIds(new Set([...added, ...returned]));
    const timer = window.setTimeout(() => setFreshIds(new Set()), 220);
    return () => window.clearTimeout(timer);
  }, [bank.placed]);

  const commit = (next) => {
    bankRef.current = next;
    setBank(next);
    onChange(wordBankAnswerTexts(next));
  };

  const place = (id) => {
    if (locked) return;
    const next = placeToken(bankRef.current, id);
    if (next === bankRef.current) return;
    const text = next.tokens.find((token) => token.id === id)?.text || "";
    commit(next);
    if (speakOnPlace && text) playLessonTts({ text, lang: "en" });
  };

  const putBack = (id) => {
    if (locked) return;
    commit(returnToken(bankRef.current, id));
  };

  const onPlacedPointerDown = (event, id) => {
    if (locked || (event.button != null && event.button !== 0)) return;
    dragRef.current = { id, x: event.clientX, y: event.clientY, moved: false };
    setDraggingId(id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPlacedPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (Math.abs(event.clientX - drag.x) > 6 || Math.abs(event.clientY - drag.y) > 6) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    const stack = document.elementsFromPoint(event.clientX, event.clientY);
    let toId = "";
    for (const el of stack) {
      const token = el.closest?.("[data-placed-token]");
      const id = token?.getAttribute("data-placed-token");
      if (id && id !== drag.id) {
        toId = id;
        break;
      }
    }
    if (!toId || toId === drag.id) return;
    const next = reorderWordBank(bankRef.current, drag.id, toId);
    if (next !== bankRef.current) commit(next);
  };

  const onPlacedPointerUp = (id) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingId("");
    if (!drag || drag.id !== id || drag.moved) return;
    putBack(id);
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
    <div className={`beego-lesson-wordbank${lined ? " beego-lesson-wordbank--lined" : ""}`} onKeyDown={onKeyDown}>
      <div className="beego-lesson-wordbank__sentence" role="list" aria-label="Câu đang ghép">
        {placedTokens.length === 0 ? (
          <span className="beego-lesson-wordbank__placeholder">Chạm các từ bên dưới để ghép câu</span>
        ) : (
          placedTokens.map((token) => (
            <button
              key={token.id}
              type="button"
              role="listitem"
              data-placed-token={token.id}
              className={`beego-lesson-wordbank__chip beego-lesson-wordbank__chip--placed${
                draggingId === token.id ? " is-dragging" : ""
              }${freshIds.has(token.id) ? " is-fresh" : ""}`}
              disabled={locked}
              onPointerDown={(event) => onPlacedPointerDown(event, token.id)}
              onPointerMove={onPlacedPointerMove}
              onPointerUp={() => onPlacedPointerUp(token.id)}
              onPointerCancel={() => onPlacedPointerUp(token.id)}
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
            className={`beego-lesson-wordbank__chip${used.has(token.id) ? " beego-lesson-wordbank__chip--used" : ""}${
              freshIds.has(token.id) ? " is-fresh" : ""
            }`}
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
