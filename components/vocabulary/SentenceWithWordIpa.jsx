"use client";

import { useMemo } from "react";
import { buildSentenceWordIpaPairs } from "@/lib/vocabulary/sentence-word-ipa";

export default function SentenceWithWordIpa({ sentence, sentenceIpa, sentenceVi, headword, headwordIpa }) {
  const pairs = useMemo(
    () => buildSentenceWordIpaPairs(sentence, sentenceIpa, headword, headwordIpa),
    [sentence, sentenceIpa, headword, headwordIpa]
  );

  if (!sentence) return null;

  return (
    <div className="beego-vocab-cardExampleBox">
      <div className="beego-vocab-sentenceIpa" aria-label="Câu ví dụ kèm phiên âm từng từ">
        {pairs.map((p, i) =>
          p.isWord ? (
            <span key={`${p.word}-${i}`} className="beego-vocab-sentenceWord">
              <span className="beego-vocab-sentenceWordText">{p.word}</span>
              <span className="beego-vocab-sentenceWordIpa">{p.ipa}</span>
            </span>
          ) : (
            <span key={`p-${i}`} className="beego-vocab-sentencePunct">
              {p.word}
            </span>
          )
        )}
      </div>
      {sentenceVi ? <p className="beego-vocab-cardExampleVi">{sentenceVi}</p> : null}
    </div>
  );
}
