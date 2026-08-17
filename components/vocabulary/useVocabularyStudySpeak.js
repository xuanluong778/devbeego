"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startPatientSpeechRecognition, isSpeechRecognitionSupported } from "@/lib/browser-patient-speech";
import {
  buildCharMarks,
  buildWordMarks,
  evaluatePronunciation,
} from "@/lib/client-pronunciation-eval";
import { assessPronunciationWithAzure } from "@/lib/vocabulary/vocabulary-card-azure";

function mergeAzureScore(evalResult, azureResult) {
  const azureScore = Number(azureResult?.score);
  if (!Number.isFinite(azureScore)) return evalResult;
  return { ...evalResult, score: Math.max(0, Math.round(azureScore)), source: "azure" };
}

export function useVocabularyStudySpeak(item) {
  const [activeTarget, setActiveTarget] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [wordResult, setWordResult] = useState(null);
  const [sentenceResult, setSentenceResult] = useState(null);
  const [wordAudioUrl, setWordAudioUrl] = useState(null);
  const [sentenceAudioUrl, setSentenceAudioUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const speechRef = useRef(null);
  const azureSentenceRef = useRef(null);
  const azurePromiseRef = useRef(null);
  const transcriptRef = useRef("");
  const targetRef = useRef(null);
  const itemRef = useRef(item);
  const wordAudioUrlRef = useRef(null);
  const sentenceAudioUrlRef = useRef(null);
  itemRef.current = item;

  const hasSentence = Boolean(item?.example_sentence);

  const supported =
    typeof window !== "undefined" &&
    Boolean(navigator?.mediaDevices?.getUserMedia) &&
    (Boolean(window.MediaRecorder) || isSpeechRecognitionSupported());

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const revokeAudio = useCallback((target) => {
    if (target === "word") {
      if (wordAudioUrlRef.current) URL.revokeObjectURL(wordAudioUrlRef.current);
      wordAudioUrlRef.current = null;
      setWordAudioUrl(null);
      return;
    }
    if (target === "sentence") {
      if (sentenceAudioUrlRef.current) URL.revokeObjectURL(sentenceAudioUrlRef.current);
      sentenceAudioUrlRef.current = null;
      setSentenceAudioUrl(null);
    }
  }, []);

  const reset = useCallback(() => {
    speechRef.current?.abort?.();
    speechRef.current = null;
    cleanupStream();
    if (wordAudioUrlRef.current) URL.revokeObjectURL(wordAudioUrlRef.current);
    if (sentenceAudioUrlRef.current) URL.revokeObjectURL(sentenceAudioUrlRef.current);
    wordAudioUrlRef.current = null;
    sentenceAudioUrlRef.current = null;
    setWordAudioUrl(null);
    setSentenceAudioUrl(null);
    setWordResult(null);
    setSentenceResult(null);
    setErrorMsg("");
    azureSentenceRef.current = null;
    azurePromiseRef.current = null;
    transcriptRef.current = "";
    targetRef.current = null;
    setActiveTarget(null);
    setPhase("idle");
  }, [cleanupStream]);

  useEffect(() => {
    reset();
  }, [item?.id, reset]);

  useEffect(() => {
    return () => {
      speechRef.current?.abort?.();
      cleanupStream();
      if (wordAudioUrlRef.current) URL.revokeObjectURL(wordAudioUrlRef.current);
      if (sentenceAudioUrlRef.current) URL.revokeObjectURL(sentenceAudioUrlRef.current);
    };
  }, [cleanupStream]);

  const stopMediaRecorder = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      const target = targetRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        if (target === "sentence") {
          if (sentenceAudioUrlRef.current) URL.revokeObjectURL(sentenceAudioUrlRef.current);
          sentenceAudioUrlRef.current = url;
          setSentenceAudioUrl(url);
        } else {
          if (wordAudioUrlRef.current) URL.revokeObjectURL(wordAudioUrlRef.current);
          wordAudioUrlRef.current = url;
          setWordAudioUrl(url);
        }
        cleanupStream();
        resolve(url);
      };
      recorder.stop();
    });
  }, [cleanupStream]);

  const finishScoring = useCallback(
    async (transcript) => {
      const target = targetRef.current;
      setPhase("scoring");
      await stopMediaRecorder();
      await Promise.race([
        azurePromiseRef.current || Promise.resolve(),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);

      const it = itemRef.current;
      const text = String(transcript || "").trim();

      if (target === "sentence") {
        if (!text) {
          setSentenceResult({
            score: 0,
            message: "Không nghe được câu. Hãy đọc to hơn và thử lại.",
            wordMarks: [],
            transcript: "",
          });
        } else {
          let evalResult = evaluatePronunciation(text, it.example_sentence, {
            isSentence: true,
            expectedIpaText: it.example_sentence_ipa || "",
          });
          evalResult.wordMarks = buildWordMarks(it.example_sentence, text);
          evalResult.transcript = text;
          evalResult = mergeAzureScore(evalResult, azureSentenceRef.current);
          setSentenceResult(evalResult);
        }
      } else {
        if (!text) {
          setWordResult({
            score: 0,
            message: "Không nghe được từ. Hãy đọc to hơn và thử lại.",
            charMarks: [],
            transcript: "",
          });
        } else {
          let evalResult = evaluatePronunciation(text, it.word, {
            isSentence: false,
            expectedIpaText: it.ipa || "",
          });
          evalResult.charMarks = buildCharMarks(it.word, text);
          evalResult.transcript = text;
          setWordResult(evalResult);
        }
      }

      setActiveTarget(null);
      setPhase("idle");
    },
    [stopMediaRecorder]
  );

  const startSpeak = useCallback(
    async (target) => {
      if (!supported) {
        setErrorMsg("Trình duyệt không hỗ trợ ghi âm.");
        setPhase("error");
        return;
      }

      revokeAudio(target);
      if (target === "word") {
        setWordResult(null);
      } else {
        setSentenceResult(null);
        azureSentenceRef.current = null;
      }
      setErrorMsg("");
      transcriptRef.current = "";
      targetRef.current = target;
      setActiveTarget(target);

      const it = itemRef.current;
      if (target === "sentence") {
        azurePromiseRef.current = assessPronunciationWithAzure(it.example_sentence, true).then((r) => {
          azureSentenceRef.current = r;
          return r;
        });
      } else {
        azurePromiseRef.current = Promise.resolve(null);
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        if (window.MediaRecorder) {
          chunksRef.current = [];
          const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
          const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
          recorderRef.current = recorder;
          recorder.ondataavailable = (e) => {
            if (e.data?.size) chunksRef.current.push(e.data);
          };
          recorder.start();
        }

        const speechCtrl = startPatientSpeechRecognition({
          lang: "en-US",
          silenceMs: target === "word" ? 2200 : 3600,
          maxMs: target === "word" ? 12000 : 36000,
          onInterim: (t) => {
            transcriptRef.current = t;
          },
          onDone: (t) => {
            speechRef.current = null;
            void finishScoring(t);
          },
          onError: () => {
            speechRef.current = null;
            void finishScoring(transcriptRef.current);
          },
        });

        if (!speechCtrl) {
          cleanupStream();
          setErrorMsg("Trình duyệt không hỗ trợ nhận diện giọng nói.");
          setPhase("error");
          setActiveTarget(null);
          return;
        }

        speechRef.current = speechCtrl;
        setPhase("listening");
      } catch {
        cleanupStream();
        setErrorMsg("Không truy cập được microphone.");
        setPhase("error");
        setActiveTarget(null);
      }
    },
    [supported, revokeAudio, finishScoring, cleanupStream]
  );

  const stopSpeak = useCallback(() => {
    if (phase !== "listening") return;
    speechRef.current?.stop();
  }, [phase]);

  const toggleSpeak = useCallback(
    (target) => {
      if (phase === "listening") {
        if (activeTarget === target) stopSpeak();
        return;
      }
      if (phase === "scoring") return;
      void startSpeak(target);
    },
    [phase, activeTarget, stopSpeak, startSpeak]
  );

  const playRecording = useCallback((target) => {
    const url = target === "sentence" ? sentenceAudioUrlRef.current : wordAudioUrlRef.current;
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch(() => {});
  }, []);

  const getMicLabel = useCallback(
    (target) => {
      if (phase === "listening" && activeTarget === target) return "Đang nghe…";
      if (phase === "scoring" && activeTarget === target) return "Đang chấm…";
      if (target === "word" && wordResult) return "Ghi lại từ";
      if (target === "sentence" && sentenceResult) return "Ghi lại câu";
      return target === "word" ? "Ghi âm từ" : "Ghi âm câu";
    },
    [phase, activeTarget, wordResult, sentenceResult]
  );

  const result = useMemo(() => {
    if (!wordResult) return null;
    const combinedScore = sentenceResult
      ? Math.round((wordResult.score + sentenceResult.score) / 2)
      : wordResult.score;
    return {
      transcript: [wordResult.transcript, sentenceResult?.transcript].filter(Boolean).join(" · "),
      word: wordResult,
      sentence: sentenceResult,
      combinedScore,
    };
  }, [wordResult, sentenceResult]);

  const isComplete = Boolean(wordResult && (!hasSentence || sentenceResult));

  return {
    phase,
    activeTarget,
    result,
    wordResult,
    sentenceResult,
    wordAudioUrl,
    sentenceAudioUrl,
    errorMsg,
    supported,
    hasSentence,
    isComplete,
    getMicLabel,
    toggleSpeak,
    playRecording,
    reset,
    isListening: phase === "listening",
    isScoring: phase === "scoring",
  };
}
