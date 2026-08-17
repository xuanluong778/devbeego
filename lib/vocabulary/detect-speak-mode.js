import { scoreText, tokenizeWords } from "@/lib/client-pronunciation-eval";

/** Tự nhận user đang nói từ hay câu dựa trên transcript. */
export function detectSpeakMode(transcript, word, exampleSentence) {
  const w = String(word || "").trim();
  const s = String(exampleSentence || "").trim();
  const spoken = tokenizeWords(transcript);

  if (!w) {
    return { mode: "word", target: w, isSentence: false, label: "Theo từ" };
  }

  if (!s) {
    return { mode: "word", target: w, isSentence: false, label: "Theo từ" };
  }

  const wordScore = scoreText(transcript, w);
  const sentenceScore = scoreText(transcript, s);

  if (spoken.length <= 2 || wordScore >= sentenceScore + 8) {
    return { mode: "word", target: w, isSentence: false, label: "Theo từ" };
  }

  if (spoken.length > 2 || sentenceScore > wordScore) {
    return { mode: "sentence", target: s, isSentence: true, label: "Theo câu" };
  }

  return { mode: "word", target: w, isSentence: false, label: "Theo từ" };
}
