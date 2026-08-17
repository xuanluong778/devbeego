"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { posChipMeta } from "@/lib/vocabulary/mock-ui";
import { isBookmarked, toggleBookmark } from "@/lib/vocabulary/bookmarks";
import { resolveStudyStatusMeta } from "@/lib/vocabulary/dashboard-config";
import { resolveCardImage } from "@/lib/vocabulary/card-image";
import { formatWordIpa } from "@/lib/vocabulary/sentence-word-ipa";
import VocabularyCardExample from "./VocabularyCardExample";
import VocabularyCardSpeakResult from "./VocabularyCardSpeakResult";
import { useVocabularyCardSpeak } from "./useVocabularyCardSpeak";

export default function VocabularyCard({ item, onListenWord, onListenSentence, onDeepStudy }) {
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(item.id));
  const [imgSrc, setImgSrc] = useState("");
  const [imgFailed, setImgFailed] = useState(false);
  const fallbackQueue = useRef([]);

  const posMeta = posChipMeta(item.part_of_speech);
  const statusMeta = resolveStudyStatusMeta(item);
  const cardImage = useMemo(() => resolveCardImage(item), [item]);
  const speak = useVocabularyCardSpeak(item);

  useEffect(() => {
    setBookmarked(isBookmarked(item.id));
  }, [item.id]);

  useEffect(() => {
    fallbackQueue.current = Array.isArray(cardImage?.fallbacks) ? [...cardImage.fallbacks] : [];
    setImgSrc(cardImage?.showImage ? cardImage.src || "" : "");
    setImgFailed(false);
  }, [cardImage, item.id]);

  function handleImageError() {
    const next = fallbackQueue.current.shift();
    if (next && next !== imgSrc) {
      setImgSrc(next);
      return;
    }
    setImgFailed(true);
  }

  function handleDeepStudy(e) {
    e.stopPropagation();
    onDeepStudy?.(item);
  }

  function handleBookmark(e) {
    e.stopPropagation();
    setBookmarked(toggleBookmark(item.id));
  }

  function handleSpeakClick(e) {
    e.stopPropagation();
    if (speak.phase === "scoring") return;
    speak.toggleSpeak();
  }

  const micActive = speak.phase === "listening";
  const micBusy = speak.phase === "scoring";

  return (
    <article className={`vocab-dash-card vocab-dash-card--${statusMeta.tone}`}>
      <span className={`vocab-dash-card__status vocab-dash-status vocab-dash-status--${statusMeta.tone}`}>
        {statusMeta.label}
      </span>

      <div className="vocab-dash-card__media">
        {imgSrc && !imgFailed && cardImage?.showImage !== false ? (
          <img
            className="vocab-dash-card__img"
            src={imgSrc}
            alt=""
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <span className="vocab-dash-card__imgFallback" aria-hidden>
            📚
          </span>
        )}
      </div>

      <div className="vocab-dash-card__head">
        <h3 className="vocab-dash-card__word">{item.word}</h3>
        <p className="vocab-dash-card__ipa">{formatWordIpa(item.ipa, item.word)}</p>
        {posMeta ? (
          <span className={`vocab-dash-pos vocab-dash-pos--${posMeta.tone}`}>{posMeta.label}</span>
        ) : null}
        <p className="vocab-dash-card__meaning">{item.vietnamese_meaning || "—"}</p>
      </div>

      {item.example_sentence ? (
        <VocabularyCardExample
          sentence={item.example_sentence}
          sentenceIpa={item.example_sentence_ipa}
          sentenceVi={item.example_sentence_vi}
          headword={item.word}
          headwordIpa={item.ipa}
        />
      ) : null}

      {micActive ? (
        <p className="vocab-dash-card__recHint">
          <span className="vocab-dash-card__recDot" aria-hidden />
          Đang nghe — bấm Nói để dừng
        </p>
      ) : null}

      {speak.phase === "result" ? (
        <VocabularyCardSpeakResult
          result={speak.result}
          onPlay={speak.playRecording}
          onRetry={speak.retrySpeak}
        />
      ) : null}

      {speak.errorMsg ? <p className="vocab-dash-card__recError">{speak.errorMsg}</p> : null}

      {onDeepStudy ? (
        <button
          type="button"
          className="vocab-dash-card__deepBtn"
          onClick={handleDeepStudy}
          title="Mở phiên học chuyên sâu: nghe, chọn nghĩa, điền từ, nói"
        >
          <span aria-hidden>✨</span>
          Học chuyên sâu
        </button>
      ) : null}

      <div className="vocab-dash-card__actions">
        <button type="button" className="vocab-dash-iconBtn" onClick={() => onListenWord?.(item)} title="Nghe từ">
          <span aria-hidden>🔊</span>
          <span className="vocab-dash-iconBtn__label">Từ</span>
        </button>
        <button type="button" className="vocab-dash-iconBtn" onClick={() => onListenSentence?.(item)} title="Nghe câu">
          <span aria-hidden>🎧</span>
          <span className="vocab-dash-iconBtn__label">Câu</span>
        </button>
        <button
          type="button"
          className={`vocab-dash-iconBtn vocab-dash-iconBtn--mic${
            micActive ? " vocab-dash-iconBtn--active" : ""
          }${micBusy ? " vocab-dash-iconBtn--busy" : ""}`}
          onClick={handleSpeakClick}
          disabled={micBusy}
          title="Nói để luyện phát âm"
        >
          <span aria-hidden>🎤</span>
          <span className="vocab-dash-iconBtn__label">{speak.speakLabel}</span>
        </button>
        <button
          type="button"
          className={`vocab-dash-iconBtn${bookmarked ? " vocab-dash-iconBtn--saved" : ""}`}
          onClick={handleBookmark}
          title={bookmarked ? "Đã lưu" : "Lưu từ"}
          aria-pressed={bookmarked}
        >
          <span aria-hidden>{bookmarked ? "★" : "☆"}</span>
          <span className="vocab-dash-iconBtn__label">Lưu</span>
        </button>
      </div>
    </article>
  );
}
