"use client";

function scoreLabel(score) {
  if (score >= 85) return "Tốt! 🤩";
  if (score >= 70) return "Khá tốt 👍";
  if (score >= 55) return "Tạm ổn 🙂";
  return "Cần luyện thêm 💪";
}

export default function PronunciationResultPanel({ result, onPlay, onRetry, canGoNext, onNext, navDisabled }) {
  if (!result) {
    return (
      <aside className="pron-result pron-result--empty" aria-label="Kết quả của bạn">
        <h3 className="pron-result__title">Kết quả của bạn</h3>
        <p className="pron-result__placeholder">Bấm ghi âm và nói để xem điểm tại đây.</p>
      </aside>
    );
  }

  const pct = Math.min(100, Math.max(0, result.score));
  const gaugeStyle = {
    background: `conic-gradient(#2563eb ${pct * 3.6}deg, #e2e8f0 0deg)`,
  };

  return (
    <aside className="pron-result" aria-label="Kết quả của bạn" role="status" aria-live="polite">
      <h3 className="pron-result__title">Kết quả của bạn</h3>

      <div className="pron-result__gaugeWrap">
        <div className="pron-result__gauge" style={gaugeStyle}>
          <div className="pron-result__gaugeInner">
            <strong>{result.score}</strong>
            <small>/100</small>
          </div>
        </div>
      </div>

      <p className={`pron-result__status pron-result__status--${result.passed ? "ok" : "warn"}`}>
        {scoreLabel(result.score)}
      </p>
      <p className="pron-result__mode">Đã chấm theo: {result.gradeType || "Theo từ"}</p>

      <div className="pron-result__transcriptBox">
        <span className="pron-result__transcriptLabel">Bạn nói</span>
        <p>{result.transcript ? `"${result.transcript}"` : "—"}</p>
      </div>

      <button type="button" className="pron-result__player" onClick={onPlay}>
        <span aria-hidden>▶</span> Nghe lại bản ghi
      </button>

      <p className="pron-result__feedback">
        <strong>Nhận xét:</strong> {result.message}
        {result.details ? ` ${result.details}` : ""}
      </p>

      <div className="pron-result__actions">
        <button type="button" className="pron-result__retry" onClick={onRetry}>
          ↻ Luyện lại
        </button>
        <button
          type="button"
          className="pron-result__next"
          onClick={onNext}
          disabled={!canGoNext || navDisabled}
        >
          Câu tiếp →
        </button>
      </div>
    </aside>
  );
}
