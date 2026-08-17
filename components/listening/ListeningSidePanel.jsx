"use client";

import { useState } from "react";

function ListeningSideTabs({ activeTab, onTabChange }) {
  return (
    <div className="ln-sideTabs" role="tablist" aria-label="Sidebar luyện nghe">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "lessons"}
        className={`ln-sideTabs__btn${activeTab === "lessons" ? " ln-sideTabs__btn--active" : ""}`}
        onClick={() => onTabChange("lessons")}
      >
        Bài nghe
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "progress"}
        className={`ln-sideTabs__btn${activeTab === "progress" ? " ln-sideTabs__btn--active" : ""}`}
        onClick={() => onTabChange("progress")}
      >
        Tiến độ 5 phút
      </button>
    </div>
  );
}

function ListeningClipList({ clips, clipIndex, onSelectClip }) {
  if (!clips.length) {
    return <p className="ln-side__empty">Chưa có bài nghe.</p>;
  }

  return (
    <div className="ln-clipList" role="list" aria-label="Danh sách bài nghe">
      {clips.map((item, index) => {
        const isActive = index === clipIndex;
        return (
          <button
            key={item.id}
            type="button"
            role="listitem"
            className={`ln-clipItem${isActive ? " ln-clipItem--active" : ""}`}
            onClick={() => onSelectClip(index)}
            aria-current={isActive ? "true" : undefined}
          >
            <span className="ln-clipItem__index">{item.number ?? index + 1}</span>
            <span className="ln-clipItem__body">
              <span className="ln-clipItem__title">{item.title}</span>
              <span className="ln-clipItem__meta">
                <span className="ln-clipItem__level">{item.level}</span>
                {item.question?.text ? (
                  <span className="ln-clipItem__question">{item.question.text}</span>
                ) : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ListeningProgressBlock({ progressPct, timerLabel, clipIndex, totalClips, score, answeredCount }) {
  return (
    <div className="ln-progressCard">
      <div className="ln-progressCard__head">
        <span className="ln-progressCard__label">Tiến độ 5 phút</span>
        <span className="ln-progressCard__timer">{timerLabel}</span>
      </div>
      <div className="ln-progressCard__bar" aria-hidden>
        <div className="ln-progressCard__fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="ln-progressCard__meta">
        <span>
          Câu {Math.min(clipIndex + 1, totalClips)}/{totalClips}
        </span>
        <span>
          {score}/{answeredCount > 0 ? answeredCount : "—"} đúng
        </span>
      </div>
    </div>
  );
}

function KeywordList({ keywords }) {
  if (!keywords.length) {
    return <p className="ln-side__empty">Nghe đúng để ghi nhận từ khóa.</p>;
  }
  return (
    <ul className="ln-keywords">
      {keywords.map((kw) => (
        <li key={kw} className="ln-keyword">
          {kw}
        </li>
      ))}
    </ul>
  );
}

function MistakeList({ mistakes }) {
  if (!mistakes.length) {
    return <p className="ln-side__empty">Chưa có lỗi sai.</p>;
  }
  return (
    <ul className="ln-mistakes">
      {mistakes.map((m) => (
        <li key={`${m.id}-${m.question}`} className="ln-mistake">
          <p className="ln-mistake__q">{m.question}</p>
          <p className="ln-mistake__picked">Bạn chọn: {m.picked}</p>
          <p className="ln-mistake__correct">Đáp án: {m.correct}</p>
        </li>
      ))}
    </ul>
  );
}

function TranscriptBlock({ clip, checked, collapsible = false, defaultOpen = false }) {
  if (!checked) {
    return (
      <div className="ln-transcript ln-transcript--locked">
        <p className="ln-transcript__hint">Trả lời câu hỏi để xem transcript và giải thích.</p>
      </div>
    );
  }

  if (collapsible) {
    return (
      <details className="ln-transcriptDetails" open={defaultOpen}>
        <summary className="ln-transcriptDetails__summary">Transcript & giải thích</summary>
        <div className="ln-transcript ln-transcript--open">
          <p className="ln-transcript__en">{clip.transcript}</p>
          {clip.transcriptVi ? <p className="ln-transcript__vi">{clip.transcriptVi}</p> : null}
          {clip.question.explanation ? (
            <p className="ln-transcript__explain">{clip.question.explanation}</p>
          ) : null}
        </div>
      </details>
    );
  }

  return (
    <div className="ln-transcript ln-transcript--open">
      <p className="ln-transcript__en">{clip.transcript}</p>
      {clip.transcriptVi ? <p className="ln-transcript__vi">{clip.transcriptVi}</p> : null}
      {clip.question.explanation ? (
        <p className="ln-transcript__explain">{clip.question.explanation}</p>
      ) : null}
    </div>
  );
}

export default function ListeningSidePanel({
  progressPct,
  timerLabel,
  clipIndex,
  totalClips,
  score,
  answeredCount,
  keywordsHeard,
  mistakes,
  clip,
  checked,
  clips = [],
  onSelectClip,
  variant = "desktop",
}) {
  const [activeTab, setActiveTab] = useState("progress");
  const isMobile = variant === "mobile";

  const handleSelectClip = (index) => {
    onSelectClip?.(index);
    setActiveTab("progress");
  };

  if (isMobile) {
    return clip ? (
      <aside className="ln-side ln-side--mobile" aria-label="Transcript phiên nghe">
        <TranscriptBlock clip={clip} checked={checked} collapsible defaultOpen={false} />
      </aside>
    ) : null;
  }

  return (
    <aside className="ln-side" aria-label="Tiến độ phiên nghe">
      <ListeningSideTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "lessons" ? (
        <section className="ln-side__block ln-side__block--lessons">
          <div className="ln-side__lessonsHead">
            <h3 className="ln-side__title">Tất cả bài nghe</h3>
            <span className="ln-side__lessonsCount">{clips.length} bài</span>
          </div>
          <ListeningClipList clips={clips} clipIndex={clipIndex} onSelectClip={handleSelectClip} />
        </section>
      ) : (
        <>
          <ListeningProgressBlock
            progressPct={progressPct}
            timerLabel={timerLabel}
            clipIndex={clipIndex}
            totalClips={totalClips}
            score={score}
            answeredCount={answeredCount}
          />

          <section className="ln-side__block">
            <h3 className="ln-side__title">Điểm</h3>
            <p className="ln-side__score">
              {score}
              <span className="ln-side__scoreOf">/{answeredCount || "—"}</span>
            </p>
          </section>

          <section className="ln-side__block">
            <h3 className="ln-side__title">Từ khóa nghe được</h3>
            <KeywordList keywords={keywordsHeard} />
          </section>

          <section className="ln-side__block">
            <h3 className="ln-side__title">Lỗi sai</h3>
            <MistakeList mistakes={mistakes} />
          </section>

          <section className="ln-side__block ln-side__block--transcript">
            <h3 className="ln-side__title">Transcript</h3>
            {clip ? <TranscriptBlock clip={clip} checked={checked} /> : null}
          </section>
        </>
      )}
    </aside>
  );
}

export function ListeningSidePanelMobileTabs({
  progressPct,
  timerLabel,
  clipIndex,
  totalClips,
  score,
  answeredCount,
  clips = [],
  onSelectClip,
}) {
  const [activeTab, setActiveTab] = useState("progress");

  const handleSelectClip = (index) => {
    onSelectClip?.(index);
    setActiveTab("progress");
  };

  return (
    <div className="ln-side ln-side--mobileTabs">
      <ListeningSideTabs activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "lessons" ? (
        <section className="ln-side__block ln-side__block--lessons">
          <div className="ln-side__lessonsHead">
            <h3 className="ln-side__title">Tất cả bài nghe</h3>
            <span className="ln-side__lessonsCount">{clips.length} bài</span>
          </div>
          <ListeningClipList clips={clips} clipIndex={clipIndex} onSelectClip={handleSelectClip} />
        </section>
      ) : (
        <ListeningProgressBlock
          progressPct={progressPct}
          timerLabel={timerLabel}
          clipIndex={clipIndex}
          totalClips={totalClips}
          score={score}
          answeredCount={answeredCount}
        />
      )}
    </div>
  );
}

export { ListeningProgressBlock, KeywordList, MistakeList, TranscriptBlock };
