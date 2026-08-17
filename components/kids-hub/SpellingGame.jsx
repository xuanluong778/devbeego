"use client";

import { useEffect, useMemo, useState } from "react";
import { KIDS_VOCAB_LESSONS } from "@/lib/kids-vocabulary/curriculum";
import { shuffle } from "@/lib/kids-vocabulary/utils";
import { playKidWordAudio } from "@/lib/kids-vocabulary/browser-tts";
import { recordGamePlayed } from "@/lib/kids-hub/rewards";
import kvStyles from "@/components/kids-vocabulary/KidsVocabulary.module.css";

/** Spelling — kéo chữ cái thành từ. */
export default function SpellingGame({ onComplete }) {
  const words = useMemo(
    () => shuffle(KIDS_VOCAB_LESSONS.flatMap((l) => l.words)).slice(0, 5),
    []
  );
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState([]);
  const [pool, setPool] = useState([]);
  const [done, setDone] = useState(false);

  const target = words[round];

  useEffect(() => {
    if (!target) return;
    const letters = target.word.toLowerCase().split("");
    const extras = shuffle("aeiou".split("")).slice(0, 2);
    setPool(shuffle([...letters, ...extras]));
    setPicked([]);
    setDone(false);
  }, [target, round]);

  function pick(ch, idx) {
    if (done) return;
    setPicked((p) => [...p, ch]);
    setPool((pool) => pool.filter((_, i) => i !== idx));
  }

  function undo() {
    if (!picked.length || done) return;
    const last = picked[picked.length - 1];
    setPicked((p) => p.slice(0, -1));
    setPool((p) => [...p, last]);
  }

  function check() {
    const attempt = picked.join("");
    if (attempt === target.word.toLowerCase()) {
      setDone(true);
      if (round + 1 >= words.length) {
        recordGamePlayed("spelling");
        onComplete?.();
      }
    }
  }

  function next() {
    setRound((r) => r + 1);
  }

  if (!target) return null;

  return (
    <div>
      <p style={{ textAlign: "center", fontWeight: 900 }}>
        Kéo chữ thành từ ({round + 1}/{words.length})
      </p>
      <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
        <img src={target.imageUrl} alt="" style={{ width: 100, height: 100, objectFit: "contain" }} />
        <p style={{ fontWeight: 800, margin: "0.35rem 0" }}>{target.vietnameseMeaning}</p>
        <button
          type="button"
          className={`${kvStyles.bigBtn} ${kvStyles.bigBtnGhost}`}
          onClick={() => playKidWordAudio({ word: target.word, audioUrl: target.audioUrl })}
        >
          🔊 Nghe
        </button>
      </div>
      <div
        style={{
          minHeight: 48,
          border: "3px dashed #1a1a2e",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          marginBottom: "0.75rem",
          fontWeight: 900,
          fontSize: "1.2rem",
          background: "#fff",
        }}
      >
        {picked.length ? picked.join("") : "..."}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: "0.75rem" }}>
        {pool.map((ch, i) => (
          <button
            key={`${ch}-${i}`}
            type="button"
            onClick={() => pick(ch, i)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "2px solid #1a1a2e",
              background: "#ffd166",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {ch}
          </button>
        ))}
      </div>
      <div className={kvStyles.row}>
        <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnGhost}`} onClick={undo}>
          ← Xóa
        </button>
        <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnPrimary}`} onClick={check}>
          Kiểm tra
        </button>
        {done ? (
          <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnPrimary}`} onClick={next}>
            {round + 1 >= words.length ? "Xong ✓" : "Tiếp →"}
          </button>
        ) : null}
      </div>
      {done ? (
        <p className={`${kvStyles.feedback} ${kvStyles.feedbackGood}`}>🎉 Đúng rồi: {target.word}!</p>
      ) : null}
    </div>
  );
}
