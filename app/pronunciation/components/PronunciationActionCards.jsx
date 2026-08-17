"use client";

export default function PronunciationActionCards({ today, weakSounds, retryCount, onAction }) {
  return (
    <div className="pron-actions" role="group" aria-label="Hành động luyện tập">
      <article className="pron-actionCard pron-actionCard--blue">
        <div className="pron-actionCard__head">
          <span className="pron-actionCard__icon" aria-hidden>✨</span>
          <strong>Bài luyện hôm nay</strong>
        </div>
        <p className="pron-actionCard__sub">
          Bài IPA <span>{today?.ipaFocus || "/·/"}</span>
        </p>
        <div className="pron-actionCard__progress">
          <div className="pron-actionCard__bar">
            <span style={{ width: `${today?.pct || 0}%` }} />
          </div>
          <span className="pron-actionCard__pct">
            {today?.done || 0}/{today?.total || 0} bài
          </span>
        </div>
        <button type="button" className="pron-actionCard__btn" onClick={() => onAction("today")}>
          Luyện ngay →
        </button>
      </article>

      <article className="pron-actionCard pron-actionCard--amber">
        <div className="pron-actionCard__head">
          <span className="pron-actionCard__icon" aria-hidden>🎯</span>
          <strong>Âm dễ sai của tôi</strong>
        </div>
        <div className="pron-actionCard__tags">
          {(weakSounds.length ? weakSounds : ["/θ/", "/ð/", "/r/"]).map((s) => (
            <span key={s} className="pron-actionCard__tag">
              {s}
            </span>
          ))}
        </div>
        <button type="button" className="pron-actionCard__btn pron-actionCard__btn--ghost" onClick={() => onAction("weak_sound")}>
          Luyện lại
        </button>
      </article>

      <article className="pron-actionCard pron-actionCard--green">
        <div className="pron-actionCard__head">
          <span className="pron-actionCard__icon" aria-hidden>🔁</span>
          <strong>Luyện lại bài chưa đạt</strong>
        </div>
        <p className="pron-actionCard__sub">Còn {retryCount} bài chưa đạt yêu cầu</p>
        <button type="button" className="pron-actionCard__btn pron-actionCard__btn--ghost" onClick={() => onAction("retry")}>
          Xem ngay ↻
        </button>
      </article>
    </div>
  );
}
