"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { playKidWordAudio, stopSpeaking } from "@/lib/kids-vocabulary/browser-tts";
import StoryAudioControls from "./StoryAudioControls";
import { storyGameWords } from "@/lib/kids-stories/stories";
import StoryHighlightText from "./StoryHighlightText";
import ListenChooseGame from "@/components/kids-vocabulary/ListenChooseGame";
import DragDropGame from "@/components/kids-vocabulary/DragDropGame";
import StoryFillBlank from "./StoryFillBlank";
import HoverTranslateToggle from "./HoverTranslateToggle";
import VocabWordImage from "./VocabWordImage";
import { recordStoryComplete } from "@/lib/kids-hub/rewards";
import styles from "@/components/kids-vocabulary/KidsVocabulary.module.css";
import storyStyles from "./KidsStories.module.css";

const TABS = [
  { id: "story", label: "Truyện" },
  { id: "vocab", label: "Từ vựng" },
  { id: "translate", label: "Dịch Việt" },
  { id: "quiz", label: "Câu hỏi" },
  { id: "games", label: "Mini game" },
];

export default function StoryRunner({ story }) {
  const [tab, setTab] = useState("story");
  const [gameSub, setGameSub] = useState("listen");
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizPick, setQuizPick] = useState(null);
  const [points, setPoints] = useState(0);
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const [hoverTranslate, setHoverTranslate] = useState(false);

  const englishLines = useMemo(() => story.paragraphs.map((p) => p.en), [story.paragraphs]);
  const storyPlayer = (
    <div className={storyStyles.storyPlayerDock}>
      <div className={storyStyles.storyPlayerRow}>
        <div className={storyStyles.storyPlayerMain}>
          <StoryAudioControls
            key={story.id}
            lines={englishLines}
            activeWordIdx={activeWordIdx}
            onActiveWordIdx={setActiveWordIdx}
          />
        </div>
        <HoverTranslateToggle enabled={hoverTranslate} onChange={setHoverTranslate} />
      </div>
    </div>
  );
  const resetAudio = useCallback(() => {
    stopSpeaking();
    setActiveWordIdx(-1);
  }, []);

  useEffect(() => {
    if (tab !== "story" && tab !== "translate") resetAudio();
  }, [tab, resetAudio]);

  useEffect(() => () => resetAudio(), [resetAudio]);

  const getWords = storyGameWords(story);
  const listenWords = getWords(story.games.listenChoose);
  const dragWords = getWords(story.games.dragDrop);
  const fillItems = Array.isArray(story.games.fillBlank) ? story.games.fillBlank : [story.games.fillBlank];
  const q = story.questions[quizIdx];

  function addPoints(n) {
    setPoints((p) => p + n);
  }

  return (
    <div className={`${styles.runner} ${storyStyles.storyRunner}`}>
      <div className={styles.scoreRow}>
        <span>⭐ Điểm: {points}</span>
        <span>{story.emoji}</span>
      </div>
      <div className={`${styles.stepBar} ${storyStyles.storyTabBar}`}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.stepPill} ${storyStyles.storyTabPill} ${tab === t.id ? styles.stepPillActive : ""} ${storyStyles.tabBtn}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "story" ? (
        <div className={storyStyles.storyPanel}>
          <h2 className={storyStyles.storyTitle}>
            {story.emoji} {story.titleEn}
          </h2>
          <p className={storyStyles.storySub}>{story.titleVi}</p>
          <div className={storyStyles.storyReadBlock}>
            {storyPlayer}
            <div className={storyStyles.storyBodyScroll}>
              <StoryHighlightText
                paragraphs={story.paragraphs}
                activeWordIdx={activeWordIdx}
                lang="en"
                vocabulary={story.vocabulary}
                hoverTranslate={hoverTranslate}
              />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "vocab" ? (
        <div className={storyStyles.vocabGrid}>
          {story.vocabulary.map((w) => (
            <div key={w.id} className={storyStyles.vocabCard}>
              <VocabWordImage word={w.word} imageUrl={w.imageUrl} />
              <p className={styles.wordTitle} style={{ fontSize: "1.1rem", margin: "0.35rem 0 0" }}>
                {w.word}
              </p>
              {w.phonetic ? <p className={styles.phonetic}>{w.phonetic}</p> : null}
              {w.vietnameseMeaning ? <p className={styles.meaning}>{w.vietnameseMeaning}</p> : null}
              <button
                type="button"
                className={`${styles.bigBtn} ${styles.bigBtnPrimary}`}
                style={{ marginTop: "0.35rem", minHeight: "36px", fontSize: "0.82rem" }}
                onClick={() => void playKidWordAudio({ word: w.word, audioUrl: w.audioUrl })}
              >
                🔊 Nghe
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "translate" ? (
        <div className={storyStyles.storyPanel}>
          <h2 className={storyStyles.storyTitle}>Bản dịch tiếng Việt</h2>
          <div className={storyStyles.storyReadBlock}>
            {storyPlayer}
            <div className={storyStyles.storyBodyScroll}>
              <div className={storyStyles.translateColumns}>
                <div className={storyStyles.translateCol}>
                  <p className={storyStyles.storyBodyLabel}>Tiếng Anh</p>
                  <StoryHighlightText
                    paragraphs={story.paragraphs}
                    activeWordIdx={activeWordIdx}
                    lang="en"
                    vocabulary={story.vocabulary}
                    hoverTranslate={hoverTranslate}
                  />
                </div>
                <div className={storyStyles.translateCol}>
                  <p className={storyStyles.storyBodyLabel}>Tiếng Việt</p>
                  <StoryHighlightText
                    paragraphs={story.paragraphs}
                    activeWordIdx={activeWordIdx}
                    lang="vi"
                    mirrorLang="en"
                    className={storyStyles.storyBodyVi}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "quiz" && q ? (
        <div className={styles.cardInner}>
          <p style={{ fontWeight: 900, textAlign: "center" }}>
            Câu hỏi {quizIdx + 1}/{story.questions.length}
          </p>
          <p className={styles.wordTitle} style={{ fontSize: "1.05rem", textAlign: "center" }}>
            {q.questionVi}
          </p>
          <p style={{ textAlign: "center", fontWeight: 700, color: "#556", fontSize: "0.85rem" }}>{q.questionEn}</p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
              marginTop: "0.75rem",
              maxWidth: "400px",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {q.options.map((opt, i) => {
              let border = "2px solid #1a1a2e";
              if (quizPick !== null && i === q.correctIndex) border = "3px solid #2a9d8f";
              if (quizPick === i && i !== q.correctIndex) border = "3px solid #e63946";
              return (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.bigBtn} ${styles.bigBtnGhost}`}
                  style={{ width: "100%", border }}
                  disabled={quizPick !== null}
                  onClick={() => {
                    setQuizPick(i);
                    if (i === q.correctIndex) addPoints(10);
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {quizPick !== null ? (
            <div className={styles.row}>
              <button
                type="button"
                className={`${styles.bigBtn} ${styles.bigBtnPrimary}`}
                onClick={() => {
                  if (quizIdx + 1 >= story.questions.length) {
                    recordStoryComplete(story.id);
                    setQuizPick(null);
                    return;
                  }
                  setQuizIdx((x) => x + 1);
                  setQuizPick(null);
                }}
              >
                {quizIdx + 1 >= story.questions.length ? "Xong câu hỏi ✓" : "Câu tiếp →"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "games" ? (
        <div>
          <div className={storyStyles.gameTabs}>
            {[
              { id: "listen", label: "1. Nghe chọn" },
              { id: "drag", label: "2. Kéo thả" },
              { id: "fill", label: "3. Điền từ" },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                className={`${styles.stepPill} ${gameSub === g.id ? styles.stepPillActive : ""} ${storyStyles.tabBtn}`}
                onClick={() => setGameSub(g.id)}
              >
                {g.label}
              </button>
            ))}
          </div>
          {gameSub === "listen" && listenWords.length ? (
            <ListenChooseGame
              words={listenWords}
              maxRounds={10}
              onCorrectWord={() => addPoints(10)}
              onComplete={() => addPoints(5)}
            />
          ) : null}
          {gameSub === "drag" && dragWords.length ? (
            <DragDropGame words={dragWords} maxRounds={10} onComplete={() => addPoints(15)} />
          ) : null}
          {gameSub === "fill" && fillItems.length ? (
            <StoryFillBlank items={fillItems} onComplete={() => addPoints(10)} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

