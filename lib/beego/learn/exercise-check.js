import { scoreText } from "@/lib/client-pronunciation-eval";
import { gradeMatchAnswer } from "@/lib/beego/learn/match-pairs";
import { gradeWordOrder } from "@/lib/beego/learn/word-bank";
import { gradeListenDictation } from "@/lib/beego/learn/listen-dictation";
import { gradeTranslation } from "@/lib/beego/learn/translation";
import { gradeContextCloze } from "@/lib/beego/learn/context-cloze";

function resolveType(exercise) {
  return String(exercise?.type || "");
}

export function hasAnswerSelected(exercise, answer) {
  if (!exercise) return false;
  const type = resolveType(exercise);

  if (type === "word_order") {
    return Array.isArray(answer) && answer.length > 0;
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

  if (type === "speaking" || type === "pronunciation") {
    // Never trust client-provided passed flag — require transcript scoring path
    if (answer && typeof answer === "object" && answer.transcript) {
      const scored = scoreSpeakingAttempt(exercise, String(answer.transcript || ""));
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
    return exercise.speakTarget || exercise.extensions?.speakTarget || "—";
  }
  if (type === "listening_dictation") {
    return exercise.extensions?.transcript || String(exercise.correctAnswer || "—");
  }
  if (type === "translation") {
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

/** Score speaking attempt without mutating answer state. */
export function scoreSpeakingAttempt(exercise, transcript) {
  const target =
    exercise.speakTarget ||
    exercise.extensions?.speakTarget ||
    exercise.prompt ||
    "";
  const score = scoreText(transcript, target);
  const min = Number(exercise.minScore ?? exercise.extensions?.minScore ?? 65);
  return { score, passed: score >= min, transcript };
}
