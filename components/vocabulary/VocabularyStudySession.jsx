"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveCardImage } from "@/lib/vocabulary/card-image";
import { posChipMeta } from "@/lib/vocabulary/mock-ui";
import { speakPassDualScore } from "@/lib/client-pronunciation-eval";
import VocabularySessionSpeakPanel from "./VocabularySessionSpeakPanel";
import { useVocabularyStudySpeak } from "./useVocabularyStudySpeak";
import {
  STUDY_STEPS,
  RATING_OPTIONS,
  buildMeaningOptions,
  buildFillBlankPrompt,
  checkFillBlank,
  checkMeaningChoice,
  createWordResult,
  tallySessionResults,
  beginReviewAttempt,
  submitWordRating,
  playAudioUrl,
} from "@/lib/vocabulary/study-session";
import SentenceWithWordIpa from "./SentenceWithWordIpa";
import VocabularySessionPhonetics from "./VocabularySessionPhonetics";

function StepDots({ currentStepId }) {
  const idx = STUDY_STEPS.findIndex((s) => s.id === currentStepId);
  return (
    <div className="vocab-session-steps" aria-label="Các bước học">
      {STUDY_STEPS.map((step, i) => (
        <span
          key={step.id}
          className={`vocab-session-step${i < idx ? " vocab-session-step--done" : ""}${i === idx ? " vocab-session-step--active" : ""}`}
          title={step.label}
        >
          {step.icon}
        </span>
      ))}
    </div>
  );
}

function SessionSummary({ summary, results, onClose, onRestart }) {
  return (
    <div className="vocab-session-summary">
      <span className="vocab-session-summary__icon" aria-hidden>
        🎉
      </span>
      <h2 className="vocab-session-summary__title">Hoàn thành phiên học!</h2>
      <p className="vocab-session-summary__sub">
        Bạn đã học <strong>{summary.total}</strong> từ trong phiên này.
      </p>

      <div className="vocab-session-summary__grid">
        <div className="vocab-session-summary__stat">
          <span className="vocab-session-summary__statVal vocab-session-summary__statVal--ok">
            {summary.correct}
          </span>
          <span className="vocab-session-summary__statLabel">Từ nhớ tốt</span>
        </div>
        <div className="vocab-session-summary__stat">
          <span className="vocab-session-summary__statVal vocab-session-summary__statVal--bad">
            {summary.wrong}
          </span>
          <span className="vocab-session-summary__statLabel">Cần ôn lại</span>
        </div>
        <div className="vocab-session-summary__stat">
          <span className="vocab-session-summary__statVal vocab-session-summary__statVal--xp">
            +{summary.xp}
          </span>
          <span className="vocab-session-summary__statLabel">XP nhận được</span>
        </div>
      </div>

      {summary.reviewAgain.length > 0 ? (
        <div className="vocab-session-summary__review">
          <h3>Từ cần ôn lại</h3>
          <ul>
            {summary.reviewAgain.slice(0, 8).map((r) => (
              <li key={r.wordId}>
                <strong>{r.word}</strong>
                <span>{r.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="vocab-session-summary__perfect">Tuyệt vời — không có từ nào cần ôn gấp!</p>
      )}

      <div className="vocab-session-summary__actions">
        <button type="button" className="vocab-session-btn vocab-session-btn--primary" onClick={onRestart}>
          Học tiếp
        </button>
        <button type="button" className="vocab-session-btn vocab-session-btn--ghost" onClick={onClose}>
          Về thư viện
        </button>
      </div>
    </div>
  );
}

export default function VocabularyStudySession({
  words = [],
  distractorPool = [],
  mode = "learn",
  sessionKey = "",
  onClose,
  onComplete,
  onRestart,
}) {
  const [wordIndex, setWordIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState(() => words.map((w) => createWordResult(w)));
  const [meaningChoice, setMeaningChoice] = useState(null);
  const [fillInput, setFillInput] = useState("");
  const [stepFeedback, setStepFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState(null);

  const currentWord = words[wordIndex];
  const studySpeak = useVocabularyStudySpeak(currentWord);
  const currentStep = STUDY_STEPS[stepIndex]?.id || "intro";
  const currentResult = results[wordIndex];
  const posMeta = posChipMeta(currentWord?.part_of_speech);
  const image = currentWord ? resolveCardImage(currentWord) : null;

  const meaningPool = useMemo(() => {
    const merged = [...words];
    const seen = new Set(words.map((w) => w.id));
    for (const row of distractorPool) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        merged.push(row);
      }
    }
    return merged;
  }, [words, distractorPool]);

  const meaningOptions = useMemo(
    () => (currentWord ? buildMeaningOptions(currentWord, meaningPool) : []),
    [currentWord, meaningPool]
  );

  const fillPrompt = useMemo(
    () => buildFillBlankPrompt(currentWord?.example_sentence, currentWord?.word),
    [currentWord]
  );

  const speakResult = studySpeak.result;
  const speakComplete = studySpeak.isComplete;
  const isRecording = studySpeak.isListening || studySpeak.isScoring;

  useEffect(() => {
    setWordIndex(0);
    setStepIndex(0);
    setResults(words.map((w) => createWordResult(w)));
    setFinished(false);
    setSummary(null);
    setMeaningChoice(null);
    setFillInput("");
    setStepFeedback(null);
  }, [sessionKey, words]);

  const patchStep = useCallback(
    (idx, stepId, data) => {
      setResults((prev) => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          steps: { ...next[idx].steps, [stepId]: data },
        };
        return next;
      });
    },
    []
  );

  const goNextStep = useCallback(() => {
    setStepFeedback(null);
    setMeaningChoice(null);
    setFillInput("");
    if (stepIndex < STUDY_STEPS.length - 1) {
      setStepIndex((s) => s + 1);
      return;
    }
    if (wordIndex < words.length - 1) {
      setWordIndex((w) => w + 1);
      setStepIndex(0);
      return;
    }
    const finalSummary = tallySessionResults(results);
    setSummary(finalSummary);
    setFinished(true);
    onComplete?.(finalSummary, results);
  }, [stepIndex, wordIndex, words.length, results, onComplete]);

  function handleListenWord() {
    if (!currentWord) return;
    playAudioUrl(currentWord.audio_url, currentWord.word);
    patchStep(wordIndex, "listen_word", { ok: true, listened: true });
    setStepFeedback({ type: "info", text: "Đã phát âm từ. Bấm Tiếp tục." });
  }

  function handleListenSentence() {
    if (!currentWord) return;
    playAudioUrl(currentWord.example_audio_url, currentWord.example_sentence);
    patchStep(wordIndex, "listen_sentence", { ok: true, listened: true });
    setStepFeedback({ type: "info", text: "Đã phát câu ví dụ. Bấm Tiếp tục." });
  }

  function handleMeaningSelect(option) {
    setMeaningChoice(option);
    const ok = checkMeaningChoice(option, currentWord);
    patchStep(wordIndex, "choose_meaning", { ok, selected: option });
    setStepFeedback({
      type: ok ? "success" : "error",
      text: ok ? "Chính xác!" : `Sai rồi — nghĩa đúng: ${currentWord.vietnamese_meaning}`,
    });
  }

  function handleFillSubmit(e) {
    e.preventDefault();
    const ok = checkFillBlank(fillInput, fillPrompt.answer);
    patchStep(wordIndex, "fill_blank", { ok, input: fillInput });
    setStepFeedback({
      type: ok ? "success" : "error",
      text: ok ? "Đúng rồi!" : `Đáp án: ${fillPrompt.answer}`,
    });
  }

  useEffect(() => {
    if (currentStep !== "speak" || !speakComplete || !speakResult || isRecording) return;
    const ok = speakPassDualScore(speakResult);
    patchStep(wordIndex, "speak", {
      ok,
      score: speakResult.combinedScore,
      wordScore: speakResult.word?.score,
      sentenceScore: speakResult.sentence?.score,
      message: speakResult.word?.message,
    });
  }, [speakResult, speakComplete, isRecording, currentStep, wordIndex, patchStep]);

  async function handleRating(ratingId) {
    if (!currentWord || submitting) return;
    setSubmitting(true);
    const rating = RATING_OPTIONS.find((r) => r.id === ratingId);
    let xpDelta = 0;
    const pronScore = currentResult?.steps?.speak?.score ?? null;
    try {
      const attemptId = await beginReviewAttempt(currentWord.id);
      const data = await submitWordRating(currentWord.id, ratingId, attemptId, {
        pronunciationScore: pronScore,
      });
      xpDelta = Number(data?.stats?.xp_delta || 0);
    } catch {
      xpDelta = rating?.isCorrect ? 10 : 0;
    }

    const stepCorrect = Object.values(currentResult?.steps || {}).filter((s) => s?.ok).length;
    const stepWrong = Object.values(currentResult?.steps || {}).filter((s) => s && !s.ok).length;

    const wordPatch = {
      rating,
      xpDelta,
      needsReview: !rating?.isCorrect,
      correctCount: stepCorrect + (rating?.isCorrect ? 1 : 0),
      wrongCount: stepWrong + (rating?.isCorrect ? 0 : 1),
    };

    setResults((prev) => {
      const next = [...prev];
      next[wordIndex] = { ...next[wordIndex], ...wordPatch };
      return next;
    });

    setStepFeedback({
      type: rating?.isCorrect ? "success" : "info",
      text: rating?.isCorrect ? `+${xpDelta} XP · ${rating.label}` : `Sẽ ôn lại sớm · ${rating.label}`,
    });

    setSubmitting(false);

    setTimeout(() => {
      if (wordIndex >= words.length - 1) {
        setResults((prev) => {
          const finalSummary = tallySessionResults(prev);
          setSummary(finalSummary);
          setFinished(true);
          onComplete?.(finalSummary, prev);
          return prev;
        });
        return;
      }
      setStepFeedback(null);
      setMeaningChoice(null);
      setFillInput("");
      setWordIndex((w) => w + 1);
      setStepIndex(0);
    }, 600);
  }

  if (!words.length) return null;

  if (finished && summary) {
    return (
      <div className="vocab-session-overlay">
        <div className="vocab-session-card">
          <SessionSummary summary={summary} results={results} onClose={onClose} onRestart={onRestart} />
        </div>
      </div>
    );
  }

  const progressLabel = `${wordIndex + 1}/${words.length}`;
  const progressPct = Math.round(((wordIndex + stepIndex / STUDY_STEPS.length) / words.length) * 100);

  return (
    <div className="vocab-session-overlay">
      <div className={`vocab-session-card vocab-session-card--step-${currentStep}`}>
        <header className="vocab-session-head">
          <button type="button" className="vocab-session-close" onClick={onClose} aria-label="Đóng phiên học">
            ✕
          </button>
          <div className="vocab-session-head__meta">
            <span className="vocab-session-mode">
              {mode === "review"
                ? "🔄 Ôn tập"
                : mode === "weak"
                ? "💪 Từ yếu"
                : mode === "deep"
                ? "✨ Học chuyên sâu"
                : "✨ Học mới"}
            </span>
            <span className="vocab-session-progressLabel">{progressLabel} từ</span>
          </div>
          <div className="vocab-session-progress">
            <div className="vocab-session-progress__bar">
              <div className="vocab-session-progress__fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <StepDots currentStepId={currentStep} />
        </header>

        <div
          className={`vocab-session-body${
            currentStep === "speak" || currentStep === "rate" ? "" : " vocab-session-body--scroll"
          }`}
        >
          {currentStep === "intro" && (
            <div className="vocab-session-intro">
              {image?.src ? (
                <img className="vocab-session-img" src={image.src} alt={currentWord.word} />
              ) : (
                <div className="vocab-session-img vocab-session-img--placeholder">📚</div>
              )}
              <h2 className="vocab-session-word">{currentWord.word}</h2>
              <p className="vocab-session-ipa">{currentWord.ipa}</p>
              {posMeta ? <span className={`vocab-dash-pos vocab-dash-pos--${posMeta.tone}`}>{posMeta.label}</span> : null}
              <p className="vocab-session-meaning">{currentWord.vietnamese_meaning}</p>
              {currentWord.example_sentence ? (
                <div className="vocab-session-intro__example">
                  <SentenceWithWordIpa
                    sentence={currentWord.example_sentence}
                    sentenceIpa={currentWord.example_sentence_ipa}
                    sentenceVi={currentWord.example_sentence_vi}
                    headword={currentWord.word}
                    headwordIpa={currentWord.ipa}
                  />
                </div>
              ) : null}
            </div>
          )}

          {currentStep === "listen_word" && (
            <div className="vocab-session-panel">
              <h2 className="vocab-session-word">{currentWord.word}</h2>
              <VocabularySessionPhonetics
                word={currentWord.word}
                ipa={currentWord.ipa}
                showSentence={false}
              />
              <p className="vocab-session-hint">Nghe phát âm chuẩn của từ này</p>
              <button type="button" className="vocab-session-playBtn" onClick={handleListenWord}>
                🔊 Nghe từ
              </button>
            </div>
          )}

          {currentStep === "listen_sentence" && (
            <div className="vocab-session-panel">
              <p className="vocab-session-hint">Nghe câu ví dụ kèm phiên âm</p>
              <VocabularySessionPhonetics
                word={currentWord.word}
                ipa={currentWord.ipa}
                sentence={currentWord.example_sentence}
                sentenceIpa={currentWord.example_sentence_ipa}
                sentenceVi={currentWord.example_sentence_vi}
                showWordIpa={false}
              />
              <button type="button" className="vocab-session-playBtn" onClick={handleListenSentence}>
                🎧 Nghe câu ví dụ
              </button>
            </div>
          )}

          {currentStep === "choose_meaning" && (
            <div className="vocab-session-panel">
              <h2 className="vocab-session-word">{currentWord.word}</h2>
              <p className="vocab-session-hint">Chọn nghĩa tiếng Việt đúng</p>
              <div className="vocab-session-options">
                {meaningOptions.map((opt) => {
                  const picked = meaningChoice === opt;
                  const isCorrect = opt === currentWord.vietnamese_meaning;
                  let cls = "vocab-session-option";
                  if (picked) cls += isCorrect ? " vocab-session-option--correct" : " vocab-session-option--wrong";
                  else if (meaningChoice && isCorrect) cls += " vocab-session-option--correct";
                  return (
                    <button key={opt} type="button" className={cls} onClick={() => handleMeaningSelect(opt)} disabled={Boolean(meaningChoice)}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === "fill_blank" && (
            <div className="vocab-session-panel">
              <p className="vocab-session-hint">Điền từ còn thiếu vào câu</p>
              <p className="vocab-session-fillPrompt">{fillPrompt.display}</p>
              <form onSubmit={handleFillSubmit} className="vocab-session-fillForm">
                <input
                  type="text"
                  className="vocab-session-fillInput"
                  value={fillInput}
                  onChange={(e) => setFillInput(e.target.value)}
                  placeholder="Nhập từ tiếng Anh…"
                  autoComplete="off"
                  disabled={Boolean(currentResult?.steps?.fill_blank)}
                />
                <button type="submit" className="vocab-session-btn vocab-session-btn--primary" disabled={Boolean(currentResult?.steps?.fill_blank)}>
                  Kiểm tra
                </button>
              </form>
            </div>
          )}

          {currentStep === "speak" && currentWord ? (
            <VocabularySessionSpeakPanel
              item={currentWord}
              speak={studySpeak}
              onListenWord={handleListenWord}
              onListenSentence={handleListenSentence}
            />
          ) : null}

          {currentStep === "rate" && (
            <div className="vocab-session-panel">
              <h2 className="vocab-session-word">{currentWord.word}</h2>
              <p className="vocab-session-hint">Bạn nhớ từ này mức nào?</p>
              <div className="vocab-session-ratings">
                {RATING_OPTIONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`vocab-session-rating vocab-session-rating--${r.tone}`}
                    onClick={() => handleRating(r.id)}
                    disabled={submitting}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stepFeedback && currentStep !== "speak" && currentStep !== "rate" ? (
            <p className={`vocab-session-feedback vocab-session-feedback--${stepFeedback.type}`}>{stepFeedback.text}</p>
          ) : null}

          {currentResult?.steps && Object.keys(currentResult.steps).length > 0 && currentStep !== "speak" ? (
            <div className="vocab-session-miniStatus" aria-label="Trạng thái bước học">
              {STUDY_STEPS.filter((s) => s.id !== "rate" && currentResult.steps[s.id]).map((s) => (
                <span
                  key={s.id}
                  className={`vocab-session-miniStatus__chip${currentResult.steps[s.id]?.ok ? " vocab-session-miniStatus__chip--ok" : " vocab-session-miniStatus__chip--bad"}`}
                >
                  {s.icon}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {currentStep !== "rate" ? (
          <footer className="vocab-session-foot">
            <button
              type="button"
              className="vocab-session-btn vocab-session-btn--primary vocab-session-btn--wide"
              onClick={goNextStep}
              disabled={
                (currentStep === "choose_meaning" && !meaningChoice) ||
                (currentStep === "fill_blank" && !currentResult?.steps?.fill_blank) ||
                (currentStep === "speak" && !currentResult?.steps?.speak)
              }
            >
              Tiếp tục
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
