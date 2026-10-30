import { scoreText } from "@/lib/client-pronunciation-eval";
import { gradeMatchAnswer } from "@/lib/beego/learn/match-pairs";
import { gradeWordOrder } from "@/lib/beego/learn/word-bank";
import { gradeListenDictation } from "@/lib/beego/learn/listen-dictation";
import { gradeTranslation } from "@/lib/beego/learn/translation";
import { gradeContextCloze } from "@/lib/beego/learn/context-cloze";
import {
  gradeFocusProduction,
  gradeGreetingProduction,
  reviewVariantText,
  scoreRecognizedSpeech,
} from "@/lib/beego/learn/speech-coach";

function resolveType(exercise) {
  return String(exercise?.type || "");
}

export function hasAnswerSelected(exercise, answer) {
  if (!exercise) return false;
  const type = resolveType(exercise);

  if (type === "word_order") {
    return Array.isArray(answer) && answer.length > 0;
  }
  if (type === "passage_read") {
    return Boolean(answer && answer.passageAttemptId && answer.submitted === true);
  }
  if (type === "speaking" || type === "pronunciation") {
    return Boolean(answer && (answer.submitted === true || answer.passed != null));
  }
  if (type === "matching_pairs") {
    return Boolean(answer && answer.completed === true);
  }
  if (type === "listening_dictation") {
    const text = typeof answer === "object" && answer ? answer.text : answer;
    return String(text || "").trim().length > 0;
  }
  if (type === "translation") {
    if (exercise?.extensions?.inputMode === "text") return String(answer || "").trim().length > 0;
    return Array.isArray(answer) && answer.length > 0;
  }
  if (type === "context_cloze" && exercise?.extensions?.inputMode === "text") {
    return String(answer || "").trim().length > 0;
  }
  if (answer == null) return false;
  if (typeof answer === "object" && answer !== null && "value" in answer) {
    return String(answer.value ?? "").length > 0;
  }
  return String(answer).length > 0;
}

export function checkAnswer(exercise, answer) {
  if (!exercise || answer == null) return false;
  const type = resolveType(exercise);

  if (type === "word_order") {
    return gradeWordOrder(exercise, answer);
  }

  if (type === "passage_read") {
    return false;
  }

  if (type === "speaking" || type === "pronunciation") {
    // Never trust client-provided passed flag — require transcript scoring path
    if (answer && typeof answer === "object" && answer.transcript) {
      const scored = scoreSpeakingAttempt(exercise, String(answer.transcript || ""), {
        variantId: answer.reviewVariantId,
        practiceChunk: answer.practiceChunk,
      });
      return Boolean(scored.passed);
    }
    return false;
  }

  if (type === "matching_pairs") {
    return gradeMatchAnswer(exercise, answer).accurate;
  }

  if (type === "listening_dictation") {
    const text = typeof answer === "object" && answer ? answer.text ?? answer.value : answer;
    const expected = exercise.extensions?.transcript || exercise.correctAnswer || "";
    return gradeListenDictation(expected, text);
  }

  if (type === "translation") {
    if (exercise?.extensions?.productionKind === "greeting") return gradeGreetingProduction(answer);
    if (exercise?.extensions?.productionKind === "focus_phrases") {
      return gradeFocusProduction(answer, exercise?.extensions?.focusWords);
    }
    return gradeTranslation(exercise, answer);
  }

  if (type === "context_cloze" && exercise?.extensions?.inputMode === "text") {
    return gradeContextCloze(exercise, answer);
  }

  const expected = exercise.correctAnswer;
  const given = typeof answer === "object" && answer && "value" in answer ? answer.value : answer;
  return String(given) === String(expected);
}

export function getCorrectAnswerDisplay(exercise) {
  const type = resolveType(exercise);
  if (type === "word_order") {
    const words = Array.isArray(exercise.correctAnswer)
      ? exercise.correctAnswer
      : String(exercise.correctAnswer || "").split(" ");
    return words.join(" ");
  }
  if (type === "matching_pairs") {
    const count = Array.isArray(exercise.pairs) ? exercise.pairs.length : 0;
    return count ? `${count} cặp từ` : "—";
  }
  if (type === "speaking" || type === "pronunciation") {
    const mode = String(exercise?.extensions?.gradingMode || "");
    if (mode === "communicative_rubric" || exercise?.extensions?.pendingTeacherReview) {
      const focus = resolveFocusWords(exercise);
      const hint = String(exercise?.extensions?.speakingHint || "").trim();
      if (focus.length) return `Cần dùng: ${focus.join(", ")}`;
      return hint || "Nói 3–4 câu theo đề";
    }
    return exercise.speakTarget || exercise.extensions?.speakTarget || "—";
  }
  if (type === "listening_dictation") {
    return exercise.extensions?.transcript || String(exercise.correctAnswer || "—");
  }
  if (type === "translation") {
    if (exercise?.extensions?.productionKind === "greeting") {
      return "Một cách nói: Hello. I'm Linh. Câu khác vẫn đúng nếu có lời chào và giới thiệu mình.";
    }
    if (exercise?.extensions?.productionKind === "focus_phrases") {
      const words = Array.isArray(exercise.extensions?.focusWords)
        ? exercise.extensions.focusWords.map((word) => String(word || "").trim()).filter(Boolean)
        : [];
      return words.length
        ? `Cần có đủ: ${words.join(", ")}. Nhiều câu khác nhau đều đúng nếu dùng đủ các từ này.`
        : "Viết 1–2 câu có từ trọng tâm của bài.";
    }
    return exercise.extensions?.modelSentence || "—";
  }
  if (type === "context_cloze") {
    return exercise.extensions?.completedSentence || "—";
  }
  if (type === "dialogue_response") {
    const opt = exercise.options?.find((o) => o.id === exercise.correctAnswer);
    return opt?.text || exercise.extensions?.reply || "—";
  }
  const opt = exercise.options?.find((o) => o.id === exercise.correctAnswer);
  return opt?.text || String(exercise.correctAnswer ?? "");
}

function normalizeSpeakText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’’']/g, "'")
    .replace(/[.,!?;:"“”()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveFocusWords(exercise) {
  const fromExt = exercise?.extensions?.focusWords;
  if (Array.isArray(fromExt) && fromExt.length) {
    return fromExt.map((w) => String(w || "").trim()).filter(Boolean);
  }
  const prompt = String(exercise?.prompt || "");
  const match = prompt.match(/từ\/cụm:\s*([^.]+)/i);
  if (!match?.[1]) return [];
  return match[1]
    .split(/[,;，、]/)
    .map((w) => w.trim().replace(/^["“]|["”]$/g, ""))
    .filter(Boolean);
}

/**
 * Open situation speaking: require focus vocab in transcript (not free praise for unrelated talk).
 */
export function scoreOpenSituationSpeaking(exercise, transcript) {
  const text = String(transcript || "").trim();
  const normalized = normalizeSpeakText(text);
  const tokenCount = normalized ? normalized.split(" ").filter(Boolean).length : 0;
  const focusWords = resolveFocusWords(exercise);
  const missing = [];
  const hit = [];
  for (const word of focusWords) {
    const needle = normalizeSpeakText(word);
    if (!needle) continue;
    if (normalized.includes(needle)) hit.push(word);
    else missing.push(word);
  }
  const enoughLength = tokenCount >= 6 || text.length >= 24;
  // ≤3 focus words: must use all; more: at least ~2/3.
  const needHits =
    focusWords.length === 0
      ? 0
      : focusWords.length <= 3
        ? focusWords.length
        : Math.max(2, Math.ceil(focusWords.length * 0.67));
  const focusOk = focusWords.length === 0 ? tokenCount >= 8 : hit.length >= needHits;
  const passed = enoughLength && focusOk;
  const coverage =
    focusWords.length === 0 ? (passed ? 1 : tokenCount / 8) : hit.length / focusWords.length;
  const score = Math.max(
    0,
    Math.min(100, Math.round((enoughLength ? 40 : Math.min(35, (tokenCount / 6) * 35)) + coverage * 60))
  );
  return {
    score,
    passed,
    transcript: text,
    pendingTeacherReview: true,
    notPronunciationAssessment: true,
    softPass: true,
    focusWords,
    focusHit: hit,
    focusMissing: missing,
    feedbackVi: passed
      ? `Đã dùng đủ từ trọng tâm: ${hit.join(", ") || "—"}.`
      : missing.length
        ? `Chưa thấy từ/cụm: ${missing.join(", ")}. Hãy nói lại và xen các từ này vào câu.`
        : "Hãy nói dài hơn (3–4 câu ngắn) theo đúng tình huống đề bài.",
  };
}

/** Score speaking attempt without mutating answer state. */
export function scoreSpeakingAttempt(exercise, transcript, options = {}) {
  const text = String(transcript || "").trim();
  const mode = String(exercise?.extensions?.gradingMode || "");
  if (mode === "communicative_rubric" || exercise?.extensions?.pendingTeacherReview) {
    return scoreOpenSituationSpeaking(exercise, text);
  }

  const allowSelfIntroName = Boolean(exercise.extensions?.allowSelfIntroName);

  if (allowSelfIntroName && text) {
    const cleaned = text.toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
    const selfIntroRegex = /^(hello|hi)?\s*(i\s+am|im|i'm|my\s+name\s+is)\s+[a-zÀ-ỹ0-9\s]+$/i;
    if (selfIntroRegex.test(cleaned)) {
      return {
        score: 95,
        passed: true,
        transcript: text,
        notPronunciationAssessment: true,
        softPass: true,
        feedbackVi: "Đủ mẫu câu giới thiệu. Máy chưa chấm phát âm từng âm.",
        focusMissing: [],
      };
    }
  }

  if (mode === "word_match" || mode === "word_match_reference_only" || mode === "") {
    const variantText = reviewVariantText(exercise, options.variantId);
    return scoreRecognizedSpeech(exercise, text, {
      variantText,
      practiceChunk: options.practiceChunk,
    });
  }

  const target =
    exercise.speakTarget ||
    exercise.extensions?.speakTarget ||
    exercise.prompt ||
    "";
  const score = scoreText(transcript, target);
  const min = Number(exercise.minScore ?? exercise.extensions?.minScore ?? 65);
  return { score, passed: score >= min, transcript, notPronunciationAssessment: true, focusMissing: [] };
}
