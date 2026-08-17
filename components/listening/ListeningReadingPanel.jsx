"use client";

function splitIntoParagraphs(text) {
  if (!text?.trim()) return [];
  const sentences = text
    .trim()
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return [text.trim()];
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(" "));
  }
  return paragraphs;
}

export default function ListeningReadingPanel({ clip }) {
  const englishSource = clip?.ttsText || clip?.transcript || "";
  const englishParagraphs = splitIntoParagraphs(englishSource);
  const vietnameseParagraphs = splitIntoParagraphs(clip?.transcriptVi || "");
  const explanation = clip?.question?.explanation?.trim();

  if (!englishParagraphs.length && !vietnameseParagraphs.length) {
    return (
      <section className="ln-readingPanel" aria-label="Bài đọc">
        <p className="ln-readingPanel__empty">Chưa có nội dung bài đọc cho bài này.</p>
      </section>
    );
  }

  return (
    <section className="ln-readingPanel" aria-label="Bài đọc">
      <header className="ln-readingPanel__head">
        <h3 className="ln-readingPanel__title">Bài đọc</h3>
        {clip?.title ? <p className="ln-readingPanel__subtitle">{clip.title}</p> : null}
      </header>

      {englishParagraphs.length ? (
        <div className="ln-readingPanel__section">
          <p className="ln-readingPanel__label">English</p>
          <div className="ln-readingPanel__text ln-readingPanel__text--en">
            {englishParagraphs.map((para, i) => (
              <p key={`en-${i}`} className="ln-readingPanel__para">
                {para}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {vietnameseParagraphs.length ? (
        <div className="ln-readingPanel__section ln-readingPanel__section--vi">
          <p className="ln-readingPanel__label">Tiếng Việt</p>
          <div className="ln-readingPanel__text ln-readingPanel__text--vi">
            {vietnameseParagraphs.map((para, i) => (
              <p key={`vi-${i}`} className="ln-readingPanel__para">
                {para}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {explanation ? (
        <aside className="ln-readingPanel__explain">
          <p className="ln-readingPanel__label">Giải thích</p>
          <p className="ln-readingPanel__explainText">{explanation}</p>
        </aside>
      ) : null}
    </section>
  );
}
