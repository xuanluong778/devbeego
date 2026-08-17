"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stopEnglishSpeech } from "@/lib/lessons/speak-english-client";

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function estimateTtsDuration(text, rate = 1) {
  const words = String(text || "").split(/\s+/).filter(Boolean).length;
  return Math.max(8, words / (2.4 * rate));
}

export { formatTime };

export function useListeningAudio({ audioUrl, ttsText, rate = 1 }) {
  const [status, setStatus] = useState("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef(null);
  const ttsTimerRef = useRef(null);
  const ttsStartedAtRef = useRef(0);
  const ttsPausedElapsedRef = useRef(0);
  const ttsDurationRef = useRef(0);
  const mountedRef = useRef(true);

  const clearTtsTimer = useCallback(() => {
    if (ttsTimerRef.current) {
      window.clearInterval(ttsTimerRef.current);
      ttsTimerRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    clearTtsTimer();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    stopEnglishSpeech();
    if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) {
        /* ignore */
      }
    }
  }, [clearTtsTimer]);

  const resetForClip = useCallback(() => {
    stopAll();
    setStatus("idle");
    setCurrentTime(0);
    ttsPausedElapsedRef.current = 0;
    ttsStartedAtRef.current = 0;

    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
      } else {
        audioRef.current.src = audioUrl;
      }
      audioRef.current.playbackRate = rate;
      const onMeta = () => {
        if (!mountedRef.current) return;
        setDuration(Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0);
      };
      const onTime = () => {
        if (!mountedRef.current) return;
        setCurrentTime(audioRef.current.currentTime || 0);
      };
      const onEnded = () => {
        if (!mountedRef.current) return;
        setStatus("ended");
        setCurrentTime(audioRef.current.duration || 0);
      };
      audioRef.current.addEventListener("loadedmetadata", onMeta);
      audioRef.current.addEventListener("timeupdate", onTime);
      audioRef.current.addEventListener("ended", onEnded);
      setDuration(0);
    } else {
      const est = estimateTtsDuration(ttsText, rate);
      ttsDurationRef.current = est;
      setDuration(est);
    }
  }, [audioUrl, ttsText, rate, stopAll]);

  useEffect(() => {
    mountedRef.current = true;
    resetForClip();
    return () => {
      mountedRef.current = false;
      stopAll();
    };
  }, [audioUrl, ttsText, resetForClip, stopAll]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    if (!audioUrl && ttsText) {
      const est = estimateTtsDuration(ttsText, rate);
      ttsDurationRef.current = est;
      setDuration(est);
    }
  }, [rate, audioUrl, ttsText]);

  const playTts = useCallback(() => {
    const text = String(ttsText || "").trim();
    if (!text || typeof window === "undefined") return;

    stopEnglishSpeech();
    try {
      window.speechSynthesis.cancel();
    } catch (_e) {
      /* ignore */
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = Math.max(0.6, Math.min(1.4, rate));

    ttsStartedAtRef.current = Date.now();
    setStatus("playing");

    u.onend = () => {
      if (!mountedRef.current) return;
      clearTtsTimer();
      setStatus("ended");
      setCurrentTime(ttsDurationRef.current);
    };
    u.onerror = () => {
      if (!mountedRef.current) return;
      clearTtsTimer();
      setStatus("ended");
    };

    try {
      window.speechSynthesis.speak(u);
    } catch (_err) {
      setStatus("idle");
      return;
    }

    clearTtsTimer();
    ttsTimerRef.current = window.setInterval(() => {
      if (!mountedRef.current) return;
      const elapsed =
        ttsPausedElapsedRef.current + (Date.now() - ttsStartedAtRef.current) / 1000;
      setCurrentTime(Math.min(elapsed, ttsDurationRef.current));
    }, 200);
  }, [ttsText, rate, clearTtsTimer]);

  const play = useCallback(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.playbackRate = rate;
      audioRef.current
        .play()
        .then(() => setStatus("playing"))
        .catch(() => setStatus("idle"));
      return;
    }
    playTts();
  }, [audioUrl, rate, playTts]);

  const pause = useCallback(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.pause();
      setStatus("paused");
      return;
    }
    if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
      try {
        window.speechSynthesis.pause();
      } catch (_e) {
        /* ignore */
      }
      clearTtsTimer();
      ttsPausedElapsedRef.current += (Date.now() - ttsStartedAtRef.current) / 1000;
      setStatus("paused");
    }
  }, [audioUrl, clearTtsTimer]);

  const resume = useCallback(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().then(() => setStatus("playing"));
      return;
    }
    if (typeof window !== "undefined" && window.speechSynthesis?.paused) {
      try {
        window.speechSynthesis.resume();
      } catch (_e) {
        playTts();
        return;
      }
      ttsStartedAtRef.current = Date.now();
      setStatus("playing");
      clearTtsTimer();
      ttsTimerRef.current = window.setInterval(() => {
        const elapsed =
          ttsPausedElapsedRef.current + (Date.now() - ttsStartedAtRef.current) / 1000;
        setCurrentTime(Math.min(elapsed, ttsDurationRef.current));
      }, 200);
    } else if (status === "paused") {
      playTts();
    }
  }, [audioUrl, status, playTts, clearTtsTimer]);

  const replay = useCallback(() => {
    stopAll();
    setCurrentTime(0);
    ttsPausedElapsedRef.current = 0;
    ttsStartedAtRef.current = 0;
    setStatus("idle");
    window.setTimeout(() => play(), 50);
  }, [stopAll, play]);

  const toggle = useCallback(() => {
    if (status === "playing") pause();
    else if (status === "paused") resume();
    else if (status === "ended") replay();
    else play();
  }, [status, pause, resume, replay, play]);

  const seek = useCallback(
    (pct) => {
      if (!audioRef.current || !duration) return;
      const t = Math.max(0, Math.min(1, pct)) * duration;
      audioRef.current.currentTime = t;
      setCurrentTime(t);
    },
    [duration]
  );

  const statusLabel =
    status === "playing"
      ? "Đang phát"
      : status === "paused"
        ? "Tạm dừng"
        : status === "ended"
          ? "Hoàn thành"
          : "Sẵn sàng";

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return {
    status,
    statusLabel,
    currentTime,
    duration,
    progressPct,
    formatCurrent: formatTime(currentTime),
    formatDuration: formatTime(duration),
    toggle,
    replay,
    seek,
    play,
    pause,
    stopAll,
  };
}
