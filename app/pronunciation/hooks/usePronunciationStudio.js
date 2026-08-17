"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startPatientSpeechRecognition, isSpeechRecognitionSupported } from "@/lib/browser-patient-speech";
import { evaluatePronunciation, scoreText } from "@/lib/client-pronunciation-eval";
import { assessPronunciationWithAzure } from "@/lib/vocabulary/vocabulary-card-azure";

export function usePronunciationStudio(drill) {
  const [phase, setPhase] = useState("ready");
  const [result, setResult] = useState(null);
  const [interimText, setInterimText] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const speechRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const azureRef = useRef(null);
  const audioUrlRef = useRef(null);
  const drillRef = useRef(drill);
  drillRef.current = drill;

  const micSupported =
    typeof window !== "undefined" &&
    Boolean(navigator?.mediaDevices?.getUserMedia) &&
    isSpeechRecognitionSupported();

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
    azureRef.current = null;
    setResult(null);
    setInterimText("");
    setErrorMsg("");
    setPhase("ready");
  }, [cleanupStream, revokeAudio]);

  useEffect(() => {
    reset();
  }, [drill?.id, reset]);

  useEffect(() => {
    return () => {
      speechRef.current?.abort?.();
      cleanupStream();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, [cleanupStream]);

  const stopRecorder = useCallback(() => {
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

  const buildFeedback = useCallback((transcript, localEval, azureScore) => {
    const d = drillRef.current;
    const target = d?.word || "";
    const clarity = Math.min(100, Math.round(localEval.score * 0.92 + (azureScore ?? localEval.score) * 0.08));
    const matchScore = scoreText(transcript, target);
    return {
      score: azureScore ?? localEval.score,
      transcript,
      message: localEval.message,
      details: localEval.details,
      clarity,
      matchScore,
      passed: (azureScore ?? localEval.score) >= 65,
      gradeType: "Theo từ",
    };
  }, []);

  const finishScoring = useCallback(
    async (transcript) => {
      setPhase("scoring");
      await stopRecorder();
      await Promise.race([
        azureRef.current || Promise.resolve(null),
        new Promise((r) => setTimeout(r, 2000)),
      ]);

      const d = drillRef.current;
      const text = String(transcript || "").trim();
      const localEval = evaluatePronunciation(text, d?.word || "", {
        expectedIpaText: d?.ipa || "",
        isSentence: false,
      });

      let azureScore = null;
      const azure = await azureRef.current;
      if (azure?.score != null) azureScore = azure.score;

      if (!text) {
        setResult({
          score: 0,
          transcript: "",
          message: "Không nghe được lời nói. Hãy đọc to hơn và thử lại.",
          details: "Cho phép micro và dùng Chrome hoặc Edge.",
          clarity: 0,
          matchScore: 0,
          passed: false,
        });
        setPhase("done");
        return;
      }

      const feedback = buildFeedback(text, localEval, azureScore);
      if (azure?.transcript && azureScore != null) {
        feedback.transcript = azure.transcript;
      }
      setResult(feedback);
      setPhase("done");
      return feedback;
    },
    [buildFeedback, stopRecorder]
  );

  const startPractice = useCallback(async () => {
    if (!micSupported) {
      setErrorMsg("Trình duyệt không hỗ trợ micro hoặc nhận diện giọng nói. Hãy dùng Chrome/Edge.");
      return null;
    }
    const d = drillRef.current;
    if (!d) return null;

    revokeAudio();
    setResult(null);
    setInterimText("");
    setErrorMsg("");

    azureRef.current = assessPronunciationWithAzure(d.word, false).catch(() => null);

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

      const ctrl = startPatientSpeechRecognition({
        lang: "en-US",
        silenceMs: 1800,
        maxMs: 14000,
        onInterim: setInterimText,
        onDone: (t) => {
          speechRef.current = null;
          void finishScoring(t);
        },
        onError: () => {
          speechRef.current = null;
          void finishScoring(interimText);
        },
      });

      if (!ctrl) {
        cleanupStream();
        setErrorMsg("Không khởi động được nhận diện giọng nói.");
        return null;
      }

      speechRef.current = ctrl;
      setPhase("listening");
      return true;
    } catch {
      cleanupStream();
      setErrorMsg("Không truy cập được microphone.");
      return null;
    }
  }, [micSupported, revokeAudio, finishScoring, cleanupStream, interimText]);

  const stopPractice = useCallback(() => {
    if (phase === "listening") speechRef.current?.stop();
  }, [phase]);

  const togglePractice = useCallback(() => {
    if (phase === "listening") {
      stopPractice();
      return;
    }
    if (phase === "ready" || phase === "done") {
      if (phase === "done") reset();
      void startPractice();
    }
  }, [phase, stopPractice, startPractice, reset]);

  const playRecording = useCallback(() => {
    if (!audioUrlRef.current) return;
    new Audio(audioUrlRef.current).play().catch(() => {});
  }, []);

  const phaseLabel =
    phase === "listening"
      ? "Đang nghe…"
      : phase === "scoring"
      ? "Đang chấm…"
      : phase === "done"
      ? "Hoàn thành"
      : "Sẵn sàng";

  return {
    phase,
    phaseLabel,
    result,
    interimText,
    audioUrl,
    errorMsg,
    micSupported,
    togglePractice,
    playRecording,
    reset,
  };
}
