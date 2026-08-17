"use client";

import { useMemo } from "react";
import { buildSentenceWordIpaPairs } from "@/lib/vocabulary/sentence-word-ipa";

/** Câu ví dụ gọn cho thẻ từ vựng dashboard. */
export default function VocabularyCardExample({
  sentence,
  sentenceIpa,
  sentenceVi,
  headword,
  headwordIpa,
}) {
  const pairs = useMemo(
    () => buildSentenceWordIpaPairs(sentence, sentenceIpa, headword, headwordIpa),
    [sentence, sentenceIpa, headword, headwordIpa]
  );

  if (!sentence) return null;

  const ipaLine = pairs
    .filter((p) => p.isWord && p.ipa)
    .map((p) => p.ipa)
    .join(" ");

  return (
    <div className="vocab-dash-card__exampleBox">
      <p className="vocab-dash-card__exEn">{sentence}</p>
      {ipaLine ? <p className="vocab-dash-card__exIpa">{ipaLine}</p> : null}
      {sentenceVi ? <p className="vocab-dash-card__exVi">{sentenceVi}</p> : null}
    </div>
  );
}
