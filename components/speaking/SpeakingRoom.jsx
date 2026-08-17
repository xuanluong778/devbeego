"use client";

import ConversationThread from "./ConversationThread";
import AnswerSuggestions from "./AnswerSuggestions";
import SpeakingMicDock from "./SpeakingMicDock";

function AiToolbar({
  chatLoading,
  viLoading,
  onListenAgain,
  onSpeakSlow,
  onTranslate,
  onHint,
  onEasierSpeak,
}) {
  return (
    <>
      <button type="button" className="mock-toolbar-btn" onClick={onListenAgain} disabled={chatLoading}>
        🔊 Nghe lại
      </button>
      <button type="button" className="mock-toolbar-btn" onClick={onSpeakSlow} disabled={chatLoading}>
        🐢 Nói chậm
      </button>
      <button type="button" className="mock-toolbar-btn" onClick={onTranslate} disabled={chatLoading || viLoading}>
        {viLoading ? "…" : "🇻🇳 Dịch nghĩa"}
      </button>
      <button type="button" className="mock-toolbar-btn" onClick={onHint} disabled={chatLoading}>
        💡 Gợi ý trả lời
      </button>
      <button type="button" className="mock-toolbar-btn" onClick={onEasierSpeak} disabled={chatLoading}>
        ✨ Nói dễ hơn
      </button>
    </>
  );
}

export default function SpeakingRoom({
  teacherName = "AI Teacher",
  teacherEmoji = "🦊",
  teacherScore = null,
  messages = [],
  listRef,
  chatLoading,
  recording,
  recordSecs = 0,
  spokenText = "",
  voiceNotice,
  speechSupported,
  viByMessageId = {},
  hasActiveAssistant = false,
  viLoading = false,
  suggestions = [],
  onSuggestionPick,
  onListenAgain,
  onSpeakSlow,
  onTranslate,
  onHint,
  onEasierSpeak,
  onSpeakMessage,
  onReplaySpoken,
  onMic,
  onContinue,
  onEndSession,
  chatInput,
  onChatInput,
  onSendText,
  onChatInputFocus,
  inputDisabled,
}) {
  const toolbar = hasActiveAssistant ? (
    <AiToolbar
      chatLoading={chatLoading}
      viLoading={viLoading}
      onListenAgain={onListenAgain}
      onSpeakSlow={onSpeakSlow}
      onTranslate={onTranslate}
      onHint={onHint}
      onEasierSpeak={onEasierSpeak}
    />
  ) : null;

  const canReplay = Boolean(String(spokenText || "").trim()) && !recording && !chatLoading;

  return (
    <section className="speaking-room speaking-room--mockup speaking-studio__center" aria-label="Conversation Room">
      <div className="speaking-room__chat-zone">
        <ConversationThread
          messages={messages}
          teacherName={teacherName}
          teacherEmoji={teacherEmoji}
          teacherScore={teacherScore}
          listRef={listRef}
          chatLoading={chatLoading}
          showViById={viByMessageId}
          onSpeakMessage={onSpeakMessage}
          showToolbar={hasActiveAssistant}
          toolbarSlot={toolbar}
        />

        <div className="speaking-room-footer">
          <button
            type="button"
            className="speaking-room-footer__end"
            onClick={onEndSession}
            disabled={inputDisabled && !recording}
          >
            Kết thúc hội thoại
          </button>
          <button
            type="button"
            className="speaking-room-footer__continue"
            onClick={onContinue}
            disabled={chatLoading || recording}
          >
            Tiếp tục câu tiếp theo →
          </button>
        </div>

        <div className="speaking-text-input speaking-text-input--mockup">
          <input
            value={chatInput}
            onChange={(e) => onChatInput(e.target.value)}
            placeholder="Hoặc gõ tiếng Anh…"
            onFocus={onChatInputFocus}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSendText();
            }}
            disabled={inputDisabled}
          />
          <button type="button" onClick={onSendText} disabled={inputDisabled}>
            Gửi
          </button>
        </div>
      </div>

      <div className="speaking-voice-dock" aria-label="Điều khiển giọng nói">
        <AnswerSuggestions suggestions={suggestions} onPick={onSuggestionPick} disabled={inputDisabled} />
        <SpeakingMicDock
          recording={recording}
          recordSecs={recordSecs}
          chatLoading={chatLoading}
          speechSupported={speechSupported}
          voiceNotice={voiceNotice}
          canReplay={canReplay}
          onReplay={onReplaySpoken}
          onMic={onMic}
          inputDisabled={inputDisabled}
        />
      </div>
    </section>
  );
}
