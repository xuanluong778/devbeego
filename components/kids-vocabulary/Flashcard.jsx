"use client";

import { useCallback, useState } from "react";
import { playKidWordAudio, speakEnglish } from "@/lib/kids-vocabulary/browser-tts";
import RecordPlaybackButtons from "./RecordPlaybackButtons";
import styles from "./KidsVocabulary.module.css";

export default function Flashcard({ words, accentColor, onDone }) {
  const [idx, setIdx] = useState(0);

  const w = words[idx];
  const playWord = useCallback(() => {
    if (!w) return;
    void playKidWordAudio({ word: w.word, audioUrl: w.audioUrl });
  }, [w]);

  const playExample = useCallback(() => {
    if (!w?.exampleSentence) return;
    void speakEnglish(w.exampleSentence, { rate: 0.85 });
  }, [w?.exampleSentence]);

  if (!w) {
    onDone?.();
    return null;
  }

  return (
    <div className={styles.cardInner} style={{ borderColor: `${accentColor}55` }}>
      <img className={styles.wordImg} src={w.imageUrl} alt="" />
      <p className={styles.wordTitle}>{w.word}</p>
      <p className={styles.phonetic}>{w.phonetic}</p>
      <p className={styles.meaning}>{w.vietnameseMeaning}</p>
      <p className={styles.example}>{w.exampleSentence}</p>
      <div className={styles.row}>
        <button type="button" className={`${styles.bigBtn} ${styles.bigBtnPrimary}`} onClick={playWord}>
          🔊 Nghe từ
        </button>
        <button type="button" className={`${styles.bigBtn} ${styles.bigBtnGhost}`} onClick={playExample}>
          📣 Nghe câu
        </button>
        {idx > 0 ? (
          <button type="button" className={`${styles.bigBtn} ${styles.bigBtnGhost}`} onClick={() => setIdx((i) => i - 1)}>
            ← Trước
          </button>
        ) : null}
        {idx < words.length - 1 ? (
          <button type="button" className={`${styles.bigBtn} ${styles.bigBtnGhost}`} onClick={() => setIdx((i) => i + 1)}>
            Tiếp →
          </button>
        ) : (
          <button type="button" className={`${styles.bigBtn} ${styles.bigBtnPrimary}`} onClick={() => onDone?.()}>
            Xong phần thẻ ✓
          </button>
        )}
      </div>
      <div className={styles.recPair}>
        <RecordPlaybackButtons label="🎙 Con nói thử" resetKey={`${w.id}-card-word`} scoreTarget={w.word} scoreAsSentence={false} />
        <RecordPlaybackButtons
          label="🎙 Ghi âm câu"
          resetKey={`${w.id}-card-sent`}
          disabled={!w.exampleSentence}
          scoreTarget={w.exampleSentence || ""}
          scoreAsSentence
        />
      </div>
      <p style={{ marginTop: "0.75rem", fontWeight: 800, color: "#445" }}>
        Thẻ {idx + 1} / {words.length}
      </p>
    </div>
  );
}
