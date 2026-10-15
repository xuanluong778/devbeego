"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useVoiceWebSocket } from "@/hooks/useVoiceWebSocket";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useStreamingTtsPlayer } from "@/hooks/useStreamingTtsPlayer";
import { learnCallMediaStillAllowed, learnCallSocketCloseKind } from "@/lib/beego/learn/ai-call-access";
import { LEARN_CALL_TTS_STALL_MS, createLearnAudioCache, createLearnPlaybackController } from "@/lib/beego/learn/learn-call-playback";
import { LEARN_TALK_RECOGNITION_TIMEOUT_MS, createLearnTalkController, learnCallRemainingView } from "@/lib/beego/learn/learn-call-talk";
import {
  applyTranscriptEvent,
  createTranscript,
  transcriptCaption,
  transcriptHasClosing,
  transcriptLastTutor,
} from "@/lib/beego/learn/learn-call-transcript";
import LearnCallCharacter from "./LearnCallCharacter";

export default function LearnCallRoom({ token, sessionId, wsUrl, offer, onClose, returnLabel = "Quay lại bài" }) {
  const { readyState, lastError, closeInfo, connect, disconnect, sendJson, sendBinary, setOnJsonMessage, setOnBinaryMessage } = useVoiceWebSocket("");
  const drainedHandlerRef = useRef(() => {});
  const stoppedHandlerRef = useRef(() => {});
  const player = useStreamingTtsPlayer({
    inputSampleRate: 24000,
    onDrained: (info) => drainedHandlerRef.current(info),
    onStopped: (info) => stoppedHandlerRef.current(info),
  });
  const [phase, setPhase] = useState("connecting");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState(null);
  const [packageLeft, setPackageLeft] = useState(offer?.limits?.packageRemainingMs);
  const [clock, setClock] = useState(null);
  const [tick, setTick] = useState(() => Date.now());
  const [mouthOn, setMouthOn] = useState(false);
  const [ccOpen, setCcOpen] = useState(false);
  const [transcript, setTranscript] = useState(createTranscript);
  const [hasNew, setHasNew] = useState(false);
  const transcriptRef = useRef(transcript);
  transcriptRef.current = transcript;
  const closingRef = useRef(false);
  closingRef.current = transcriptHasClosing(transcript);
  const sheetId = useId();
  const pushTranscript = useCallback((event) => {
    setTranscript((current) => applyTranscriptEvent(current, event));
  }, []);
  const requestRef = useRef(0);
  const dropAudioRef = useRef(false);
  const closedRef = useRef(false);
  const azureRef = useRef(false);
  const listeningRef = useRef(false);
  const ttsPlayingRef = useRef(false);
  const deadlineRef = useRef(0);
  const endTimerRef = useRef(0);
  const talkTimerRef = useRef(0);
  const stallTimerRef = useRef(0);
  const logRef = useRef(null);
  const stickRef = useRef(true);
  const ccButtonRef = useRef(null);
  const ccCloseRef = useRef(null);
  const leaveRef = useRef(null);
  const playbackRef = useRef(null);
  const audioCacheRef = useRef(null);
  const talkRef = useRef(null);
  if (playbackRef.current == null) playbackRef.current = createLearnPlaybackController();
  if (audioCacheRef.current == null) audioCacheRef.current = createLearnAudioCache();
  if (talkRef.current == null) talkRef.current = createLearnTalkController();
  const playerRef = useRef(player);
  const sendJsonRef = useRef(sendJson);
  const sendBinaryRef = useRef(sendBinary);
  playerRef.current = player;
  sendJsonRef.current = sendJson;
  sendBinaryRef.current = sendBinary;

  const publishAck = (ack) => {
    if (!ack || closedRef.current) return;
    sendJsonRef.current({
      type: "playback_ack",
      requestId: ack.requestId,
      playbackId: ack.playbackId,
      kind: ack.kind,
      playback: ack.playback,
    });
    pushTranscript({ type: "playback", requestId: ack.requestId, kind: ack.kind, playback: ack.playback });
  };
  const clearStall = () => {
    if (stallTimerRef.current) {
      window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = 0;
    }
  };
  const settleReady = () => {
    setMouthOn(false);
    const next = talkRef.current.noteReady();
    if (!next.ignored) setPhase("ready");
  };
  drainedHandlerRef.current = () => {
    if (closedRef.current) return;
    clearStall();
    const result = playbackRef.current.sourceEnded({ generation: playbackRef.current.snapshot().generation });
    if (result.ack) publishAck(result.ack);
    // A gap in streamed audio is not the end of the turn; stay "speaking" until tts_end or a stall.
    if (result.waiting) {
      stallTimerRef.current = window.setTimeout(() => {
        stallTimerRef.current = 0;
        if (!closedRef.current) settleReady();
      }, LEARN_CALL_TTS_STALL_MS);
      return;
    }
    settleReady();
  };
  stoppedHandlerRef.current = () => {
    if (closedRef.current) {
      playbackRef.current.disconnect();
      return;
    }
    publishAck(playbackRef.current.interrupt().ack);
    setMouthOn(false);
  };

  const onPcmChunk = useCallback((pcm) => {
    if (closedRef.current || !azureRef.current) return;
    if (!talkRef.current.notePcm(pcm?.byteLength || 0)) return;
    sendBinaryRef.current(pcm);
  }, []);

  const { ensureStream, startPcmCapture, stopMic, micError, setMicError, audioState } = useVoiceRecorder({ onPcmChunk });

  const releaseMedia = useCallback(() => {
    listeningRef.current = false;
    ttsPlayingRef.current = false;
    playerRef.current.interrupt();
    playerRef.current.close();
  }, []);

  const finish = useCallback(
    (nextPhase, nextNotice) => {
      if (closedRef.current) return;
      closedRef.current = true;
      if (endTimerRef.current) {
        window.clearTimeout(endTimerRef.current);
        endTimerRef.current = 0;
      }
      playbackRef.current.disconnect();
      audioCacheRef.current.clear();
      talkRef.current.exit();
      if (talkTimerRef.current) {
        window.clearTimeout(talkTimerRef.current);
        talkTimerRef.current = 0;
      }
      clearStall();
      releaseMedia();
      stopMic();
      disconnect();
      setPhase(nextPhase);
      if (nextNotice) setNotice(nextNotice);
    },
    [disconnect, releaseMedia, stopMic]
  );

  const openTalkMedia = useCallback(
    async (decision) => {
      const still = () =>
        !closedRef.current &&
        talkRef.current.snapshot().generation === decision.generation &&
        learnCallMediaStillAllowed({ closed: closedRef.current, deadlineAt: deadlineRef.current });
      if (decision.action === "interrupt_listen") {
        listeningRef.current = false;
        ttsPlayingRef.current = false;
        dropAudioRef.current = true;
        playerRef.current.interrupt();
        sendJsonRef.current({ type: "interrupt", requestId: decision.previousRequestId, reason: "barge_in" });
      }
      setMicError("");
      try {
        const playback = await playerRef.current.resumeFromGesture();
        if (!still()) {
          stopMic();
          return;
        }
        await ensureStream();
        if (!still()) {
          stopMic();
          return;
        }
        await startPcmCapture();
        if (!still()) {
          stopMic();
          return;
        }
        const captureRunning = audioState() === "running";
        const applied = talkRef.current.mediaReady({
          generation: decision.generation,
          running: playback.running === true && captureRunning,
        });
        if (applied.stale || applied.ignored) {
          stopMic();
          return;
        }
        if (applied.action !== "send_pcm") {
          stopMic();
          setPhase("mic");
          setNotice("Micro hoặc âm thanh chưa ở trạng thái đang chạy. Bấm Cho phép micro để thử lại.");
          return;
        }
        listeningRef.current = true;
        requestRef.current = applied.requestId;
        dropAudioRef.current = false;
        sendJsonRef.current({ type: "recognition_start", requestId: applied.requestId });
        setPhase("listening");
        setNotice("");
      } catch (error) {
        stopMic();
        const applied = talkRef.current.mediaReady({ generation: decision.generation, running: false });
        if (applied.stale || closedRef.current) return;
        const name = String(error?.name || "");
        setPhase("mic");
        setNotice(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "Micro chưa được phép. Bấm Cho phép micro để thử lại."
            : "Không mở được micro. Cuộc gọi chưa được tính là hoàn thành."
        );
      }
    },
    [audioState, ensureStream, setMicError, startPcmCapture, stopMic]
  );

  const onPrimary = useCallback(async () => {
    if (closingRef.current) return;
    const decision = talkRef.current.press();
    if (decision.ignored) return;
    if (decision.action === "arm_listen" || decision.action === "interrupt_listen") {
      if (decision.action === "interrupt_listen") {
        setMouthOn(false);
        const previous = decision.previousRequestId;
        const snap = playbackRef.current.snapshot();
        const playing = snap.kind === "turn" && snap.requestId === previous && !snap.acked && snap.bytes > 0;
        const turn = transcriptRef.current.turns.find((item) => item.key === `t:${previous}`);
        if (!playing && (!turn || turn.playback === "pending")) {
          publishAck({ kind: "turn", playback: "cancelled", requestId: previous, playbackId: previous });
        }
      }
      await openTalkMedia(decision);
      return;
    }
    if (decision.action === "empty_audio") {
      listeningRef.current = false;
      stopMic();
      sendJsonRef.current({ type: "interrupt", requestId: decision.requestId, reason: "no_audio" });
      setPhase("ready");
      setNotice("Chưa có tiếng. Hãy nhấn để nói lại.");
      return;
    }
    if (decision.action === "submit") {
      listeningRef.current = false;
      stopMic();
      requestRef.current = decision.requestId;
      sendJsonRef.current({ type: "recognition_end", requestId: decision.requestId });
      setPhase("transcribing");
      setNotice("Đang nhận dạng câu bạn vừa nói.");
      if (talkTimerRef.current) window.clearTimeout(talkTimerRef.current);
      talkTimerRef.current = window.setTimeout(() => {
        talkTimerRef.current = 0;
        const timed = talkRef.current.noteTimeout();
        if (timed.ignored || closedRef.current) return;
        listeningRef.current = false;
        stopMic();
        sendJsonRef.current({ type: "interrupt", requestId: decision.requestId, reason: "recognition_timeout" });
        setPhase("ready");
        setNotice("Hết thời gian nhận dạng. Hãy nhấn để nói lại.");
      }, LEARN_TALK_RECOGNITION_TIMEOUT_MS);
    }
  }, [openTalkMedia, pushTranscript, stopMic]);

  useEffect(() => {
    setOnJsonMessage((msg) => {
      if (!msg || typeof msg !== "object" || closedRef.current) return;
      if (msg.type === "hello") {
        const serverRid = Math.max(1, Number(msg.currentRequestId) || 1);
        requestRef.current = serverRid;
        if (Array.isArray(msg.transcript)) pushTranscript({ type: "hydrate", turns: msg.transcript });
        if (Number.isFinite(Number(msg.callClock?.deadlineAt)) && Number.isFinite(Number(msg.callClock?.startedAt))) {
          const deadlineAt = Number(msg.callClock.deadlineAt);
          const startedAt = Number(msg.callClock.startedAt);
          deadlineRef.current = deadlineAt;
          setClock((prev) => (prev && prev.deadlineAt === deadlineAt ? prev : { startedAt, deadlineAt }));
        }
        if (Number.isFinite(Number(msg.packageQuota?.remainingMs))) setPackageLeft(Number(msg.packageQuota.remainingMs));
        if (!msg.useAzure) {
          finish("error", "Gateway preview chưa bật Azure STT. Cuộc gọi không chuyển sang nhận dạng trình duyệt.");
          return;
        }
        azureRef.current = true;
        talkRef.current.hello({ azure: true, requestId: serverRid });
        setPhase("ready");
        return;
      }
      if (msg.type === "call_summary") {
        setSummary(msg.summary || null);
        return;
      }
      if (msg.type === "call_ended") {
        const reason =
          msg.reason === "lesson_complete"
            ? "Gia sư đã chào kết thúc. Micro và tiếng đã dừng."
            : msg.reason === "feature_disabled"
            ? "Cuộc gọi đã được tắt. Micro và tiếng đã dừng."
            : msg.reason === "package_quota"
            ? "Hết hạn mức gói thử nghiệm. Micro và tiếng đã dừng."
            : msg.reason === "time_limit"
              ? "Hết thời lượng mức 1. Micro và tiếng đã dừng."
              : "Đã dừng micro và tiếng. Kết quả bài học không đổi.";
        if (Number.isFinite(Number(msg.packageQuota?.remainingMs))) setPackageLeft(Number(msg.packageQuota.remainingMs));
        finish("ended", reason);
        return;
      }
      if (msg.type === "error") {
        const message = String(msg.message || "Mất kết nối cuộc gọi.");
        if (message.includes("Chưa có câu") || message.includes("Không còn đủ audio")) {
          setNotice(message);
          return;
        }
        listeningRef.current = false;
        if (message.includes("Azure STT")) {
          finish("error", "Azure gặp lỗi. Cuộc gọi không chuyển sang nhận dạng trình duyệt.");
          return;
        }
        finish("error", message);
        return;
      }
      const rid = Number(msg.requestId) || 0;
      if (rid && rid !== requestRef.current) return;
      if (msg.type === "interrupt" || msg.type === "interrupt_ack") {
        if (msg.reason === "stt_canceled" || msg.reason === "stt_session_stopped") {
          finish("error", "Azure gặp lỗi. Cuộc gọi không chuyển sang nhận dạng trình duyệt.");
          return;
        }
        dropAudioRef.current = true;
        ttsPlayingRef.current = false;
        if (talkRef.current.snapshot().phase === "speaking") playerRef.current.interrupt();
        return;
      }
      if (msg.type === "partial_transcript") {
        pushTranscript({ type: "partial_transcript", requestId: rid, text: String(msg.text || "") });
        return;
      }
      if (msg.type === "final_transcript") {
        if (talkTimerRef.current) {
          window.clearTimeout(talkTimerRef.current);
          talkTimerRef.current = 0;
        }
        const text = String(msg.text || "").trim();
        pushTranscript({ type: "final_transcript", requestId: rid, text });
        const result = talkRef.current.noteFinal(text);
        if (result.ignored) return;
        listeningRef.current = false;
        stopMic();
        if (result.action === "empty_transcript") {
          setPhase("ready");
          setNotice("Chưa nghe thấy câu nào. Hãy nhấn để nói lại.");
          return;
        }
        setPhase("thinking");
        setNotice("Đang tạo một câu trả lời.");
        return;
      }
      if (msg.type === "ai_stream") {
        if (msg.speculative) return;
        dropAudioRef.current = false;
        talkRef.current.noteSpeaking();
        setPhase("speaking");
        pushTranscript({ type: "ai_stream", requestId: rid, token: msg.token, speculative: false });
        return;
      }
      if (msg.type === "ai_done") {
        pushTranscript({ type: "ai_done", requestId: rid, text: String(msg.text || ""), closing: msg.closing === true });
        setNotice("");
        talkRef.current.noteSpeaking();
        setPhase("speaking");
        return;
      }
      if (msg.type === "repeat_started") {
        const playbackId = Number(msg.playbackId);
        if (!playbackId) return;
        const started = playbackRef.current.startReplay({ requestId: rid || requestRef.current, playbackId });
        playerRef.current.armPlayback(started.playbackId);
        dropAudioRef.current = false;
        ttsPlayingRef.current = true;
        talkRef.current.noteSpeaking();
        setPhase("speaking");
        return;
      }
      if (msg.type === "tts_end") {
        clearStall();
        const playbackId = Number(msg.playbackId) || playbackRef.current.snapshot().playbackId;
        playerRef.current.flushPending();
        const ended = playbackRef.current.serverEnd({ playbackId });
        const flushed = playbackRef.current.flushBuffer();
        if (ended.ack || flushed.ack) {
          publishAck(ended.ack || flushed.ack);
          const next = talkRef.current.noteReady();
          if (!next.ignored) setPhase("ready");
          return;
        }
        if (!playerRef.current.hasPendingAudio()) {
          const drained = playbackRef.current.sourceEnded({ generation: playbackRef.current.snapshot().generation });
          if (drained.ack) publishAck(drained.ack);
          const next = talkRef.current.noteReady();
          if (!next.ignored) setPhase("ready");
        }
      }
    });
    setOnBinaryMessage((ab) => {
      if (closedRef.current || dropAudioRef.current) return;
      const u8 = new Uint8Array(ab);
      if (u8.length < 6 || (u8[0] !== 0x02 && u8[0] !== 0x03)) return;
      const header = u8[0] === 0x03 ? 9 : 5;
      if (u8.length < header) return;
      const first = u8[1] | (u8[2] << 8) | (u8[3] << 16) | (u8[4] << 24);
      const second = u8[0] === 0x03 ? u8[5] | (u8[6] << 8) | (u8[7] << 16) | (u8[8] << 24) : 0;
      const playbackId = u8[0] === 0x03 ? first : first;
      const rid = u8[0] === 0x03 ? second : first;
      if (!rid || (u8[0] === 0x02 && rid !== requestRef.current)) return;
      const pcm = u8.subarray(header);
      const snap = playbackRef.current.snapshot();
      if (!snap.playbackId || snap.playbackId !== playbackId) {
        if (u8[0] !== 0x02) return;
        const started = playbackRef.current.startTurn(rid);
        playerRef.current.armPlayback(started.playbackId);
      }
      const gen = playbackRef.current.snapshot().generation;
      const accepted = playbackRef.current.chunk({ playbackId: playbackRef.current.snapshot().playbackId, generation: gen, bytes: pcm.byteLength });
      if (accepted.drop) return;
      clearStall();
      if (u8[0] === 0x02) audioCacheRef.current.append(rid, pcm);
      ttsPlayingRef.current = true;
      setMouthOn(true);
      talkRef.current.noteSpeaking();
      setPhase("speaking");
      playerRef.current.enqueuePcmS16le(pcm, 24000, playbackRef.current.snapshot().playbackId);
      // Audio that arrives after tts_end is already queued; count it as playing so the next drain completes the turn.
      if (playbackRef.current.snapshot().serverEnded) playbackRef.current.flushBuffer();
    });
  }, [finish, pushTranscript, setOnBinaryMessage, setOnJsonMessage, stopMic]);

  useEffect(() => {
    let url = "";
    try {
      const next = new URL(wsUrl);
      next.searchParams.set("token", token);
      next.searchParams.set("sessionId", sessionId);
      url = next.toString();
    } catch (_e) {
      setPhase("error");
      setNotice("Địa chỉ kết nối thoại không hợp lệ. Cuộc gọi chưa bắt đầu.");
      return undefined;
    }
    connect(url);
    return () => {
      closedRef.current = true;
      if (endTimerRef.current) {
        window.clearTimeout(endTimerRef.current);
        endTimerRef.current = 0;
      }
      playbackRef.current.disconnect();
      audioCacheRef.current.clear();
      talkRef.current.exit();
      if (talkTimerRef.current) {
        window.clearTimeout(talkTimerRef.current);
        talkTimerRef.current = 0;
      }
      clearStall();
      listeningRef.current = false;
      playerRef.current.interrupt();
      playerRef.current.close();
      stopMic();
      disconnect();
    };
  }, [connect, disconnect, sessionId, stopMic, token, wsUrl]);

  useEffect(() => {
    if (closedRef.current) return;
    if (readyState !== "error" && readyState !== "closed") return;
    if (learnCallSocketCloseKind(closeInfo) === "intentional") return;
    if (readyState === "error") {
      finish("error", lastError || "Mất kết nối. Hãy thử lại. Cuộc gọi chưa được tính là hoàn thành.");
      return;
    }
    finish("ended", "Mất kết nối. Micro và tiếng đã dừng.");
  }, [closeInfo, finish, lastError, readyState]);

  const replay = () => {
    if (closedRef.current || readyState !== "open") return;
    const lastTutor = transcriptLastTutor(transcriptRef.current);
    if (!lastTutor || phase === "listening" || phase === "transcribing" || phase === "thinking") return;
    const cached = audioCacheRef.current.replay(lastTutor.requestId);
    if (!cached) {
      sendJson({ type: "repeat_last", requestId: lastTutor.requestId });
      return;
    }
    const started = playbackRef.current.startReplay(cached);
    player.armPlayback(started.playbackId);
    dropAudioRef.current = false;
    for (const chunk of cached.chunks) {
      playbackRef.current.chunk({
        playbackId: started.playbackId,
        generation: started.generation,
        bytes: chunk.byteLength,
      });
      player.enqueuePcmS16le(chunk, 24000, started.playbackId);
    }
    player.flushPending();
    playbackRef.current.serverEnd({ playbackId: started.playbackId, generation: started.generation });
    playbackRef.current.flushBuffer();
    ttsPlayingRef.current = true;
    talkRef.current.noteSpeaking();
    setPhase("speaking");
  };

  const endCall = () => {
    listeningRef.current = false;
    ttsPlayingRef.current = false;
    player.interrupt();
    stopMic();
    sendJson({ type: "end_call" });
    if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    endTimerRef.current = window.setTimeout(() => {
      endTimerRef.current = 0;
      if (!closedRef.current) {
        finish("ended", "Đã dừng micro và tiếng. Chưa nhận được tổng kết từ phiên.");
      }
    }, 4000);
  };

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ccOpen) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setCcOpen(false);
        ccButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    ccCloseRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [ccOpen]);

  useEffect(() => {
    const el = logRef.current;
    if (!el || !ccOpen) return;
    if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
      setHasNew(false);
    } else {
      setHasNew(true);
    }
  }, [transcript, ccOpen]);

  useEffect(() => {
    if (phase !== "ended" && phase !== "error") return;
    setCcOpen(false);
    leaveRef.current?.focus();
  }, [phase]);

  const caption = transcriptCaption(transcript, talkRef.current.snapshot().requestId);
  const canReplay = Boolean(transcriptLastTutor(transcript));

  const clockView = learnCallRemainingView({
    startedAt: clock?.startedAt,
    deadlineAt: clock?.deadlineAt,
    now: tick,
  });
  const sceneClass = ["listening", "thinking", "speaking", "transcribing"].includes(phase) ? `is-${phase}` : "is-idle";
  const closing = transcriptHasClosing(transcript);
  const speakLabel =
    closing && phase !== "ended" && phase !== "error"
      ? "ĐANG KẾT THÚC…"
      : phase === "listening"
      ? "GỬI CÂU TRẢ LỜI"
      : phase === "speaking"
        ? "NGẮT LỜI"
        : phase === "transcribing"
          ? "ĐANG NHẬN DẠNG…"
          : phase === "thinking"
            ? "ĐANG SUY NGHĨ…"
            : "NHẤN ĐỂ NÓI";
  const statusLabel =
    phase === "connecting"
      ? "Đang kết nối…"
      : phase === "listening"
        ? "Đang nghe bạn nói"
        : phase === "transcribing"
          ? "Đang nhận dạng…"
          : phase === "thinking"
            ? "Đang suy nghĩ…"
            : phase === "speaking"
              ? closing
                ? "Gia sư đang chào kết thúc"
                : mouthOn
                ? "Gia sư đang nói"
                : "Gia sư đang chuẩn bị tiếng"
              : phase === "mic"
                ? "Cần quyền micro"
                : phase === "error"
                  ? "Lỗi kết nối"
                  : phase === "ended"
                    ? "Cuộc gọi đã kết thúc"
                    : "Sẵn sàng";
  const captionText = caption || statusLabel;
  const speakDisabled =
    closing ||
    readyState !== "open" ||
    phase === "connecting" ||
    phase === "transcribing" ||
    phase === "thinking" ||
    phase === "ended" ||
    phase === "error";
  const replayDisabled =
    closing ||
    readyState !== "open" ||
    !canReplay ||
    phase === "listening" ||
    phase === "transcribing" ||
    phase === "thinking" ||
    phase === "ended" ||
    phase === "error";
  const topic = offer?.title || "Bài học";
  const ended = phase === "ended" || phase === "error";
  const serverSummary = summary && Array.isArray(summary.transcript) ? summary : null;
  const summaryTurns = serverSummary
    ? serverSummary.transcript.map((turn, index) => ({ ...turn, key: `s:${index}`, final: true }))
    : transcript.turns.filter((turn) => turn.final);
  const learnerTurns = serverSummary ? Number(serverSummary.learnerTurns) || 0 : summaryTurns.filter((turn) => turn.role === "user").length;
  const tutorCount = (playback) => summaryTurns.filter((turn) => turn.role === "tutor" && (turn.playback || "pending") === playback).length;
  const practiced = learnerTurns > 0;

  const closeCc = () => {
    setCcOpen(false);
    ccButtonRef.current?.focus();
  };
  const jumpToLatest = () => {
    const el = logRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickRef.current = true;
    setHasNew(false);
  };
  const turnBadge = (turn, afterCall = ended) => {
    if (!turn.final) return turn.role === "user" ? "đang nhận dạng" : "đang soạn";
    if (turn.role !== "tutor") return "";
    const prefix = turn.closing ? "Lời kết" : "";
    const state =
      turn.playback === "complete"
        ? "Đã phát hết"
        : turn.playback === "interrupted"
          ? "Bị ngắt khi đang phát"
          : turn.playback === "cancelled"
            ? "Hủy trước khi phát"
            : afterCall
              ? "Chưa xác nhận phát hết"
              : "";
    return [prefix, state].filter(Boolean).join(" · ");
  };

  return (
    <div
      className="beego-call-stage"
      role="region"
      aria-label={offer?.limits?.difficultyLabel ? `Cuộc gọi AI mức ${offer.limits.difficultyLabel}` : "Cuộc gọi AI"}
    >
      <div className="beego-call-stage__phone">
        <section className={`beego-call-stage__scene ${sceneClass}`}>
          <div className="beego-call-stage__window" aria-hidden="true" />
          <div className="beego-call-stage__curtain" aria-hidden="true" />
          <header className="beego-call-stage__header">
            <button type="button" className="beego-call-stage__close" onClick={endCall} disabled={ended} aria-label="Kết thúc cuộc gọi">
              ×
            </button>
            <div
              className="beego-call-stage__track"
              role="progressbar"
              aria-label="Thời gian còn lại"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(clockView.ratio * 100)}
              aria-valuetext={clockView.label}
            >
              <div className="beego-call-stage__bar" style={{ width: `${clockView.ratio * 100}%` }} />
            </div>
          </header>
          <div className="beego-call-stage__meta">
            <span className="beego-call-stage__topic">
              Gia sư Beego · {topic}
              {offer?.limits?.difficultyLabel ? ` · Mức ${offer.limits.difficultyLabel}` : ""}
            </span>
            <time dateTime={clockView.known ? new Date(clockView.deadlineAt).toISOString() : undefined}>{clockView.label}</time>
          </div>
          <div className="beego-call-stage__halo" aria-hidden="true" />
          <LearnCallCharacter talking={mouthOn} />
          <div className="beego-call-stage__caption" aria-live="polite">
            <span>{captionText}</span>
          </div>
          <aside className="beego-call-stage__sheet" id={sheetId} hidden={!ccOpen} aria-label="Đoạn hội thoại">
            <div className="beego-call-stage__sheet-head">
              <strong>Đoạn hội thoại</strong>
              <button ref={ccCloseRef} type="button" onClick={closeCc} aria-label="Đóng hội thoại">
                ×
              </button>
            </div>
            <div
              className="beego-call-stage__log"
              role="log"
              ref={logRef}
              onScroll={(event) => {
                const el = event.currentTarget;
                stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
                if (stickRef.current) setHasNew(false);
              }}
            >
              {transcript.turns.length ? (
                transcript.turns.map((turn) => {
                  const badge = turnBadge(turn);
                  return (
                    <div
                      key={turn.key}
                      className={`beego-call-stage__msg${turn.role === "user" ? " is-user" : ""}${turn.final ? "" : " is-interim"}`}
                      data-turn={turn.key}
                    >
                      <small>
                        {turn.role === "user" ? "BẠN" : "GIA SƯ BEEGO"}
                        {badge ? ` · ${badge}` : ""}
                      </small>
                      <span>{turn.text}</span>
                    </div>
                  );
                })
              ) : (
                <p className="beego-call-stage__empty">Chưa có câu nào trong phiên này.</p>
              )}
            </div>
            {hasNew ? (
              <button type="button" className="beego-call-stage__new" onClick={jumpToLatest}>
                Có câu mới
              </button>
            ) : null}
          </aside>
        </section>
        <p className="beego-call-stage__status" aria-live="polite">
          {notice || micError || statusLabel}
        </p>
        <nav className="beego-call-stage__controls" aria-label="Điều khiển cuộc gọi">
          <button type="button" className="beego-call-stage__side" onClick={replay} disabled={replayDisabled} aria-label="Nghe lại câu gia sư">
            ↺
          </button>
          <button type="button" className={`beego-call-stage__speak${phase === "listening" ? " is-listening" : ""}`} onClick={onPrimary} disabled={speakDisabled}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15a4 4 0 0 0 4-4V5a4 4 0 0 0-8 0v6a4 4 0 0 0 4 4zm-7-4h2a5 5 0 0 0 10 0h2a7 7 0 0 1-6 6.93V21h3v2H8v-2h3v-3.07A7 7 0 0 1 5 11z" />
            </svg>
            <span>{phase === "mic" ? "CHO PHÉP MICRO" : speakLabel}</span>
          </button>
          <button
            ref={ccButtonRef}
            type="button"
            className="beego-call-stage__side beego-call-stage__cc"
            aria-pressed={ccOpen}
            aria-controls={sheetId}
            aria-label="Phụ đề hội thoại"
            onClick={() => (ccOpen ? closeCc() : setCcOpen(true))}
          >
            CC
          </button>
        </nav>
        {ended ? (
          <section className="beego-call-stage__summary" aria-label="Tổng kết phiên">
            <p className="beego-call-stage__kicker">BEEGO · GIA SƯ AI · MỨC 1</p>
            <h1>
              {phase === "error"
                ? "Cuộc gọi dừng vì lỗi"
                : practiced
                  ? "Bạn đã luyện nói hôm nay!"
                  : "Chưa có câu nào được ghi nhận"}
            </h1>
            <p>{notice || "Kết quả bài học không đổi."}</p>
            {!practiced && phase !== "error" ? <p>Lần sau hãy nhấn nút nói và trả lời gia sư một câu ngắn.</p> : null}
            {!serverSummary ? <p className="beego-call-stage__note">Chưa nhận tổng kết từ server; số liệu dưới đây lấy từ phiên trên máy.</p> : null}
            <div className="beego-call-stage__stats">
              <div>
                <strong>{Number.isFinite(serverSummary?.durationSeconds) ? `${serverSummary.durationSeconds}s` : "—"}</strong>
                Thời lượng (server)
              </div>
              <div>
                <strong>{learnerTurns}</strong>
                Lượt bạn nói
              </div>
            </div>
            <ul className="beego-call-stage__playback" aria-label="Câu của gia sư">
              <li>Đã phát hết: {tutorCount("complete")}</li>
              <li>Bị ngắt khi đang phát: {tutorCount("interrupted")}</li>
              <li>Hủy trước khi phát: {tutorCount("cancelled")}</li>
              <li>Chưa xác nhận: {tutorCount("pending")}</li>
            </ul>
            <p>Phát âm: Chưa đánh giá</p>
            {Number.isFinite(Number(packageLeft)) ? <p>Còn lại theo gói, từ server: {Math.max(0, Math.round(Number(packageLeft) / 1000))} giây</p> : null}
            {summaryTurns.length ? (
              <ol className="beego-call-stage__recap" aria-label="Đoạn hội thoại của phiên">
                {summaryTurns.map((turn) => {
                  const badge = turnBadge(turn, true);
                  return (
                    <li key={turn.key} className={turn.role === "user" ? "is-user" : ""}>
                      <small>
                        {turn.role === "user" ? "BẠN" : "GIA SƯ BEEGO"}
                        {badge ? ` · ${badge}` : ""}
                      </small>
                      <span>{turn.text}</span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
            <button ref={leaveRef} type="button" className="beego-call-stage__leave" onClick={onClose}>
              {returnLabel}
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
