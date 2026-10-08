/**
 * Adaptive Learn-chat support. Lesson position and catalog level are a start,
 * not a required difficulty. CEFR is never raised here.
 */

const SUPPORT = ["low", "medium", "high"];
const HELP_RE =
  /(don'?t know|do not understand|i'?m stuck|help me|what does|nghĩa là|giải thích|không hiểu|không biết|gợi ý|dễ hơn|make it easier)/i;
const FILLER = new Set(["yes", "no", "ok", "okay", "um", "uh", "hmm"]);

function parseLessonPosition(lessonId) {
  const match = String(lessonId || "").match(/^p(\d+)-g\d+-n(\d+)$/i);
  if (!match) return { part: 1, node: 1 };
  return { part: Number(match[1]), node: Number(match[2]) };
}

function stageForNode(node) {
  const n = Number(node) || 1;
  if (n <= 5) return "early";
  if (n <= 11) return "mid";
  return "late";
}

function clampSupport(level, delta) {
  const index = Math.max(0, SUPPORT.indexOf(level));
  return SUPPORT[Math.max(0, Math.min(SUPPORT.length - 1, index + delta))];
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentTokens(value) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token && !FILLER.has(token));
}

function usesLessonLanguage(message, vocabularyWords) {
  const tokens = new Set(contentTokens(message));
  return (vocabularyWords || []).some((word) =>
    normalizeText(word)
      .split(" ")
      .filter(Boolean)
      .some((part) => tokens.has(part))
  );
}

function lastAssistantText(history) {
  const rows = Array.isArray(history) ? history : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.role === "assistant" && String(rows[i].content || "").trim()) {
      return String(rows[i].content);
    }
  }
  return "";
}

/**
 * Starting support from where the lesson sits. Not a cap and not a CEFR change.
 * @param {{ lessonId?: string, level?: string }} input
 */
export function resolveLearnLessonDifficulty(input = {}) {
  const { part, node } = parseLessonPosition(input.lessonId);
  const stage = stageForNode(node);
  const supportLevel = stage === "early" ? "high" : stage === "mid" ? "medium" : "low";
  const level = String(input.level || "A1").trim() || "A1";
  return {
    level,
    part,
    node,
    stage,
    supportLevel,
    languageComplexity: "lesson",
  };
}

/**
 * @param {{
 *   message?: string,
 *   history?: Array<{ role: string, content: string }>,
 *   vocabularyWords?: string[],
 *   objective?: string,
 *   sessionId?: string|number,
 *   state?: {
 *     supportLevel?: string,
 *     languageComplexity?: string,
 *     sessions?: Array<{ sessionId: string, independent: boolean, goalMet: boolean }>,
 *   },
 *   start?: { supportLevel?: string, languageComplexity?: string, level?: string },
 * }} input
 */
export function decideLearnAdaptation(input = {}) {
  const start = input.start || resolveLearnLessonDifficulty(input);
  const state = input.state || {};
  const supportNow = SUPPORT.includes(state.supportLevel) ? state.supportLevel : start.supportLevel;
  const complexityNow = ["simplified", "lesson", "stretch"].includes(state.languageComplexity)
    ? state.languageComplexity
    : "lesson";
  const sessions = Array.isArray(state.sessions) ? state.sessions.map((row) => ({ ...row })) : [];
  const goal = String(input.objective || "").trim() || "Practice the language of this lesson.";
  const message = String(input.message || "").trim();
  const vocab = input.vocabularyWords || [];
  const echo =
    normalizeText(message) !== "" &&
    normalizeText(message) === normalizeText(lastAssistantText(input.history));
  const askedForHelp = HELP_RE.test(message);
  const lessonLanguage = usesLessonLanguage(message, vocab);
  const ownAttempt = contentTokens(message).length >= 2 || lessonLanguage;
  const goalMet = !askedForHelp && !echo && (lessonLanguage || contentTokens(message).length >= 2);
  const independent = goalMet && !askedForHelp && !echo;
  const priorIndependentSessions = new Set(
    sessions.filter((row) => row.independent && row.goalMet).map((row) => String(row.sessionId))
  );
  const sessionKey = String(input.sessionId || "");
  const newIndependentSession =
    Boolean(sessionKey) && independent && !priorIndependentSessions.has(sessionKey);
  if (newIndependentSession) {
    sessions.push({ sessionId: sessionKey, independent: true, goalMet: true });
  }

  let supportLevel = supportNow;
  let languageComplexity = complexityNow;
  let reason = "No new evidence. Keep the current support and the lesson's own language.";

  if (askedForHelp) {
    supportLevel = clampSupport(supportNow, 1);
    languageComplexity = "simplified";
    reason =
      "The learner asked for help or an explanation. Simplify the language and add a hint, but keep the same communicative goal.";
  } else if (echo) {
    reason =
      "The learner repeated the previous reply. Keep support; a repeated sentence is not an independent answer.";
  } else if (newIndependentSession && priorIndependentSessions.size >= 2) {
    supportLevel = clampSupport(supportNow, -1);
    languageComplexity = "stretch";
    reason = `The learner answered independently and met the goal in ${priorIndependentSessions.size} earlier sessions. Raise the challenge only inside this lesson's language.`;
  } else if (independent) {
    reason =
      "This answer is independent, but challenge stays until the same goal is met across more than one session.";
  } else if (message) {
    reason =
      "The reply did not show an independent attempt at the lesson goal. Support stays; sentence length is not treated as success.";
  }

  return {
    catalogLevel: start.level,
    supportLevel,
    languageComplexity,
    communicativeGoal: goal,
    reason,
    askedForHelp,
    independent,
    goalMet,
    priorIndependentSessions: priorIndependentSessions.size,
    sessions,
  };
}

export function describeAdaptationForPrompt(decision) {
  const supportLine = {
    high: "Give a model answer and two example choices before the question.",
    medium: "Give one sentence starter, then the question.",
    low: "Ask one open question. Do not model the answer unless the learner asks for help.",
  }[decision.supportLevel];
  const complexityLine = {
    simplified:
      "Use familiar words and patterns from this lesson. Add a hint. A shorter sentence is allowed. Do not add grammar the lesson does not teach.",
    lesson:
      "Use this lesson's vocabulary and grammar only as the content allows. Do not treat sentence length as the measure of difficulty.",
    stretch:
      "Ask the learner to say their own idea with this lesson's language. Do not introduce a new CEFR level or a structure the lesson does not use.",
  }[decision.languageComplexity];
  return [
    "ADAPTATION (lesson position is only the starting support, not a required level):",
    `- catalog level stays ${decision.catalogLevel}. Do not raise CEFR.`,
    `- communicative goal, unchanged: ${decision.communicativeGoal}`,
    `- support: ${decision.supportLevel}. ${supportLine}`,
    `- language complexity, separate from support: ${decision.languageComplexity}. ${complexityLine}`,
    `- reason: ${decision.reason}`,
  ].join("\n");
}
