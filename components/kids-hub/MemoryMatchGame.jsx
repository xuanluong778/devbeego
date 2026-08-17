"use client";

import { useEffect, useMemo, useState } from "react";
import { KIDS_VOCAB_LESSONS } from "@/lib/kids-vocabulary/curriculum";
import { shuffle } from "@/lib/kids-vocabulary/utils";
import { playKidWordAudio } from "@/lib/kids-vocabulary/browser-tts";
import { recordGamePlayed } from "@/lib/kids-hub/rewards";
import kvStyles from "@/components/kids-vocabulary/KidsVocabulary.module.css";

/** Memory Match — ghép hình với từ. */
export default function MemoryMatchGame({ onComplete }) {
  const allWords = useMemo(
    () => KIDS_VOCAB_LESSONS.flatMap((l) => l.words).slice(0, 24),
    []
  );
  const [pairs, setPairs] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [lock, setLock] = useState(false);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    const pick = shuffle(allWords).slice(0, 6);
    const cards = shuffle(
      pick.flatMap((w) => [
        { uid: `${w.id}-img`, wordId: w.id, kind: "img", word: w },
        { uid: `${w.id}-txt`, wordId: w.id, kind: "txt", word: w },
      ])
    );
    setPairs(cards);
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
  }, [allWords]);

  function flip(card) {
    if (lock || matched.has(card.wordId) || flipped.some((f) => f.uid === card.uid)) return;
    const next = [...flipped, card];
    setFlipped(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    setLock(true);
    const [a, b] = next;
    if (a.wordId === b.wordId && a.kind !== b.kind) {
      const nextMatched = new Set(matched).add(a.wordId);
      setMatched(nextMatched);
      setFlipped([]);
      setLock(false);
      if (nextMatched.size >= 6) {
        recordGamePlayed("memory");
        onComplete?.();
      }
    } else {
      setTimeout(() => {
        setFlipped([]);
        setLock(false);
      }, 900);
    }
  }

  return (
    <div>
      <p style={{ textAlign: "center", fontWeight: 900 }}>Lật thẻ ghép hình với từ · {moves} lượt</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.5rem",
          maxWidth: 360,
          margin: "0 auto",
        }}
      >
        {pairs.map((card) => {
          const show = flipped.some((f) => f.uid === card.uid) || matched.has(card.wordId);
          return (
            <button
              key={card.uid}
              type="button"
              onClick={() => flip(card)}
              style={{
                aspectRatio: "1",
                borderRadius: 14,
                border: "3px solid #1a1a2e",
                background: show ? "#fff" : "#ffd166",
                boxShadow: "4px 4px 0 #1a1a2e",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: card.kind === "txt" ? "0.75rem" : undefined,
              }}
            >
              {show ? (
                card.kind === "img" ? (
                  <img src={card.word.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                  card.word.word
                )
              ) : (
                "?"
              )}
            </button>
          );
        })}
      </div>
      {matched.size >= 6 ? (
        <p className={`${kvStyles.feedback} ${kvStyles.feedbackGood}`} style={{ marginTop: "1rem" }}>
          🎉 Ghép xong! Giỏi lắm!
        </p>
      ) : null}
    </div>
  );
}
