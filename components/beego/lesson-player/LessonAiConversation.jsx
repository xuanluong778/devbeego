"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isSpeechRecognitionSupported,
  startLessonSpeechCapture,
} from "@/lib/beego/learn/adapters/lesson-speech";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import {
  assistToggleBody,
  assistToggleLabel,
  createPanelActivityGate,
} from "@/lib/beego/learn/lesson-ai-panel-guards";
import styles from "./LessonAiConversation.module.css";

function newRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `learn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapTurns(turns) {
  const out = [];
  for (const t of turns || []) {
    if (t.status === "pending") continue;
    if (t.user_message && t.source !== "wrap_up") {
      out.push({
        id: `u-${t.client_request_id}`,
        role: "user",
        text: t.user_message,
      });
    }
    if (t.reply) {
      out.push({
        id: `a-${t.client_request_id}`,
        role: "assistant",
        text: t.reply,
        vi: t.mistakes_explanation || "",
        translation: t.translation || "",
        tip: t.pronunciation_tip || "",
        corrected: t.corrected_sentence || "",
        source: t.source || "",
      });
    }
  }
  return out;
}

export default function LessonAiConversation({ lessonId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [lessonMeta, setLessonMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const [micBroken, setMicBroken] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const micRef = useRef(null);
  const logRef = useRef(null);
  const aliveRef = useRef(true);
  const gateRef = useRef(null);
  const sendAbortRef = useRef(null);
  const busyRef = useRef(false);
  if (!gateRef.current) gateRef.current = createPanelActivityGate();

  const stopAll = useCallback(() => {
    gateRef.current.close();
    try {
      micRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    try {
      micRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    micRef.current = null;
    try {
      sendAbortRef.current?.abort();
    } catch {
      /* ignore */
    }
    stopLessonTts();
    setRecording(false);
    setPlaying(false);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    gateRef.current = createPanelActivityGate();
    return () => {
      aliveRef.current = false;
      gateRef.current.close();
      try {
        micRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      micRef.current = null;
      try {
        sendAbortRef.current?.abort();
      } catch {
        /* ignore */
      }
      stopLessonTts();
    };
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const openSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/learn/chat/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson_id: lessonId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!aliveRef.current) return;
      if (!res.ok || !json.success) {
        setError(json.message || "Không mở được hội thoại.");
        setLoading(false);
        return;
      }
      const sid = json.data?.session_id;
      setSessionId(sid);
      setLessonMeta(json.data?.lesson || null);
      const hist = await fetch(
        `/api/learn/chat/session?session_id=${encodeURIComponent(sid)}`,
        { credentials: "same-origin", cache: "no-store" }
      );
      const histJson = await hist.json().catch(() => ({}));
      if (!aliveRef.current) return;
      if (hist.ok && histJson.success) {
        setMessages(mapTurns(histJson.data?.turns));
        if (histJson.data?.session?.lesson) setLessonMeta(histJson.data.session.lesson);
        if (histJson.data?.session?.status === "closed") setEnded(true);
      }
      if (json.data?.status === "closed") setEnded(true);
    } catch {
      if (aliveRef.current) setError("Không kết nối được. Thử lại.");
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void openSession();
  }, [openSession]);

  const speakReply = useCallback(async (text) => {
    const line = String(text || "").trim();
    const token = gateRef.current.beginSpeak();
    if (!token || !line) return;
    stopLessonTts();
    if (!gateRef.current.canFinishSpeak(token)) {
      stopLessonTts();
      return;
    }
    setPlaying(true);
    try {
      await playLessonTts({ text: line, lang: "en" });
    } finally {
      if (!gateRef.current.canFinishSpeak(token)) {
        stopLessonTts();
        return;
      }
      if (aliveRef.current) setPlaying(false);
    }
  }, []);

  const sendTurn = useCallback(
    async (text, { source = "text", intent = "practice" } = {}) => {
      const msg = String(text || "").trim();
      if (!sessionId || sending || busyRef.current || gateRef.current.isClosed()) return;
      if (intent !== "wrap_up" && !msg) return;
      busyRef.current = true;
      setSending(true);
      setError("");
      const requestId = newRequestId();
      if (intent !== "wrap_up") {
        setMessages((prev) => [...prev, { id: `local-${requestId}`, role: "user", text: msg }]);
        setDraft("");
      }
      const ac = new AbortController();
      sendAbortRef.current = ac;
      try {
        const res = await fetch("/api/learn/chat/turn", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            session_id: sessionId,
            message: msg,
            client_request_id: requestId,
            source,
            intent,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!aliveRef.current || gateRef.current.isClosed()) return;
        if (res.status === 409 && json.code === "SESSION_CLOSED") {
          setEnded(true);
          const hist = await fetch(
            `/api/learn/chat/session?session_id=${encodeURIComponent(sessionId)}`,
            { credentials: "same-origin", cache: "no-store" }
          );
          const histJson = await hist.json().catch(() => ({}));
          if (aliveRef.current && !gateRef.current.isClosed() && hist.ok && histJson.success) {
            setMessages(mapTurns(histJson.data?.turns));
          }
          return;
        }
        if (!res.ok || !json.success) {
          setError(json.message || "Không gửi được. Thử lại.");
          return;
        }
        const data = json.data || {};
        if (intent === "wrap_up" && data.duplicate) {
          setEnded(true);
          const hist = await fetch(
            `/api/learn/chat/session?session_id=${encodeURIComponent(sessionId)}`,
            { credentials: "same-origin", cache: "no-store" }
          );
          const histJson = await hist.json().catch(() => ({}));
          if (aliveRef.current && !gateRef.current.isClosed() && hist.ok && histJson.success) {
            setMessages(mapTurns(histJson.data?.turns));
          }
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${data.client_request_id || requestId}`,
            role: "assistant",
            text: data.reply || "",
            vi: data.mistakes_explanation || "",
            translation: data.translation || "",
            tip: data.pronunciation_tip || "",
            corrected: data.corrected_sentence || "",
            source: intent === "wrap_up" ? "wrap_up" : source,
          },
        ]);
        if (intent === "wrap_up") setEnded(true);
        if (!gateRef.current.isClosed()) void speakReply(data.reply);
      } catch (err) {
        if (err?.name === "AbortError") return;
        if (aliveRef.current) setError("Lỗi mạng. Bạn có thể nhập lại và gửi.");
      } finally {
        busyRef.current = false;
        if (aliveRef.current) setSending(false);
      }
    },
    [sessionId, sending, speakReply]
  );

  const startMic = () => {
    if (sending || ended || recording) return;
    setError("");
    setMicBroken(false);
    if (!isSpeechRecognitionSupported()) {
      setMicBroken(true);
      setError("Micro không hỗ trợ. Hãy nhập chữ bên dưới.");
      return;
    }
    setRecording(true);
    const ctrl = startLessonSpeechCapture({
      onResult: (transcript) => {
        if (!aliveRef.current || !gateRef.current.canApplyTranscript()) return;
        setRecording(false);
        setDraft(String(transcript || "").trim());
      },
      onError: () => {
        if (!aliveRef.current) return;
        setRecording(false);
        setMicBroken(true);
        setError("Không nghe được. Sửa chữ hoặc nhập tay rồi gửi.");
      },
    });
    micRef.current = ctrl;
  };

  const suggestions = (lessonMeta?.vocabularyWords || []).slice(0, 3);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Thực hành với AI">
      <div className={styles.panel}>
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>Thực hành với AI</h2>
            <p className={styles.sub}>
              Tùy chọn — không ảnh hưởng điểm, XP hay Honey của bài vừa xong.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={() => { stopAll(); onClose(); }} aria-label="Đóng">
            ×
          </button>
        </header>

        <p className={styles.brief}>
          <strong>
            {lessonMeta?.topicTitle || lessonMeta?.title || "Bài học"} · {lessonMeta?.level || ""}
          </strong>
          Mục tiêu: {lessonMeta?.objective || "Luyện nói theo nội dung bài."}
        </p>

        <div className={styles.log} ref={logRef}>
          {loading ? <p className={styles.status}>Đang mở hội thoại…</p> : null}
          {!loading && messages.length === 0 ? (
            <p className={styles.status}>Chọn gợi ý, nói, hoặc nhập một câu tiếng Anh.</p>
          ) : null}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.bubble} ${m.role === "user" ? styles.user : styles.assistant}`}
            >
              <div>{m.text}</div>
              {m.role === "assistant" && showVi && assistToggleBody(m) ? (
                <div className={styles.meta}>{assistToggleBody(m).text}</div>
              ) : null}
              {m.role === "assistant" && m.corrected ? (
                <div className={styles.meta}>Gợi ý: {m.corrected}</div>
              ) : null}
              {m.role === "assistant" && m.tip ? <div className={styles.meta}>{m.tip}</div> : null}
            </div>
          ))}
          {sending ? <p className={styles.status}>Beego đang trả lời…</p> : null}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        {suggestions.length && !ended ? (
          <div className={styles.row}>
            {suggestions.map((w) => (
              <button
                key={w}
                type="button"
                className={styles.chip}
                disabled={sending || loading}
                onClick={() => setDraft((d) => (d ? d : `I can say ${w}.`))}
              >
                {w}
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.row}>
          <button
            type="button"
            className={styles.ghost}
            disabled={!assistToggleLabel(lastAssistant, showVi)}
            onClick={() => setShowVi((v) => !v)}
          >
            {assistToggleLabel(lastAssistant, showVi) || "Giải thích"}
          </button>
          <button
            type="button"
            className={styles.ghost}
            disabled={!lastAssistant?.text}
            onClick={() => void speakReply(lastAssistant?.text)}
          >
            Nghe lại
          </button>
          <button type="button" className={styles.ghost} disabled={!playing} onClick={() => { stopLessonTts(); setPlaying(false); }}>
            Dừng phát
          </button>
          <button
            type="button"
            className={styles.ghost}
            disabled={sending || loading || ended || !sessionId}
            onClick={() => void sendTurn("", { intent: "wrap_up", source: "text" })}
          >
            Kết thúc
          </button>
        </div>

        <div className={styles.composer}>
          <textarea
            className={styles.draft}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={micBroken ? "Nhập câu tiếng Anh…" : "Xem / sửa câu trước khi gửi"}
            disabled={sending || ended || loading}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} disabled={sending || ended || recording} onClick={startMic}>
              {recording ? "Đang nghe…" : "Micro"}
            </button>
            {recording ? (
              <button
                type="button"
                className={styles.ghost}
                onClick={() => {
                  try {
                    micRef.current?.stop?.();
                  } catch {
                    /* ignore */
                  }
                  setRecording(false);
                }}
              >
                Dừng mic
              </button>
            ) : null}
            <button
              type="button"
              className={styles.primary}
              disabled={sending || ended || loading || !draft.trim()}
              onClick={() => void sendTurn(draft, { source: recording ? "voice" : "text" })}
            >
              Gửi
            </button>
          </div>
          {micBroken ? <p className={styles.status}>Mic lỗi — dùng ô chữ để luyện tiếp.</p> : null}
          {ended ? <p className={styles.status}>Đã góp ý cuối buổi. Bạn có thể đóng và về lộ trình.</p> : null}
        </div>
      </div>
    </div>
  );
}
