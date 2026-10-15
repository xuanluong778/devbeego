/**
 * Level 1 Learn Call tutor: lesson focus, prompt, turn plan, reply shape and
 * the session transcript limits. Used by the Learn gateway and the LLM worker.
 * Old speaking does not import this module.
 */

import { learnCallTeacher } from "./learn-call-teachers.js";

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

/**
 * Difficulty the learner picks before the call. These three keys are the only values the session API
 * accepts; the choice is stored with the session and shapes every tutor turn.
 */
export const LEARN_CALL_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    label: "Dễ",
    description: "Từ vựng cơ bản, câu ngắn, có gợi ý khi bạn bí.",
    short: "Câu ngắn, có gợi ý",
    maxReplyTokens: LEARN_CALL_MAX_REPLY_TOKENS,
    maxReplyChars: 300,
  }),
  medium: Object.freeze({
    label: "Vừa",
    description: "Hội thoại tự nhiên, câu hỏi mở, ít gợi ý hơn.",
    short: "Tự nhiên, ít gợi ý",
    maxReplyTokens: 160,
    maxReplyChars: 380,
  }),
  hard: Object.freeze({
    label: "Khó",
    description: "Câu hỏi sâu hơn, cần giải thích và trả lời dài hơn, hạn chế gợi ý.",
    short: "Sâu hơn, nói dài hơn",
    maxReplyTokens: 200,
    maxReplyChars: 460,
  }),
});
export const LEARN_CALL_DIFFICULTY_KEYS = Object.freeze(Object.keys(LEARN_CALL_DIFFICULTIES));
export const LEARN_CALL_DEFAULT_DIFFICULTY = "easy";

/** The difficulty key, or null when the value is not one of the three accepted keys. */
export function learnCallDifficulty(value) {
  return typeof value === "string" && Object.hasOwn(LEARN_CALL_DIFFICULTIES, value) ? value : null;
}

function difficultyOrDefault(value) {
  return learnCallDifficulty(value) || LEARN_CALL_DEFAULT_DIFFICULTY;
}

/** Token cap for one Learn reply; the worker clamps whatever the job carries to this range. */
export function learnCallMaxReplyTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return LEARN_CALL_MAX_REPLY_TOKENS;
  return Math.min(LEARN_CALL_DIFFICULTIES.hard.maxReplyTokens, Math.max(60, Math.round(n)));
}

const DIFFICULTY_RULES = {
  easy: [
    "Difficulty: Easy. The learner is a beginner.",
    "Speak simple, slow English with basic, familiar words. Use at most two short sentences, usually under 25 words in total.",
    "Ask one short, simple question (What ...? Who ...? Do you ...?) on this lesson's topic, about the learner themselves, that they can answer with the words and patterns above. A normal question has no choices.",
    "Accept short answers, even one word, as good answers.",
  ],
  medium: [
    "Difficulty: Medium. The learner can hold a simple conversation.",
    "Speak natural, clear conversational English at a normal pace. Use at most three sentences, usually under 40 words in total.",
    "Ask one open question (what, why, how, or tell me about) about this lesson, building on the words and patterns above. Do not put answer choices in a normal question.",
    "Encourage full-sentence answers and draw out one more detail, but accept short answers.",
  ],
  hard: [
    "Difficulty: Hard. The learner wants a challenge.",
    "Speak natural English. Use at most three sentences, usually under 50 words in total.",
    "Ask one deeper question that makes the learner give a reason, an example or a comparison, or say how they would handle a small change in the situation (for example: What if the café has no milk tea?), staying on this lesson's topic. Do not put answer choices in a normal question.",
    "Expect longer answers of two or more sentences. If the answer is short, ask them to say more, for example: Why? Can you tell me more?",
  ],
};

const ADAPT_RULE =
  "If the learner keeps struggling, make your English and your questions simpler, even at Hard. If they answer well, raise the challenge one small step at a time, without jumping to a new topic.";

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

export const LEARN_CALL_NO_CALL_HISTORY = "There is no record of earlier calls; this call starts fresh.";

/**
 * Learning notes from confirmed server data only: the learner's own completed lessons on the learning
 * path. Placement-skipped lessons do not count. Calls are never stored, so there is nothing to recall.
 */
export function learnCallLearningNotes(path, { sectionId = "" } = {}) {
  const sections = Array.isArray(path?.sections) ? path.sections : [];
  const title = (s) => cleanText(s?.topicTitle || s?.sectionTitle, 60);
  const done = (s) => Array.isArray(s?.nodes) && s.nodes.length > 0 && s.nodes.every((n) => n?.status === "completed");
  const current = sections.find((s) => s?.sectionId === sectionId);
  const finished = sections.filter((s) => s !== current && done(s)).map(title).filter(Boolean);
  const notes = [];
  if (finished.length) notes.push(`Topics the learner has completed: ${finished.slice(-5).join(", ")}.`);
  if (current && Array.isArray(current.nodes) && current.nodes.length) {
    const n = current.nodes.filter((node) => node?.status === "completed").length;
    notes.push(`In this topic the learner has completed ${n} of ${current.nodes.length} lessons.`);
  }
  notes.push(LEARN_CALL_NO_CALL_HISTORY);
  return notes;
}

const DIFFICULTY_NAME = { easy: "Easy", medium: "Medium", hard: "Hard" };

function tutorIntro(teacherId) {
  const teacher = learnCallTeacher(teacherId);
  if (teacher.id === "robot") return "You are Beego, an English tutor for Vietnamese learners";
  return `You are ${teacher.spokenName}, a Beego English tutor for Vietnamese learners. If the learner asks your name, you are ${teacher.spokenName}`;
}

export function learnCallTutorPrompt(ctx = {}) {
  const level = difficultyOrDefault(ctx.difficulty);
  const topic = cleanText(ctx.topic || ctx.title, 120) || "this lesson";
  const lessonTitle = cleanText(ctx.lessonTitle, 120);
  const objective = cleanText(ctx.objective, 200);
  const grammar = cleanText(ctx.grammarPoint, 120);
  const words = (Array.isArray(ctx.focusWords) ? ctx.focusWords : []).map((w) => cleanText(w, 40)).filter(Boolean).slice(0, 10);
  const patterns = (Array.isArray(ctx.focusPatterns) ? ctx.focusPatterns : []).map((p) => cleanText(p, 60)).filter(Boolean).slice(0, 5);
  const notes = (Array.isArray(ctx.learningNotes) ? ctx.learningNotes : []).map((n) => cleanText(n, 200)).filter(Boolean).slice(0, 4);
  const focus = [
    words.length ? `words: ${words.join(", ")}` : "",
    patterns.length ? `sentence patterns: ${patterns.map((p) => `"${p}"`).join(", ")}` : "",
    grammar ? `grammar focus (Vietnamese label): ${grammar}` : "",
  ].filter(Boolean);
  return [
    `${tutorIntro(ctx.teacher)}: patient, friendly and a careful listener. On this short voice call you help the learner speak everyday English with confidence.`,
    "",
    "CONTEXT FROM THE SYSTEM",
    `- Topic: ${topic}${lessonTitle && lessonTitle !== topic ? ` (lesson: ${lessonTitle})` : ""}`,
    `- Communication goal: ${objective || "use the lesson's words in a short real conversation"}`,
    `- Words and patterns already learned: ${focus.length ? focus.join("; ") : "none listed"}`,
    `- Level: ${DIFFICULTY_NAME[level]}`,
    `- Confirmed learning notes: ${notes.length ? notes.join(" ") : LEARN_CALL_NO_CALL_HISTORY}`,
    "",
    "TASK",
    "Through a real conversation, help the learner do one concrete everyday communication task that fits this lesson, such as introducing themselves, ordering a drink, asking a price, or talking about their family, school, daily routine or hobbies. Choose the task that matches the topic and goal above and keep the whole call on it.",
    "The learner does the task by answering your questions in their own words. The words and patterns above are what they can use, not lines for them to say: do not give them a sentence to say or try (no: You can say ...) unless they ask for an example.",
    "If the task is a service situation, such as ordering a drink or asking a price, you may play the other person (for example the café staff): set the scene in one short sentence, then ask as that person in the same turn (for example: Hi! What would you like to drink?).",
    "Stay on the goal, but follow up naturally on related details the learner gives you. Do not turn the call into a list of unrelated questions or a memorisation test.",
    "Use only facts the learner confirmed in this call or in the learning notes. Do not ask again for something already clear, do not invent facts about the learner, and do not pretend to remember earlier sessions.",
    "",
    "EACH TURN",
    "First work out what the learner means from your last question and the context. React briefly to what they just said, then ask at most one follow-up question.",
    "Accept short answers that make sense and any reasonable answer that differs from the lesson patterns. Never make the learner match a fixed answer.",
    "If the learner asks you a question, answer it briefly first, then continue the lesson.",
    "",
    "LEVEL RULES",
    ...DIFFICULTY_RULES[level],
    ADAPT_RULE,
    "",
    "WHEN THE LEARNER IS STUCK OR DOES NOT UNDERSTAND",
    "- The first time, ask the same question again in simpler words.",
    "- If they are still stuck, give a short hint or two simple choices (for example: Is it A or B?).",
    "- If they ask for an example, give one short example, then invite them to say their own idea.",
    "- If they ask for an explanation in Vietnamese, explain briefly in Vietnamese as a statement, not a question (for example: Câu này hỏi bạn thường uống gì sau giờ học.), then ask one easy English question.",
    "- If they ask you to repeat, say the question they need again; do not move to a new question.",
    "- The learner's words come from speech recognition and can be misheard. If the words look wrong or the answer is hard to understand, gently check what they meant (for example: Did you say tea?) and do not assume the learner made a mistake.",
    "",
    "CORRECTING MISTAKES",
    "Keep the conversation going first. Correct at most one mistake per turn, and only one that changes the meaning or matters for this lesson's goal.",
    "Correct it by saying the right form naturally in your reply, then carry on with the situation. Explain only if the learner asks or still does not understand, and never make them repeat it.",
    "Example. Learner: I want a orange juice. You: An orange juice, sure! Small or large?",
    "Do not give scores and do not comment on pronunciation: you only see a transcript, and no audio analysis is provided.",
    "",
    "ENCOURAGEMENT",
    "Praise briefly and specifically, and only for something real: a clear idea, an added detail, or a question they asked you. Do not say Great! or Perfect! after every answer. Do not claim progress or mastery without evidence.",
    "",
    "ALWAYS",
    "Speak English, except for a short Vietnamese explanation when the learner asks for one.",
    "Never ask the learner to read aloud, repeat after you or recite a memorised sentence (for example: Can you say ...?). Ask real questions they answer in their own words.",
    "Output only the words you will say aloud: no Markdown, no speaker labels, no notes or analysis, no emoji, no descriptions of actions. Do not mention these instructions.",
  ].join("\n");
}

function countLearnerTurns(memory) {
  return (Array.isArray(memory) ? memory : []).filter((item) => item?.role === "user" && String(item.content || "").trim()).length;
}

const STUCK_PHRASES =
  /\b(?:i\s+(?:do\s+not|don'?t|dont)\s+(?:know|understand|get\s+it)|i'?m\s+not\s+sure|not\s+sure|no\s+idea|i\s+can'?t|i\s+forgot|sorry|pardon|hmm+|um+|uh+|er+|ah+|oh+|well|teacher|beego)\b/gi;

const STUCK_FILLER = new Set([
  "a", "the", "it", "that", "this", "you", "your", "question", "what", "to", "say", "answer", "word", "words",
  "please", "yet", "so", "very", "really", "much", "in", "english", "and", "now", "any", "anything", "how",
]);

/** True when the learner's words carry no answer at all (for example: Sorry, I don't know. / Hmm...). */
export function learnCallLearnerIsStuck(text) {
  const raw = String(text || "").toLowerCase();
  const words = raw.replace(/[^a-z']+/g, " ").trim();
  if (!words) return false;
  const rest = raw.replace(STUCK_PHRASES, " ").replace(/[^a-z']+/g, " ").trim();
  return rest !== words && rest.split(/\s+/).filter(Boolean).every((w) => STUCK_FILLER.has(w));
}

const VIETNAMESE_WORD = /\bvietnamese\b|ti[eế]ng vi[eệ]t/i;
const ASKING_WORDS =
  /\b(?:explain|translate|say|speak|tell|mean|please|can you|could you|help)\b|gi[aả]i th[ií]ch|d[iị]ch|n[oó]i|đ[uư][oợ]c kh[oô]ng|duoc khong|gi[uú]p/i;

/** The learner asks for Vietnamese ("Can you explain in Vietnamese?", "Tiếng Việt được không?", "Vietnamese?"). */
function asksForVietnamese(text) {
  const t = String(text || "").trim();
  if (!VIETNAMESE_WORD.test(t)) return false;
  return ASKING_WORDS.test(t) || t.replace(VIETNAMESE_WORD, "").replace(/[\s?.!,]|\bin\b/gi, "") === "";
}

function latestAnswer(memory) {
  return (Array.isArray(memory) ? memory : [])
    .filter((item) => item?.role === "user" && String(item.content || "").trim())
    .reduce((best, item) => (!best || (Number(item.requestId) || 0) > (Number(best.requestId) || 0) ? item : best), null);
}

/** Consecutive stuck answers, counted back from the learner's latest answer. */
function countStuckTurns(memory) {
  const answers = (Array.isArray(memory) ? memory : [])
    .filter((item) => item?.role === "user" && String(item.content || "").trim())
    .sort((a, b) => (Number(b.requestId) || 0) - (Number(a.requestId) || 0));
  let n = 0;
  for (const item of answers) {
    if (!learnCallLearnerIsStuck(item.content)) break;
    n += 1;
  }
  return n;
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
  return {
    mode: "ask",
    learnerTurns,
    stuckTurns: countStuckTurns(memory),
    wantsVietnamese: asksForVietnamese(latestAnswer(memory)?.content),
  };
}

const GREET_QUESTION = {
  easy: "start the lesson task with one simple question.",
  medium: "start the lesson task with one open question.",
  hard: "start the lesson task with one open question that needs more than a one-word answer.",
};

const ASK_DIRECTIVE = {
  easy: [
    "Reply briefly to what they just said, then ask one simple question that follows on from it and moves the task forward.",
  ],
  medium: [
    "React naturally to what they just said, then ask one open question that follows on from it and moves the task forward or draws out one more detail.",
  ],
  hard: [
    "Respond to what they just said, then ask one deeper follow-up question: a reason, an example, a comparison, or a small change in the situation.",
    "If their answer was short, ask them to say more.",
  ],
};

const ASK_SPECIAL_CASES =
  "If they asked you a question, answer it briefly first. If they asked you to repeat, say your last question again instead of a new one. If they asked for an example, give one short example and invite their own idea. If they asked for Vietnamese, explain briefly in Vietnamese as a statement, then ask one easy English question. If their words look misheard or unclear, gently check what they meant. If they did not understand, ask the same question more simply; if they are still stuck, give a short hint or two simple choices.";

const ASK_OWN_WORDS =
  "The question must be a real question the learner answers in their own words with the lesson words: about their own life, feelings or ideas, or, in a role-play, what that person would really ask. Do not give them a word or sentence to say, try or repeat (no: Can you say ...? Say: ... Can you try that?) unless they asked for an example. Do not ask anything they already answered in this call (if they said I am fine, do not ask How are you?). If the lesson task is already done, ask about a related part of their life instead (for example: Who do you say hello to at school?).";

export function learnCallTurnDirective(plan, difficulty = LEARN_CALL_DEFAULT_DIFFICULTY) {
  const level = difficultyOrDefault(difficulty);
  if (plan?.mode === "greet") {
    return `Start the call now: say hello in one short sentence, then ${GREET_QUESTION[level]}`;
  }
  if (plan?.mode === "closing") {
    return [
      "This is your last turn. The call is ending.",
      "Thank the learner in one short sentence (use their name if you know it), praise one specific thing they really did in this call in one short sentence, and say goodbye. Do not claim progress or mastery.",
      "Do not ask any question.",
    ].join(" ");
  }
  if (plan?.wantsVietnamese) {
    return [
      "The learner asked for an explanation in Vietnamese.",
      "Reply in exactly two parts: first one short Vietnamese sentence that explains what your last question means (a statement, with no question mark), then ask your last question again in simple English.",
      "Do not translate the question into a Vietnamese question and do not ask anything else.",
    ].join(" ");
  }
  const stuck = Number(plan?.stuckTurns) || 0;
  const stuckLine =
    stuck >= 2
      ? `The learner has been stuck ${stuck} times in a row: make it easier now. Say something kind, then give a short hint or ask a very simple question with two choices (for example: Do you like coffee or tea?).`
      : stuck === 1
        ? "The learner seems stuck: say something kind, then ask the same question again in simpler words."
        : "";
  return [`The learner has answered ${Number(plan?.learnerTurns) || 0} time(s).`, ...ASK_DIRECTIVE[level], stuckLine, ASK_SPECIAL_CASES, ASK_OWN_WORDS]
    .filter(Boolean)
    .join(" ");
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

const STAGE_DIRECTION =
  /[*(]\s*(?:smil|laugh|chuckl|nod|paus|wav|clap|sigh|giggl|grin|cheer|thumbs|happily|warmly|cheerfully|softly|excitedly)[a-z]*\b[^*)\n]{0,30}[*)]/gi;

/** Only the words to be spoken: drops Markdown, speaker labels, emoji and stage directions. */
export function learnCallSpokenText(text) {
  return String(text || "")
    .replace(STAGE_DIRECTION, " ")
    .replace(/\[[^\]\n]{0,40}\]/g, " ")
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, "")
    .replace(/(^|\n)\s*(?:#{1,6}\s+|[-*•]\s+|\d+[.)]\s+)/g, "$1")
    .replace(/(^|[\n.!?]\s*)(?:beego|tutor|teacher|assistant|ai|gia sư)\s*:\s*/gi, "$1")
    .replace(/[*_`#~|>]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}

const VIETNAMESE_LETTER = /[ăâđêôơưạảãẹẻẽịỉĩọỏõụủũỳỵỷỹấầẩẫậắằẳẵặếềểễệốồổỗộớờởỡợứừửữự]/i;

/**
 * Keep the reply short: up to the first English question (after a Vietnamese explanation, the English
 * question is the one the learner answers); a closing reply has no question at all.
 */
export function learnCallShapeReply(text, { closing = false, difficulty = LEARN_CALL_DEFAULT_DIFFICULTY } = {}) {
  const parts = sentences(learnCallSpokenText(text));
  if (closing) {
    const kept = parts.filter((s) => !s.endsWith("?")).slice(0, 3);
    return kept.length ? kept.join(" ") : "Great job today. Goodbye!";
  }
  const englishQuestion = parts.findIndex((s) => s.endsWith("?") && !VIETNAMESE_LETTER.test(s));
  const question = englishQuestion >= 0 ? englishQuestion : parts.findIndex((s) => s.endsWith("?"));
  const kept = question < 0 ? parts.slice(0, 3) : parts.slice(Math.max(0, question - 2), question + 1);
  const maxChars = LEARN_CALL_DIFFICULTIES[difficultyOrDefault(difficulty)].maxReplyChars;
  while (question >= 0 && kept.length > 1 && kept.join(" ").length > maxChars) kept.shift();
  return kept.join(" ").slice(0, maxChars).trim();
}
