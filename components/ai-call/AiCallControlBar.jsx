"use client";

export default function AiCallControlBar({
  recording = false,
  busy = false,
  onMic,
  onType,
  onHint,
  onTranslate,
  onEnd,
  textInput = "",
  onTextInput,
  onSendText,
  showTextInput = false,
  onToggleText,
}) {
  return (
    <div className="ai-call-controls-wrap ai-call-controls-wrap--dock">
      {showTextInput ? (
        <form
          className="ai-call-textForm"
          onSubmit={(e) => {
            e.preventDefault();
            onSendText?.();
          }}
        >
          <input
            type="text"
            className="ai-call-textForm__input"
            placeholder="Nhập câu tiếng Anh…"
            value={textInput}
            onChange={(e) => onTextInput?.(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="ai-call-textForm__send" disabled={busy || !textInput.trim()}>
            Gửi
          </button>
          <button type="button" className="ai-call-textForm__close" onClick={onToggleText}>
            ×
          </button>
        </form>
      ) : null}

      <div className="ai-call-controls" aria-label="Điều khiển cuộc gọi">
        <button type="button" className="ai-call-controls__side" onClick={onToggleText} disabled={busy}>
          <span aria-hidden>⌨️</span>
          <span>Nhập</span>
        </button>
        <button type="button" className="ai-call-controls__side" onClick={onHint} disabled={busy}>
          <span aria-hidden>💡</span>
          <span>Gợi ý</span>
        </button>

        <div className="ai-call-controls__micWrap">
          <button
            type="button"
            className={`ai-call-controls__mic${recording ? " ai-call-controls__mic--active" : ""}${busy ? " ai-call-controls__mic--busy" : ""}`}
            onClick={onMic}
            disabled={busy && !recording}
            aria-pressed={recording}
            aria-label={recording ? "Đang nghe — bấm để gửi" : "Bấm để nói"}
          >
            <span className="ai-call-controls__micIcon" aria-hidden>
              {busy && !recording ? "⋯" : "🎤"}
            </span>
          </button>
          <p className="ai-call-controls__status" aria-live="polite">
            {busy && !recording ? "Đang xử lý…" : recording ? "Đang nghe…" : "Bấm để nói"}
          </p>
        </div>

        <button type="button" className="ai-call-controls__side" onClick={onTranslate} disabled={busy}>
          <span aria-hidden>🇻🇳</span>
          <span>Dịch</span>
        </button>
        <button type="button" className="ai-call-controls__side ai-call-controls__side--end" onClick={onEnd}>
          <span aria-hidden>📵</span>
          <span>Kết thúc</span>
        </button>
      </div>
    </div>
  );
}

export function AiCallSessionSummary({ stats, open = false, onToggle }) {
  if (!stats) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="ai-call-summary-toggle"
        onClick={onToggle}
        aria-label="Xem thống kê buổi học"
        title="Buổi học hôm nay"
      >
        <span aria-hidden>📊</span>
        <span className="ai-call-summary-toggle__label">Tiến độ</span>
      </button>
    );
  }

  return (
    <aside className="ai-call-summary ai-call-summary--open" aria-label="Buổi học hôm nay">
      <button type="button" className="ai-call-summary__close" onClick={onToggle} aria-label="Đóng thống kê">
        ×
      </button>
      <h4>Buổi học hôm nay</h4>
      <ul>
        <li>
          <span>Câu đã luyện</span>
          <strong>{stats.sentences}</strong>
        </li>
        <li>
          <span>Lỗi đã sửa</span>
          <strong>{stats.errors}</strong>
        </li>
        <li>
          <span>Cần ôn tập</span>
          <strong>{stats.review}</strong>
        </li>
      </ul>
    </aside>
  );
}
