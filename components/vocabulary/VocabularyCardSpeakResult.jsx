"use client";

function scoreTone(score) {
  if (score >= 85) return "great";
  if (score >= 70) return "good";
  if (score >= 55) return "ok";
  return "low";
}

export default function VocabularyCardSpeakResult({ result, onPlay, onRetry }) {
  if (!result) return null;

  const tone = scoreTone(result.score);

  return (
    <div className="vocab-dash-card__speakResult" role="status" aria-live="polite">
      <div className="vocab-dash-card__speakTop">
        <span className={`vocab-dash-card__speakScore vocab-dash-card__speakScore--${tone}`}>
          {result.score}
          <small>/100</small>
        </span>
        <span className="vocab-dash-card__speakType">{result.gradeType}</span>
        <div className="vocab-dash-card__speakActions">
          <button type="button" className="vocab-dash-card__speakPlay" onClick={onPlay} title="Nghe lại bản ghi">
            ▶
          </button>
          <button type="button" className="vocab-dash-card__speakRetry" onClick={onRetry} title="Ghi lại">
            ↺
          </button>
        </div>
      </div>
      {result.transcript ? (
        <p className="vocab-dash-card__speakTranscript">&ldquo;{result.transcript}&rdquo;</p>
      ) : null}
      <p className="vocab-dash-card__speakMsg">{result.message}</p>
    </div>
  );
}
