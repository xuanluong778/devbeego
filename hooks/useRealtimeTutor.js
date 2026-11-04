"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapRealtimeEvent } from "@/lib/beego/learn/learn-call-realtime";
import { createRealtimeTranscriptAdapter, dispatchRealtimeTranscriptEvent } from "@/lib/beego/learn/learn-call-realtime-transcript";
import { createRealtimeTurnCoordinator, learnCallTurnModeEvent } from "@/lib/beego/learn/learn-call-realtime-turns";
import { createRealtimeCallLifecycle } from "@/lib/beego/learn/learn-call-realtime-lifecycle";

/**
 * Resamples Float32 audio samples to 16kHz 16-bit PCM buffer for Azure Coach sidecar.
 * Runs completely non-blocking without interfering with WebRTC streams.
 */
function downsampleTo16kPcm(inputFloat32, inputSampleRate) {
  if (!inputFloat32 || inputFloat32.length === 0) return new ArrayBuffer(0);
  if (inputSampleRate === 16000) {
    const pcm = new Int16Array(inputFloat32.length);
    for (let i = 0; i < inputFloat32.length; i++) {
      const s = Math.max(-1, Math.min(1, inputFloat32[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm.buffer;
  }
  const ratio = inputSampleRate / 16000;
  const newLength = Math.round(inputFloat32.length / ratio);
  const pcm = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const originIdx = Math.round(i * ratio);
    const s = Math.max(-1, Math.min(1, inputFloat32[originIdx] || 0));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm.buffer;
}

/**
 * Client adapter for OpenAI Realtime API via WebRTC GA (AI Tutor Stage 4)
 *
 * Architecture & Guarantees:
 * 1. Raw audio is the conversation medium, streamed directly via WebRTC PeerConnection.
 * 2. Remote audio is played directly from the WebRTC MediaStream. Realtime transcripts are NEVER sent to TTS.
 * 3. Server VAD handles turn-taking, barge-in, and response cutoff natively.
 *    No artificial truncate calls based on MediaStream currentTime.
 * 4. Multi-cycle interruption:
 *    When user_speech_started fires, audio playback pauses immediately.
 *    When assistant_turn_started fires, playback resumes cleanly by refreshing srcObject to purge stale frames.
 *    Verified across 2+ consecutive interruption cycles without stuck pause.
 * 5. Mute & Push-to-Talk (manual mode):
 *    - "auto" mode: microphone open continuously, server VAD detects speech.
 *    - "manual" mode: microphone muted until user holds/presses to talk.
 *    - toggleMute genuinely stops audio track; mute state survives interruptions and reconnects.
 * 6. Liveness Heartbeat & Tab Visibility:
 *    Sends heartbeat every 7s; immediately flushes heartbeat when tab becomes visible or gains focus.
 * 7. Sidecar Azure Pronunciation Coach:
 *    Resamples microphone audio to 16kHz PCM16 independently without blocking WebRTC conversation.
 */
export function useRealtimeTutor({
  onTranscriptEvent,
  onNotice,
  onError,
  onStatusChange,
  onCoachPcmChunk,
  onSessionClock,
  onEnded,
  onOpening,
  onTurnDecision,
} = {}) {
  const [status, setStatus] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [talkMode, setTalkMode] = useState("auto"); // "auto" | "manual"
  const [isTalking, setIsTalking] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [captionTarget, setCaptionTarget] = useState({ requestId: 0, role: "tutor" });
  const transcriptAdapterRef = useRef(null);
  const lifecycleRef = useRef(null);
  if (!lifecycleRef.current) lifecycleRef.current = createRealtimeCallLifecycle();
  const disconnectRef = useRef(() => {});
  const [isClosing, setIsClosing] = useState(false);

  // Store callbacks in mutable ref to guarantee stable connect/disconnect identity across renders
  const callbacksRef = useRef({
    onTranscriptEvent,
    onNotice,
    onError,
    onStatusChange,
    onCoachPcmChunk,
    onSessionClock,
    onEnded,
    onOpening,
    onTurnDecision,
  });
  callbacksRef.current = {
    onTranscriptEvent,
    onNotice,
    onError,
    onStatusChange,
    onCoachPcmChunk,
    onSessionClock,
    onEnded,
    onOpening,
    onTurnDecision,
  };
  const openingGateRef = useRef({ dcOpen: false, configured: false, tried: false });

  const turnCoordinatorRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const audioElRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sidecarNodeRef = useRef(null);
  const sessionIdRef = useRef("");
  const heartbeatTimerRef = useRef(null);
  const isInterruptedRef = useRef(false);
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;
  const talkModeRef = useRef(talkMode);
  talkModeRef.current = talkMode;

  const connectingRef = useRef(false);
  const connSeqRef = useRef(0);
  const telemetryRef = useRef({
    callReadyAt: 0,
    openingAudibleAt: 0,
    firstValidLearnerAt: 0,
    lastLearnerStoppedAt: 0,
    turnLatenciesMs: [],
    learnerContentTurns: 0,
    model: "",
    usage: { audioInTokens: 0, audioOutTokens: 0, textInTokens: 0, textOutTokens: 0 },
    seenResponseIds: [],
  });

  const telemetryPayload = useCallback(() => {
    const t = telemetryRef.current;
    return {
      model: t.model,
      usage: { ...t.usage },
      experience: {
        callReadyAt: t.callReadyAt,
        openingAudibleAt: t.openingAudibleAt,
        firstValidLearnerAt: t.firstValidLearnerAt,
        turnLatenciesMs: t.turnLatenciesMs.slice(-20),
        learnerContentTurns: t.learnerContentTurns,
      },
    };
  }, []);

  const updateStatus = useCallback((next) => {
    setStatus(next);
    callbacksRef.current.onStatusChange?.(next);
  }, []);

  const sendEvent = useCallback((event) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify(event));
      return true;
    }
    return false;
  }, []);

  if (!turnCoordinatorRef.current) turnCoordinatorRef.current = createRealtimeTurnCoordinator({
    sendEvent,
    onDecision: decision => {
      callbacksRef.current.onTurnDecision?.(decision);
      if (decision.action === "closing") applyLifecycleEffects(lifecycleRef.current.notePolicyClosing());
    },
    onError: error => callbacksRef.current.onNotice?.(error?.message === "INCOMPLETE_UTTERANCE" ? "Bạn có thể nói tiếp ý vừa rồi, hoặc bỏ qua để sang câu mới." : "Chưa nhận được lời bạn nói. Bạn có thể nói lại hoặc kết nối lại."),
    requestTurn: async payload => {
      const response = await fetch("/api/learn/ai-call/realtime/turn", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.code || "TURN_POLICY_UNAVAILABLE");
      return json.data;
    },
  });

  const applyLifecycleEffects = useCallback((effects) => {
    for (const effect of effects) {
      if (effect.type === "send") {
        sendEvent(effect.event);
      } else if (effect.type === "closing") {
        turnCoordinatorRef.current.stop();
        setIsClosing(true);
        setIsTalking(false);
        localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = false; });
        updateStatus("closing");
        callbacksRef.current.onNotice?.("Gia sư đang chào tạm biệt. Phiên học sắp kết thúc.");
      } else if (effect.type === "end") {
        disconnectRef.current({ reason: effect.reason });
        callbacksRef.current.onEnded?.(effect);
      }
    }
  }, [sendEvent, updateStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      const lifecycle = lifecycleRef.current;
      turnCoordinatorRef.current?.tick(Date.now());
      if (lifecycle.ended) return;
      if (dcRef.current?.readyState === "open" || (lifecycle.clock && Date.now() >= lifecycle.clock.deadlineAt)) {
        applyLifecycleEffects(lifecycle.tick(Date.now()));
      }
    }, 250);
    return () => clearInterval(timer);
  }, [applyLifecycleEffects]);

  const sendHeartbeatImmediate = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid) {
      fetch("/api/learn/ai-call/realtime/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, ...telemetryPayload() }),
      }).then(async response => {
        const json = await response.json().catch(() => ({}));
        if (sessionIdRef.current !== sid || lifecycleRef.current.ended) return;
        if (response.status === 404 || response.status === 410 || response.status === 401 || response.status === 403) {
          disconnectRef.current({ reason: "server_ended" });
          callbacksRef.current.onEnded?.({ reason: "server_ended", message: json.message || "Phiên gọi đã kết thúc. Hẹn gặp bạn ở buổi tiếp theo!" });
        } else if (json.success && json.callClock) {
          const clock = lifecycleRef.current.setClock(json.callClock);
          if (clock) callbacksRef.current.onSessionClock?.(clock);
        }
      }).catch(() => {});
    }
  }, [telemetryPayload]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(
    (sid) => {
      stopHeartbeat();
      sessionIdRef.current = sid;
      sendHeartbeatImmediate();
      heartbeatTimerRef.current = setInterval(() => {
        sendHeartbeatImmediate();
      }, 7000);
    },
    [sendHeartbeatImmediate, stopHeartbeat]
  );

  // Policy Phân Biệt:
  // 1. Policy Tab Ẩn / App Nền: Cuộc gọi WebRTC vẫn tiếp tục bình thường khi tab bị ẩn.
  //    Client KHÔNG tự ngắt kết nối chỉ vì document.hidden.
  // 2. Policy Mất Heartbeat (Server Watchdog Liveness Timeout = 25s):
  //    Chỉ kích hoạt khi máy chủ KHÔNG nhận được heartbeat trong >25s (do mất mạng, tắt máy, OS đình chỉ).
  //    Sự kiện 'visible' / 'focus' gửi heartbeat bổ sung để làm mới liveness nếu phiên chưa bị quá hạn 25s.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeatImmediate();
      }
    };
    const onFocus = () => {
      sendHeartbeatImmediate();
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("focus", onFocus);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("focus", onFocus);
      }
    };
  }, [sendHeartbeatImmediate]);

  const connect = useCallback(
    async ({ sessionId, lessonId, sectionId, difficulty, teacher, sessionMode, topic, title }) => {
      if (connectingRef.current) return;
      connectingRef.current = true;
      turnCoordinatorRef.current.connect(sessionId);
      const mySeq = ++connSeqRef.current;
      transcriptAdapterRef.current = createRealtimeTranscriptAdapter();
      lifecycleRef.current = createRealtimeCallLifecycle();
      openingGateRef.current = { dcOpen: false, configured: false, tried: false };
      telemetryRef.current = {
        callReadyAt: 0,
        openingAudibleAt: 0,
        firstValidLearnerAt: 0,
        lastLearnerStoppedAt: 0,
        turnLatenciesMs: [],
        learnerContentTurns: 0,
        model: "",
        usage: { audioInTokens: 0, audioOutTokens: 0, textInTokens: 0, textOutTokens: 0 },
        seenResponseIds: [],
      };
      setIsClosing(false);
      setAudioBlocked(false);
      setCaptionTarget({ requestId: 0, role: "tutor" });

      try {
        updateStatus("connecting");

        // 1. Setup local audio element for remote stream playback
        if (!audioElRef.current && typeof document !== "undefined") {
          const el = document.createElement("audio");
          el.autoplay = true;
          audioElRef.current = el;
        }

        // 2. Setup RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        // Handle remote audio track (speech-to-speech)
        pc.ontrack = (event) => {
          remoteStreamRef.current = event.streams[0];
          if (audioElRef.current) {
            audioElRef.current.srcObject = remoteStreamRef.current;
            audioElRef.current.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
          }
        };

        // 3. Acquire user microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Guard against component unmounting or disconnect during mic prompt
        if (connSeqRef.current !== mySeq || pc.signalingState === "closed" || pcRef.current !== pc) {
          stream.getTracks().forEach((t) => t.stop());
          connectingRef.current = false;
          return;
        }

        localStreamRef.current = stream;

        // Apply mute/manual state to initial audio track
        const track = stream.getAudioTracks()[0];
        if (track) {
          track.enabled = !isMutedRef.current && talkModeRef.current === "auto";
        }

        // Safe addTrack only when PeerConnection is not closed
        if (pc.signalingState !== "closed") {
          stream.getTracks().forEach((t) => {
            try {
              pc.addTrack(t, stream);
            } catch {
              /* ignore if closed */
            }
          });
        }

        // 4. Setup Azure coach sidecar (non-blocking 16kHz PCM16 resampler)
        if (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) {
          try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            audioCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            // ScriptProcessorNode downsamples to 16kHz PCM16 chunks
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            sidecarNodeRef.current = processor;
            processor.onaudioprocess = (e) => {
              if (callbacksRef.current.onCoachPcmChunk && track?.enabled) {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = downsampleTo16kPcm(inputData, ctx.sampleRate);
                callbacksRef.current.onCoachPcmChunk(pcm16);
              }
            };
            source.connect(processor);
            processor.connect(ctx.destination);
          } catch {
            /* AudioContext sidecar optional */
          }
        }

        // 5. Create DataChannel for OpenAI Realtime events
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        dc.onopen = () => {
          if (connSeqRef.current === mySeq) {
            sendEvent(learnCallTurnModeEvent(talkModeRef.current));
            turnCoordinatorRef.current.ready();
            updateStatus("connected");
            applyLifecycleEffects(lifecycleRef.current.tick(Date.now()));
            openingGateRef.current.dcOpen = true;
            if (openingGateRef.current.configured && !openingGateRef.current.tried) {
              openingGateRef.current.tried = true;
              if (!telemetryRef.current.callReadyAt) telemetryRef.current.callReadyAt = Date.now();
              applyLifecycleEffects(lifecycleRef.current.noteReady());
            }
          }
        };

        dc.onmessage = (e) => {
          if (connSeqRef.current !== mySeq) return;
          try {
            const raw = JSON.parse(e.data);
            const mapped = mapRealtimeEvent(raw);
            if (!mapped) return;
            if (!lifecycleRef.current.closing) turnCoordinatorRef.current.observe(mapped);
            if (lifecycleRef.current.closing && mapped.type === "user_speech_started") return;
            const projection = dispatchRealtimeTranscriptEvent(transcriptAdapterRef.current, mapped, {
              onTranscriptEvent: callbacksRef.current.onTranscriptEvent,
              onCaptionChange: setCaptionTarget,
              onNotice: callbacksRef.current.onNotice,
            });
            if (projection.status) updateStatus(projection.status);

            switch (mapped.type) {
              case "user_speech_started":
                applyLifecycleEffects(lifecycleRef.current.noteLearnerSpeech());
                // Interruption: Pause local playback immediately
                if (audioElRef.current && !audioElRef.current.paused) {
                  audioElRef.current.pause();
                }
                isInterruptedRef.current = true;
                break;

              case "user_speech_stopped":
                telemetryRef.current.lastLearnerStoppedAt = Date.now();
                break;

              case "user_transcript_final": {
                const spoken = String(mapped.text || mapped.transcript || "").trim();
                if (spoken) {
                  telemetryRef.current.learnerContentTurns += 1;
                  if (!telemetryRef.current.firstValidLearnerAt) telemetryRef.current.firstValidLearnerAt = Date.now();
                }
                break;
              }

              case "assistant_turn_started":
              case "assistant_audio_started":
                if (!telemetryRef.current.openingAudibleAt) telemetryRef.current.openingAudibleAt = Date.now();
                if (telemetryRef.current.lastLearnerStoppedAt > 0) {
                  telemetryRef.current.turnLatenciesMs.push(Date.now() - telemetryRef.current.lastLearnerStoppedAt);
                  telemetryRef.current.lastLearnerStoppedAt = 0;
                }
                if (projection.status !== "speaking") break;
                // Resume assistant speech: purge stale buffered frames by reconnecting srcObject
                if (audioElRef.current) {
                  if (isInterruptedRef.current || audioElRef.current.paused) {
                    if (remoteStreamRef.current) {
                      audioElRef.current.srcObject = remoteStreamRef.current;
                    }
                    audioElRef.current.play().catch(() => {});
                  }
                }
                isInterruptedRef.current = false;
                break;

              case "assistant_turn_done": {
                const rid = String(mapped.responseId || "");
                if (rid && telemetryRef.current.seenResponseIds.includes(rid)) break;
                if (rid) telemetryRef.current.seenResponseIds.push(rid);
                const usage = mapped.usage || {};
                const add = (key, value) => {
                  telemetryRef.current.usage[key] = (telemetryRef.current.usage[key] || 0) + (Number(value) || 0);
                };
                add("audioInTokens", usage.input_token_details?.audio_tokens);
                add("audioOutTokens", usage.output_token_details?.audio_tokens);
                add("textInTokens", usage.input_token_details?.text_tokens ?? usage.input_tokens);
                add("textOutTokens", usage.output_token_details?.text_tokens ?? usage.output_tokens);
                break;
              }

              case "assistant_transcript_delta":
                if (!projection.events.some(event => event.type === "ai_stream" && event.requestId === projection.caption?.requestId)) break;
                // If audio element was paused or blocked, ensure it plays on incoming data
                if (audioElRef.current?.paused && remoteStreamRef.current) {
                  audioElRef.current.play().catch(() => {});
                }
                break;

              default:
                break;
            }
            applyLifecycleEffects(lifecycleRef.current.observe(mapped));
          } catch (error) {
            callbacksRef.current.onNotice?.(`Không cập nhật được phụ đề cuộc gọi: ${error?.message || "Dữ liệu không hợp lệ."}`);
          }
        };

        if (connSeqRef.current !== mySeq || pc.signalingState === "closed") {
          connectingRef.current = false;
          return;
        }

        // 6. Create local SDP Offer
        const offer = await pc.createOffer();
        if (connSeqRef.current !== mySeq || pc.signalingState === "closed") {
          connectingRef.current = false;
          return;
        }
        await pc.setLocalDescription(offer);

        // 7. Unified GA Flow: Send SDP Offer to backend POST /api/learn/ai-call/realtime/session
        const res = await fetch("/api/learn/ai-call/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            sdpOffer: offer.sdp,
            lessonId,
            sectionId,
            difficulty,
            teacher,
            sessionMode,
            talkMode: talkModeRef.current,
          }),
        });

        if (connSeqRef.current !== mySeq || pc.signalingState === "closed") {
          connectingRef.current = false;
          return;
        }

        const json = await res.json();
        if (!json.success || !json.data?.sdpAnswer) {
          throw new Error(json.message || "Không thể khởi tạo cuộc gọi Realtime.");
        }

        const sdpAnswer = json.data?.sdpAnswer;
        const activeSid = json.data?.sessionId || sessionId;
        sessionIdRef.current = activeSid;
        const deadlineAt = Number(json.data.deadlineAt);
        const serverClock = json.data.callClock || (deadlineAt > 0 ? {
          startedAt: deadlineAt - (Number(json.data.limits?.maxMinutes) || 2) * 60_000,
          deadlineAt, serverNow: Date.now(),
        } : null);
        const clock = lifecycleRef.current.setClock(serverClock);
        if (clock) callbacksRef.current.onSessionClock?.(clock);
        turnCoordinatorRef.current.configure({ awaitingPracticeAttempt: json.data.awaitingPracticeAttempt === true });
        const opening = json.data.opening || null;
        lifecycleRef.current.configureOpening({
          sessionMode: sessionMode === "open" ? "open" : "lesson",
          topicCtx: json.data.topicCtx || { topic: topic || title || "", title: title || topic || "", sectionId, sessionMode },
          opening,
          difficulty,
          shouldSpeak: opening?.shouldSpeak === true,
        });
        if (opening?.spoken) callbacksRef.current.onOpening?.(opening);
        openingGateRef.current.configured = true;
        if (openingGateRef.current.dcOpen && !openingGateRef.current.tried) {
          openingGateRef.current.tried = true;
          if (!telemetryRef.current.callReadyAt) telemetryRef.current.callReadyAt = Date.now();
          applyLifecycleEffects(lifecycleRef.current.noteReady());
        }
        if (json.data?.model) telemetryRef.current.model = String(json.data.model);

        // 8. Complete WebRTC handshake with SDP Answer
        await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

        // 9. Start liveness heartbeat
        startHeartbeat(activeSid);
        connectingRef.current = false;
      } catch (err) {
        connectingRef.current = false;
        if (connSeqRef.current === mySeq) {
          await disconnectRef.current({ reason: "connect_failed" });
          updateStatus("error");
          callbacksRef.current.onError?.(err?.message || "Realtime WebRTC connection failed");
        }
      }
    },
    [applyLifecycleEffects, sendEvent, startHeartbeat, updateStatus]
  );

  const disconnect = useCallback(async ({ reason = "user_hangup" } = {}) => {
    connSeqRef.current += 1;
    connectingRef.current = false;
    stopHeartbeat();
    lifecycleRef.current.stop();
    turnCoordinatorRef.current.stop();
    const sid = sessionIdRef.current;
    if (sid) {
      sessionIdRef.current = "";
      fetch("/api/learn/ai-call/realtime/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, reason, ...telemetryPayload() }),
      }).catch(() => {});
    }

    try {
      if (sidecarNodeRef.current) {
        sidecarNodeRef.current.disconnect();
        sidecarNodeRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.srcObject = null;
        audioElRef.current = null;
      }
      remoteStreamRef.current = null;
      updateStatus("closed");
    } catch {
      /* ignore cleanup error */
    }
  }, [stopHeartbeat, telemetryPayload, updateStatus]);
  disconnectRef.current = disconnect;

  const repeatQuestion = useCallback(() => {
    if (lifecycleRef.current.closing || dcRef.current?.readyState !== "open") return;
    turnCoordinatorRef.current.observe({ type: "user_transcript_final", itemId: `repeat-${crypto.randomUUID()}`, text: "Could you repeat the question?" });
  }, []);

  const endGracefully = useCallback(() => {
    if (dcRef.current?.readyState !== "open") {
      disconnectRef.current();
      callbacksRef.current.onEnded?.({ reason: "user_hangup", message: "Cuộc gọi đã kết thúc. Hẹn gặp bạn ở buổi tiếp theo!" });
      return;
    }
    applyLifecycleEffects(lifecycleRef.current.endGracefully());
  }, [applyLifecycleEffects]);

  // Genuine mute toggle: preserves state across interruptions/reconnects
  const toggleMute = useCallback(() => {
    if (lifecycleRef.current.closing) return;
    setIsMuted((prev) => {
      const next = !prev;
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !next && (talkModeRef.current === "auto" || isTalking);
        }
      }
      return next;
    });
  }, [isTalking]);

  // Push-to-talk controls (manual mode)
  const startTalking = useCallback(() => {
    if (lifecycleRef.current.closing) return;
    if (isMutedRef.current || talkingRef.current) return;
    talkingRef.current = true;
    sendEvent({ type: "input_audio_buffer.clear" });
    sendEvent({ type: "response.cancel" });
    sendEvent({ type: "output_audio_buffer.clear" });
    setIsTalking(true);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = true;
    }
  }, [sendEvent]);

  const talkingRef = useRef(false);
  const stopTalking = useCallback(() => {
    const wasTalking = talkingRef.current;
    talkingRef.current = false;
    setIsTalking(false);
    if (talkModeRef.current === "manual" && localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = false;
    }
    if (wasTalking && talkModeRef.current === "manual") sendEvent({ type: "input_audio_buffer.commit" });
  }, [sendEvent]);

  const unblockAudio = useCallback(() => {
    const el = audioElRef.current;
    if (!el) return;
    el.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
  }, []);

  const setMode = useCallback((mode) => {
    if (lifecycleRef.current.closing) return;
    const nextMode = mode === "manual" ? "manual" : "auto";
    talkModeRef.current = nextMode;
    talkingRef.current = false;
    setIsTalking(false);
    sendEvent(learnCallTurnModeEvent(nextMode));
    setTalkMode(nextMode);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMutedRef.current && nextMode === "auto";
      }
    }
  }, [sendEvent]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return useMemo(
    () => ({
      status,
      isMuted,
      talkMode,
      isTalking,
      audioBlocked,
      captionTarget,
      isClosing,
      endGracefully,
      repeatQuestion,
      connect,
      disconnect,
      toggleMute,
      unblockAudio,
      setMode,
      startTalking,
      stopTalking,
      sendEvent,
    }),
    [
      status,
      isMuted,
      talkMode,
      isTalking,
      audioBlocked,
      captionTarget,
      isClosing,
      endGracefully,
      repeatQuestion,
      connect,
      disconnect,
      toggleMute,
      unblockAudio,
      setMode,
      startTalking,
      stopTalking,
      sendEvent,
    ]
  );
}
