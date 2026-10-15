"use client";

import { useCallback, useRef, useState } from "react";

const TARGET_RATE = 16000;

/**
 * getUserMedia + AudioWorklet (PCM 16kHz s16le) + RTCPeerConnection addTrack.
 * @param {{ onPcmChunk: (u8: Uint8Array, meta: { rms: number }) => void }} opts
 */
export function useVoiceRecorder({ onPcmChunk } = {}) {
  const [micError, setMicError] = useState("");
  const [hasStream, setHasStream] = useState(false);
  const streamRef = useRef(null);
  const pcRef = useRef(null);
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const sourceRef = useRef(null);
  const chunkCbRef = useRef(onPcmChunk);
  chunkCbRef.current = onPcmChunk;

  const stopPipeline = useCallback(() => {
    try {
      workletNodeRef.current?.port?.close?.();
    } catch (_e) {}
    try {
      workletNodeRef.current?.disconnect?.();
    } catch (_e2) {}
    workletNodeRef.current = null;
    try {
      sourceRef.current?.disconnect?.();
    } catch (_e3) {}
    sourceRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => {});
    }
  }, []);

  const setMicEnabled = useCallback((enabled) => {
    try {
      streamRef.current?.getAudioTracks?.().forEach((t) => {
        t.enabled = Boolean(enabled);
      });
    } catch (_e) {
      /* ignore */
    }
  }, []);

  const stopMic = useCallback(() => {
    stopPipeline();
    try {
      streamRef.current?.getTracks?.().forEach((t) => t.stop());
    } catch (_e) {}
    streamRef.current = null;
    try {
      pcRef.current?.close?.();
    } catch (_e) {}
    pcRef.current = null;
    setHasStream(false);
  }, [stopPipeline]);

  const ensureStream = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    setMicError("");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    streamRef.current = stream;
    setHasStream(true);

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
      pcRef.current = pc;
    } catch (_e) {
      /* optional */
    }

    return stream;
  }, []);

  const startPcmCapture = useCallback(async () => {
    await ensureStream();
    const stream = streamRef.current;
    if (!stream) return;

    stopPipeline();

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;

    const workletUrl = new URL("/audio-worklets/pcm-capture-processor.js", window.location.origin).href;
    await audioCtx.audioWorklet.addModule(workletUrl);

    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const node = new AudioWorkletNode(audioCtx, "pcm-capture-processor");
    workletNodeRef.current = node;

    node.port.onmessage = (ev) => {
      const { pcm, rms } = ev.data || {};
      if (pcm instanceof ArrayBuffer) {
        chunkCbRef.current?.(new Uint8Array(pcm), { rms: typeof rms === "number" ? rms : 0 });
      }
    };

    source.connect(node);
    // Không phát mic ra loa — tránh vọng âm/rè khi TTS đang phát.
    const silent = audioCtx.createGain();
    silent.gain.value = 0;
    node.connect(silent);
    silent.connect(audioCtx.destination);
  }, [ensureStream, stopPipeline]);

  const audioState = useCallback(() => {
    const state = audioCtxRef.current?.state;
    return state === "running" || state === "suspended" || state === "closed" ? state : "none";
  }, []);

  return {
    TARGET_RATE,
    micError,
    setMicError,
    hasStream,
    ensureStream,
    startPcmCapture,
    stopPcmCapture: stopPipeline,
    stopMic,
    setMicEnabled,
    audioState,
  };
}
