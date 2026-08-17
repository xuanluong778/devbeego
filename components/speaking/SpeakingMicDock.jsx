"use client";

const MAX_RECORD_SEC = 30;

function getMicStatusLabel({ recording, chatLoading, canReplay }) {
  if (recording) return "Đang nghe…";
  if (chatLoading) return "Đang xử lý…";
  if (canReplay) return "Nghe lại bản ghi";
  return "Bấm để nói";
}

export default function SpeakingMicDock({
  recording = false,
  recordSecs = 0,
  chatLoading = false,
  speechSupported,
  voiceNotice,
  canReplay = false,
  onReplay,
  onMic,
  inputDisabled,
}) {
  const elapsed = String(recordSecs).padStart(2, "0");
  const max = String(MAX_RECORD_SEC).padStart(2, "0");
  const statusLabel = getMicStatusLabel({ recording, chatLoading, canReplay });
  const showTimer = recording;

  return (
    <div className="speaking-mic-dock">
      {speechSupported === false ? (
        <p className="speaking-voice-notice speaking-voice-notice--warn" role="status">
          Dùng Chrome hoặc Edge để bật micro.
        </p>
      ) : null}
      {speechSupported !== false && voiceNotice ? (
        <p className="speaking-voice-notice" role="status" aria-live="polite">
          {voiceNotice}
        </p>
      ) : null}

      <div className={`speaking-mic-dock__pulse${recording ? " speaking-mic-dock__pulse--on" : ""}`}>
        <span className="speaking-mic-dock__ring speaking-mic-dock__ring--1" aria-hidden />
        <span className="speaking-mic-dock__ring speaking-mic-dock__ring--2" aria-hidden />
        <button
          type="button"
          className={`speaking-mic-btn${recording ? " speaking-mic-btn--recording" : ""}${
            chatLoading ? " speaking-mic-btn--busy" : ""
          }`}
          onClick={canReplay && !recording && !chatLoading ? onReplay || onMic : onMic}
          disabled={speechSupported === false || (inputDisabled && !recording && !canReplay)}
          aria-pressed={recording}
          aria-busy={chatLoading}
          aria-label={statusLabel}
        >
          {recording ? "⏹" : chatLoading ? "⋯" : canReplay ? "🔊" : "🎤"}
        </button>
      </div>

      <p className="speaking-mic-timer" aria-live="polite">
        {showTimer ? `${elapsed} / ${max}` : statusLabel}
      </p>
    </div>
  );
}
