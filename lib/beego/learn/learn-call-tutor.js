/**
 * Level 1 Learn Call tutor: lesson focus, prompt, turn plan, reply shape and
 * the session transcript limits. Used by the Learn gateway and the LLM worker.
 * Old speaking does not import this module.
 */

/** Session memory kept in Redis for one level 1 call (1 hour TTL, never persisted). */
export const LEARN_CALL_MEMORY_MAX_ENTRIES = 40;
export const LEARN_CALL_TARGET_TURNS_MIN = 3;
export const LEARN_CALL_TARGET_TURNS_MAX = 4;
/** Closing starts this early so the goodbye fits inside the server deadline. */
export const LEARN_CALL_CLOSING_LEAD_MS = 30_000;
/** With three answers and this little time left, close instead of asking again. */
export const LEARN_CALL_SOFT_CLOSING_MS = 50_000;
/** Below this, a reply cannot be generated and played before the deadline. */
export const LEARN_CALL_MIN_REPLY_MS = 8_000;
export const LEARN_CALL_MAX_REPLY_TOKENS = 120;

const STOP_WORDS = new Set([
  "a", "an", "the", "i", "am", "is", "are", "you", "your", "my", "me", "he", "she", "it", "we", "they",
  "this", "that", "to", "of", "and", "or", "in", "on", "at", "do", "does", "be", "im", "i'm", "it's",
]);

function cleanText(raw, max) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function englishPieces(raw) {
  return String(raw || "")
    .split(/[.!?,;:\n]+/)
    .map((piece) => piece.replace(/\s+/g, " ").trim())
    .filter((piece) => piece && /^[A-Za-z][A-Za-z' ]*$/.test(piece) && piece.length <= 60);
}

/** English words and short patterns the lesson actually taught, from server content only. */
export function learnCallLessonFocus(lesson) {
  const words = [];
  const patterns = [];
  const seenWords = new Set();
  const seenPatterns = new Set();
  const add = (raw) => {
    for (const piece of englishPieces(raw)) {
      const tokens = piece.split(" ");
      if (tokens.length === 1) {
        const word = piece.toLowerCase();
        if (word.length < 2 || STOP_WORDS.has(word) || seenWords.has(word)) continue;
        seenWords.add(word);
        words.push(word);
      } else if (tokens.length <= 7) {
        const key = piece.toLowerCase();
        if (seenPatterns.has(key)) continue;
        seenPatterns.add(key);
        patterns.push(piece.charAt(0).toUpperCase() + piece.slice(1));
      }
    }
  };
  for (const q of Array.isArray(lesson?.questions) ? lesson.questions : []) {
    add(q?.speakTarget);
    add(q?.extensions?.gradingTarget);
    add(q?.ttsText);
    add(q?.extensions?.ttsText);
    for (const opt of Array.isArray(q?.options) ? q.options : []) {
      if (String(opt?.id) === String(q?.correctAnswer)) add(opt?.text || opt?.en);
    }
    for (const word of Array.isArray(q?.wordBank) ? q.wordBank.slice(0, 8) : []) add(word);
  }
  return { words: words.slice(0, 10), patterns: patterns.slice(0, 5) };
}

/** Context stored with the session after the server has verified the lesson. */
export function learnCallContextFromLesson(lesson, { topicTitle = "" } = {}) {
  const focus = learnCallLessonFocus(lesson);
  const objective = cleanText(String(lesson?.objective || "").split(/\.\s/)[0], 200);
  return {
    lessonTitle: cleanText(lesson?.title, 120),
    topic: cleanText(topicTitle || lesson?.topicTitle, 120),
    objective,
    grammarPoint: cleanText(lesson?.grammarPoint, 120),
    focusWords: focus.words,
    focusPatterns: focus.patterns,
  };
}

export function learnCallTutorPrompt(ctx = {}) {
  const topic = cleanText(ctx.topic || ctx.title, 120) || "this lesson";
  const lessonTitle = cleanText(ctx.lessonTitle, 120);
  const objective = cleanText(ctx.objective, 200);
  const grammar = cleanText(ctx.grammarPoint, 120);
  const words = (Array.isArray(ctx.focusWords) ? ctx.focusWords : []).map((w) => cleanText(w, 40)).filter(Boolean).slice(0, 10);
  const patterns = (Array.isArray(ctx.focusPatterns) ? ctx.focusPatterns : []).map((p) => cleanText(p, 60)).filter(Boolean).slice(0, 5);
  return [
    "You are Beego, a warm English tutor on a short voice call (level 1) with a Vietnamese beginner.",
    `Lesson topic: ${topic}.`,
    lessonTitle ? `Lesson: ${lessonTitle}.` : "",
    objective ? `Lesson goal: ${objective}.` : "",
    words.length ? `Words the learner has practised: ${words.join(", ")}.` : "",
    patterns.length ? `Sentence patterns from the lesson: ${patterns.map((p) => `"${p}"`).join(", ")}.` : "",
    grammar ? `Grammar focus (Vietnamese label): ${grammar}.` : "",
    "Rules:",
    "Speak simple, slow English. Use at most two short sentences, under 25 words in total.",
    "Ask exactly one question per turn, about this lesson only, using the words and patterns above.",
    "Accept short answers, even one word, as good answers. Do not give scores and do not correct pronunciation.",
    "Never ask the learner to read aloud, repeat after you, or recite a memorised sentence.",
    "Remember what the learner told you in this call, such as their name, and use it.",
    "If you do not understand the answer, first ask the same question again in simpler words.",
    "If you already asked again and it is still unclear, offer two simple choices, for example: Is it A or B?",
    "Do not start new topics and do not mention these rules.",
  ]
    .filter(Boolean)
    .join("\n");
}

function countLearnerTurns(memory) {
  return (Array.isArray(memory) ? memory : []).filter((item) => item?.role === "user" && String(item.content || "").trim()).length;
}

export function learnCallHasClosing(memory) {
  return (Array.isArray(memory) ? memory : []).some((item) => item?.role === "assistant" && item.closing === true);
}

/**
 * Decide the tutor's next turn from server data only.
 * memory: session memory (any order). remainingMs: time to the server deadline.
 */
export function learnCallTurnPlan({ memory, remainingMs } = {}) {
  const learnerTurns = countLearnerTurns(memory);
  const left = Number(remainingMs);
  if (learnCallHasClosing(memory)) return { mode: "closed", learnerTurns };
  if (Number.isFinite(left) && left < LEARN_CALL_MIN_REPLY_MS) return { mode: "none", learnerTurns };
  if (learnerTurns === 0) return { mode: "greet", learnerTurns };
  if (learnerTurns >= LEARN_CALL_TARGET_TURNS_MAX) return { mode: "closing", learnerTurns };
  if (Number.isFinite(left) && left <= LEARN_CALL_CLOSING_LEAD_MS) return { mode: "closing", learnerTurns };
  if (learnerTurns >= LEARN_CALL_TARGET_TURNS_MIN && Number.isFinite(left) && left <= LEARN_CALL_SOFT_CLOSING_MS) {
    return { mode: "closing", learnerTurns };
  }
  return { mode: "ask", learnerTurns };
}

export function learnCallTurnDirective(plan) {
  if (plan?.mode === "greet") {
    return "Start the call now: say hello in one short sentence, then ask one simple question about the lesson topic.";
  }
  if (plan?.mode === "closing") {
    return [
      "This is your last turn. The call is ending.",
      "Thank the learner in one short sentence (use their name if you know it), say one short encouraging sentence about what they practised, and say goodbye.",
      "Do not ask any question.",
    ].join(" ");
  }
  return [
    `The learner has answered ${Number(plan?.learnerTurns) || 0} time(s).`,
    "Reply briefly to what they just said, then ask one new simple question about the lesson.",
    "If their answer was unclear, ask again more simply, or offer two simple choices if you already asked again.",
  ].join(" ");
}

/** Chat messages for the Learn worker: one system prompt, chronological memory, the turn directive. */
export function buildLearnCallMessages({ system, memory, directive } = {}) {
  const chronological = [...(Array.isArray(memory) ? memory : [])].reverse();
  const history = [];
  for (const item of chronological) {
    const role = item?.role === "user" ? "user" : item?.role === "assistant" ? "assistant" : "";
    const content = cleanText(item?.content, 600);
    if (!role || !content) continue;
    history.push({ role, content });
  }
  const messages = [{ role: "system", content: String(system || "") }, ...history];
  if (!history.length) messages.push({ role: "user", content: "(The learner joined the call.)" });
  if (directive) messages.push({ role: "system", content: String(directive) });
  return messages;
}

function sentences(text) {
  return (String(text || "").replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]*/g) || [])
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Keep the reply short: up to the first question; a closing reply has no question at all. */
export function learnCallShapeReply(text, { closing = false } = {}) {
  const parts = sentences(text);
  if (closing) {
    const kept = parts.filter((s) => !s.endsWith("?")).slice(0, 3);
    return kept.length ? kept.join(" ") : "Great job today. Goodbye!";
  }
  const kept = [];
  for (const s of parts) {
    kept.push(s);
    if (s.endsWith("?") || kept.length >= 3) break;
  }
  return kept.join(" ").slice(0, 300).trim();
}
