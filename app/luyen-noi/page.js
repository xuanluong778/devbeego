"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  isSpeechRecognitionSupported,
  startPatientSpeechRecognition,
} from "@/lib/browser-patient-speech";
import { usePaywall } from "@/components/billing/PaywallProvider";
import { isPaywallResponse } from "@/lib/billing/checkout-client";
import { createAssistantChatMessage } from "@/lib/lessons/assistant-reply-ui";
import {
  DEFAULT_LANGUAGE_SUPPORT_MODE,
} from "@/lib/lessons/language-support-mode";
import {
  AI_TEACHERS,
  DEFAULT_AI_TEACHER_ID,
  normalizeSelectedTeacher,
} from "@/lib/lessons/ai-teachers";
import { hasVietnameseForTts } from "@/lib/vbee/prepare-vietnamese-tts-text";
import { speakEnglishText, stopEnglishSpeech } from "@/lib/lessons/speak-english-client";
import { useRouter } from "next/navigation";
import { buildSpeakingFeedback } from "@/lib/lessons/speaking-feedback";
import { getScenarioById } from "@/lib/lessons/speaking-scenarios";
import { getAnswerSuggestions } from "@/lib/lessons/speaking-suggestions";
import {
  EASIER_SPEAK_PROMPT,
  QUICK_5_SECONDS,
  QUICK_5_START_PROMPT,
  normalizeSessionMode,
} from "@/lib/lessons/speaking-session-modes";
import SpeakingPageHeader from "@/components/speaking/SpeakingPageHeader";
import SpeakingSessionBar from "@/components/speaking/SpeakingSessionBar";
import SpeakingScenarioChips from "@/components/speaking/SpeakingScenarioChips";
import SpeakingRoom from "@/components/speaking/SpeakingRoom";
import SpeakingProgressPanel from "@/components/speaking/SpeakingProgressPanel";
import RescuePhrases from "@/components/speaking/RescuePhrases";
import AiCallLayout from "@/components/ai-call/AiCallLayout";
import "./lessons.css";
import "./lessons-mockup.css";

const CHAT_FALLBACK_REPLY = "Good effort! Please try one more sentence.";

const VOICE_ERROR_MESSAGES = {
  unsupported:
    "Voice typing is not available in this browser. Please use Chrome or Edge on a computer or phone.",
  "start-failed":
    "Could not start the microphone. Please refresh the page and try again.",
  "not-allowed":
    "Microphone is blocked. Click the lock icon in the address bar and allow the microphone.",
  "service-not-allowed": "Speech recognition is not allowed on this page. Try Chrome or Edge.",
  "audio-capture": "No microphone was found. Please connect a mic and try again.",
  "network": "Network error during speech recognition. Check your connection and try again.",
  "no-speech": "We didn't hear anything. Tap the mic and speak clearly in English.",
  aborted: "",
};

function buildWelcomeMessage() {
  return {
    id: `welcome-${Date.now()}`,
    role: "assistant",
    text: "Hello! Nice to meet you.\nWhat is your name?",
    correctedSentence: "",
    ipa: "",
    tip: "",
    mistakesExplanation: "",
    userQuestion: "",
    detailsOpen: false,
    showVi: false,
    viText: "",
    viLoading: false,
  };
}

function buildInitialChatMessages() {
  return [buildWelcomeMessage()];
}

function apiHistoryToChatMessages(items) {
  return items
    .map((m, index) => {
      const role = m.role === "user" ? "user" : "assistant";
      const text = String(m.text || "").trim();
      if (!text) return null;
      const base = {
        id: `hist-${role}-${index}-${Date.now()}`,
        role,
        text,
        showVi: false,
        viText: "",
        viLoading: false,
      };
      if (role === "assistant") {
        return {
          ...base,
          correctedSentence: String(m.corrected_sentence || "").trim(),
          ipa: String(m.ipa || "").trim(),
          tip: String(m.pronunciation_tip || "").trim(),
          mistakesExplanation: String(m.mistakes_explanation || "").trim(),
          userQuestion: "",
          detailsOpen: false,
        };
      }
      return base;
    })
    .filter(Boolean);
}

export default function LessonsPage() {
  const router = useRouter();
  const { openPaywall } = usePaywall();

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playingId, setPlayingId] = useState(null);

  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [recording, setRecording] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [pronunciation, setPronunciation] = useState(null);
  const [speechSupported, setSpeechSupported] = useState(null);
  const [voiceNotice, setVoiceNotice] = useState("");

  const voiceSendingRef = useRef(false);
  const chatLoadingRef = useRef(false);

  const [chatMessages, setChatMessages] = useState(() => buildInitialChatMessages());
  const [practiceMode, setPracticeMode] = useState("free_talk");
  const [languageSupportMode, setLanguageSupportMode] = useState(DEFAULT_LANGUAGE_SUPPORT_MODE);
  const [selectedTeacher, setSelectedTeacher] = useState(DEFAULT_AI_TEACHER_ID);
  const [activeScenarioId, setActiveScenarioId] = useState("");
  const [sessionMode, setSessionMode] = useState("scenario");
  const [quickSecsLeft, setQuickSecsLeft] = useState(null);
  const [recordSecs, setRecordSecs] = useState(0);

  const recognitionRef = useRef(null);
  const recordTimerRef = useRef(null);
  const listRef = useRef(null);
  const vbeeAudioRef = useRef(null);
  const vbeeAudioCacheRef = useRef(new Map());
  const [vbeeLoadingId, setVbeeLoadingId] = useState(null);

  useEffect(() => {
    chatLoadingRef.current = chatLoading;
  }, [chatLoading]);

  useEffect(() => {
    if (quickSecsLeft == null || quickSecsLeft <= 0) return undefined;
    const timer = window.setInterval(() => {
      setQuickSecsLeft((prev) => {
        if (prev == null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [quickSecsLeft]);

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch (_err) {}
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadChatHistory() {
      try {
        const res = await fetch("/api/lessons/chat/history", { cache: "no-store", credentials: "same-origin" });
        const json = await res.json();
        if (cancelled) return;

        const items =
          res.ok && json.success && Array.isArray(json.data?.messages) ? json.data.messages : [];
        const mapped = apiHistoryToChatMessages(items);

        if (mapped.length > 0) {
          setChatMessages(mapped);
        }
      } catch (_err) {
        // Giữ lời chào mặc định đã có trong state ban đầu.
      }
    }

    void loadChatHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function fetchLessons() {
      try {
        const response = await fetch("/api/lessons", { cache: "no-store" });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to load lessons.");
        }

        setLessons(Array.isArray(result.data) ? result.data : []);
        if (result.degraded) {
          setError("");
        }
      } catch (err) {
        setError(err.message || "Cannot fetch lessons.");
      } finally {
        setLoading(false);
      }
    }

    fetchLessons();
  }, []);

  const playAudio = (lesson) => {
    if (!lesson.audio) {
      return;
    }

    try {
      const audio = new Audio(lesson.audio);
      setPlayingId(lesson.id);
      audio.play();
      audio.addEventListener("ended", () => setPlayingId(null), { once: true });
      audio.addEventListener("error", () => setPlayingId(null), { once: true });
    } catch (_err) {
      setPlayingId(null);
    }
  };

  const normalizeText = (input) =>
    String(input || "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const similarityScore = (a, b) => {
    const s1 = normalizeText(a);
    const s2 = normalizeText(b);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 100;
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i += 1) dp[i][0] = i;
    for (let j = 0; j <= n; j += 1) dp[0][j] = j;
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    const distance = dp[m][n];
    const maxLen = Math.max(m, n);
    return Math.max(0, Math.round((1 - distance / maxLen) * 100));
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, 0);
  };

  function buildTranslateSource(m) {
    return String(m.text || "").trim();
  }

  function speakVietnameseBrowser(text) {
    const t = String(text || "")
      .trim()
      .replace(/<\/?english>/gi, "");
    if (!t || typeof window === "undefined") return;
    if (!hasVietnameseForTts(t)) return;
    try {
      window.speechSynthesis.cancel();
      const speakOnce = () => {
        const u = new SpeechSynthesisUtterance(t);
        const voices = window.speechSynthesis.getVoices?.() || [];
        const viVoices = voices.filter((v) => String(v.lang || "").toLowerCase().startsWith("vi"));
        if (viVoices.length > 0) {
          const googleVi = viVoices.find((v) =>
            String(v.name || "").toLowerCase().includes("google")
          );
          u.voice = googleVi || viVoices[0];
        }
        u.lang = "vi-VN";
        // Chậm và rõ hơn cho tiếng Việt.
        u.rate = 0.8;
        u.pitch = 0.95;
        window.speechSynthesis.speak(u);
      };

      const existingVoices = window.speechSynthesis.getVoices?.() || [];
      if (existingVoices.length > 0) {
        speakOnce();
        return;
      }

      // Một số trình duyệt load voices bất đồng bộ – đợi sự kiện rồi đọc.
      const onVoices = () => {
        window.speechSynthesis.removeEventListener?.("voiceschanged", onVoices);
        speakOnce();
      };
      window.speechSynthesis.addEventListener?.("voiceschanged", onVoices);
      // Fallback: nếu vì lý do nào đó sự kiện không bắn, vẫn đọc ngay bằng cấu hình mặc định.
      window.setTimeout(() => {
        if (!window.speechSynthesis.speaking) {
          speakOnce();
        }
      }, 500);
    } catch (_err) {
      /* ignore */
    }
  }

  async function playVietnameseTts(text, options = {}) {
    const raw = String(text || "").trim();
    if (!raw || typeof window === "undefined") return;
    if (!hasVietnameseForTts(raw)) return;

    try {
      stopEnglishSpeech();
      vbeeAudioRef.current?.pause?.();
      vbeeAudioRef.current = null;
      window.speechSynthesis.cancel();
    } catch (_err) {}

    const memCached = vbeeAudioCacheRef.current.get(raw);
    if (memCached?.audioBase64) {
      const audio = new Audio(
        `data:${memCached.contentType || "audio/mpeg"};base64,${memCached.audioBase64}`
      );
      vbeeAudioRef.current = audio;
      await audio.play();
      return;
    }

    const loadingId = options.loadingMessageId;
    if (loadingId) setVbeeLoadingId(loadingId);
    try {
      const response = await fetch("/api/lessons/vbee-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ text: raw }),
      });
      const result = await response.json();

      if (response.ok && result.success && result.data?.audioBase64) {
        const contentType = result.data.contentType || "audio/mpeg";
        vbeeAudioCacheRef.current.set(raw, {
          audioBase64: result.data.audioBase64,
          contentType,
        });
        const audio = new Audio(`data:${contentType};base64,${result.data.audioBase64}`);
        vbeeAudioRef.current = audio;
        await audio.play();
        return;
      }

      if (result?.code !== "NOT_VIETNAMESE") {
        speakVietnameseBrowser(raw);
      }
    } catch (_err) {
      speakVietnameseBrowser(raw);
    } finally {
      if (loadingId) setVbeeLoadingId(null);
    }
  }

  async function playVietnameseHelp(message) {
    const text = String(message?.mistakesExplanation || "").trim();
    if (!text) return;
    await playVietnameseTts(text, { loadingMessageId: message.id });
  }

  async function requestTranslate(m) {
    const id = m.id;
    const source = buildTranslateSource(m);
    if (!source.trim()) return;
    setChatMessages((prev) =>
      prev.map((x) => (x.id === id ? { ...x, viLoading: true } : x))
    );
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source }),
      });
      const json = await res.json();
      if (isPaywallResponse(json)) {
        openPaywall({ message: json.message, source: "lessons_translate" });
        setChatMessages((prev) =>
          prev.map((x) => (x.id === id ? { ...x, viLoading: false } : x))
        );
        scrollToBottom();
        return;
      }
      const translated =
        res.ok && json.success && json.data?.translated
          ? String(json.data.translated)
          : "Không dịch được lúc này. Thử lại sau.";
      setChatMessages((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, viText: translated, viLoading: false, showVi: true } : x
        )
      );
      void playVietnameseTts(translated);
    } catch (_err) {
      setChatMessages((prev) =>
        prev.map((x) => (x.id === id ? { ...x, viLoading: false } : x
        ))
      );
    }
    scrollToBottom();
  }

  function toggleMessageDetails(messageId) {
    setChatMessages((prev) =>
      prev.map((x) => (x.id === messageId ? { ...x, detailsOpen: !x.detailsOpen } : x))
    );
  }

  function toggleVietnamese(m) {
    if (m.showVi) {
      try {
        vbeeAudioRef.current?.pause?.();
        vbeeAudioRef.current = null;
        window.speechSynthesis.cancel();
      } catch (_err) {}
      setChatMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, showVi: false } : x))
      );
      return;
    }
    if (m.viText) {
      setChatMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, showVi: true } : x))
      );
      void playVietnameseTts(m.viText);
      return;
    }
    void requestTranslate(m);
  }

  const sendChat = async (content, options = {}) => {
    const text = String(content || "").trim();
    if (!text || chatLoading) return;

    const userMsg = {
      id: `${Date.now()}-u`,
      role: "user",
      text,
      showVi: false,
      viText: "",
      viLoading: false,
    };
    const historyPayload = chatMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.text }));
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    scrollToBottom();

    try {
      const response = await fetch("/api/lessons/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          selectedTeacher: normalizeSelectedTeacher(selectedTeacher),
          practice_mode: practiceMode,
          language_support_mode: languageSupportMode,
          vocabulary_words: lessons.map((lesson) => String(lesson.word || "").trim()).filter(Boolean),
          source: options.source || "text",
          spoken_text: options.spokenText || null,
          pronunciation_score:
            typeof options.pronunciationScore === "number" ? options.pronunciationScore : null,
          history: historyPayload,
        }),
      });
      let result = {};
      try {
        result = await response.json();
      } catch (_parseErr) {
        result = {};
      }

      if (isPaywallResponse(result)) {
        openPaywall({ message: result.message, source: "lessons_chat" });
        setChatMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setChatInput(text);
        setChatLoading(false);
        scrollToBottom();
        return;
      }

      const apiData =
        result?.data && typeof result.data === "object"
          ? result.data
          : { reply: result?.message || CHAT_FALLBACK_REPLY };
      const assistantMsg = createAssistantChatMessage(apiData, CHAT_FALLBACK_REPLY, {
        userQuestion: text,
      });
      setChatMessages((prev) => [...prev, assistantMsg]);
      speakEnglishText(assistantMsg.text, 0.95);
    } catch (_err) {
      setChatMessages((prev) => [
        ...prev,
        createAssistantChatMessage(
          { reply: "I cannot connect right now. Please try again in a moment." },
          CHAT_FALLBACK_REPLY
        ),
      ]);
    } finally {
      setChatLoading(false);
      scrollToBottom();
    }
  };

  const mapVoiceErrorMessage = (code) => {
    const key = String(code || "").trim();
    return VOICE_ERROR_MESSAGES[key] || "Microphone error. Please try again.";
  };

  const submitVoiceTranscript = (transcript) => {
    const trimmed = String(transcript || "").trim();
    setSpokenText(trimmed);

    if (!trimmed) {
      setPronunciation(null);
      setVoiceNotice(VOICE_ERROR_MESSAGES["no-speech"]);
      return;
    }

    if (voiceSendingRef.current) return;
    if (chatLoadingRef.current) {
      setVoiceNotice("Please wait — Teacher is thinking...");
      return;
    }

    voiceSendingRef.current = true;
    setVoiceNotice("");

    const normalized = normalizeText(trimmed);
    const wordCount = normalized ? normalized.split(" ").filter(Boolean).length : 0;
    const score = Math.max(45, Math.min(98, 55 + wordCount * 6));
    setPronunciation({
      score,
      feedback:
        score >= 85
          ? "Nice speaking! Keep going."
          : score >= 65
          ? "Good try! Speak a little slower and clearer."
          : "Keep practicing — listen and say it again.",
    });

    void sendChat(trimmed, {
      source: "voice",
      spokenText: trimmed,
      pronunciationScore: score,
    }).finally(() => {
      voiceSendingRef.current = false;
    });
  };

  const startVoice = () => {
    if (speechSupported === false) {
      setVoiceNotice(VOICE_ERROR_MESSAGES.unsupported);
      return;
    }
    if (chatLoadingRef.current) {
      setVoiceNotice("Please wait — Teacher is thinking...");
      return;
    }

    recognitionRef.current?.abort?.();
    stopEnglishSpeech();

    setSpokenText("");
    setPronunciation(null);
    setVoiceNotice("");
    setRecordSecs(0);
    if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    recordTimerRef.current = window.setInterval(() => {
      setRecordSecs((s) => s + 1);
    }, 1000);

    const ctrl = startPatientSpeechRecognition({
      lang: "en-US",
      silenceMs: 2800,
      maxMs: 28000,
      onInterim: (t) => {
        const live = String(t || "").trim();
        if (live) setSpokenText(live);
      },
      onDone: (transcript) => {
        setRecording(false);
        recognitionRef.current = null;
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        submitVoiceTranscript(transcript);
      },
      onError: (err) => {
        setRecording(false);
        recognitionRef.current = null;
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        const key = String(err || "");
        if (key === "aborted") return;
        const message = mapVoiceErrorMessage(key);
        if (message) setVoiceNotice(message);
        if (key === "unsupported" || key === "start-failed") {
          setSpeechSupported(false);
        }
        setPronunciation(null);
      },
    });

    if (!ctrl) {
      setSpeechSupported(false);
      setVoiceNotice(VOICE_ERROR_MESSAGES.unsupported);
      return;
    }

    recognitionRef.current = ctrl;
    setRecording(true);
    setVoiceNotice("Listening… speak in English.");
  };

  const stopVoice = () => {
    if (!recording) return;
    setVoiceNotice("Stopping…");
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    try {
      recognitionRef.current?.stop?.();
    } catch (_err) {
      setRecording(false);
      recognitionRef.current = null;
    }
  };

  function resetChatFromStart() {
    try {
      stopEnglishSpeech();
      vbeeAudioRef.current?.pause?.();
      vbeeAudioRef.current = null;
      stopEnglishSpeech();
    } catch (_err) {}
    try {
      recognitionRef.current?.abort?.();
    } catch (_err) {}
    recognitionRef.current = null;
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecordSecs(0);
    setRecording(false);
    setChatLoading(false);
    setChatInput("");
    setSpokenText("");
    setPronunciation(null);
    setVoiceNotice("");
    setVbeeLoadingId(null);
    voiceSendingRef.current = false;
    setActiveScenarioId("");
    setQuickSecsLeft(null);
    setChatMessages(buildInitialChatMessages());
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = 0;
    }, 0);
  }

  const pickScenario = (scenario) => {
    if (!scenario?.prompt) return;
    setActiveScenarioId(scenario.id);
    setSessionMode("scenario");
    void sendChat(scenario.prompt, { source: "scenario_chip" });
  };

  const handleSessionModeChange = (modeId) => {
    const mode = normalizeSessionMode(modeId);
    setSessionMode(mode);
    if (mode === "quick_5") {
      setQuickSecsLeft(QUICK_5_SECONDS);
      const userTurns = chatMessages.filter((m) => m.role === "user").length;
      if (userTurns === 0) {
        void sendChat(QUICK_5_START_PROMPT, { source: "quick_5_start" });
      }
    } else {
      setQuickSecsLeft(null);
    }
  };

  const handleRescuePhrase = (phrase) => {
    if (!phrase?.text) return;
    void sendChat(phrase.text, { source: "rescue" });
  };

  const handleEasierSpeak = () => {
    void sendChat(EASIER_SPEAK_PROMPT, { source: "easier" });
  };

  const lastAssistantMsg = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      if (chatMessages[i].role === "assistant") return chatMessages[i];
    }
    return null;
  }, [chatMessages]);

  const lastUserMsg = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      if (chatMessages[i].role === "user") return chatMessages[i];
    }
    return null;
  }, [chatMessages]);

  const speakingFeedback = useMemo(() => {
    if (!lastUserMsg || !lastAssistantMsg) return null;
    const uIndex = chatMessages.findIndex((m) => m.id === lastUserMsg.id);
    const aIndex = chatMessages.findIndex((m) => m.id === lastAssistantMsg.id);
    if (aIndex < uIndex) return null;
    return buildSpeakingFeedback({
      assistantMsg: lastAssistantMsg,
      userText: lastUserMsg.text,
      spokenText,
      pronunciationScore: pronunciation?.score ?? null,
    });
  }, [chatMessages, lastAssistantMsg, lastUserMsg, spokenText, pronunciation]);

  const turnCount = useMemo(
    () => chatMessages.filter((m) => m.role === "user").length,
    [chatMessages]
  );

  const teacherMeta = AI_TEACHERS.find((t) => t.id === selectedTeacher) || AI_TEACHERS[0];
  const teacherEmoji = teacherMeta.emoji || "🦊";
  const teacherDisplayName = `AI Teacher — ${teacherMeta.name
    .replace(/^Teacher\s+/i, "")
    .replace(/^Captain\s+/i, "")
    .replace(/^Miss\s+/i, "")
    .replace(/^Professor\s+/i, "")}`;
  const activeScenario = getScenarioById(activeScenarioId);
  const inputDisabled = chatLoading || recording;

  const answerSuggestions = useMemo(
    () =>
      getAnswerSuggestions(
        lastAssistantMsg?.text,
        lastAssistantMsg?.correctedSentence
      ),
    [lastAssistantMsg]
  );

  const handleListenAgain = () => {
    if (lastAssistantMsg?.text) speakEnglishText(lastAssistantMsg.text, 0.95);
  };

  const handleSpeakSlow = () => {
    if (lastAssistantMsg?.text) speakEnglishText(lastAssistantMsg.text, 0.72);
  };

  const handleTranslate = () => {
    if (lastAssistantMsg) void toggleVietnamese(lastAssistantMsg);
  };

  const handleHint = () => {
    const hintParts = [
      lastAssistantMsg?.tip,
      lastAssistantMsg?.ipa ? `IPA: ${lastAssistantMsg.ipa}` : "",
      lastAssistantMsg?.mistakesExplanation,
    ].filter(Boolean);
    const hintLine = hintParts.join(" · ");
    if (hintLine) speakEnglishText(hintLine, 0.82);
    else if (lastAssistantMsg?.text) speakEnglishText(lastAssistantMsg.text, 0.78);
  };

  const handleContinue = () => {
    void sendChat("Let's continue with the next question.", { source: "continue" });
  };

  const viByMessageId = useMemo(() => {
    const map = {};
    for (const m of chatMessages) {
      if (m.showVi && m.viText) map[m.id] = m.viText;
    }
    return map;
  }, [chatMessages]);

  const showFeedbackActions = Boolean(speakingFeedback) && !chatLoading && !recording;

  const handleSuggestionPick = (text) => {
    void sendChat(text, { source: "suggestion" });
  };

  return (
    <main className={`speaking-page speaking-page--mockup speaking-page--chat-first${sessionMode === "voice_call" ? " speaking-page--ai-call" : ""}`}>
      {sessionMode !== "voice_call" ? (
        <SpeakingPageHeader
          streakDays={7}
          minutesToday={Math.max(1, turnCount * 2)}
          avgScore={speakingFeedback?.total ?? null}
          onHistory={() => router.push("/progress")}
          onRestart={resetChatFromStart}
          restartDisabled={chatLoading || recording}
        />
      ) : null}

      {loading ? (
        <p className="speaking-page__status speaking-page__status--loading">Đang tải từ vựng bài…</p>
      ) : null}
      {!loading && error && sessionMode !== "voice_call" ? (
        <p className="speaking-page__status speaking-page__status--error">{error}</p>
      ) : null}

      {sessionMode === "voice_call" ? (
        <AiCallLayout
          sessionMode={sessionMode}
          onSessionModeChange={handleSessionModeChange}
          activeScenarioId={activeScenarioId}
          onScenarioPick={pickScenario}
          selectedTeacher={selectedTeacher}
          onSelectTeacher={setSelectedTeacher}
          onEndSession={resetChatFromStart}
        />
      ) : (
        <>
          <SpeakingSessionBar
            sessionMode={sessionMode}
            onSessionModeChange={handleSessionModeChange}
            quickSecsLeft={sessionMode === "quick_5" ? quickSecsLeft : null}
            quickDoneMessage={
              sessionMode === "quick_5" && quickSecsLeft === 0
                ? "⏱️ Hết 5 phút! Xem phản hồi bên phải và bấm Tiếp tục."
                : ""
            }
            scenarioSlot={
              sessionMode === "scenario" ? (
                <SpeakingScenarioChips
                  activeScenarioId={activeScenarioId}
                  onPick={pickScenario}
                  disabled={inputDisabled}
                />
              ) : null
            }
            inputDisabled={inputDisabled}
          />

          <div className="speaking-studio speaking-grid speaking-grid--mockup">
            <SpeakingRoom
            teacherName={teacherDisplayName}
            teacherEmoji={teacherEmoji}
            teacherScore={speakingFeedback?.total ?? null}
            messages={chatMessages}
            listRef={listRef}
            chatLoading={chatLoading}
            recording={recording}
            recordSecs={recordSecs}
            voiceNotice={voiceNotice}
            speechSupported={speechSupported}
            viByMessageId={viByMessageId}
            hasActiveAssistant={Boolean(lastAssistantMsg?.text)}
            viLoading={Boolean(lastAssistantMsg?.viLoading)}
            suggestions={answerSuggestions}
            onSuggestionPick={handleSuggestionPick}
            onListenAgain={handleListenAgain}
            onSpeakSlow={handleSpeakSlow}
            onTranslate={handleTranslate}
            onHint={handleHint}
            onEasierSpeak={handleEasierSpeak}
            onSpeakMessage={speakEnglishText}
            spokenText={spokenText}
            onReplaySpoken={() => {
              const t = String(spokenText || "").trim();
              if (t) speakEnglishText(t, 0.9);
            }}
            onMic={recording ? stopVoice : startVoice}
            onContinue={handleContinue}
            onEndSession={resetChatFromStart}
            chatInput={chatInput}
            onChatInput={setChatInput}
            onSendText={() => sendChat(chatInput)}
            onChatInputFocus={scrollToBottom}
            inputDisabled={inputDisabled}
          />

          <SpeakingProgressPanel
            feedback={speakingFeedback}
            turnCount={turnCount}
            scenarioLabel={activeScenario?.label || ""}
            ipaText={lastAssistantMsg?.ipa || ""}
            selectedTeacher={selectedTeacher}
            onSelectTeacher={setSelectedTeacher}
            practiceMode={practiceMode}
            onPracticeMode={setPracticeMode}
            languageSupportMode={languageSupportMode}
            onLanguageMode={setLanguageSupportMode}
            settingsDisabled={inputDisabled}
            onSpeakBetter={(t) => speakEnglishText(t, 0.88)}
            onRetrySpeak={startVoice}
            onContinue={handleContinue}
            showFeedbackActions={showFeedbackActions}
            actionsDisabled={chatLoading || recording}
            recentMessages={chatMessages}
            rescueSlot={
              <RescuePhrases onPick={handleRescuePhrase} disabled={inputDisabled} />
            }
          />
          </div>
        </>
      )}

    </main>
  );
}
