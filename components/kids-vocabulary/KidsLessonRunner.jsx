"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Flashcard from "./Flashcard";
import ListenChooseGame from "./ListenChooseGame";
import DragDropGame from "./DragDropGame";
import SpeakPractice from "./SpeakPractice";
import ReviewQuiz from "./ReviewQuiz";
import RewardScreen from "./RewardScreen";
import { recordCorrect, recordWrong } from "@/lib/kids-vocabulary/progress";
import { recordLessonComplete } from "@/lib/kids-hub/rewards";
import styles from "./KidsVocabulary.module.css";

const STEPS = [
  { id: "flash", label: "Thẻ" },
  { id: "listen", label: "Nghe" },
  { id: "drag", label: "Kéo" },
  { id: "speak", label: "Nói" },
  { id: "review", label: "Quiz" },
  { id: "reward", label: "Thưởng" },
];

export default function KidsLessonRunner({ lesson }) {
  const words = lesson.words;
  const [step, setStep] = useState(0);
  const [points, setPoints] = useState(0);

  const maxScore = useMemo(
    () => 10 + Math.min(6, words.length) * 10 + 40 + (10 * Math.min(6, words.length) + 10) + Math.min(5, words.length) * 10,
    [words]
  );

  const addPoints = useCallback((n) => setPoints((p) => p + n), []);

  const stepId = STEPS[step]?.id;

  useEffect(() => {
    if (stepId === "reward") {
      recordLessonComplete(lesson.id, starCount());
    }
  }, [stepId, lesson.id, points]);

  function starCount() {
    const r = points / Math.max(1, maxScore);
    if (r >= 0.82) return 3;
    if (r >= 0.55) return 2;
    return 1;
  }

  return (
    <div className={styles.runner}>
      <div className={styles.scoreRow}>
        <span>⭐ Điểm: {points}</span>
        <span style={{ opacity: 0.85 }}>{lesson.emoji}</span>
      </div>
      <div className={styles.stepBar}>
        {STEPS.map((s, i) => (
          <span key={s.id} className={`${styles.stepPill} ${i === step ? styles.stepPillActive : ""}`}>
            {i + 1}. {s.label}
          </span>
        ))}
      </div>

      {stepId === "flash" ? (
        <Flashcard words={words} accentColor={lesson.color} onDone={() => { addPoints(10); setStep(1); }} />
      ) : null}

      {stepId === "listen" ? (
        <ListenChooseGame
          words={words}
          onCorrectWord={(id) => {
            recordCorrect(id);
            addPoints(10);
          }}
          onComplete={() => {
            setStep(2);
          }}
        />
      ) : null}

      {stepId === "drag" ? (
        <DragDropGame
          words={words}
          onComplete={({ wordIds }) => {
            (wordIds || []).forEach((id) => recordCorrect(id));
            addPoints(40);
            setStep(3);
          }}
        />
      ) : null}

      {stepId === "speak" ? (
        <SpeakPractice
          words={words}
          onWordDone={(id) => {
            recordCorrect(id);
            addPoints(10);
          }}
          onComplete={() => {
            addPoints(10);
            setStep(4);
          }}
        />
      ) : null}

      {stepId === "review" ? (
        <ReviewQuiz
          words={words}
          onWordResult={(wordId, ok) => {
            if (ok) {
              recordCorrect(wordId);
              addPoints(10);
            } else {
              recordWrong(wordId);
            }
          }}
          onComplete={() => {
            setStep(5);
          }}
        />
      ) : null}

      {stepId === "reward" ? (
        <RewardScreen stars={starCount()} points={points} lessonTitle={`${lesson.titleEn} (${lesson.titleVi})`} />
      ) : null}
    </div>
  );
}
