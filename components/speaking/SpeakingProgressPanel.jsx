"use client";

import SpeakingFeedbackCard from "./SpeakingFeedbackCard";
import SpeakingRoadmapCard from "./SpeakingRoadmapCard";
import SpeakingCompactSettings from "./SpeakingCompactSettings";
import SpeakingRecentHistory from "./SpeakingRecentHistory";

export default function SpeakingProgressPanel({
  feedback,
  turnCount = 0,
  scenarioLabel = "",
  ipaText = "",
  selectedTeacher,
  onSelectTeacher,
  practiceMode,
  onPracticeMode,
  languageSupportMode,
  onLanguageMode,
  settingsDisabled = false,
  onSpeakBetter,
  onRetrySpeak,
  onContinue,
  showFeedbackActions = false,
  actionsDisabled = false,
  rescueSlot = null,
  recentMessages = [],
  className = "",
}) {
  const totalScore = feedback?.total ?? null;

  const progressBody = (
    <div className="speaking-progress-body">
      <div className="speaking-progress-stats speaking-progress-stats--mockup">
        <div className="speaking-stat">
          <span className="speaking-stat__value">{turnCount}</span>
          <span className="speaking-stat__label">Lượt nói</span>
        </div>
        <div className="speaking-stat">
          <span className="speaking-stat__value">{totalScore ?? "—"}</span>
          <span className="speaking-stat__label">Điểm</span>
        </div>
      </div>

      {scenarioLabel ? (
        <p className="speaking-progress-scenario">
          Tình huống: <strong>{scenarioLabel}</strong>
        </p>
      ) : null}

      <SpeakingFeedbackCard
        feedback={feedback}
        ipaText={ipaText}
        onSpeakBetter={onSpeakBetter}
        showActions={showFeedbackActions}
        onRetrySpeak={onRetrySpeak}
        onContinue={onContinue}
        actionsDisabled={actionsDisabled}
      />

      {rescueSlot ? <div className="speaking-progress-rescue">{rescueSlot}</div> : null}

      <SpeakingRecentHistory messages={recentMessages} />

      <SpeakingRoadmapCard />

      <SpeakingCompactSettings
        selectedTeacher={selectedTeacher}
        onSelectTeacher={onSelectTeacher}
        practiceMode={practiceMode}
        onPracticeMode={onPracticeMode}
        languageSupportMode={languageSupportMode}
        onLanguageMode={onLanguageMode}
        disabled={settingsDisabled}
      />
    </div>
  );

  return (
    <aside
      className={`speaking-panel speaking-panel--progress speaking-panel--mockup speaking-aside speaking-aside--right ${className}`.trim()}
    >
      <h2 className="speaking-panel__title speaking-panel__title--desktop">Kết quả & tiến độ</h2>

      <details className="speaking-score-sheet">
        <summary className="speaking-score-sheet__trigger">
          <span className="speaking-score-sheet__label">Chi tiết điểm & phản hồi</span>
          <span className="speaking-score-sheet__meta">
            <span className="speaking-score-sheet__turns">{turnCount} lượt</span>
            <span className="speaking-score-sheet__score">{totalScore ?? "—"}</span>
          </span>
        </summary>
        {progressBody}
      </details>
    </aside>
  );
}
