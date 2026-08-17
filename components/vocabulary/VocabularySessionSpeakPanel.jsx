"use client";

import { speakPassDualScore } from "@/lib/client-pronunciation-eval";
import { formatWordIpa } from "@/lib/vocabulary/sentence-word-ipa";
import HighlightedPronunciationText from "./HighlightedPronunciationText";
import VocabularySessionPhonetics from "./VocabularySessionPhonetics";

function displayScore(score) {
  const n = Number(score);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function scoreTone(score) {
  const n = displayScore(score);
  if (n >= 85) return "great";
  if (n >= 70) return "good";
  if (n >= 55) return "ok";
  return "low";
}

function SpeakSlot({ label, score, children, transcript, audioUrl, onPlay, onRetry, retryLabel }) {
  const shownScore = displayScore(score);

  return (
    <div className="vocab-session-speakSlot">
      <div className="vocab-session-speakSlot__head">
        <span className="vocab-session-speakSlot__label">{label}</span>
        <span className={`vocab-session-speakSlot__score vocab-session-speakSlot__score--${scoreTone(shownScore)}`}>
          {shownScore}%
        </span>
      </div>
      <div className="vocab-session-speakSlot__body">
        <div className="vocab-session-speakSlot__content">{children}</div>
        <span
          className={`vocab-session-speakSlot__badge vocab-session-speakSlot__score--${scoreTone(shownScore)}`}
          aria-label={`Điểm ${label}: ${shownScore}%`}
        >
          {shownScore}%
        </span>
      </div>
      {transcript ? <p className="vocab-session-speakSlot__said">Bạn nói: &ldquo;{transcript}&rdquo;</p> : null}
      <div className="vocab-session-speakSlot__actions">
        {audioUrl ? (
          <button type="button" className="vocab-session-speakResult__playBtn" onClick={onPlay}>
            ▶ Nghe lại
          </button>
        ) : null}
        <button type="button" className="vocab-session-speakResult__retryBtn" onClick={onRetry}>
          ↺ {retryLabel}
        </button>
      </div>
    </div>
  );
}

export default function VocabularySessionSpeakPanel({
  item,
  speak,
  onListenWord,
  onListenSentence,
}) {
  const {
    activeTarget,
    wordResult,
    sentenceResult,
    wordAudioUrl,
    sentenceAudioUrl,
    errorMsg,
    hasSentence,
    getMicLabel,
    toggleSpeak,
    playRecording,
    isListening,
    isScoring,
    result,
  } = speak;

  const passed = result ? speakPassDualScore(result) : false;
  const showSummary = Boolean(wordResult && (!hasSentence || sentenceResult));
  const stageEmpty = !wordResult && !sentenceResult && !isListening && !isScoring;

  return (
    <div className="vocab-session-panel vocab-session-speak">
      <div className="vocab-session-speak__prompt">
        <h2 className="vocab-session-word vocab-session-word--compact">{item.word}</h2>
        <p className="vocab-session-ipa vocab-session-ipa--compact">{formatWordIpa(item.ipa, item.word)}</p>
        {hasSentence ? (
          <VocabularySessionPhonetics
            word={item.word}
            ipa={item.ipa}
            sentence={item.example_sentence}
            sentenceIpa={item.example_sentence_ipa}
            sentenceVi={item.example_sentence_vi}
            sentenceLabel={item.vietnamese_meaning || "Câu ví dụ"}
            showWordIpa={false}
            compact
          />
        ) : null}
        <p className="vocab-session-hint vocab-session-hint--compact">
          {hasSentence ? "Ghi âm riêng từ và câu — kết quả hiện ở giữa." : "Ghi âm từ để xem kết quả ở giữa."}
        </p>
      </div>

      <div className="vocab-session-speak__stage" aria-live="polite">
        {stageEmpty ? (
          <p className="vocab-session-speak__placeholder">🎤 Bấm nút ghi âm bên dưới</p>
        ) : null}

        {isListening ? (
          <p className="vocab-session-feedback vocab-session-feedback--compact vocab-session-feedback--info vocab-session-speak__status">
            Đang ghi âm {activeTarget === "sentence" ? "câu" : "từ"} — bấm lại để dừng.
          </p>
        ) : null}

        {isScoring ? (
          <p className="vocab-session-feedback vocab-session-feedback--compact vocab-session-feedback--info vocab-session-speak__status">
            Đang chấm {activeTarget === "sentence" ? "câu" : "từ"}…
          </p>
        ) : null}

        {wordResult ? (
          <SpeakSlot
            label="Từ"
            score={wordResult.score}
            transcript={wordResult.transcript}
            audioUrl={wordAudioUrl}
            onPlay={() => playRecording("word")}
            onRetry={() => toggleSpeak("word")}
            retryLabel="Ghi lại từ"
          >
            <HighlightedPronunciationText
              word={item.word}
              charMarks={wordResult.charMarks}
              wordOk={displayScore(wordResult.score) >= 65}
              compact
              hideLabels
            />
          </SpeakSlot>
        ) : null}

        {sentenceResult ? (
          <SpeakSlot
            label="Câu"
            score={sentenceResult.score}
            transcript={sentenceResult.transcript}
            audioUrl={sentenceAudioUrl}
            onPlay={() => playRecording("sentence")}
            onRetry={() => toggleSpeak("sentence")}
            retryLabel="Ghi lại câu"
          >
            <HighlightedPronunciationText
              sentence={item.example_sentence}
              sentenceMarks={sentenceResult.wordMarks}
              compact
              hideLabels
            />
          </SpeakSlot>
        ) : null}

        {showSummary ? (
          <p
            className={`vocab-session-feedback vocab-session-feedback--compact vocab-session-feedback--${
              passed ? "success" : "error"
            }`}
          >
            {passed ? "Tốt lắm! Đạt yêu cầu." : "Phần đỏ cần luyện thêm."}
          </p>
        ) : null}
      </div>

      <div className="vocab-session-speak__controls">
        <div className="vocab-session-speak__modelBtns">
          <button type="button" className="vocab-session-speak__miniBtn" onClick={onListenWord} title="Nghe mẫu từ">
            🔊 Từ
          </button>
          {hasSentence ? (
            <button type="button" className="vocab-session-speak__miniBtn" onClick={onListenSentence} title="Nghe mẫu câu">
              🎧 Câu
            </button>
          ) : null}
        </div>

        <div className="vocab-session-speak__micRow">
          <button
            type="button"
            className={`vocab-session-micBtn vocab-session-micBtn--compact vocab-session-micBtn--split${
              isListening && activeTarget === "word" ? " vocab-session-micBtn--active" : ""
            }`}
            onClick={() => toggleSpeak("word")}
            disabled={isScoring || (isListening && activeTarget !== "word")}
          >
            🎤 {getMicLabel("word")}
          </button>
          {hasSentence ? (
            <button
              type="button"
              className={`vocab-session-micBtn vocab-session-micBtn--compact vocab-session-micBtn--split vocab-session-micBtn--sentence${
                isListening && activeTarget === "sentence" ? " vocab-session-micBtn--active" : ""
              }`}
              onClick={() => toggleSpeak("sentence")}
              disabled={isScoring || (isListening && activeTarget !== "sentence")}
            >
              🎤 {getMicLabel("sentence")}
            </button>
          ) : null}
        </div>

        {errorMsg ? (
          <p className="vocab-session-feedback vocab-session-feedback--compact vocab-session-feedback--error">{errorMsg}</p>
        ) : null}
      </div>
    </div>
  );
}
