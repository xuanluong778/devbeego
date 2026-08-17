"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveCardImage } from "@/lib/vocabulary/card-image";
import { posChipMeta } from "@/lib/vocabulary/mock-ui";
import { useVocabularySpeech } from "@/components/vocabulary/useVocabularySpeech";
import {
  getPracticeMode,
  buildMeaningOptionsFromPool,
  buildWordOptionsFromPool,
  buildMatchRound,
  tallyPracticeResults,
  WORD_MATCH_SIZE,
} from "@/lib/vocabulary/practice-modes";
import {
  buildFillBlankPrompt,
  checkFillBlank,
  checkMeaningChoice,
  speakPassScore,
  playAudioUrl,
  submitWordRating,
} from "@/lib/vocabulary/study-session";
import VocabularySessionPhonetics from "./VocabularySessionPhonetics";

function PracticeSummary({ summary, modeLabel, onClose, onRestart }) {
  return (
    <div className="vocab-session-summary">
      <span className="vocab-session-summary__icon" aria-hidden>
        {summary.accuracy >= 80 ? "🎉" : "📊"}
      </span>
      <h2 className="vocab-session-summary__title">Hoàn thành — {modeLabel}</h2>
      <p className="vocab-session-summary__sub">
        Bạn trả lời đúng <strong>{summary.correct}</strong> / {summary.total} (
        {summary.accuracy}%)
      </p>
      <div className="vocab-session-summary__grid">
        <div className="vocab-session-summary__stat">
          <span className="vocab-session-summary__statVal vocab-session-summary__statVal--ok">
            {summary.correct}
          </span>
          <span className="vocab-session-summary__statLabel">Đúng</span>
        </div>
        <div className="vocab-session-summary__stat">
          <span className="vocab-session-summary__statVal vocab-session-summary__statVal--bad">
            {summary.wrong}
          </span>
          <span className="vocab-session-summary__statLabel">Sai</span>
        </div>
        <div className="vocab-session-summary__stat">
          <span className="vocab-session-summary__statVal vocab-session-summary__statVal--xp">
            {summary.accuracy}%
          </span>
          <span className="vocab-session-summary__statLabel">Chính xác</span>
        </div>
      </div>
      {summary.missed.length > 0 ? (
        <div className="vocab-session-summary__review">
          <h3>Cần ôn lại</h3>
          <ul>
            {summary.missed.slice(0, 6).map((r) => (
              <li key={r.wordId}>
                <strong>{r.word}</strong>
                <span>{r.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="vocab-session-summary__perfect">Xuất sắc — không có lỗi nào!</p>
      )}
      <div className="vocab-session-summary__actions">
        <button type="button" className="vocab-session-btn vocab-session-btn--primary" onClick={onRestart}>
          Luyện tiếp
        </button>
        <button type="button" className="vocab-session-btn vocab-session-btn--ghost" onClick={onClose}>
          Về thư viện
        </button>
      </div>
    </div>
  );
}

function WordMatchPanel({ matchRound, onComplete }) {
  const [selectedWordId, setSelectedWordId] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);
  const [wrongFlash, setWrongFlash] = useState(null);
  const [errors, setErrors] = useState(0);

  const handleMeaningClick = (meaningId) => {
    if (matchedIds.includes(meaningId) || !selectedWordId) return;
    if (selectedWordId === meaningId) {
      const next = [...matchedIds, meaningId];
      setMatchedIds(next);
      setSelectedWordId(null);
      if (next.length === matchRound.pairs.length) {
        onComplete({ ok: errors === 0, errors, pairs: matchRound.pairs.length });
      }
    } else {
      setErrors((e) => e + 1);
      setWrongFlash(meaningId);
      setTimeout(() => setWrongFlash(null), 500);
      setSelectedWordId(null);
    }
  };

  return (
    <div className="vocab-practice-match">
      <p className="vocab-session-hint">Chọn từ bên trái, rồi chọn nghĩa tương ứng bên phải</p>
      <div className="vocab-practice-match__cols">
        <div className="vocab-practice-match__col">
          {matchRound.words.map((item) => {
            const done = matchedIds.includes(item.id);
            const active = selectedWordId === item.id;
            return (
              <button
                key={`w-${item.id}`}
                type="button"
                className={`vocab-practice-match__item${done ? " vocab-practice-match__item--done" : ""}${active ? " vocab-practice-match__item--active" : ""}`}
                onClick={() => !done && setSelectedWordId(item.id)}
                disabled={done}
              >
                {item.text}
              </button>
            );
          })}
        </div>
        <div className="vocab-practice-match__col">
          {matchRound.meanings.map((item) => {
            const done = matchedIds.includes(item.id);
            const wrong = wrongFlash === item.id;
            return (
              <button
                key={`m-${item.id}`}
                type="button"
                className={`vocab-practice-match__item vocab-practice-match__item--meaning${done ? " vocab-practice-match__item--done" : ""}${wrong ? " vocab-practice-match__item--wrong" : ""}`}
                onClick={() => handleMeaningClick(item.id)}
                disabled={done}
              >
                {item.text}
              </button>
            );
          })}
        </div>
      </div>
      <p className="vocab-practice-match__progress">
        Đã ghép {matchedIds.length} / {matchRound.pairs.length}
      </p>
    </div>
  );
}

export default function VocabularyPracticeSession({
  words = [],
  pool = [],
  practiceMode = "flashcard",
  sessionKey = "",
  onClose,
  onComplete,
  onRestart,
}) {
  const modeMeta = getPracticeMode(practiceMode);
  const effectiveMode = practiceMode === "weak_words" ? "multiple_choice" : practiceMode;
  const isWordMatch = effectiveMode === "word_match";

  const [wordIndex, setWordIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [fillInput, setFillInput] = useState("");
  const [answered, setAnswered] = useState(false);

  const { recordingId, speechResult, startRecord } = useVocabularySpeech();

  const distractorPool = pool.length ? pool : words;
  const currentWord = words[wordIndex];
  const posMeta = currentWord ? posChipMeta(currentWord.part_of_speech) : null;
  const image = currentWord ? resolveCardImage(currentWord) : null;

  const meaningOptions = useMemo(
    () => (currentWord ? buildMeaningOptionsFromPool(currentWord, distractorPool) : []),
    [currentWord, distractorPool]
  );

  const wordOptions = useMemo(
    () => (currentWord ? buildWordOptionsFromPool(currentWord, distractorPool) : []),
    [currentWord, distractorPool]
  );

  const fillPrompt = useMemo(
    () => buildFillBlankPrompt(currentWord?.example_sentence, currentWord?.word),
    [currentWord]
  );

  const matchRound = useMemo(
    () => (isWordMatch ? buildMatchRound(words, WORD_MATCH_SIZE) : null),
    [isWordMatch, words, sessionKey]
  );

  const speakKey = currentWord
    ? effectiveMode === "speak_sentence"
      ? `sentence-${currentWord.id}`
      : currentWord.id
    : null;
  const speakScore = speakKey ? speechResult?.[speakKey] : null;
  const isRecording = recordingId === speakKey;

  const progressPct = isWordMatch
    ? 50
    : words.length
    ? Math.round((wordIndex / words.length) * 100)
    : 0;

  useEffect(() => {
    setWordIndex(0);
    setResults([]);
    setFinished(false);
    setSummary(null);
    setFeedback(null);
    setFlipped(false);
    setFillInput("");
    setAnswered(false);
  }, [sessionKey, practiceMode]);

  useEffect(() => {
    if (effectiveMode !== "listen_choose" || !currentWord || answered) return;
    playAudioUrl(currentWord.audio_url, currentWord.word);
  }, [effectiveMode, currentWord, wordIndex, answered, sessionKey]);

  const recordResult = useCallback(
    (ok, extra = {}) => {
      if (!currentWord) return;
      const row = {
        wordId: currentWord.id,
        word: currentWord.word,
        meaning: currentWord.vietnamese_meaning,
        ok,
        ...extra,
      };
      setResults((prev) => [...prev, row]);
      return row;
    },
    [currentWord]
  );

  const advance = useCallback(
    (delay = 700) => {
      setTimeout(() => {
        if (wordIndex >= words.length - 1) {
          setResults((prev) => {
            const finalSummary = tallyPracticeResults(prev);
            setSummary(finalSummary);
            setFinished(true);
            onComplete?.(finalSummary);
            return prev;
          });
          return;
        }
        setWordIndex((i) => i + 1);
        setFeedback(null);
        setFlipped(false);
        setFillInput("");
        setAnswered(false);
      }, delay);
    },
    [wordIndex, words.length, onComplete]
  );

  const maybeSubmitSrs = useCallback(
    async (ok) => {
      if (practiceMode !== "weak_words" || !currentWord) return;
      try {
        const attemptId = `practice-weak-${sessionKey}-${currentWord.id}-${Date.now()}`;
        await submitWordRating(currentWord.id, ok ? "normal" : "forgot", attemptId);
      } catch {
        /* optional */
      }
    },
    [practiceMode, currentWord, sessionKey]
  );

  const handleMeaningPick = async (choice) => {
    if (!currentWord || answered) return;
    const ok = checkMeaningChoice(choice, currentWord);
    setAnswered(true);
    recordResult(ok);
    await maybeSubmitSrs(ok);
    setFeedback({
      type: ok ? "success" : "error",
      text: ok ? "Chính xác!" : `Sai — nghĩa đúng: ${currentWord.vietnamese_meaning}`,
    });
    advance();
  };

  const handleWordPick = async (choice) => {
    if (!currentWord || answered) return;
    const ok = String(choice).trim().toLowerCase() === String(currentWord.word).trim().toLowerCase();
    setAnswered(true);
    recordResult(ok);
    setFeedback({
      type: ok ? "success" : "error",
      text: ok ? "Đúng rồi!" : `Sai — từ đúng: ${currentWord.word}`,
    });
    advance();
  };

  const handleFillSubmit = (e) => {
    e.preventDefault();
    if (!currentWord || answered) return;
    const ok = checkFillBlank(fillInput, fillPrompt.answer);
    setAnswered(true);
    recordResult(ok);
    setFeedback({
      type: ok ? "success" : "error",
      text: ok ? "Chính xác!" : `Đáp án: ${fillPrompt.answer}`,
    });
    advance();
  };

  const handleSpeakCheck = async () => {
    if (!currentWord || !speakScore || answered) return;
    const ok = speakPassScore(speakScore.score);
    setAnswered(true);
    recordResult(ok, { score: speakScore.score });
    await maybeSubmitSrs(ok);
    setFeedback({
      type: ok ? "success" : "error",
      text: ok ? `Tốt lắm (${speakScore.score}%)` : speakScore.message || "Thử lại nhé!",
    });
    advance(900);
  };

  useEffect(() => {
    if (
      (effectiveMode !== "speak_word" && effectiveMode !== "speak_sentence") ||
      !speakScore ||
      isRecording ||
      answered
    ) {
      return;
    }
    handleSpeakCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakScore, isRecording, effectiveMode, answered]);

  const handleFlashcardNext = (remembered) => {
    recordResult(remembered);
    if (wordIndex >= words.length - 1) {
      setResults((prev) => {
        const finalSummary = tallyPracticeResults(prev);
        setSummary(finalSummary);
        setFinished(true);
        onComplete?.(finalSummary);
        return prev;
      });
      return;
    }
    setWordIndex((i) => i + 1);
    setFlipped(false);
    setFeedback(null);
  };

  const handleMatchComplete = ({ ok, errors, pairs }) => {
    const matchResults = matchRound.pairs.map((p) => ({
      wordId: p.id,
      word: p.word,
      meaning: p.meaning,
      ok: errors === 0,
    }));
    setResults(matchResults);
    const finalSummary = {
      ...tallyPracticeResults(matchResults),
      matchErrors: errors,
      pairs,
    };
    setSummary(finalSummary);
    setFinished(true);
    onComplete?.(finalSummary);
  };

  if (!words.length) return null;

  if (finished && summary) {
    return (
      <div className="vocab-session-overlay">
        <div className="vocab-session-card">
          <PracticeSummary
            summary={summary}
            modeLabel={modeMeta.label}
            onClose={onClose}
            onRestart={onRestart}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="vocab-session-overlay">
      <div className="vocab-session-card vocab-practice-session">
        <header className="vocab-session-head">
          <button type="button" className="vocab-session-close" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
          <div className="vocab-session-head__meta">
            <span className="vocab-session-mode">
              {modeMeta.icon} {modeMeta.label}
              {practiceMode === "weak_words" ? " · Từ yếu" : ""}
            </span>
            {!isWordMatch ? (
              <span className="vocab-session-progressLabel">
                {wordIndex + 1} / {words.length}
              </span>
            ) : null}
          </div>
          <div className="vocab-session-progress__bar">
            <div className="vocab-session-progress__fill" style={{ width: `${progressPct}%` }} />
          </div>
        </header>

        <div className="vocab-session-body">
          {effectiveMode === "flashcard" && currentWord ? (
            <div className="vocab-practice-flashcard">
              <button
                type="button"
                className="vocab-practice-flashcard__card"
                onClick={() => setFlipped((f) => !f)}
              >
                {!flipped ? (
                  <div className="vocab-practice-flashcard__face">
                    {image?.src ? (
                      <img className="vocab-session-img" src={image.src} alt={currentWord.word} />
                    ) : (
                      <div className="vocab-session-img vocab-session-img--placeholder">📚</div>
                    )}
                    <h2 className="vocab-session-word">{currentWord.word}</h2>
                    <p className="vocab-session-ipa">{currentWord.ipa}</p>
                    {posMeta ? (
                      <span className={`vocab-dash-pos vocab-dash-pos--${posMeta.tone}`}>{posMeta.label}</span>
                    ) : null}
                    <p className="vocab-practice-flashcard__tap">Chạm để xem nghĩa</p>
                  </div>
                ) : (
                  <div className="vocab-practice-flashcard__face">
                    <p className="vocab-session-meaning">{currentWord.vietnamese_meaning}</p>
                    {currentWord.example_sentence ? (
                      <p className="vocab-session-example">{currentWord.example_sentence}</p>
                    ) : null}
                    {currentWord.example_sentence_vi ? (
                      <p className="vocab-session-exampleVi">{currentWord.example_sentence_vi}</p>
                    ) : null}
                    <p className="vocab-practice-flashcard__tap">Chạm để xem từ</p>
                  </div>
                )}
              </button>
              <div className="vocab-practice-flashcard__actions">
                <button
                  type="button"
                  className="vocab-session-btn vocab-session-btn--ghost"
                  onClick={() => handleFlashcardNext(false)}
                >
                  Chưa nhớ
                </button>
                <button
                  type="button"
                  className="vocab-session-btn vocab-session-btn--primary"
                  onClick={() => handleFlashcardNext(true)}
                >
                  Đã nhớ
                </button>
              </div>
            </div>
          ) : null}

          {effectiveMode === "multiple_choice" && currentWord ? (
            <div className="vocab-session-panel">
              <h2 className="vocab-session-word">{currentWord.word}</h2>
              <p className="vocab-session-hint">Chọn nghĩa tiếng Việt đúng</p>
              <div className="vocab-session-options">
                {meaningOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="vocab-session-option"
                    onClick={() => handleMeaningPick(opt)}
                    disabled={answered}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {effectiveMode === "listen_choose" && currentWord ? (
            <div className="vocab-session-panel">
              <p className="vocab-session-hint">Nghe và chọn từ tiếng Anh đúng</p>
              <button
                type="button"
                className="vocab-session-playBtn"
                onClick={() => playAudioUrl(currentWord.audio_url, currentWord.word)}
              >
                🔊 Nghe lại
              </button>
              <div className="vocab-session-options">
                {wordOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="vocab-session-option"
                    onClick={() => handleWordPick(opt)}
                    disabled={answered}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {effectiveMode === "fill_blank" && currentWord ? (
            <div className="vocab-session-panel">
              <p className="vocab-session-hint">Điền từ còn thiếu vào câu</p>
              <p className="vocab-session-fillPrompt">{fillPrompt.display}</p>
              {currentWord.example_sentence_vi ? (
                <p className="vocab-session-exampleVi">{currentWord.example_sentence_vi}</p>
              ) : null}
              <form onSubmit={handleFillSubmit} className="vocab-session-fillForm">
                <input
                  type="text"
                  className="vocab-session-fillInput"
                  value={fillInput}
                  onChange={(e) => setFillInput(e.target.value)}
                  placeholder="Nhập từ tiếng Anh…"
                  autoComplete="off"
                  disabled={answered}
                />
                <button
                  type="submit"
                  className="vocab-session-btn vocab-session-btn--primary"
                  disabled={answered}
                >
                  Kiểm tra
                </button>
              </form>
            </div>
          ) : null}

          {effectiveMode === "speak_word" && currentWord ? (
            <div className="vocab-session-panel">
              <h2 className="vocab-session-word">{currentWord.word}</h2>
              <VocabularySessionPhonetics
                word={currentWord.word}
                ipa={currentWord.ipa}
                sentence={currentWord.example_sentence}
                sentenceIpa={currentWord.example_sentence_ipa}
                sentenceVi={currentWord.example_sentence_vi}
              />
              <p className="vocab-session-hint">Nói lại từ này rõ ràng</p>
              <button
                type="button"
                className={`vocab-session-micBtn${isRecording ? " vocab-session-micBtn--active" : ""}`}
                onClick={() => startRecord(currentWord, { sentence: false })}
                disabled={isRecording || answered}
              >
                🎤 {isRecording ? "Đang nghe…" : "Bấm để nói"}
              </button>
              {speakScore ? (
                <p
                  className={`vocab-session-feedback vocab-session-feedback--${speakPassScore(speakScore.score) ? "success" : "error"}`}
                >
                  {speakScore.score}% — {speakScore.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {effectiveMode === "speak_sentence" && currentWord ? (
            <div className="vocab-session-panel">
              <p className="vocab-session-hint">Nói lại câu ví dụ — xem phiên âm từng từ</p>
              <VocabularySessionPhonetics
                word={currentWord.word}
                ipa={currentWord.ipa}
                sentence={currentWord.example_sentence}
                sentenceIpa={currentWord.example_sentence_ipa}
                sentenceVi={currentWord.example_sentence_vi}
                showWordIpa={false}
              />
              <button
                type="button"
                className={`vocab-session-micBtn${isRecording ? " vocab-session-micBtn--active" : ""}`}
                onClick={() => startRecord(currentWord, { sentence: true })}
                disabled={isRecording || answered}
              >
                🎤 {isRecording ? "Đang nghe…" : "Bấm để nói"}
              </button>
              {speakScore ? (
                <p
                  className={`vocab-session-feedback vocab-session-feedback--${speakPassScore(speakScore.score) ? "success" : "error"}`}
                >
                  {speakScore.score}% — {speakScore.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {isWordMatch && matchRound ? (
            <WordMatchPanel matchRound={matchRound} onComplete={handleMatchComplete} />
          ) : null}

          {feedback ? (
            <p className={`vocab-session-feedback vocab-session-feedback--${feedback.type}`}>{feedback.text}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
