"use client";

import { useEffect } from "react";

function shortTeacherName(name) {
  const raw = String(name || "AI Teacher").trim();
  const stripped = raw.replace(/^AI Teacher\s*[—–-]\s*/i, "").trim();
  return stripped || raw || "AI Teacher";
}

export default function ConversationThread({
  messages = [],
  teacherName = "AI Teacher",
  teacherEmoji = "🦊",
  teacherScore = null,
  listRef,
  chatLoading = false,
  showViById = {},
  onSpeakMessage,
  showToolbar = false,
  toolbarSlot = null,
}) {
  const scrollToEnd = () => {
    const el = listRef?.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  };

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, chatLoading, listRef]);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return undefined;

    const onViewportChange = () => scrollToEnd();
    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
    return () => {
      vv.removeEventListener("resize", onViewportChange);
      vv.removeEventListener("scroll", onViewportChange);
    };
  }, [listRef, messages.length]);

  const visible = messages.filter((m) => String(m.text || "").trim());
  const lastAssistantId = [...visible].reverse().find((m) => m.role === "assistant")?.id;
  const lastUserId = [...visible].reverse().find((m) => m.role === "user")?.id;
  const displayTeacherName = shortTeacherName(teacherName);

  return (
    <div className="conv-room" ref={listRef} aria-label="Cuộc hội thoại">
      {visible.length === 0 ? (
        <p className="conv-room__empty">Chọn tình huống và bấm micro để bắt đầu.</p>
      ) : null}

      {visible.map((m) => {
        const isAssistant = m.role === "assistant";
        const isLastAssistant = m.id === lastAssistantId;
        const isLastUser = m.id === lastUserId;
        const viText = showViById[m.id];
        const showAnalyzing = isLastUser && chatLoading;

        if (isAssistant) {
          return (
            <div key={m.id} className="conv-block conv-block--ai">
              <div className="mock-ai-bubble">
                <div className="mock-ai-bubble__head">
                  <div className="mock-ai-bubble__avatar-wrap">
                    <span className="mock-ai-bubble__avatar" aria-hidden>
                      {teacherEmoji}
                    </span>
                    <span className="mock-ai-bubble__online" aria-label="Online" />
                  </div>
                  <div className="mock-ai-bubble__meta">
                    <strong title={teacherName}>{displayTeacherName}</strong>
                    <span>Online</span>
                  </div>
                  {isLastAssistant && teacherScore != null ? (
                    <span className="mock-ai-bubble__score" aria-label={`Điểm ${teacherScore}`}>
                      {teacherScore}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="mock-bubble__speaker"
                    aria-label="Nghe câu AI"
                    onClick={() => onSpeakMessage?.(m.text, 0.95)}
                  >
                    🔊
                  </button>
                </div>
                <p className="mock-ai-bubble__text">{m.text}</p>
                {viText ? <p className="mock-ai-bubble__vi">{viText}</p> : null}
              </div>
              {isLastAssistant && showToolbar && toolbarSlot ? (
                <div className="mock-ai-toolbar">{toolbarSlot}</div>
              ) : null}
            </div>
          );
        }

        return (
          <div key={m.id} className="conv-block conv-block--user">
            <div className="mock-user-bubble">
              <p className="mock-user-bubble__text">{m.text}</p>
              <button
                type="button"
                className="mock-bubble__speaker"
                aria-label="Nghe lại câu của bạn"
                onClick={() => onSpeakMessage?.(m.text, 0.9)}
              >
                🔊
              </button>
            </div>
            {showAnalyzing ? (
              <p className="mock-user-analyzing" role="status">
                <span className="speaking-thinking__dots" aria-hidden>
                  <span />
                  <span />
                  <span />
                </span>
                Đang phân tích câu trả lời của bạn…
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
