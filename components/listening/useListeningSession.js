"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_LISTENING_CLIPS } from "@/lib/listening/session-catalog";
import { LISTEN_5_SECONDS } from "@/lib/listening/constants";

export function useListeningSession() {
  const [clips, setClips] = useState(ALL_LISTENING_CLIPS);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [clipIndex, setClipIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [keywordsHeard, setKeywordsHeard] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [secsLeft, setSecsLeft] = useState(LISTEN_5_SECONDS);
  const [sessionDone, setSessionDone] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/listening/clips", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok && json.success && Array.isArray(json.data) && json.data.length) {
          setClips(json.data);
        }
      } catch {
        /* fallback catalog */
      } finally {
        if (!cancelled) setClipsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const clip = clips[clipIndex] || null;
  const totalClips = clips.length;

  const progressPct = useMemo(() => {
    const elapsed = LISTEN_5_SECONDS - secsLeft;
    return Math.min(100, Math.round((elapsed / LISTEN_5_SECONDS) * 100));
  }, [secsLeft]);

  const timerLabel = useMemo(() => {
    const m = Math.floor(secsLeft / 60);
    const s = secsLeft % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [secsLeft]);

  useEffect(() => {
    if (sessionDone || clipsLoading) return undefined;
    timerRef.current = window.setInterval(() => {
      setSecsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerRef.current);
          setSessionDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timerRef.current);
  }, [sessionDone, clipsLoading]);

  const resetQuestion = useCallback(() => {
    setSelectedIndex(null);
    setChecked(false);
  }, []);

  const selectOption = useCallback(
    (index) => {
      if (checked) return;
      setSelectedIndex(index);
    },
    [checked]
  );

  const checkAnswer = useCallback(() => {
    if (selectedIndex == null || !clip || checked) return;
    const correct = selectedIndex === clip.question.correctIndex;
    setChecked(true);
    setAnsweredCount((n) => n + 1);
    if (correct) {
      setScore((s) => s + 1);
      setKeywordsHeard((prev) => {
        const next = new Set(prev);
        for (const kw of clip.keywords || []) next.add(kw);
        return [...next];
      });
    } else {
      setMistakes((prev) => [
        ...prev,
        {
          id: clip.id,
          question: clip.question.text,
          picked: clip.question.options[selectedIndex],
          correct: clip.question.options[clip.question.correctIndex],
        },
      ]);
    }
  }, [selectedIndex, clip, checked]);

  const continueNext = useCallback(() => {
    if (!checked) return;
    const next = clipIndex + 1;
    if (next >= totalClips || secsLeft <= 0) {
      setSessionDone(true);
      return;
    }
    setClipIndex(next);
    resetQuestion();
  }, [checked, clipIndex, totalClips, secsLeft, resetQuestion]);

  const restartSession = useCallback(() => {
    window.clearInterval(timerRef.current);
    setClipIndex(0);
    resetQuestion();
    setScore(0);
    setAnsweredCount(0);
    setKeywordsHeard([]);
    setMistakes([]);
    setSecsLeft(LISTEN_5_SECONDS);
    setSessionDone(false);
  }, [resetQuestion]);

  const goToClip = useCallback(
    (index) => {
      if (index < 0 || index >= totalClips || sessionDone) return;
      setClipIndex(index);
      resetQuestion();
    },
    [totalClips, sessionDone, resetQuestion]
  );

  const isCorrect =
    checked && selectedIndex != null && clip && selectedIndex === clip.question.correctIndex;

  const canCheck = selectedIndex != null && !checked && !sessionDone && !clipsLoading;
  const canContinue = checked && !sessionDone;

  return {
    clips,
    clip,
    clipIndex,
    totalClips,
    clipsLoading,
    selectedIndex,
    checked,
    isCorrect,
    score,
    answeredCount,
    keywordsHeard,
    mistakes,
    secsLeft,
    progressPct,
    timerLabel,
    sessionDone,
    selectOption,
    checkAnswer,
    continueNext,
    restartSession,
    goToClip,
    canCheck,
    canContinue,
  };
}
