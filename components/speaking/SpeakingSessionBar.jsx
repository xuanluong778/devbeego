"use client";

import SpeakingModeBar from "./SpeakingModeBar";

export default function SpeakingSessionBar({
  sessionMode,
  onSessionModeChange,
  quickSecsLeft = null,
  scenarioSlot = null,
  quickDoneMessage = "",
  inputDisabled = false,
}) {
  return (
    <div className="speaking-session-bar" aria-label="Thiết lập buổi học">
      <SpeakingModeBar
        sessionMode={sessionMode}
        onModeChange={onSessionModeChange}
        quickSecsLeft={quickSecsLeft}
        disabled={inputDisabled}
      />

      {sessionMode === "scenario" && scenarioSlot ? (
        <div className="speaking-session-bar__scenarios">{scenarioSlot}</div>
      ) : null}

      {quickDoneMessage ? (
        <p className="speaking-quick-done speaking-session-bar__done" role="status">
          {quickDoneMessage}
        </p>
      ) : null}
    </div>
  );
}
