"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mapRealtimeEvent } from "@/lib/beego/learn/learn-call-realtime";

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
  onTranscriptDelta,
  onUserTranscript,
  onAssistantDone,
  onError,
  onStatusChange,
  onCoachPcmChunk,
} = {}) {
  const [status, setStatus] = useState("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [talkMode, setTalkMode] = useState("auto"); // "auto" | "manual"
  const [isTalking, setIsTalking] = useState(false);

  // Store callbacks in mutable ref to guarantee stable connect/disconnect identity across renders
  const callbacksRef = useRef({
    onTranscriptDelta,
    onUserTranscript,
    onAssistantDone,
    onError,
    onStatusChange,
    onCoachPcmChunk,
  });
  callbacksRef.current = {
    onTranscriptDelta,
    onUserTranscript,
    onAssistantDone,
    onError,
    onStatusChange,
    onCoachPcmChunk,
  };

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

  const updateStatus = useCallback((next) => {
    setStatus(next);
    callbacksRef.current.onStatusChange?.(next);
  }, []);

  const sendEvent = useCallback((event) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify(event));
    }
  }, []);

  const sendHeartbeatImmediate = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid) {
      fetch("/api/learn/ai-call/realtime/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      }).catch(() => {});
    }
  }, []);

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
    async ({ sessionId, lessonId, sectionId, difficulty, teacher, sessionMode }) => {
      if (connectingRef.current) return;
      connectingRef.current = true;
      const mySeq = ++connSeqRef.current;

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
            audioElRef.current.play().catch(() => {});
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
            updateStatus("connected");
          }
        };

        dc.onmessage = (e) => {
          try {
            const raw = JSON.parse(e.data);
            const mapped = mapRealtimeEvent(raw);
            if (!mapped) return;

            switch (mapped.type) {
              case "user_speech_started":
                // Interruption: Pause local playback immediately
                if (audioElRef.current && !audioElRef.current.paused) {
                  audioElRef.current.pause();
                }
                isInterruptedRef.current = true;
                updateStatus("listening");
                break;

              case "assistant_turn_started":
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
                updateStatus("speaking");
                break;

              case "assistant_transcript_delta":
                // If audio element was paused or blocked, ensure it plays on incoming data
                if (audioElRef.current?.paused && remoteStreamRef.current) {
                  audioElRef.current.play().catch(() => {});
                }
                callbacksRef.current.onTranscriptDelta?.(mapped.delta);
                break;

              case "user_transcript_final":
                callbacksRef.current.onUserTranscript?.(mapped.text);
                break;

              case "assistant_turn_done":
                updateStatus("connected");
                callbacksRef.current.onAssistantDone?.(mapped);
                break;

              default:
                break;
            }
          } catch {
            /* ignore malformed frame */
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

        // 8. Complete WebRTC handshake with SDP Answer
        await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

        // 9. Start liveness heartbeat
        startHeartbeat(activeSid);
        connectingRef.current = false;
      } catch (err) {
        connectingRef.current = false;
        if (connSeqRef.current === mySeq) {
          updateStatus("error");
          callbacksRef.current.onError?.(err?.message || "Realtime WebRTC connection failed");
        }
      }
    },
    [startHeartbeat, updateStatus]
  );

  const disconnect = useCallback(async () => {
    connSeqRef.current += 1;
    connectingRef.current = false;
    stopHeartbeat();
    const sid = sessionIdRef.current;
    if (sid) {
      sessionIdRef.current = "";
      fetch("/api/learn/ai-call/realtime/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, reason: "user_hangup" }),
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
  }, [stopHeartbeat, updateStatus]);

  // Genuine mute toggle: preserves state across interruptions/reconnects
  const toggleMute = useCallback(() => {
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
    if (isMutedRef.current) return;
    setIsTalking(true);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = true;
    }
  }, []);

  const stopTalking = useCallback(() => {
    setIsTalking(false);
    if (talkModeRef.current === "manual" && localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = false;
    }
  }, []);

  const setMode = useCallback((mode) => {
    const nextMode = mode === "manual" ? "manual" : "auto";
    setTalkMode(nextMode);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMutedRef.current && nextMode === "auto";
      }
    }
  }, []);

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
      connect,
      disconnect,
      toggleMute,
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
      connect,
      disconnect,
      toggleMute,
      setMode,
      startTalking,
      stopTalking,
      sendEvent,
    ]
  );
}
