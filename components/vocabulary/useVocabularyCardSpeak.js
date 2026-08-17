"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startPatientSpeechRecognition, isSpeechRecognitionSupported } from "@/lib/browser-patient-speech";
import { evaluatePronunciation, tokenizeWords } from "@/lib/client-pronunciation-eval";
import { detectSpeakMode } from "@/lib/vocabulary/detect-speak-mode";
import { assessPronunciationWithAzure } from "@/lib/vocabulary/vocabulary-card-azure";

export function useVocabularyCardSpeak(item) {
  const [phase, setPhase] = useState("idle");
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const speechRef = useRef(null);
  const azureResultRef = useRef(null);
  const azurePromiseRef = useRef(null);
  const transcriptRef = useRef("");
  const itemRef = useRef(item);
  const audioUrlRef = useRef(null);
  itemRef.current = item;

  const supported =
    typeof window !== "undefined" &&
    Boolean(navigator?.mediaDevices?.getUserMedia) &&
    (Boolean(window.MediaRecorder) || isSpeechRecognitionSupported());

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const revokeAudio = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
  }, []);

  const reset = useCallback(() => {
    speechRef.current?.abort?.();
    speechRef.current = null;
    cleanupStream();
    revokeAudio();
    setResult(null);
    setErrorMsg("");
    azureResultRef.current = null;
    azurePromiseRef.current = null;
    transcriptRef.current = "";
    setPhase("idle");
  }, [cleanupStream, revokeAudio]);

  useEffect(() => {
    return () => {
      speechRef.current?.abort?.();
      cleanupStream();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [cleanupStream]);

  const stopMediaRecorder = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = url;
        setAudioUrl(url);
        cleanupStream();
        resolve(url);
      };
      recorder.stop();
    });
  }, [cleanupStream]);

  const mergeScore = useCallback((transcript, detected, localEval) => {
    const azure = azureResultRef.current;
    let score = localEval.score;
    let displayTranscript = transcript;
    let source = "local";

    if (azure?.score != null) {
      const azureWords = tokenizeWords(azure.transcript);
      const useAzure =
        (detected.mode === "word" && azureWords.length <= 3) ||
        (detected.mode === "sentence" && azureWords.length > 1);
      if (useAzure) {
        score = azure.score;
        if (azure.transcript) displayTranscript = azure.transcript;
        source = "azure";
      }
    }

    return {
      score,
      transcript: displayTranscript,
      message: localEval.message,
      details: localEval.details,
      gradeType: detected.label,
      source,
    };
  }, []);

  const finishScoring = useCallback(
    async (transcript) => {
      setPhase("scoring");
      await stopMediaRecorder();
      await Promise.race([
        azurePromiseRef.current || Promise.resolve(),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);

      const it = itemRef.current;
      const text = String(transcript || "").trim();
      const detected = detectSpeakMode(text, it.word, it.example_sentence);
      const expectedIpa = detected.isSentence ? it.example_sentence_ipa || "" : it.ipa || "";

      if (!text) {
        setResult({
          score: 0,
          transcript: "",
          gradeType: detected.label,
          message: "Không nghe được lời nói. Hãy đọc to hơn và thử lại.",
          details: "",
          source: "local",
        });
        setPhase("result");
        return;
      }

      const localEval = evaluatePronunciation(text, detected.target, {
        isSentence: detected.isSentence,
        expectedIpaText: expectedIpa,
      });

      const merged = mergeScore(text, detected, localEval);
      setResult(merged);
      setPhase("result");
    },
    [mergeScore, stopMediaRecorder]
  );

  const startSpeak = useCallback(async () => {
    if (!supported) {
      setErrorMsg("Trình duyệt không hỗ trợ ghi âm.");
      setPhase("error");
      return;
    }

    revokeAudio();
    setResult(null);
    setErrorMsg("");
    transcriptRef.current = "";
    azureResultRef.current = null;

    const it = itemRef.current;
    const azureTarget = it.example_sentence || it.word || "";
    const azureIsSentence = Boolean(it.example_sentence);

    azurePromiseRef.current = assessPronunciationWithAzure(azureTarget, azureIsSentence)
      .then((r) => {
        if (r) azureResultRef.current = r;
        return r;
      })
      .catch(() => null);

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
        silenceMs: 2800,
        maxMs: 32000,
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
        return;
      }

      speechRef.current = speechCtrl;
      setPhase("listening");
    } catch {
      cleanupStream();
      setErrorMsg("Không truy cập được microphone.");
      setPhase("error");
    }
  }, [supported, revokeAudio, finishScoring, cleanupStream]);

  const stopSpeak = useCallback(() => {
    if (phase !== "listening") return;
    speechRef.current?.stop();
  }, [phase]);

  const toggleSpeak = useCallback(() => {
    if (phase === "listening") {
      stopSpeak();
      return;
    }
    if (phase === "scoring") return;
    if (phase === "result" || phase === "error") {
      reset();
    }
    void startSpeak();
  }, [phase, stopSpeak, startSpeak, reset]);

  const retrySpeak = useCallback(() => {
    reset();
    void startSpeak();
  }, [reset, startSpeak]);

  const playRecording = useCallback(() => {
    if (!audioUrlRef.current) return;
    const audio = new Audio(audioUrlRef.current);
    audio.play().catch(() => {});
  }, []);

  const speakLabel =
    phase === "listening" ? "Đang nghe…" : phase === "scoring" ? "Đang chấm…" : "Nói";

  return {
    phase,
    result,
    errorMsg,
    audioUrl,
    supported,
    speakLabel,
    toggleSpeak,
    retrySpeak,
    playRecording,
    reset,
  };
}
