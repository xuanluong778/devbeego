"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVoiceWebSocket } from "@/hooks/useVoiceWebSocket";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useStreamingTtsPlayer } from "@/hooks/useStreamingTtsPlayer";
import { usePaywall } from "@/components/billing/PaywallProvider";
import { startPatientSpeechRecognition } from "@/lib/browser-patient-speech";
import { SPEAKING_PATH } from "@/lib/beego/routes";
import { sanitizeVoiceUserMessage } from "@/lib/lessons/voice-call-feedback";
import styles from "./VoiceCall.module.css";

function friendlyVoiceStatusLabel(voicePhase, readyState, isOpen, lastError) {
  if (lastError && readyState === "error") return "Mất kết nối";
  if (readyState === "connecting") return "Đang kết nối…";
  switch (voicePhase) {
    case "listening":
      return "Đang lắng nghe bạn";
    case "processing":
      return "Đang suy nghĩ…";
    case "speaking":
      return "Giáo viên đang nói";
    default:
      return isOpen ? "Đang trong cuộc gọi" : "Chưa gọi";
  }
}

function defaultWsUrl() {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_VOICE_WS_URL) {
    return process.env.NEXT_PUBLIC_VOICE_WS_URL;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "beego.vn" || host === "www.beego.vn") {
      return `${window.location.protocol === "https:" ? "wss" : "ws"}://${host}/voice`;
    }
  }
  // Local/dev only — production uses wss://beego.vn/voice (port 3031 behind nginx)
  return "ws://127.0.0.1:3031";
}

/**
 * Low-latency voice tutor: AudioWorklet PCM → WS, partial/final STT, streaming LLM + TTS,
 * state machine idle → listening → processing → speaking, PTT interrupt during playback.
 */
export default function VoiceCall({
  wsUrl: wsUrlProp = null,
  toolbarOnly = false,
  headless = false,
  onApiReady = null,
  userFriendly = false,
}) {
  const sanitizeUi = userFriendly || headless;
  const { openPaywall, hideBillingUi } = usePaywall();
  const wsUrl = wsUrlProp || defaultWsUrl();
  const { readyState, lastError, closeInfo, connect, disconnect, sendJson, sendBinary, setOnJsonMessage, setOnBinaryMessage, isOpen } =
    useVoiceWebSocket(wsUrl);

  const player = useStreamingTtsPlayer({ inputSampleRate: 24000 });

  const [mode, setMode] = useState("ptt");
  const [autoRunning, setAutoRunning] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [awaitingRecognitionStart, setAwaitingRecognitionStart] = useState(false);
  const [liveUserText, setLiveUserText] = useState("");
  const [speculativeAssistant, setSpeculativeAssistant] = useState("");
  const [streamingAssistant, setStreamingAssistant] = useState("");
  const [messages, setMessages] = useState([]);
  const [serverHello, setServerHello] = useState(null);
  const [authError, setAuthError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [llmStreaming, setLlmStreaming] = useState(false);
  const [metrics, setMetrics] = useState({
    requestId: 0,
    listenStartAt: 0,
    sttFirstPartialAt: 0,
    sttFinalAt: 0,
    llmFirstTokenAt: 0,
    ttsFirstChunkAt: 0,
    firstAudioPlayAt: 0,
  });
  const [quota, setQuota] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  // Default to Browser STT for easiest local setup (no Azure keys needed).
  const [sttMode, setSttMode] = useState("browser"); // azure | browser
  const browserRecRef = useRef(null);
  const browserFinalSentRef = useRef(false);

  const capturingRef = useRef(false);
  const awaitingStartRef = useRef(false);
  const ttsPlayingRef = useRef(false);
  const requestSeqRef = useRef(0);
  const currentRequestIdRef = useRef(0);
  const modeRef = useRef(mode);
  const sttModeRef = useRef(sttMode);
  const autoRunningRef = useRef(autoRunning);
  const lastVoiceRef = useRef(0);
  const segmentStartRef = useRef(0);
  const silenceTimerRef = useRef(null);
  const restartTimerRef = useRef(null);
  const listRef = useRef(null);
  const noiseEmaRef = useRef(0);
  const rmsThreshRef = useRef(0.035);
  const gotTtsFirstChunkRef = useRef(false);

  modeRef.current = mode;
  sttModeRef.current = sttMode;
  autoRunningRef.current = autoRunning;
  ttsPlayingRef.current = ttsPlaying;

  const scrollBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const onPcmChunk = useCallback(
    (pcm, { rms }) => {
      // Dynamic threshold: estimate noise floor EMA and set a device-adaptive barge-in threshold.
      const noise = noiseEmaRef.current || rms;
      const nextNoise = noise * 0.995 + rms * 0.005;
      noiseEmaRef.current = nextNoise;
      // Avoid too-low thresholds (echoCancellation differences).
      rmsThreshRef.current = Math.max(0.022, nextNoise * 3.2 + 0.010);

      // Always-on mic pipeline: only uplink audio while listening,
      // but keep RMS for barge-in interrupt while TTS is playing.
      // Browser STT: tránh tự ngắt TTS khi loa rò vào mic (gây rè/chập).
      if (
        ttsPlayingRef.current &&
        sttModeRef.current !== "browser" &&
        rms > rmsThreshRef.current
      ) {
        const rid = currentRequestIdRef.current;
        sendJson({ type: "interrupt", requestId: rid, reason: "barge_in_rms" });
        player.interrupt();
        setTtsPlaying(false);
      }
      if (!capturingRef.current) return;
      sendBinary(pcm);
      if (modeRef.current === "auto" && autoRunningRef.current && rms > 0.018) {
        lastVoiceRef.current = Date.now();
      }
    },
    [player, sendBinary, sendJson]
  );

  const { ensureStream, startPcmCapture, stopPcmCapture, stopMic, micError, setMicError, setMicEnabled } =
    useVoiceRecorder({
      onPcmChunk,
    });

  // Keep AudioWorklet running while connected for fast barge-in VAD.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureStream();
        if (cancelled) return;
        await startPcmCapture();
      } catch (e) {
        if (!cancelled) setMicError(e?.message || "Microphone permission denied.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureStream, isOpen, setMicError, startPcmCapture]);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const endSpeechSegment = useCallback(() => {
    clearTimers();
    if (capturingRef.current) {
      capturingRef.current = false;
      setCapturing(false);
    }
    awaitingStartRef.current = false;
    setAwaitingRecognitionStart(false);
    if (isOpen && sttModeRef.current !== "browser") {
      const rid = currentRequestIdRef.current;
      sendJson({ type: "recognition_end", requestId: rid });
    }
  }, [clearTimers, isOpen, sendJson]);

  const beginSpeechSegment = useCallback(() => {
    if (!isOpen || capturingRef.current || awaitingStartRef.current) return;
    setMicError("");
    awaitingStartRef.current = true;
    setAwaitingRecognitionStart(true);
    setLiveUserText("");
    const rid = (requestSeqRef.current += 1);
    currentRequestIdRef.current = rid;
    browserFinalSentRef.current = false;
    gotTtsFirstChunkRef.current = false;
    setMetrics({
      requestId: rid,
      listenStartAt: performance.now(),
      sttFirstPartialAt: 0,
      sttFinalAt: 0,
      llmFirstTokenAt: 0,
      ttsFirstChunkAt: 0,
      firstAudioPlayAt: 0,
    });
    // Cancel any in-flight audio/token streams immediately on new user speech.
    sendJson({ type: "interrupt", requestId: rid, reason: "recognition_start" });
    player.interrupt();
    setTtsPlaying(false);
    setSpeculativeAssistant("");
    setStreamingAssistant("");
    if (sttMode === "browser") {
      try {
        browserRecRef.current?.abort?.();
      } catch (_e) {}
      const ctrl = startPatientSpeechRecognition({
        lang: "en-US",
        silenceMs: 1200,
        maxMs: 20000,
        onInterim: (t) => {
          const partial = String(t || "");
          setMicError("");
          setLiveUserText(partial);
          sendJson({ type: "client_partial_transcript", requestId: rid, text: partial });
        },
        onDone: (t) => {
          const final = String(t || "").trim();
          setAwaitingRecognitionStart(false);
          awaitingStartRef.current = false;
          capturingRef.current = false;
          setCapturing(false);
          if (final) {
            setLiveUserText(final);
            if (!browserFinalSentRef.current) {
              browserFinalSentRef.current = true;
              sendJson({ type: "client_final_transcript", requestId: rid, text: final });
            }
          } else {
            setLiveUserText("");
          }
          scrollBottom();
        },
        onError: (err) => {
          const raw = String(err || "");
          setMicError(
            sanitizeUi
              ? sanitizeVoiceUserMessage(raw) || "Không nghe được giọng nói. Hãy thử nói rõ hơn."
              : `Browser STT error: ${raw}`
          );
          setAwaitingRecognitionStart(false);
          awaitingStartRef.current = false;
          capturingRef.current = false;
          setCapturing(false);
        },
      });
      browserRecRef.current = ctrl;
      if (ctrl) {
        awaitingStartRef.current = false;
        setAwaitingRecognitionStart(false);
        capturingRef.current = true;
        setCapturing(true);
      } else {
        awaitingStartRef.current = false;
        setAwaitingRecognitionStart(false);
        capturingRef.current = false;
        setCapturing(false);
      }
      return;
    }
    sendJson({ type: "recognition_start", requestId: rid });
  }, [isOpen, player, sendJson, setMicError, sttMode]);

  const connectAuthed = useCallback(async () => {
    setAuthError("");
    player.ensureCtx?.();
    try {
      const res = await fetch("/api/voice/token", { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        const msg = json?.message || "Cannot get voice token. Please sign in.";
        setAuthError(msg);
        if (res.status === 401) {
          // Redirect to login with return path.
          const next = encodeURIComponent(SPEAKING_PATH);
          window.location.href = `/auth?next=${next}`;
        }
        return;
      }
      const token = String(json.data?.token || "");
      const sid = String(json.data?.sessionId || "");
      if (!token || !sid) {
        setAuthError("Invalid token response.");
        return;
      }
      setSessionId(sid);
      const u = new URL(wsUrl);
      u.searchParams.set("token", token);
      u.searchParams.set("sessionId", sid);
      connect(u.toString());
    } catch (e) {
      setAuthError(e?.message || "Voice connect failed.");
    }
  }, [connect, player, wsUrl]);

  const refreshQuota = useCallback(async () => {
    setQuotaLoading(true);
    try {
      const res = await fetch("/api/voice/usage", { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (res.ok && json?.success) {
        setQuota(json.data);
      }
    } catch (_e) {
      /* ignore */
    } finally {
      setQuotaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    refreshQuota();
    const t = window.setInterval(() => {
      refreshQuota();
    }, 5000);
    return () => clearInterval(t);
  }, [isOpen, refreshQuota]);

  const handleServerInterrupt = useCallback(() => {
    setSpeculativeAssistant("");
    setStreamingAssistant("");
    setLlmStreaming(false);
    player.interrupt();
    setTtsPlaying(false);
  }, [player]);

  const onBinary = useCallback(
    (ab) => {
      const u8 = new Uint8Array(ab);
      if (u8.length < 6) return;
      if (u8[0] === 0x02) {
        const rid = u8[1] | (u8[2] << 8) | (u8[3] << 16) | (u8[4] << 24);
        if (rid !== currentRequestIdRef.current) return;
        setTtsPlaying(true);
        if (!gotTtsFirstChunkRef.current) {
          gotTtsFirstChunkRef.current = true;
          setMetrics((m) => ({ ...m, ttsFirstChunkAt: m.ttsFirstChunkAt || performance.now() }));
        }
        player.enqueuePcmS16le(u8.subarray(5), 24000);
        // First time we schedule audio playback locally.
        setMetrics((m) => ({ ...m, firstAudioPlayAt: m.firstAudioPlayAt || performance.now() }));
      }
    },
    [player]
  );

  const onServerJson = useCallback(
    async (msg) => {
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "hello") {
        setServerHello(msg);
        return;
      }
      const rid = typeof msg.requestId === "number" ? msg.requestId : 0;
      if (rid && rid !== currentRequestIdRef.current) {
        // Ignore stale events to avoid races (older request finishing late).
        return;
      }
      if (msg.type === "recognition_started") {
        awaitingStartRef.current = false;
        setAwaitingRecognitionStart(false);
        try {
          await ensureStream();
          // Ensure AudioWorklet is running (always-on).
          await startPcmCapture();
          capturingRef.current = true;
          setCapturing(true);
          segmentStartRef.current = Date.now();
          lastVoiceRef.current = Date.now();
          if (modeRef.current === "auto" && autoRunningRef.current) {
            silenceTimerRef.current = window.setInterval(() => {
              if (!capturingRef.current || !autoRunningRef.current || modeRef.current !== "auto") return;
              const minMs = 700;
              if (Date.now() - segmentStartRef.current < minMs) return;
              if (Date.now() - lastVoiceRef.current > 900) {
                endSpeechSegment();
              }
            }, 200);
          }
        } catch (e) {
          setMicError(e?.message || "Microphone permission denied.");
          capturingRef.current = false;
          setCapturing(false);
          awaitingStartRef.current = false;
          setAwaitingRecognitionStart(false);
          sendJson({ type: "recognition_end", requestId: currentRequestIdRef.current });
        }
        return;
      }
      if (msg.type === "partial_transcript") {
        setLiveUserText(String(msg.text || ""));
        setMetrics((m) => ({ ...m, sttFirstPartialAt: m.sttFirstPartialAt || performance.now() }));
        scrollBottom();
        return;
      }
      if (msg.type === "final_transcript") {
        setMetrics((m) => ({ ...m, sttFinalAt: m.sttFinalAt || performance.now() }));
        const ft = String(msg.text || "").trim();
        setLiveUserText("");
        if (ft) {
          setMessages((prev) => {
            const lastUser = [...prev].reverse().find((m) => m.role === "user");
            if (lastUser && String(lastUser.text || "").trim() === ft) return prev;
            return [...prev, { id: `u-${Date.now()}`, role: "user", text: ft }];
          });
        }
        scrollBottom();
        return;
      }
      if (msg.type === "interrupt") {
        handleServerInterrupt();
        scrollBottom();
        return;
      }
      if (msg.type === "interrupt_ack") {
        return;
      }
      if (msg.type === "ai_stream") {
        const tok = String(msg.token || "");
        const spec = Boolean(msg.speculative);
        setLlmStreaming(true);
        if (!spec) {
          setMetrics((m) => ({ ...m, llmFirstTokenAt: m.llmFirstTokenAt || performance.now() }));
        }
        if (spec) {
          setSpeculativeAssistant((s) => s + tok);
        } else {
          setSpeculativeAssistant("");
          setStreamingAssistant((s) => s + tok);
        }
        scrollBottom();
        return;
      }
      if (msg.type === "ai_speculative_done") {
        setLlmStreaming(false);
        return;
      }
      if (msg.type === "ai_done") {
        setLlmStreaming(false);
        const full = String(msg.text || "");
        setStreamingAssistant("");
        setSpeculativeAssistant("");
        if (full.trim()) {
          setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", text: full }]);
        }
        scrollBottom();
        return;
      }
      if (msg.type === "tts_end") {
        player.flushPending();
        setTtsPlaying(false);
        if (modeRef.current === "auto" && autoRunningRef.current && isOpen) {
          restartTimerRef.current = window.setTimeout(() => {
            if (!autoRunningRef.current || !isOpen) return;
            beginSpeechSegment();
          }, 400);
        }
        return;
      }
      if (msg.type === "error") {
        const m = String(msg.message || "");
        if (m.toLowerCase().includes("azure stt canceled")) {
          setSttMode("browser");
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "system",
            text: String(msg.message || "Voice server error"),
          },
        ]);
        scrollBottom();
        return;
      }
      if (msg.type === "quota_exceeded") {
        const scope = String(msg.scope || "quota");
        const usedDay = typeof msg.used_day === "number" ? msg.used_day : null;
        const limitDay = typeof msg.limit_day === "number" ? msg.limit_day : null;
        const usedMonth = typeof msg.used_month === "number" ? msg.used_month : null;
        const limitMonth = typeof msg.limit_month === "number" ? msg.limit_month : null;
        const plan = String(msg.plan || serverHello?.plan || "");
        const detail =
          usedDay != null && limitDay != null
            ? `Day ${usedDay}/${limitDay}`
            : usedMonth != null && limitMonth != null
            ? `Month ${usedMonth}/${limitMonth}`
            : "";
        setMessages((prev) => [
          ...prev,
          {
            id: `q-${Date.now()}`,
            role: "system",
            text: `Quota exceeded (${scope}). ${detail ? detail + ". " : ""}Please upgrade your plan or try later.`,
          },
        ]);
        handleServerInterrupt();
        openPaywall({
          message: `Bạn đã vượt giới hạn gói ${plan || "hiện tại"} cho voice (${scope}). Vui lòng nâng cấp để tiếp tục.`,
          source: "voice_quota",
        });
        scrollBottom();
        return;
      }
      if (msg.type === "metrics") {
        // Optional server-side metrics; kept for debugging in UI later if needed.
        return;
      }
    },
    [beginSpeechSegment, endSpeechSegment, ensureStream, handleServerInterrupt, isOpen, sendJson, startPcmCapture, setMicError]
  );

  useEffect(() => {
    setOnJsonMessage((m) => {
      void onServerJson(m);
    });
  }, [onServerJson, setOnJsonMessage]);

  useEffect(() => {
    setOnBinaryMessage(onBinary);
  }, [onBinary, setOnBinaryMessage]);

  useEffect(() => {
    if (!awaitingRecognitionStart || sttModeRef.current === "browser") return;
    const t = window.setTimeout(() => {
      setAwaitingRecognitionStart((v) => {
        if (v) {
          awaitingStartRef.current = false;
          setMicError(
            sanitizeUi
              ? "Không thể bắt đầu nghe. Vui lòng thử lại sau vài giây."
              : "Voice server did not start recognition in time. Is npm run voice-ws running?"
          );
        }
        return false;
      });
    }, 4000);
    return () => clearTimeout(t);
  }, [awaitingRecognitionStart, sanitizeUi, setMicError]);

  useEffect(() => {
    return () => {
      clearTimers();
      stopMic();
      player.close();
    };
  }, [clearTimers, player, stopMic]);

  useEffect(() => {
    if (readyState !== "closed" && readyState !== "error") return;
    capturingRef.current = false;
    setCapturing(false);
    awaitingStartRef.current = false;
    setAwaitingRecognitionStart(false);
    clearTimers();
    stopMic();
    player.interrupt();
    setTtsPlaying(false);
  }, [readyState, clearTimers, player, stopMic]);

  const voicePhase = useMemo(() => {
    if (!isOpen) return "idle";
    if (capturing) return "listening";
    if (llmStreaming || speculativeAssistant || streamingAssistant) return "processing";
    if (ttsPlaying) return "speaking";
    return "idle";
  }, [isOpen, capturing, llmStreaming, speculativeAssistant, streamingAssistant, ttsPlaying]);

  const statusLabel = useMemo(() => {
    if (sanitizeUi) return friendlyVoiceStatusLabel(voicePhase, readyState, isOpen, lastError);
    if (lastError && readyState === "error") return "Lỗi kết nối";
    if (readyState === "connecting") return "Đang kết nối…";
    switch (voicePhase) {
      case "listening":
        return "Đang nghe (listening)";
      case "processing":
        return "Đang xử lý (processing)";
      case "speaking":
        return "Đang phát âm (speaking)";
      default:
        return isOpen ? "Sẵn sàng (idle)" : "Chưa kết nối";
    }
  }, [isOpen, lastError, readyState, sanitizeUi, voicePhase]);

  const statusDetail = useMemo(() => {
    if (authError) return authError;
    if (lastError) return lastError;
    if (closeInfo?.code) {
      const reason = String(closeInfo.reason || "").toLowerCase();
      // Suppress noisy "normal" client-initiated closes (e.g. cleanup in dev / reconnect).
      if (closeInfo.code === 1000 && (reason === "client" || reason === "reconnect")) return "";
      return `WS closed: ${closeInfo.code}${closeInfo.reason ? ` (${closeInfo.reason})` : ""}`;
    }
    return "";
  }, [authError, closeInfo, lastError]);

  const statusClass =
    lastError && readyState === "error"
      ? styles.error
      : readyState === "connecting"
      ? styles.connecting
      : voicePhase === "listening"
      ? styles.speaking
      : voicePhase === "processing"
      ? styles.processing
      : voicePhase === "speaking"
      ? styles.speaking
      : "";

  const pttDown = useCallback(() => {
    if (!isOpen) return;
    if (ttsPlaying) {
      const rid = currentRequestIdRef.current;
      sendJson({ type: "interrupt", requestId: rid, reason: "barge_in" });
      player.interrupt();
      setTtsPlaying(false);
    }
    if (mode !== "ptt" || capturingRef.current || awaitingStartRef.current) return;
    beginSpeechSegment();
  }, [beginSpeechSegment, isOpen, mode, player, sendJson, ttsPlaying]);

  const pttUp = useCallback(() => {
    if (mode !== "ptt") return;
    if (sttMode === "browser") {
      browserRecRef.current?.stop?.();
      browserRecRef.current = null;
    }
    endSpeechSegment();
  }, [endSpeechSegment, mode, sttMode]);

  const disconnectCall = useCallback(() => {
    setAutoRunning(false);
    autoRunningRef.current = false;
    clearTimers();
    if (isOpen) {
      sendJson({ type: "interrupt", reason: "disconnect" });
    }
    endSpeechSegment();
    player.interrupt();
    setTtsPlaying(false);
    disconnect();
  }, [clearTimers, disconnect, endSpeechSegment, isOpen, player, sendJson]);

  const interruptPlayback = useCallback(() => {
    if (isOpen) {
      const rid = currentRequestIdRef.current;
      sendJson({ type: "interrupt", requestId: rid, reason: "user_interrupt" });
    }
    player.interrupt();
    setTtsPlaying(false);
  }, [isOpen, player, sendJson]);

  const setMicMuted = useCallback(
    (muted) => {
      setMicEnabled(!muted);
    },
    [setMicEnabled]
  );

  const setSpeakerOn = useCallback(
    (on) => {
      player.setVolume(on ? 1 : 0);
    },
    [player]
  );

  const toggleAutoRun = useCallback(() => {
    if (!isOpen) return;
    setAutoRunning((r) => {
      const next = !r;
      if (!next) {
        autoRunningRef.current = false;
        endSpeechSegment();
        clearTimers();
      } else {
        autoRunningRef.current = true;
        if (!capturingRef.current && !awaitingStartRef.current) {
          beginSpeechSegment();
        }
      }
      return next;
    });
  }, [beginSpeechSegment, clearTimers, endSpeechSegment, isOpen]);

  const displayStatusDetail = useMemo(() => {
    const raw = statusDetail;
    if (!raw) return "";
    return sanitizeUi ? sanitizeVoiceUserMessage(raw) : raw;
  }, [sanitizeUi, statusDetail]);

  const displayMicError = useMemo(() => {
    if (!micError) return "";
    return sanitizeUi ? sanitizeVoiceUserMessage(micError) : micError;
  }, [micError, sanitizeUi]);

  const displayAuthError = useMemo(() => {
    if (!authError) return "";
    return sanitizeUi ? sanitizeVoiceUserMessage(authError) : authError;
  }, [authError, sanitizeUi]);

  const displayMessages = useMemo(() => {
    if (!sanitizeUi) return messages;
    return messages.map((m) => {
      if (m.role !== "system") return m;
      return { ...m, text: sanitizeVoiceUserMessage(m.text) || m.text };
    });
  }, [messages, sanitizeUi]);

  useEffect(() => {
    if (!headless || !onApiReady) return;
    onApiReady({
      connect: connectAuthed,
      disconnect: disconnectCall,
      pttDown,
      pttUp,
      beginSpeechSegment,
      endSpeechSegment,
      interruptPlayback,
      isOpen,
      readyState,
      voicePhase,
      statusLabel,
      statusDetail: displayStatusDetail,
      messages: displayMessages,
      liveUserText,
      streamingText: speculativeAssistant || streamingAssistant,
      capturing,
      awaitingRecognitionStart,
      ttsPlaying,
      micError: displayMicError,
      authError: displayAuthError,
      setMicMuted,
      setSpeakerOn,
      ensureAudio: () => player.ensureCtx(),
      mode,
      autoRunning,
      toggleAutoRun,
    });
  }, [
    autoRunning,
    awaitingRecognitionStart,
    beginSpeechSegment,
    capturing,
    connectAuthed,
    disconnectCall,
    displayAuthError,
    displayMessages,
    displayMicError,
    displayStatusDetail,
    endSpeechSegment,
    headless,
    interruptPlayback,
    isOpen,
    liveUserText,
    mode,
    onApiReady,
    pttDown,
    pttUp,
    readyState,
    setMicMuted,
    setSpeakerOn,
    player,
    speculativeAssistant,
    statusLabel,
    streamingAssistant,
    toggleAutoRun,
    ttsPlaying,
    voicePhase,
  ]);

  if (headless) return null;

  const controlsEl = (
    <div className={styles.controls}>
        {!isOpen ? (
          <button type="button" className={styles.btn} onClick={connectAuthed} disabled={readyState === "connecting"}>
            Kết nối voice server
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => {
              setAutoRunning(false);
              autoRunningRef.current = false;
              clearTimers();
              sendJson({ type: "interrupt", reason: "disconnect" });
              endSpeechSegment();
              player.interrupt();
              setTtsPlaying(false);
              disconnect();
            }}
          >
            Ngắt kết nối
          </button>
        )}

        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={() => {
            refreshQuota();
          }}
          disabled={quotaLoading}
          title="Cập nhật plan/quota"
        >
          {quotaLoading ? "Đang cập nhật..." : "Refresh plan/quota"}
        </button>

        {!hideBillingUi ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => openPaywall({ message: "Nâng cấp để dùng voice nhiều hơn.", source: "voice_upgrade_btn" })}
            title="Nâng cấp gói"
          >
            Upgrade
          </button>
        ) : null}

        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={() => setSttMode((m) => (m === "azure" ? "browser" : "azure"))}
          title="Đổi STT mode (fallback khi Azure lỗi)"
        >
          STT: {sttMode === "azure" ? "Azure" : "Browser"}
        </button>

        <div className={styles.modeToggle} role="group" aria-label="Chế độ thu âm">
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === "ptt" ? styles.modeBtnActive : ""}`}
            onClick={() => {
              setMode("ptt");
              setAutoRunning(false);
              autoRunningRef.current = false;
              clearTimers();
              endSpeechSegment();
            }}
          >
            Bấm giữ nói
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === "auto" ? styles.modeBtnActive : ""}`}
            onClick={() => {
              setMode("auto");
            }}
          >
            Tự động (lặng im)
          </button>
        </div>

        {mode === "auto" && isOpen ? (
          <button type="button" className={`${styles.btn} ${autoRunning ? styles.btnDanger : ""}`} onClick={toggleAutoRun}>
            {autoRunning ? "Dừng auto" : "Bắt đầu auto"}
          </button>
        ) : null}
      </div>
  );

  // Toolbar-only mode: render only the top control buttons (so caller can place them elsewhere).
  // (Use a dedicated prop to avoid breaking wsUrl parsing.)
  if (toolbarOnly) {
    return (
      <div className={styles.toolbar} aria-label="Voice tutor toolbar">
        <div className={styles.toolbarTop}>
          <span className={`${styles.statusPill} ${statusClass}`}>
            <span className={styles.dot} aria-hidden />
            {statusLabel}
          </span>
        </div>
        {controlsEl}
        {authError ? (
          <p className={styles.hint} style={{ color: "#9d2f2f", marginTop: "0.35rem" }}>
            {authError}
          </p>
        ) : null}
        {statusDetail && !authError ? (
          <p className={styles.hint} style={{ color: "#9d2f2f", marginTop: "0.35rem" }}>
            {statusDetail}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section className={styles.wrap} aria-label="Voice tutor WebSocket">
      <div className={styles.head}>
        <h3 className={styles.title}>Trò chuyện giọng nói (low-latency)</h3>
        <div className={styles.statusRow}>
          <span className={`${styles.statusPill} ${statusClass}`}>
            <span className={styles.dot} aria-hidden />
            {statusLabel}
          </span>
        </div>
      </div>

      {controlsEl}

      {mode === "ptt" && isOpen ? (
        <button
          type="button"
          className={`${styles.btn} ${styles.ptt} ${capturing ? styles.pttActive : ""}`}
          onPointerDown={(e) => {
            e.preventDefault();
            pttDown();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            pttUp();
          }}
          onPointerLeave={(e) => {
            if (e.buttons === 0) pttUp();
          }}
        >
          {ttsPlaying && !capturing
            ? "Chạm giữ để ngắt / nói tiếp"
            : capturing
            ? "Đang thu… thả để gửi"
            : "Giữ nút để nói tiếng Anh"}
        </button>
      ) : null}

      {micError ? (
        <p className={styles.hint} style={{ color: "#9d2f2f", marginTop: "0.35rem" }}>
          {micError}
        </p>
      ) : null}
      {authError ? (
        <p className={styles.hint} style={{ color: "#9d2f2f", marginTop: "0.35rem" }}>
          {authError}
        </p>
      ) : null}
      {statusDetail && !authError ? (
        <p className={styles.hint} style={{ color: "#9d2f2f", marginTop: "0.35rem" }}>
          {statusDetail}
        </p>
      ) : null}

      <p className={styles.liveLine}>
        <strong>Bạn (partial):</strong>{" "}
        <span className={liveUserText ? styles.interim : ""}>{liveUserText || "…"}</span>
      </p>
      {(speculativeAssistant || streamingAssistant) && (
        <p className={styles.liveLine}>
          <strong>AI (stream):</strong>{" "}
          <span className={styles.interim}>{speculativeAssistant || streamingAssistant}</span>
        </p>
      )}

      <div className={styles.chat} ref={listRef}>
        {serverHello ? (
          <div className={`${styles.bubble} ${styles.system}`}>
            Session: {String(serverHello.sessionId || sessionId || "-")} · STT={serverHello.useAzure ? "Azure" : "demo"} · LLM+TTS=
            {serverHello.hasOpenAi ? "Workers" : "off"} · {serverHello.pcmHz} Hz uplink · AudioWorklet
          </div>
        ) : null}
        {quota?.plan && quota?.limits ? (
          <div className={`${styles.bubble} ${styles.system}`}>
            Plan: <strong>{quota.plan}</strong> · Daily caps: STT {Math.round((quota.limits.cap.stt_ms_day || 0) / 60000)}m · LLM{" "}
            {quota.limits.cap.llm_tokens_day || 0} tok · TTS {Math.round((quota.limits.cap.tts_bytes_day || 0) / 1000000)}MB
          </div>
        ) : null}
        {quota?.usage?.day ? (
          <div className={`${styles.bubble} ${styles.system}`}>
            Today used: STT {Math.round((quota.usage.day.stt_audio_ms || 0) / 60000)}m · LLM{" "}
            {(quota.usage.day.llm_tokens_in || 0) + (quota.usage.day.llm_tokens_out || 0)} tok · TTS{" "}
            {Math.round((quota.usage.day.tts_bytes || 0) / 1000000)}MB
          </div>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`${styles.bubble} ${
              m.role === "user" ? styles.user : m.role === "assistant" ? styles.assistant : styles.system
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <p className={styles.hint}>
        Protocol: <code>partial_transcript</code>, <code>final_transcript</code>, <code>ai_stream</code>,{" "}
        <code>ai_done</code>, <code>interrupt</code>, binary <code>0x02+pcm24k</code>, <code>tts_end</code>. Chạy{" "}
        <code>npm run voice-ws:local</code> (không cần Redis) hoặc <code>npm run voice-ws:dev</code> (cần Redis) với{" "}
        <code>OPENAI_API_KEY</code> trên server voice.
      </p>

      {metrics.requestId ? (
        <p className={styles.hint}>
          Latency (ms) · STT partial:{" "}
          {metrics.sttFirstPartialAt ? Math.round(metrics.sttFirstPartialAt - metrics.listenStartAt) : "-"} · LLM first token:{" "}
          {metrics.llmFirstTokenAt ? Math.round(metrics.llmFirstTokenAt - metrics.listenStartAt) : "-"} · TTS first chunk:{" "}
          {metrics.ttsFirstChunkAt ? Math.round(metrics.ttsFirstChunkAt - metrics.listenStartAt) : "-"} · Play start:{" "}
          {metrics.firstAudioPlayAt ? Math.round(metrics.firstAudioPlayAt - metrics.listenStartAt) : "-"} · RMS thresh:{" "}
          {rmsThreshRef.current.toFixed(3)}
        </p>
      ) : null}
    </section>
  );
}
