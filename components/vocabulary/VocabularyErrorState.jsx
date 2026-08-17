export default function VocabularyErrorState({ message, onRetry }) {
  return (
    <div className="vocab-dash-error" role="alert">
      <span className="vocab-dash-error__icon" aria-hidden>⚠️</span>
      <div>
        <strong className="vocab-dash-error__title">Không tải được dữ liệu</strong>
        <p className="vocab-dash-error__msg">{message || "Vui lòng thử lại sau."}</p>
      </div>
      <button type="button" className="vocab-dash-error__btn" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}
