"use client";

import SentenceWithWordIpa from "./SentenceWithWordIpa";
import { formatWordIpa } from "@/lib/vocabulary/sentence-word-ipa";

/** Phiên âm từ + câu ví dụ trong phiên học/luyện nói. */
export default function VocabularySessionPhonetics({
  word,
  ipa,
  sentence,
  sentenceIpa,
  sentenceVi,
  showWordIpa = true,
  showSentence = true,
  sentenceLabel = "Câu ví dụ",
  compact = false,
}) {
  if (!showWordIpa && !showSentence) return null;

  return (
    <div className={`vocab-session-phonetics${compact ? " vocab-session-phonetics--compact" : ""}`}>
      {showWordIpa ? (
        <p className="vocab-session-ipa vocab-session-ipa--prominent">{formatWordIpa(ipa, word)}</p>
      ) : null}
      {showSentence && sentence ? (
        <div className="vocab-session-phonetics__sentence">
          <p className="vocab-session-phonetics__label">{sentenceLabel}</p>
          <SentenceWithWordIpa
            sentence={sentence}
            sentenceIpa={sentenceIpa}
            sentenceVi={sentenceVi}
            headword={word}
            headwordIpa={ipa}
          />
        </div>
      ) : null}
    </div>
  );
}
