"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KIDS_VOCAB_LESSONS } from "@/lib/kids-vocabulary/curriculum";
import { shuffle } from "@/lib/kids-vocabulary/utils";
import { playKidWordAudio, speakEnglish } from "@/lib/kids-vocabulary/browser-tts";
import { listenKidEnglishOnce } from "@/lib/kids-hub/speech-listen";
import { evaluatePronunciation } from "@/lib/client-pronunciation-eval";
import { recordGamePlayed, recordPronunciationScore } from "@/lib/kids-hub/rewards";
import { kidAiFeedback } from "@/lib/kids-hub/ai-teacher";
import kvStyles from "@/components/kids-vocabulary/KidsVocabulary.module.css";

/** Speak to Unlock — nói đúng để mở khóa phần thưởng. */
export default function SpeakToUnlockGame({ onComplete }) {
  const words = useMemo(
    () => shuffle(KIDS_VOCAB_LESSONS.flatMap((l) => l.words)).slice(0, 4),
    []
  );
  const [round, setRound] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [listening, setListening] = useState(false);
  const target = words[round];

  const speakSlow = useCallback((text) => {
    void speakEnglish(text, { rate: 0.72 });
  }, []);

  useEffect(() => {
    setUnlocked(false);
    setFeedback("");
  }, [round]);

  async function trySpeak() {
    if (!target || listening || unlocked) return;
    setListening(true);
    setFeedback("Cô đang nghe con nói…");
    try {
      const heard = await listenKidEnglishOnce();
      const ev = evaluatePronunciation(heard, target.word, { isSentence: false });
      recordPronunciationScore(ev.score);
      const fb = kidAiFeedback({ target: target.word, heard, score: ev.score });
      setFeedback(fb.vi);
      if (ev.score >= 45) {
        setUnlocked(true);
        if (round + 1 >= words.length) recordGamePlayed("speak-unlock");
      }
    } catch {
      setFeedback("Chưa nghe rõ — con thử nói to hơn nhé!");
    } finally {
      setListening(false);
    }
  }

  function next() {
    if (round + 1 >= words.length) {
      onComplete?.();
      return;
    }
    setRound((r) => r + 1);
  }

  if (!target) return null;

  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ fontWeight: 900, fontSize: "3rem", margin: "0 0 0.5rem" }}>{unlocked ? "🎁" : "🔒"}</p>
      <p style={{ fontWeight: 900 }}>Nói đúng để mở khóa ({round + 1}/{words.length})</p>
      <img src={target.imageUrl} alt="" style={{ width: 110, height: 110, objectFit: "contain", margin: "0.5rem auto" }} />
      <p style={{ fontWeight: 800, opacity: unlocked ? 1 : 0.5 }}>{unlocked ? target.word : "???"}</p>
      <div className={kvStyles.row} style={{ justifyContent: "center" }}>
        <button
          type="button"
          className={`${kvStyles.bigBtn} ${kvStyles.bigBtnGhost}`}
          onClick={() => playKidWordAudio({ word: target.word, audioUrl: target.audioUrl })}
        >
          🔊 Nghe
        </button>
        <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnGhost}`} onClick={() => speakSlow(target.word)}>
          🐝 Cô đọc chậm
        </button>
      </div>
      {!unlocked ? (
        <button
          type="button"
          className={`${kvStyles.bigBtn} ${kvStyles.bigBtnPrimary}`}
          onClick={trySpeak}
          disabled={listening}
          style={{ marginTop: "0.75rem" }}
        >
          {listening ? "Đang nghe…" : "🎙 Con nói thử"}
        </button>
      ) : (
        <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnPrimary}`} onClick={next} style={{ marginTop: "0.75rem" }}>
          {round + 1 >= words.length ? "Nhận thưởng ✓" : "Mở tiếp →"}
        </button>
      )}
      {feedback ? (
        <p className={`${kvStyles.feedback} ${unlocked ? kvStyles.feedbackGood : kvStyles.feedbackTry}`}>{feedback}</p>
      ) : null}
    </div>
  );
}
