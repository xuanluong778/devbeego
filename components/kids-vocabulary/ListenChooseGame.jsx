"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { playBeegoAudio } from "@/lib/beego/audio-player";
import { shuffle } from "@/lib/kids-vocabulary/utils";
import styles from "./KidsVocabulary.module.css";

export default function ListenChooseGame({ words, onComplete, onCorrectWord, maxRounds = 6 }) {
  const rounds = Math.min(maxRounds, words.length);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState(null);
  const [feedback, setFeedback] = useState("");
  const correctRef = useRef(0);

  const target = words[round];

  const options = useMemo(() => {
    const usedImages = new Set([target.imageUrl]);
    const distractors = [];
    for (const w of shuffle(words.filter((x) => x.id !== target.id))) {
      if (!w?.imageUrl || usedImages.has(w.imageUrl)) continue;
      usedImages.add(w.imageUrl);
      distractors.push(w);
      if (distractors.length >= 3) break;
    }
    for (const w of shuffle(words.filter((x) => x.id !== target.id))) {
      if (distractors.length >= 3) break;
      if (distractors.some((d) => d.id === w.id)) continue;
      distractors.push(w);
    }
    return shuffle([target, ...distractors.slice(0, 3)]);
  }, [target, round, words]);

  useEffect(() => {
    setPicked(null);
    setFeedback("");
  }, [round]);

  function playAudio() {
    void playBeegoAudio({ url: target.audioUrl, text: target.word, lang: "en" });
  }

  function choose(opt) {
    if (picked) return;
    setPicked(opt.id);
    const ok = opt.id === target.id;
    if (ok) {
      correctRef.current += 1;
      setFeedback("🎉 Giỏi lắm! Đúng rồi!");
    } else {
      setFeedback("Gần đúng rồi! Thử lại nhé — không trừ điểm đâu.");
    }
  }

  function next() {
    if (!picked) return;
    const ok = picked === target.id;
    if (!ok) {
      setPicked(null);
      setFeedback("");
      return;
    }
    onCorrectWord?.(target.id);
    if (round + 1 >= rounds) {
      onComplete?.({ correct: correctRef.current, total: rounds });
      return;
    }
    setRound((r) => r + 1);
  }

  return (
    <div>
      <p style={{ textAlign: "center", fontWeight: 900, marginBottom: "0.5rem" }}>
        Nghe và chọn đúng hình ({round + 1}/{rounds})
      </p>
      <div className={styles.row}>
        <button type="button" className={`${styles.bigBtn} ${styles.bigBtnPrimary}`} onClick={playAudio}>
          🔊 Nghe lại
        </button>
      </div>
      <div className={styles.choiceGrid}>
        {options.map((opt) => {
          const cls = [styles.choiceBtn];
          if (picked && opt.id === target.id) cls.push(styles.choiceRight);
          if (picked && picked === opt.id && opt.id !== target.id) cls.push(styles.choiceWrong);
          return (
            <button key={opt.id} type="button" className={cls.join(" ")} onClick={() => choose(opt)}>
              <img src={opt.imageUrl} alt="" />
            </button>
          );
        })}
      </div>
      {feedback ? (
        <div className={`${styles.feedback} ${picked === target.id ? styles.feedbackGood : styles.feedbackTry}`}>{feedback}</div>
      ) : null}
      <div className={styles.row}>
        {picked ? (
          <button type="button" className={`${styles.bigBtn} ${styles.bigBtnPrimary}`} onClick={next}>
            {picked === target.id ? (round + 1 >= rounds ? "Hoàn thành ✓" : "Câu tiếp →") : "Thử lại"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
