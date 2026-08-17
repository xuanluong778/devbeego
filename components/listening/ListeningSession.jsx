"use client";

import { useEffect, useState } from "react";
import ListeningAudioPlayer from "./ListeningAudioPlayer";
import ListeningAnswerChips from "./ListeningAnswerChips";
import ListeningReadingPanel from "./ListeningReadingPanel";
import ListeningSidePanel, { ListeningSidePanelMobileTabs } from "./ListeningSidePanel";

export default function ListeningSessionMain({ session }) {
  const { clip, clipsLoading } = session;

  if (clipsLoading) {
    return (
      <div className="ln-done">
        <p className="ln-done__meta">Đang tải bài luyện nghe…</p>
      </div>
    );
  }

  if (session.sessionDone) {
    const pct = session.answeredCount
      ? Math.round((session.score / session.answeredCount) * 100)
      : 0;
    return (
      <div className="ln-done">
        <h2 className="ln-done__title">Hết thời gian!</h2>
        <p className="ln-done__score">
          {session.score}/{session.answeredCount} câu đúng ({pct}%)
        </p>
        <p className="ln-done__meta">
          Từ khóa nghe được: {session.keywordsHeard.length} · Lỗi: {session.mistakes.length}
        </p>
        <button type="button" className="ln-btn ln-btn--primary" onClick={session.restartSession}>
          Luyện lại
        </button>
      </div>
    );
  }

  if (!clip) return null;

  return (
    <ListeningSessionCard session={session} clip={clip} />
  );
}

function ListeningSessionCard({ session, clip }) {
  const [showReading, setShowReading] = useState(false);

  useEffect(() => {
    setShowReading(false);
  }, [clip.id]);

  return (
    <>
      <div className="ln-mobileOnly">
        <ListeningSidePanelMobileTabs
          progressPct={session.progressPct}
          timerLabel={session.timerLabel}
          clipIndex={session.clipIndex}
          totalClips={session.totalClips}
          score={session.score}
          answeredCount={session.answeredCount}
          clips={session.clips}
          onSelectClip={session.goToClip}
        />
      </div>

      <article className="ln-questionCard">
        <div className="ln-questionCard__head">
          <span className="ln-questionCard__badge">{clip.number ? `#${clip.number}` : clip.level}</span>
          <span className="ln-questionCard__level">{clip.level}</span>
          <h2 className="ln-questionCard__title">{clip.title}</h2>
        </div>

        <ListeningAudioPlayer key={clip.id} audioUrl={clip.audioUrl} ttsText={clip.ttsText} />

        <div className="ln-questionCard__body">
          <p className="ln-questionCard__prompt">{clip.question.text}</p>
          <ListeningAnswerChips
            options={clip.question.options}
            selectedIndex={session.selectedIndex}
            checked={session.checked}
            correctIndex={clip.question.correctIndex}
            onSelect={session.selectOption}
          />

          {session.checked ? (
            <p
              className={`ln-feedback${session.isCorrect ? " ln-feedback--ok" : " ln-feedback--bad"}`}
              role="status"
            >
              {session.isCorrect ? "Chính xác!" : "Chưa đúng — xem transcript để ôn lại."}
            </p>
          ) : null}

          <div className="ln-actions">
            {!session.checked ? (
              <button
                type="button"
                className="ln-btn ln-btn--primary"
                disabled={!session.canCheck}
                onClick={session.checkAnswer}
              >
                Kiểm tra
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={`ln-btn ln-btn--reading${showReading ? " ln-btn--reading--active" : ""}`}
                  onClick={() => setShowReading((open) => !open)}
                  aria-expanded={showReading}
                >
                  {showReading ? "Ẩn bài đọc" : "Bài đọc"}
                </button>
                <button
                  type="button"
                  className="ln-btn ln-btn--primary"
                  disabled={!session.canContinue}
                  onClick={session.continueNext}
                >
                  Tiếp tục
                </button>
              </>
            )}
          </div>

          {session.checked && showReading ? <ListeningReadingPanel clip={clip} /> : null}
        </div>
      </article>

      <div className="ln-mobileOnly ln-mobileTranscript">
        <ListeningSidePanel
          variant="mobile"
          progressPct={session.progressPct}
          timerLabel={session.timerLabel}
          clipIndex={session.clipIndex}
          totalClips={session.totalClips}
          score={session.score}
          answeredCount={session.answeredCount}
          keywordsHeard={session.keywordsHeard}
          mistakes={session.mistakes}
          clip={clip}
          checked={session.checked}
        />
      </div>
    </>
  );
}

export function ListeningSessionAside({ session }) {
  if (session.sessionDone || !session.clip) return null;

  return (
    <ListeningSidePanel
      variant="desktop"
      progressPct={session.progressPct}
      timerLabel={session.timerLabel}
      clipIndex={session.clipIndex}
      totalClips={session.totalClips}
      score={session.score}
      answeredCount={session.answeredCount}
      keywordsHeard={session.keywordsHeard}
      mistakes={session.mistakes}
      clip={session.clip}
      checked={session.checked}
      clips={session.clips}
      onSelectClip={session.goToClip}
    />
  );
}
