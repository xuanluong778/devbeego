"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { learnCallEventIsCurrent } from "@/lib/beego/learn/ai-call-access";

/**
 * WebSocket: JSON control + binary PCM uplink + binary TTS downlink (0x02 + pcm_s16le).
 * Protocol: partial_transcript, final_transcript, ai_stream, ai_done, interrupt, tts_end (see voice-ws-server.mjs header).
 */
export function useVoiceWebSocket(initialUrl) {
  const [readyState, setReadyState] = useState("idle"); // idle | connecting | open | closed | error
  const [lastError, setLastError] = useState("");
  const [closeInfo, setCloseInfo] = useState({ code: 0, reason: "" });
  const urlRef = useRef(initialUrl || "");
  const lastUrlRef = useRef(initialUrl || "");
  const wsRef = useRef(null);
  const socketGenRef = useRef(0);
  const onJsonRef = useRef(null);
  const onBinaryRef = useRef(null);

  const setOnJsonMessage = useCallback((fn) => {
    onJsonRef.current = fn;
  }, []);

  const setOnBinaryMessage = useCallback((fn) => {
    onBinaryRef.current = fn;
  }, []);

  const disconnect = useCallback(() => {
    socketGenRef.current += 1;
    const w = wsRef.current;
    wsRef.current = null;
    if (w && (w.readyState === WebSocket.OPEN || w.readyState === WebSocket.CONNECTING)) {
      try {
        w.close(1000, "client");
      } catch (_e) {}
    }
    setReadyState("closed");
    setCloseInfo({ code: 1000, reason: "client" });
  }, []);

  const connect = useCallback((urlOverride) => {
    const url = String(urlOverride || urlRef.current || "").trim();
    if (!url || typeof window === "undefined") return;
    const gen = (socketGenRef.current += 1);
    urlRef.current = url;
    // Close any existing socket without polluting UI with "WS closed: 1000 (client)".
    const prev = wsRef.current;
    wsRef.current = null;
    if (prev && (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING)) {
      try {
        prev.close(1000, "reconnect");
      } catch (_e) {}
    }
    setLastError("");
    setCloseInfo({ code: 0, reason: "" });
    setReadyState("connecting");
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      setLastError(e?.message || "WebSocket failed");
      setReadyState("error");
      return;
    }
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    lastUrlRef.current = url;

    ws.onopen = () => {
      if (!learnCallEventIsCurrent(gen, socketGenRef.current)) return;
      setReadyState("open");
    };

    ws.onmessage = async (ev) => {
      if (!learnCallEventIsCurrent(gen, socketGenRef.current)) return;
      if (typeof ev.data === "string") {
        try {
          const obj = JSON.parse(ev.data);
          onJsonRef.current?.(obj);
        } catch (_e) {}
        return;
      }
      let ab = ev.data;
      if (ev.data instanceof Blob) {
        ab = await ev.data.arrayBuffer();
      }
      if (ab instanceof ArrayBuffer) {
        onBinaryRef.current?.(ab);
      }
    };

    ws.onerror = () => {
      if (!learnCallEventIsCurrent(gen, socketGenRef.current)) return;
      setLastError("WebSocket error. Is the voice server running?");
      setReadyState("error");
    };

    ws.onclose = (ev) => {
      if (!learnCallEventIsCurrent(gen, socketGenRef.current)) return;
      if (wsRef.current === ws) wsRef.current = null;
      setCloseInfo({ code: ev?.code || 0, reason: ev?.reason || "" });
      setReadyState((s) => (s === "error" ? "error" : "closed"));
    };
  }, [disconnect]);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  const sendJson = useCallback((obj) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return false;
    try {
      w.send(JSON.stringify(obj));
      return true;
    } catch (_e) {
      return false;
    }
  }, []);

  const sendBinary = useCallback((bufferSource) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return false;
    try {
      if (bufferSource instanceof ArrayBuffer) {
        w.send(bufferSource);
        return true;
      }
      if (bufferSource instanceof Uint8Array) {
        const u8 =
          bufferSource.byteOffset === 0 && bufferSource.byteLength === bufferSource.buffer.byteLength
            ? bufferSource
            : new Uint8Array(bufferSource.buffer, bufferSource.byteOffset, bufferSource.byteLength);
        w.send(u8);
        return true;
      }
      return false;
    } catch (_e) {
      return false;
    }
  }, []);

  return {
    readyState,
    lastError,
    closeInfo,
    connect,
    disconnect,
    sendJson,
    sendBinary,
    setOnJsonMessage,
    setOnBinaryMessage,
    isOpen: readyState === "open",
  };
}
