"use client";

import { useEffect, useRef, useState } from "react";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import {
  applyMatchSelection,
  audioCueLabel,
  audioSelectLabel,
  afterAudioCue,
  columnOrder,
  initialMatchState,
  leftItemId,
  matchSummary,
  pairIdFromItemId,
  rightItemId,
} from "@/lib/beego/learn/match-pairs";

export default function MatchPairsExercise({ exercise, onAnswerChange }) {
  const pairs = Array.isArray(exercise?.pairs) ? exercise.pairs : [];
  const audioMatch = Boolean(exercise?.extensions?.audioMatch);
  const [order] = useState(() => columnOrder(pairs, exercise?.id || "match"));
  const [state, setState] = useState(initialMatchState);
  const [playingId, setPlayingId] = useState("");
  const [hearError, setHearError] = useState("");
  const finishedRef = useRef(false);
  const playGen = useRef(0);
  const byPair = new Map(pairs.map((pair) => [pair.pairId, pair]));

  useEffect(() => {
    return () => {
      playGen.current += 1;
      stopLessonTts();
    };
  }, [exercise?.id]);

  const choose = (side, itemId) => {
    if (finishedRef.current) return;
    setHearError("");
    const next = applyMatchSelection(state, pairs, side, itemId);
    setState(next);
    if (!next.done || finishedRef.current) return;
    finishedRef.current = true;
    onAnswerChange({
      completed: true,
      mistakeCount: next.mistakes,
      matches: next.locked.map((pairId) => ({
        pairId,
        leftItemId: leftItemId(pairId),
        rightItemId: rightItemId(pairId),
      })),
    });
  };

  const playCue = async (itemId, text) => {
    const token = playGen.current + 1;
    playGen.current = token;
    setPlayingId(itemId);
    setHearError("");
    try {
      const result = await playLessonTts({ text, lang: "en" });
      if (token !== playGen.current) return;
      const cue = afterAudioCue(state, result);
      setHearError(cue.hearError);
    } catch {
      if (token === playGen.current) setHearError(AUDIO_PLAYBACK_ERROR);
    } finally {
      if (token === playGen.current) setPlayingId("");
    }
  };

  const moveFocus = (event) => {
    const buttons = event.currentTarget.querySelectorAll("button");
    const index = [...buttons].indexOf(document.activeElement);
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      buttons[(index + 1 + buttons.length) % buttons.length]?.focus();
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    }
  };

  const renderColumn = (ids, side) => (
    <div
      className="beego-lesson-match__col"
      role="group"
      aria-label={
        audioMatch && side === "left" ? "Âm thanh" : side === "left" ? "Tiếng Anh" : audioMatch ? "Từ tiếng Anh" : "Tiếng Việt"
      }
      onKeyDown={moveFocus}
    >
      {ids.map((itemId, index) => {
        const pair = byPair.get(pairIdFromItemId(itemId));
        if (!pair) return null;
        const locked = state.locked.includes(pair.pairId);
        const selected = state.leftId === itemId || state.rightId === itemId;
        const wrong = state.wrongLeft === itemId || state.wrongRight === itemId;
        const itemClass = [
          "beego-lesson-match__item",
          locked ? "beego-lesson-match__item--locked" : "",
          selected ? "beego-lesson-match__item--selected" : "",
          wrong ? "beego-lesson-match__item--wrong" : "",
        ]
          .filter(Boolean)
          .join(" ");
        if (audioMatch && side === "left") {
          return (
            <div key={itemId} className="beego-lesson-match__audio">
              <button
                type="button"
                className="beego-lesson-listen-btn"
                aria-label={`Nghe mục ${index + 1}`}
                aria-pressed={playingId === itemId}
                onClick={() => playCue(itemId, pair.en)}
              >
                {playingId === itemId ? "Đang nghe" : audioCueLabel()}
              </button>
              <button
                type="button"
                className={itemClass}
                disabled={locked}
                aria-pressed={selected}
                aria-label={`Chọn âm ${index + 1} để ghép`}
                onClick={() => choose(side, itemId)}
              >
                {audioSelectLabel(selected, locked)}
              </button>
            </div>
          );
        }
        return (
          <button
            key={itemId}
            type="button"
            className={itemClass}
            disabled={locked}
            aria-pressed={selected}
            onClick={() => choose(side, itemId)}
          >
            {side === "left" ? pair.en : audioMatch ? pair.en : pair.vi}
            {audioMatch && locked ? <span className="beego-lesson-match__meaning">{pair.vi}</span> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="beego-lesson-match">
      <div className="beego-lesson-match__cols">
        {renderColumn(order.left, "left")}
        {renderColumn(order.right, "right")}
      </div>
      <p className="beego-lesson-match__status" role="status">
        {hearError || state.message || `Đã ghép ${state.locked.length}/${pairs.length}`}
      </p>
      {state.done ? (
        <p className="beego-lesson-match__summary">{matchSummary(pairs.length, state.mistakes)}</p>
      ) : null}
    </div>
  );
}
