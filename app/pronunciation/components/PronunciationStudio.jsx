"use client";

import PronunciationResultPanel from "./PronunciationResultPanel";
import {
  getPronunciationAudioText,
  speakPronunciationEnglish,
} from "@/lib/pronunciation/pronunciation-audio";

export default function PronunciationStudio({ drill, lessonGroup, wordIndex, studio, canGoNext, onNext }) {
  if (!drill || !lessonGroup) {
    return (
      <section className="pron-room pron-room--empty" aria-label="Phòng luyện phát âm">
        <span className="pron-room__emptyIcon" aria-hidden>
          🎙️
        </span>
        <h2 className="pron-room__emptyTitle">Phòng luyện phát âm</h2>
        <p className="pron-room__emptyDesc">Chọn một bài luyện bên trái để bắt đầu.</p>
      </section>
    );
  }

  const { phase, result, interimText, errorMsg, micSupported, togglePractice, playRecording, reset } = studio;
  const listening = phase === "listening";
  const busy = phase === "scoring";
  const progressLabel = `${wordIndex + 1}/${lessonGroup.wordCount}`;

  const handleRetry = () => {
    reset();
  };

  const activePhoneme = drill.targetPhoneme || drill.ipaFocus || lessonGroup.targetPhoneme || lessonGroup.ipaFocus;
  const practiceTitle = activePhoneme ? `Âm ${activePhoneme}` : lessonGroup.title;

  const speakPhoneme = () => {
    const text = getPronunciationAudioText("phoneme", lessonGroup, drill);
    speakPronunciationEnglish(text, 0.72);
  };

  const speakWord = () => {
    const text = getPronunciationAudioText("word", lessonGroup, drill);
    speakPronunciationEnglish(text);
  };

  const speakSentence = () => {
    const text = getPronunciationAudioText("sentence", lessonGroup, drill);
    speakPronunciationEnglish(text, 0.82);
  };

  return (
    <section className="pron-room" aria-label="Phòng luyện phát âm">
      <div className="pron-room__shell">
        <div className="pron-room__practice">
          <div className="pron-room__head">
            <h2 className="pron-room__title">
              Đang luyện: <span>{practiceTitle}</span>
            </h2>
            <span className="pron-room__progress">{progressLabel}</span>
          </div>

          <div className="pron-room__focus">
            <div className="pron-room__ipaRow">
              <span className="pron-room__ipaBig">{activePhoneme}</span>
              <button
                type="button"
                className="pron-room__speakBtn"
                onClick={speakPhoneme}
                aria-label={`Nghe mẫu âm ${activePhoneme}`}
              >
                🔊
              </button>
            </div>

            <div className="pron-room__wordRow">
              <strong className="pron-room__word">{drill.word}</strong>
              <button
                type="button"
                className="pron-room__speakBtn"
                onClick={speakWord}
                aria-label="Nghe mẫu từ"
              >
                🔊
              </button>
            </div>

            <p className="pron-room__phonetic">{drill.ipa}</p>

            <div className="pron-room__sentence">
              <p>
                {drill.sampleSentence}
                <button
                  type="button"
                  className="pron-room__speakBtn pron-room__speakBtn--inline"
                  onClick={speakSentence}
                  aria-label="Nghe câu mẫu"
                >
                  🔊
                </button>
              </p>
              {drill.sampleSentenceVi ? <span>{drill.sampleSentenceVi}</span> : null}
            </div>
          </div>

          {!micSupported ? (
            <p className="pron-room__warn">
              Trình duyệt không hỗ trợ ghi âm. Hãy dùng <strong>Chrome</strong> hoặc <strong>Edge</strong>.
            </p>
          ) : null}
          {errorMsg ? <p className="pron-room__warn">{errorMsg}</p> : null}

          {listening ? (
            <p className="pron-room__hint">
              <span className="pron-room__recDot" aria-hidden />
              {interimText ? `Đang nghe: ${interimText}` : "Đang nghe — nói từ hoặc câu mẫu"}
            </p>
          ) : null}

          <div className="pron-room__controls">
            <button type="button" className="pron-room__sideBtn" onClick={speakWord}>
              <span aria-hidden>🎧</span>
              Nghe mẫu
            </button>

            <button
              type="button"
              className={`pron-room__mic${listening ? " pron-room__mic--active" : ""}${
                busy ? " pron-room__mic--busy" : ""
              }`}
              onClick={togglePractice}
              disabled={busy || !micSupported}
              aria-label={listening ? "Dừng ghi âm" : "Bắt đầu ghi âm"}
            >
              <span aria-hidden>{listening ? "⏹" : "🎤"}</span>
            </button>

            <button
              type="button"
              className="pron-room__sideBtn"
              onClick={playRecording}
              disabled={!studio.audioUrl}
            >
              <span aria-hidden>〰️</span>
              Bản ghi của tôi
            </button>
          </div>

          <p className="pron-room__micHint">
            Nhấn để bắt đầu nói — Nói từ hoặc câu, hệ thống sẽ tự chấm điểm cho bạn.
          </p>

          <div className="pron-room__nav">
            <button
              type="button"
              className="pron-room__nextBtn"
              onClick={onNext}
              disabled={!canGoNext || listening || busy}
            >
              Câu tiếp →
            </button>
            {!canGoNext ? (
              <span className="pron-room__navHint">Bạn đã hoàn thành tất cả từ trong bài này.</span>
            ) : null}
          </div>

          <div className="pron-room__tip">
            <span className="pron-room__tipIcon" aria-hidden>
              💡
            </span>
            <div>
              <strong>Mẹo nhỏ</strong>
              <p>{lessonGroup.tip}</p>
            </div>
          </div>
        </div>

        <PronunciationResultPanel
          result={result}
          onPlay={playRecording}
          onRetry={handleRetry}
          canGoNext={canGoNext}
          onNext={onNext}
          navDisabled={listening || busy}
        />
      </div>
    </section>
  );
}
