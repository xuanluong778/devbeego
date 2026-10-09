"use client";

import { useEffect, useRef, useState } from "react";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import { playLessonSfx } from "@/lib/beego/learn/lesson-sfx";
import {
  applyMatchSelection,
  AUDIO_PLAYBACK_ERROR,
  afterAudioCue,
  columnOrder,
  initialMatchState,
  leftItemId,
  matchSummary,
  pairIdFromItemId,
  rightItemId,
} from "@/lib/beego/learn/match-pairs";

function SpeakerIcon() {
  return (
    <svg className="beego-lesson-audio-card__icon" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M3.8 9.2v5.6h3.7L12.2 19V5L7.5 9.2H3.8z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M15.4 9.2a3.6 3.6 0 0 1 0 5.6M17.8 7a6.4 6.4 0 0 1 0 10"
      />
    </svg>
  );
}

function SoundWave({ playing }) {
  return (
    <span className={`beego-lesson-audio-card__wave${playing ? " is-playing" : ""}`} aria-hidden>
      {Array.from({ length: 16 }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}

export default function MatchPairsExercise({ exercise, onAnswerChange }) {
  const pairs = Array.isArray(exercise?.pairs) ? exercise.pairs : [];
  const audioMatch = Boolean(exercise?.extensions?.audioMatch);
  const [order, setOrder] = useState(() => columnOrder(pairs, exercise?.id || "match"));
  const [state, setState] = useState(initialMatchState);
  const [playingId, setPlayingId] = useState("");
  const [hearError, setHearError] = useState("");
  const finishedRef = useRef(false);
  const playGen = useRef(0);
  const lockedCountRef = useRef(0);
  const wrongKeyRef = useRef("");
  const byPair = new Map(pairs.map((pair) => [pair.pairId, pair]));

  useEffect(() => {
    finishedRef.current = false;
    setState(initialMatchState());
    setOrder(columnOrder(Array.isArray(exercise?.pairs) ? exercise.pairs : [], exercise?.id || "match"));
    setPlayingId("");
    setHearError("");
    lockedCountRef.current = 0;
    wrongKeyRef.current = "";
    playGen.current += 1;
    stopLessonTts();
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

  useEffect(() => {
    if (state.locked.length > lockedCountRef.current) playLessonSfx("ding");
    lockedCountRef.current = state.locked.length;
    const wrongKey = state.tone === "wrong" ? `${state.wrongLeft || ""}:${state.wrongRight || ""}` : "";
    if (wrongKey && wrongKey !== wrongKeyRef.current) playLessonSfx("soft");
    wrongKeyRef.current = wrongKey;
  }, [state.locked.length, state.tone, state.wrongLeft, state.wrongRight]);

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
          const playing = playingId === itemId;
          const cardClass = [
            "beego-lesson-audio-card",
            playing ? "is-playing" : "",
            locked ? "is-locked" : "",
            selected ? "is-selected" : "",
            wrong ? "is-wrong" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={itemId}
              className={cardClass}
              role="button"
              tabIndex={locked ? -1 : 0}
              aria-pressed={selected}
              aria-disabled={locked}
              aria-label={`Nghe và chọn âm ${index + 1}`}
              onClick={() => {
                playCue(itemId, pair.en);
                if (!locked) {
                  playLessonSfx("pop");
                  choose(side, itemId);
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                playCue(itemId, pair.en);
                if (!locked) {
                  playLessonSfx("pop");
                  choose(side, itemId);
                }
              }}
            >
              <span className="beego-lesson-audio-card__num">{index + 1}</span>
              <button
                type="button"
                className="beego-lesson-audio-card__play"
                aria-label={`Nghe âm ${index + 1}`}
                aria-pressed={playing}
                onClick={(event) => {
                  event.stopPropagation();
                  playCue(itemId, pair.en);
                }}
              >
                <SpeakerIcon />
              </button>
              <SoundWave playing={playing} />
            </div>
          );
        }
        if (audioMatch && side === "right") {
          const wordClass = [
            "beego-lesson-word-card",
            locked ? "is-locked" : "",
            selected ? "is-selected" : "",
            wrong ? "is-wrong" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={itemId}
              type="button"
              className={wordClass}
              disabled={locked}
              aria-pressed={selected}
              onClick={() => {
                if (!locked) playLessonSfx("pop");
                choose(side, itemId);
              }}
            >
              <span className="beego-lesson-word-card__num">{order.left.length + index + 1}</span>
              <span className="beego-lesson-word-card__text">
                {pair.en}
                {locked ? <span className="beego-lesson-match__meaning">{pair.vi}</span> : null}
              </span>
            </button>
          );
        }
        return (
          <button
            key={itemId}
            type="button"
            className={itemClass}
            disabled={locked}
            aria-pressed={selected}
            onClick={() => {
              if (locked) return;
              playLessonSfx("pop");
              if (side === "left" && pair.en) playLessonTts({ text: pair.en, lang: "en" });
              choose(side, itemId);
            }}
          >
            {side === "left" ? pair.en : audioMatch ? pair.en : pair.vi}
            {audioMatch && locked ? <span className="beego-lesson-match__meaning">{pair.vi}</span> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`beego-lesson-match${audioMatch ? " beego-lesson-match--audio" : ""}`}>
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
