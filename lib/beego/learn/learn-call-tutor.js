/**
 * Level 1 Learn Call tutor: lesson focus, prompt, turn plan, reply shape and
 * the session transcript limits. Used by the Learn gateway and the LLM worker.
 * Old speaking does not import this module.
 */

import { learnCallTeacher } from "./learn-call-teachers.js";
import {
  NON_NAME_SET,
  learnCallAngleLines,
  learnCallSelectQuestion,
  learnCallCoveredFacets,
  learnCallQuestionFacet,
  learnCallReplyHints,
  learnCallSessionGoals,
  learnCallTopicGuide,
} from "./learn-call-topics.js";
import { learnCallPersonalTurnIds, learnCallPersonalAssistantTurn, learnCallAge, learnCallPersonalCorrection } from "./learn-call-personal.js";
import { buildAiTutorSystemPromptV2 } from "./prompts/ai-tutor-system-prompt.v2.js";
import { learnCallClassifyAnswer, nextRetriesByTarget } from "./learn-call-answer.js";
import { learnCallOpeningScript, learnCallShouldTutorOpen } from "./learn-call-opening.js";

export { learnCallReplyHints, learnCallTopicGuide } from "./learn-call-topics.js";
export { learnCallClassifyAnswer } from "./learn-call-answer.js";
export { learnCallOpeningScript, learnCallShouldTutorOpen } from "./learn-call-opening.js";

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
    description: "A0: câu tiếng Anh 2–6 từ, hỏi có/không hoặc chọn một trong hai. Chấp nhận trả lời một từ hoặc tiếng Việt.",
    short: "A0 · câu rất ngắn",
    maxReplyTokens: 140,
    maxReplyChars: 260,
  }),
  medium: Object.freeze({
    label: "Vừa",
    description: "A1–A2: giao tiếp cơ bản, khuyến khích 1–2 câu, hỗ trợ khi cần.",
    short: "A1–A2 · 1–2 câu",
    maxReplyTokens: 160,
    maxReplyChars: 400,
  }),
  hard: Object.freeze({
    label: "Khó",
    description: "B1–B2: mô tả, giải thích, so sánh và nêu ý kiến; vẫn chỉ một ý mỗi lượt.",
    short: "B1–B2 · giải thích",
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
    "Difficulty: Easy (A0 / pre-A1). The learner has almost no English foundation.",
    "Difficulty only changes how simple your English and support are. It does not change the topic. The topic practice goal outranks a narrow lesson drill (for example do not turn a greetings call into only goodbye practice).",
    "Speak very slow, simple English with familiar words. Prefer short questions, usually under 8 English words, and under 14 words in the whole turn.",
    "Ask exactly one idea per turn. Basic What / Where / How questions about personal facts are allowed (What's your name? How old are you? Where do you live? What do you do? Do you like music?). Yes/no and A-or-B are fine too. Do not ask for long explanations, reasons, or essays.",
    "Accept one-word answers and Vietnamese answers as good. Never force a full English sentence. Never use idioms or slang. Never raise the difficulty during this Easy call.",
  ],
  medium: [
    "Difficulty: Medium (A1–A2). The learner can hold a basic conversation on familiar situations.",
    "Difficulty only changes language and support, not the topic. Speak clear conversational English. Use at most three sentences, usually under 40 words.",
    "Ask one basic open question about this topic. Encourage a 1–2 sentence answer and help when they struggle.",
    "Accept short answers; gently invite one more detail when they can handle it.",
  ],
  hard: [
    "Difficulty: Hard (B1–B2). The learner can explain, compare, give reasons and opinions.",
    "Difficulty only changes language and support, not the topic. Speak natural English. Use at most three sentences, usually under 50 words.",
    "Ask one deeper question that needs a reason, an example, a comparison, or an opinion, still on this topic. Only one idea per turn.",
    "Expect longer answers of two or more sentences. If the answer is short, ask them to say more.",
  ],
};

const ADAPT_RULES = {
  easy: [
    "Never raise the difficulty during this Easy call, even if the learner answers well several times in a row.",
    "If they struggle, say không hiểu, answer in Vietnamese, or give only one word: explain briefly in Vietnamese, give one short model answer, then ask the same easy question again. Stay on the same topic angle.",
  ],
  medium: [
    "If the learner keeps struggling, simplify and help. If they answer well, you may draw out one more short detail on the same topic.",
  ],
  hard: [
    "If the learner keeps struggling, make your English and questions simpler, even at Hard. If they answer well, raise the challenge one small step without leaving the topic.",
  ],
};

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
export function learnCallContextFromLesson(lesson, { topicTitle = "", sectionId = "" } = {}) {
  const focus = learnCallLessonFocus(lesson);
  const topic = cleanText(topicTitle || lesson?.topicTitle, 120);
  const lessonTitle = cleanText(lesson?.title, 120);
  const objective = cleanText(String(lesson?.objective || "").split(/\.\s/)[0], 200);
  const guide = learnCallTopicGuide({ topic, title: lessonTitle, sectionId: sectionId || lesson?.sectionId || "" });
  const farewellHeavy =
    guide.key === "greetings" &&
    /\b(goodbye|see you|tạm biệt|tam biet)\b/i.test(`${objective} ${lessonTitle} ${focus.words.join(" ")} ${focus.patterns.join(" ")}`);
  return {
    lessonTitle,
    topic,
    sectionId: cleanText(sectionId || lesson?.sectionId, 40),
    objective,
    practiceGoal: guide.practiceGoal,
    topicKey: guide.key,
    avoidUntilClosing: [...(guide.avoidUntilClosing || [])],
    farewellLesson: farewellHeavy,
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
  return buildAiTutorSystemPromptV2(ctx);
}

function countLearnerTurns(memory) {
  return (Array.isArray(memory) ? memory : []).filter((item) => item?.role === "user" && String(item.content || "").trim()).length;
}

function countContentTurns(memory) {
  return (Array.isArray(memory) ? memory : []).filter((item) => {
    if (item?.role !== "user") return false;
    const content = String(item.content || "").trim();
    if (!content) return false;
    if (item.kind && item.kind !== "content") return false;
    return learnCallHelpKind(content) === "content";
  }).length;
}

const STUCK_PHRASES =
  /\b(?:i\s+(?:do\s+not|don'?t|dont)\s+(?:know|understand|get\s+it)|i'?m\s+not\s+sure|not\s+sure|no\s+idea|i\s+can'?t|i\s+forgot|sorry|pardon|hmm+|um+|uh+|er+|ah+|oh+|well|teacher|beego)\b/gi;

/** Vietnamese “I don't understand / I don't know” style stuck phrases from STT or typed text. */
const STUCK_PHRASES_VI =
  /không\s*hiểu|khong\s*hieu|không\s*biết|khong\s*biet|chưa\s*hiểu|chua\s*hieu|b[ií]t\s*sao|trả\s*lời\s*sao|tra\s*loi\s*sao/i;

const STUCK_FILLER = new Set([
  "a", "the", "it", "that", "this", "you", "your", "question", "what", "to", "say", "answer", "word", "words",
  "please", "yet", "so", "very", "really", "much", "in", "english", "and", "now", "any", "anything", "how",
]);

const COMMON_SHORT_CLEAR = new Set([
  "hi", "ok", "ha", "ya", "yo", "no", "me", "we", "he", "it", "in", "on", "at", "to", "go", "my", "so", "do", "am", "is", "an", "as", "up", "yes", "tea", "lan", "dan", "mai", "nam", "nga", "bao", "duy", "hai", "hoa", "huy", "lam", "linh", "long", "quan", "sang", "son", "tai", "tam", "thao", "trang", "tuan", "tung", "viet", "vinh", "vy",
]);

/**
 * Transcript that is not a real answer: too little speech, or a letter blob with no vowel.
 * Stuck phrases ("I don't know") are handled separately and are not treated as nonsense.
 * Short answers ("Hi", "OK", "Yes", names) are understood and never marked unclear just by length.
 */
export function learnCallTranscriptUnclear(text) {
  const raw = String(text || "").trim();
  if (!raw || learnCallLearnerIsStuck(raw) || learnCallLearnerWantsToStop(raw)) return false;
  if (VIETNAMESE_LETTER.test(raw)) return false;
  if (/\d/.test(raw)) return false;
  const words = raw.toLowerCase().match(/[a-z']{2,}/g) || [];
  if (!words.length) return true;
  if (words.length === 1 && words[0].length >= 5 && !/[aeiouy]/.test(words[0])) return true;
  if (words.length === 1 && COMMON_SHORT_CLEAR.has(words[0])) return false;
  if (words.length === 1 && words[0].length <= 4 && /[aeiouy]/.test(words[0])) return false;
  if (words.every((word) => word.length <= 2) && !/[aeiouy]/.test(words.join(""))) return true;
  if (words.every((word) => word.length <= 2) && words.join("").length <= 4 && !words.some((w) => COMMON_SHORT_CLEAR.has(w) || /[aeiouy]/.test(w))) return true;
  return false;
}

/** True when the learner's words carry no answer at all (for example: Sorry, I don't know. / Hmm... / Không hiểu). */
export function learnCallLearnerIsStuck(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (STUCK_PHRASES_VI.test(raw)) return true;
  const lower = raw.toLowerCase();
  const words = lower.replace(/[^a-z']+/g, " ").trim();
  if (!words) return false;
  const rest = lower.replace(STUCK_PHRASES, " ").replace(/[^a-z']+/g, " ").trim();
  return rest !== words && rest.split(/\s+/).filter(Boolean).every((w) => STUCK_FILLER.has(w));
}

const VIETNAMESE_WORD = /\bvietnamese\b|ti[eế]ng vi[eệ]t/i;
const ASKING_WORDS =
  /\b(?:explain|translate|say|speak|tell|mean|please|can you|could you|help)\b|gi[aả]i th[ií]ch|d[iị]ch|n[oó]i|đ[uư][oợ]c kh[oô]ng|duoc khong|gi[uú]p/i;
/** Short Vietnamese help lines when STT stays on en-US (romanized or mixed script). */
const VIETNAMESE_HELP_SHORT =
  /^(?:kh[oô]ng\s*(?:hi(?:ểu|êu|eu)|b(?:iết|iet))|khong\s*(?:hieu|biet)|t[oô]i\s*kh[oô]ng\s*(?:hi(?:ểu|êu|eu)|b(?:iết|iet))|toi\s*khong\s*(?:hieu|biet)|ch(?:ưa|ua)\s*hi(?:ểu|êu|eu)|chua\s*hieu|gi[aả]i\s*th[ií]ch\s*(?:b[aằ]ng\s*)?(?:ti[eế]ng\s*)?vi[eệ]t|bang\s*tieng\s*viet)[.!?\s]*$/i;

/** The learner asks for Vietnamese ("Can you explain in Vietnamese?", "Tiếng Việt được không?", "Vietnamese?"). */
export function asksForVietnamese(text) {
  const t = String(text || "").trim();
  if (VIETNAMESE_HELP_SHORT.test(t) && t.split(/\s+/).filter(Boolean).length <= 8) return true;
  if (!VIETNAMESE_WORD.test(t)) return false;
  return ASKING_WORDS.test(t) || t.replace(VIETNAMESE_WORD, "").replace(/[\s?.!,]|\bin\b/gi, "") === "";
}

function latestAnswer(memory) {
  return (Array.isArray(memory) ? memory : [])
    .filter((item) => item?.role === "user" && String(item.content || "").trim())
    .reduce((best, item) => (!best || (Number(item.requestId) || 0) > (Number(best.requestId) || 0) ? item : best), null);
}

/** Consecutive stuck answers, counted back from the learner's latest answer. */
function recentUserAnswers(memory) {
  return (Array.isArray(memory) ? memory : [])
    .filter((item) => item?.role === "user" && String(item.content || "").trim())
    .sort((a, b) => (Number(b.requestId) || 0) - (Number(a.requestId) || 0));
}

function countStuckTurns(memory) {
  let n = 0;
  for (const item of recentUserAnswers(memory)) {
    if (!learnCallLearnerIsStuck(item.content)) break;
    n += 1;
  }
  return n;
}

/** Consecutive unclear transcripts, counted back from the latest learner line. */
export function learnCallUnclearStreak(memory) {
  let n = 0;
  for (const item of recentUserAnswers(memory)) {
    if (!learnCallTranscriptUnclear(item.content)) break;
    n += 1;
  }
  return n;
}

const RECIPROCAL = /\b(?:and you|how about you|what about you)\b/i;
const RECIPROCAL_END = /(?:^|[\s,])(?:and you|how about you|what about you|how are you)\s*\??\s*$/i;
const SKIP_REQUEST = /\b(?:skip(?:\s+this)?|next(?:\s+question)?|pass)\b|bỏ\s*qua|bo\s*qua|câu khác/i;
const REPEAT_REQUEST = /\b(?:(?:please\s+)?(?:repeat|say(?:\s+that)?\s+again)|pardon|one more time)\b|nhắc lại|nói lại|noi lai/i;
const SLOW_REQUEST = /\b(?:speak|talk|say)(?:\s+it)?\s+(?:more\s+)?slow(?:ly)?\b|n[oó]i\s+ch[aậ]m/i;

/** The learner turned the question back (“and you?”), often right after their own short answer. */
export function learnCallAsksAboutTutor(text) {
  const raw = String(text || "").trim().replace(/[.!\s]+$/, "");
  if (!raw || !RECIPROCAL_END.test(raw)) return false;
  const rest = raw
    .replace(RECIPROCAL_END, " ")
    .replace(/[^a-zà-ỹ'\s]/gi, " ")
    .trim();
  return rest.split(/\s+/).filter(Boolean).length <= 8;
}

/** Short tutor answer that matches the last question. Never invents age or a private life. */
export function learnCallTutorSelfAnswer(facet, teacherName = "Beego") {
  const name = String(teacherName || "Beego").trim() || "Beego";
  if (facet === "greeting") return "I'm good, thank you.";
  if (facet === "name") return `I'm ${name}.`;
  if (facet === "job") return "I'm an English tutor.";
  if (facet === "age" || facet === "home" || facet === "hobby" || facet === "members") {
    return `I'm ${name}, your English tutor.`;
  }
  return `I'm ${name}.`;
}

const EXAMPLE_REQUEST =
  /\b(?:(?:give|show|can you give|could you give|need|want)(?:\s+me)?\s+(?:an?\s+)?example|for example)\b|cho\s*(?:mình|em|tôi)?\s*v[íi]\s*d[ụu]|v[íi]\s*d[ụu]\s*(?:đi|nhé|được không|duoc khong)/i;

/** Learner asks for a model example ("Give me an example", "Cho em ví dụ"). */
export function asksForExample(text) {
  return EXAMPLE_REQUEST.test(String(text || "").trim());
}

/** Help/skip/repeat turns are not treated as a new personal fact. */
export function learnCallHelpKind(text) {
  const raw = String(text || "").trim();
  if (!raw) return "empty";
  if (learnCallLearnerWantsToStop(raw)) return "stop";
  if (SKIP_REQUEST.test(raw) && raw.split(/\s+/).length <= 8) return "skip";
  if (REPEAT_REQUEST.test(raw) && raw.split(/\s+/).length <= 8) return "repeat";
  if (SLOW_REQUEST.test(raw) && raw.split(/\s+/).length <= 10) return "slower";
  if (asksForVietnamese(raw)) return "vietnamese";
  if (asksForExample(raw)) return "example";
  if (learnCallTranscriptUnclear(raw)) return "unclear";
  if (learnCallLearnerIsStuck(raw)) return "stuck";
  return "content";
}

const STOP_REQUEST =
  /\b(?:(?:please|can we|could we|let'?s|i (?:want|need|would like|'d like) to)\s+(?:stop|finish|end|quit)(?:\s+(?:now|here|the call|the lesson|it))?|stop (?:the call|the lesson|now|please)|end the (?:call|lesson)|hang up|i (?:have|need) to go(?!\s+to\b)|i'?m done(?: now| for today)?\s*[.!]?$)|^\s*(?:stop|quit)\s*[.!]*\s*$|d[uừ]ng (?:l[aạ]i|h[oọ]c|cu[oộ]c g[oọ]i)|k[eế]t th[uú]c (?:cu[oộ]c g[oọ]i|bu[oổ]i h[oọ]c)|t[oô]i mu[oố]n (?:d[uừ]ng|ngh[iỉ])|th[oô]i h[oọ]c/i;

/** The learner asks to stop the call ("Can we stop now?", "I have to go.", "Tôi muốn dừng"). */
export function learnCallLearnerWantsToStop(text) {
  return STOP_REQUEST.test(String(text || "").trim());
}

/** Learner turns with a real answer: not empty, not only "I don't know", not a request to stop. One-word and Vietnamese answers count. */
function countMeaningfulAnswers(memory) {
  return (Array.isArray(memory) ? memory : []).filter((item) => {
    const content = String(item?.role === "user" ? item.content || "" : "").trim();
    if (!content || learnCallLearnerIsStuck(content) || learnCallLearnerWantsToStop(content)) return false;
    return /[a-z]/i.test(content) || VIETNAMESE_LETTER.test(content);
  }).length;
}

export function learnCallHasClosing(memory) {
  return (Array.isArray(memory) ? memory : []).some((item) => item?.role === "assistant" && item.closing === true);
}

function extractLastQuestion(text) {
  const parts = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i].includes("?")) return parts[i].trim();
  }
  return "";
}

const PRACTICE_CONTRACTIONS = [
  [/\bi['’]m\b/gi, "i am"],
  [/\byou['’]re\b/gi, "you are"],
  [/\bhe['’]s\b/gi, "he is"],
  [/\bshe['’]s\b/gi, "she is"],
  [/\bit['’]s\b/gi, "it is"],
  [/\bwe['’]re\b/gi, "we are"],
  [/\bthey['’]re\b/gi, "they are"],
  [/\bthat['’]s\b/gi, "that is"],
  [/\bwhat['’]s\b/gi, "what is"],
  [/\bwho['’]s\b/gi, "who is"],
  [/\bi['’]d like\b/gi, "i would like"],
  [/\bi['’]d\b/gi, "i would"],
  [/\bdon['’]t\b/gi, "do not"],
  [/\bdoesn['’]t\b/gi, "does not"],
  [/\bdidn['’]t\b/gi, "did not"],
  [/\bisn['’]t\b/gi, "is not"],
  [/\baren['’]t\b/gi, "are not"],
  [/\bwasn['’]t\b/gi, "was not"],
  [/\bweren['’]t\b/gi, "were not"],
  [/\bcan['’]t\b/gi, "cannot"],
  [/\bwon['’]t\b/gi, "will not"],
];

const NUMBER_ONES = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const NUMBER_TEENS = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const NUMBER_TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function replaceSpokenNumbers(s) {
  let text = String(s || "");
  text = text.replace(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/g,
    (_, ten, one) => String(NUMBER_TENS[ten] + NUMBER_ONES[one])
  );
  text = text.replace(/\b(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/g, (w) =>
    String(NUMBER_TEENS[w])
  );
  text = text.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (w) => String(NUMBER_TENS[w]));
  text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\b/g, (w) => String(NUMBER_ONES[w]));
  text = text.replace(/\bzero\b/g, "0");
  return text;
}

function collapseSpokenGaps(text) {
  return String(text || "")
    .replace(/[…]+/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePracticeTokens(str) {
  let s = replaceSpokenNumbers(String(str || "").toLowerCase());
  for (const [p, r] of PRACTICE_CONTRACTIONS) {
    s = s.replace(p, r);
  }
  return collapseSpokenGaps(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Checks structural & semantic completion of targeted practice phrase.
 *
 * NOTE: This evaluates communicative/structural task completion, NOT pronunciation score.
 * Pronunciation scoring belongs strictly to acoustic speech evaluation (Azure STT/Phoneme coach).
 *
 * @param {string} userText Learner's spoken utterance
 * @param {string} targetPhrase Target phrase set by tutor
 * @returns {{ isComplete: boolean, isPracticeAttempt: boolean, missingFocus?: string, reason: string }}
 */
export function evaluatePracticeCompletion(userText, targetPhrase) {
  const userWords = normalizePracticeTokens(userText);
  const targetWords = normalizePracticeTokens(targetPhrase);

  if (!userWords.length || !targetWords.length) {
    return { isComplete: false, isPracticeAttempt: false, reason: "empty" };
  }

  const userJoined = userWords.join(" ");
  const targetJoined = targetWords.join(" ");

  // Check attempt overlap
  const hasWordOverlap = userWords.some((w) => targetWords.includes(w));
  const isSubstring = targetJoined.includes(userJoined) || userJoined.includes(targetJoined);
  const isParaphraseAttempt =
    (userJoined.includes("want") && targetJoined.includes("would like")) ||
    (userJoined.includes("would like") && targetJoined.includes("want"));

  if (!hasWordOverlap && !isSubstring && !isParaphraseAttempt) {
    return { isComplete: false, isPracticeAttempt: false, reason: "no_overlap" };
  }

  // 1. Negation polarity check: 'not', 'n't', 'never', 'no'
  const NEGATION_SET = new Set(["not", "never", "no", "cannot", "neither"]);
  const targetNegated = targetWords.some((w) => NEGATION_SET.has(w));
  const userNegated = userWords.some((w) => NEGATION_SET.has(w));

  if (targetNegated && !userNegated) {
    return {
      isComplete: false,
      isPracticeAttempt: true,
      missingFocus: "not",
      reason: "Missing required negation 'not'",
    };
  }

  if (!targetNegated && userNegated) {
    return {
      isComplete: false,
      isPracticeAttempt: true,
      missingFocus: "negation_conflict",
      reason: "Target affirmative but learner negated",
    };
  }

  // 2. Crucial verbs & copulas (is, am, are, was, were)
  const COPULAS = new Set(["is", "am", "are", "was", "were"]);
  for (const c of COPULAS) {
    if (targetWords.includes(c) && !userWords.includes(c)) {
      return {
        isComplete: false,
        isPracticeAttempt: true,
        missingFocus: c,
        reason: `Missing required verb '${c}'`,
      };
    }
  }

  // 3. Exact match after contraction normalization
  if (userJoined === targetJoined) {
    return { isComplete: true, isPracticeAttempt: true, reason: "exact_match" };
  }

  // 4. Semantic equivalence & valid paraphrasing:
  // e.g. "I would like a cup of coffee" <=> "I want a cup of coffee" <=> "I'd like a coffee" <=> "I want coffee"
  const targetSyn = targetJoined
    .replace(/\bwould like\b/g, "want")
    .replace(/\ba cup of coffee\b/g, "coffee")
    .replace(/\ba coffee\b/g, "coffee")
    .replace(/\bstudy\b/g, "learn")
    .replace(/\bvery delicious\b/g, "delicious")
    .replace(/\breally delicious\b/g, "delicious");

  const userSyn = userJoined
    .replace(/\bwould like\b/g, "want")
    .replace(/\ba cup of coffee\b/g, "coffee")
    .replace(/\ba coffee\b/g, "coffee")
    .replace(/\bstudy\b/g, "learn")
    .replace(/\bvery delicious\b/g, "delicious")
    .replace(/\breally delicious\b/g, "delicious");

  if (targetSyn === userSyn) {
    return { isComplete: true, isPracticeAttempt: true, reason: "paraphrase_equivalent" };
  }

  // 5. Core content words coverage (all essential nouns, adjectives, verbs)
  const MINOR_STOPWORDS = new Set(["a", "an", "the", "in", "at", "to", "of", "for", "very", "really", "please"]);
  const coreTarget = targetWords.filter((w) => !MINOR_STOPWORDS.has(w));
  const coreUser = userWords.filter((w) => !MINOR_STOPWORDS.has(w));

  const allCoreCovered = coreTarget.every((w) => coreUser.includes(w));
  if (allCoreCovered && coreUser.length >= coreTarget.length && coreUser.length <= coreTarget.length + 3) {
    return { isComplete: true, isPracticeAttempt: true, reason: "core_coverage" };
  }

  return {
    isComplete: false,
    isPracticeAttempt: true,
    reason: "fragment_incomplete",
  };
}

const RECITATION_CUE =
  /(?:bây\s+giờ\s+bạn\s+(?:thử\s+)?(?:nói\s*)?(?:cả\s+câu\s*)?(?:nhé)?|bạn\s+thử\s+(?:nói\s*)?(?:cả\s+câu\s*)?(?:nhé)?|thử\s+nói|hãy\s+nói|cùng\s+nói|nói\s+theo|you\s+can\s+say|try\s+saying|can\s+you\s+(?:say|try|repeat|read)|now,?\s+(?:say(?:\s+it)?|you\s+say(?:\s+it)?|you\s+try|your\s+turn|repeat|listen)|say\s+it(?:\s+slowly)?|let'?s\s+(?:say(?:\s+it)?|slow\s+down|try(?:\s+again)?|break\s+it\s+down|focus)|focus on the sound|the sound|slow\s+down|repeat(?:\s+after\s+me)?|listen(?:\s+and\s+repeat)?|step\s+by\s+step|your\s+turn|you\s+try)/i;

const RECITATION_TAIL =
  /\s*(?:now,?\s+you\s+say|now,?\s+you\s+try|now,?\s+your\s+turn|now,?\s+repeat|your turn|you try|slowly|step by step|listen)\b.*$/i;

const HELP_REPEAT_PHRASE = /^(?:that again|it again|this again|again|that|it)\??$/i;

function cleanPracticePhrase(phrase) {
  let text = String(phrase || "")
    .replace(/^(?:slowly|listen|repeat|please)[:，,\s-]*/i, "")
    .replace(/[."”]+$/g, "")
    .replace(RECITATION_TAIL, "")
    .replace(/\s*\.{2,}.*$/, "")
    .replace(/\s*[?！？]+$/, "")
    .trim();
  const stop = text.search(/[.!?]/);
  if (stop >= 8) text = text.slice(0, stop).trim();
  if (HELP_REPEAT_PHRASE.test(text)) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3 || text.length < 10) return "";
  return text;
}

/** Pull the model sentence from a tutor drill, dropping “your turn / you try” tails. */
export function extractLearnCallPracticePhrase(text) {
  const raw = collapseSpokenGaps(text);
  if (!raw.trim()) return "";
  const quoted = [...raw.matchAll(/["“]([^"”]{8,120})["”]/g)]
    .map((match) => cleanPracticePhrase(match[1]))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const match = raw.match(new RegExp(`${RECITATION_CUE.source}\\s*[:：,.-]*\\s*["“]?([^"”\\n]+)`, "i"));
  const fromCue = cleanPracticePhrase(match?.[1] || "");
  return [fromCue, ...quoted].filter(Boolean).sort((a, b) => b.length - a.length)[0] || "";
}

export function learnerProducedPracticePhrase(memory, phrase) {
  const target = String(phrase || "").trim();
  if (!target) return false;
  return (Array.isArray(memory) ? memory : []).some(
    (item) => item?.role === "user" && evaluatePracticeCompletion(item.content, target).isComplete
  );
}

function sameSpokenLine(a, b) {
  const left = normalizePracticeTokens(a).join(" ");
  const right = normalizePracticeTokens(b).join(" ");
  return Boolean(left) && left === right;
}

function isFullSpokenSentence(text) {
  return normalizePracticeTokens(text).length >= 5;
}

function samePracticeTarget(a, b) {
  if (!a || !b) return false;
  if (sameSpokenLine(a, b)) return true;
  return evaluatePracticeCompletion(a, b).isComplete || evaluatePracticeCompletion(b, a).isComplete;
}

function tutorAsksToRepeatLearnerSentence(sentence, last) {
  const uttered = String(last || "").trim();
  if (!isFullSpokenSentence(uttered) || !RECITATION_CUE.test(sentence)) return false;
  const invited = extractLearnCallPracticePhrase(sentence);
  if (invited && evaluatePracticeCompletion(uttered, invited).isComplete) return true;
  const hay = normalizePracticeTokens(sentence).join(" ");
  const needle = normalizePracticeTokens(uttered).join(" ");
  return needle.length >= 8 && hay.includes(needle);
}

/**
 * Evaluates full conversational and learning state across session memory:
 * - pendingQuestion: question asked by tutor awaiting response (asked/pending/confirmed/skipped)
 * - confirmedFacts: facts verified with learner turn evidence (never model utterances)
 * - helpLevel: adaptive scaffolding level (0: normal, 1: keyword, 2: frame, 3: example/breakdown)
 * - currentPractice: active phrase building / targeted practice
 * - sessionMode: "lesson" (mini lesson, 4 turns cap) vs "open" (conversation governed by deadline)
 */
export function evaluateLearnCallState(memory, { topicCtx = null, sessionMode = "lesson" } = {}) {
  const guide = learnCallTopicGuide({
    topic: topicCtx?.topic || topicCtx?.title || "",
    title: topicCtx?.lessonTitle || "",
    sectionId: topicCtx?.sectionId || "",
  });
  const mode = sessionMode || topicCtx?.sessionMode || "lesson";
  const turns = Array.isArray(memory) ? memory : [];
  const seen = new Set();
  const sorted = [...turns].sort((a, b) => (Number(a?.requestId) || 0) - (Number(b?.requestId) || 0) || (a.role === b.role ? 0 : a.role === "user" ? -1 : 1)).filter(item => {
    const id = item.itemId || item.eventId || item.requestId;
    if (!id) return true;
    const key = `${item.role}:${id}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  let pendingQuestion = null;
  const confirmedFacts = [];
  let helpLevel = 0;
  let currentPractice = { targetPhrase: "", active: false, step: 0, attempts: [], completed: false };
  let contentTurns = 0;
  let retriesByTarget = {};
  const intentOkFacets = [];
  const targetUsedFacets = [];
  let lastClassification = null;

  for (let i = 0; i < sorted.length; i += 1) {
    const item = sorted[i];
    const prior = sorted.slice(0, i);
    const text = String(item?.content || "").trim();
    if (!text) continue;

    if (item.role === "assistant") {
      const candidate = extractLearnCallPracticePhrase(text);
      if (candidate) {
        const targetId = currentPractice.targetId || pendingQuestion?.intent || "practice";
        if (!pendingQuestion) pendingQuestion = { intent: targetId, text: extractLastQuestion(text), status: "asked" };
        const used = Number(retriesByTarget[targetId]) || 0;
        const alreadySaid = learnerProducedPracticePhrase(prior, candidate);
        if (alreadySaid || used >= 1) {
          currentPractice = { ...currentPractice, targetId, targetPhrase: currentPractice.targetPhrase || candidate, active: false, completed: true };
        } else {
          retriesByTarget[targetId] = 1;
          currentPractice = { targetId, targetPhrase: candidate, active: true, step: 1, attempts: [], completed: false };
        }
      }

      const lastQ = extractLastQuestion(text);
      if (lastQ && lastQ.includes("?") && !candidate) {
        const intent = learnCallQuestionFacet(lastQ, guide) || "general";
        pendingQuestion = {
          text: lastQ,
          intent,
          askedAtTurn: Number(item.requestId) || 0,
          status: "asked",
        };
      }
      continue;
    }

    if (item.role === "user") {
      const rid = Number(item.requestId) || 0;
      const helpKind = learnCallHelpKind(text);
      let isPracticeAttempt = false;
      let practiceEval = null;

      // Track scaffolding practice attempts
      if (currentPractice.active) {
        practiceEval = evaluatePracticeCompletion(text, currentPractice.targetPhrase);
        const repeatedFullLine =
          isFullSpokenSentence(text) &&
          prior.some((turn) => turn?.role === "user" && sameSpokenLine(turn.content, text));
        const alreadyComplete =
          practiceEval.isComplete ||
          learnerProducedPracticePhrase(prior, currentPractice.targetPhrase) ||
          repeatedFullLine;
        if (practiceEval.isPracticeAttempt || alreadyComplete) {
          const wasExactComplete = practiceEval.isComplete === true;
          isPracticeAttempt = true;
          currentPractice.attempts.push({
            text,
            requestId: rid,
            missingFocus: practiceEval.missingFocus || null,
            reason: alreadyComplete && !wasExactComplete ? "already_produced" : practiceEval.reason,
          });
          if (alreadyComplete) {
            currentPractice.active = false;
            currentPractice.completed = true;
            practiceEval = {
              isComplete: true,
              isPracticeAttempt: true,
              reason: wasExactComplete ? practiceEval.reason : "already_produced",
            };
            if (wasExactComplete) contentTurns += 1;
          }
        }
        if (
          currentPractice.active &&
          currentPractice.attempts.filter((attempt) => isFullSpokenSentence(attempt.text)).length >= 2 &&
          !currentPractice.attempts.some((attempt) => evaluatePracticeCompletion(attempt.text, currentPractice.targetPhrase).isComplete)
        ) {
          currentPractice.active = false;
          currentPractice.completed = true;
        }
      } else {
        const prevAssistant = [...prior].reverse().find((turn) => turn?.role === "assistant");
        const invited = extractLearnCallPracticePhrase(prevAssistant?.content);
        if (invited && evaluatePracticeCompletion(text, invited).isComplete) {
          currentPractice = {
            targetPhrase: invited,
            active: false,
            step: 0,
            attempts: currentPractice.attempts || [],
            completed: true,
          };
          practiceEval = { isComplete: true, isPracticeAttempt: true, reason: "already_produced" };
        }
      }

      if (currentPractice.active && helpKind !== "repeat" && helpKind !== "slower") {
        currentPractice.active = false;
        currentPractice.completed = true;
      }

      lastClassification = learnCallClassifyAnswer(text, {
        pendingQuestion,
        topicCtx,
        helpKind,
        unclear: helpKind === "unclear" || learnCallTranscriptUnclear(text),
        practiceEval,
        retriesByTarget,
      });
      retriesByTarget = nextRetriesByTarget(retriesByTarget, lastClassification);
      if (lastClassification.intentOk && pendingQuestion?.intent && !intentOkFacets.includes(pendingQuestion.intent)) {
        intentOkFacets.push(pendingQuestion.intent);
      }
      if (lastClassification.targetUsed && pendingQuestion?.intent && !targetUsedFacets.includes(pendingQuestion.intent)) {
        targetUsedFacets.push(pendingQuestion.intent);
      }

      if (helpKind === "skip") {
        currentPractice.active = false;
        currentPractice.completed = true;
        if (pendingQuestion) pendingQuestion.status = "skipped";
        continue;
      }

      // Point 3: Immediate support for Vietnamese or example requests, do NOT force stepping through 1 -> 2 -> 3
      if (helpKind === "vietnamese" || asksForVietnamese(text)) {
        helpLevel = 3;
        if (pendingQuestion) pendingQuestion.status = "pending";
        continue;
      }
      if (helpKind === "example" || asksForExample(text)) {
        helpLevel = 3;
        if (pendingQuestion) pendingQuestion.status = "pending";
        continue;
      }
      if (helpKind === "stuck") {
        helpLevel = Math.min(3, helpLevel + 1);
        if (pendingQuestion) pendingQuestion.status = "pending";
        continue;
      }

      // If not an intermediate practice attempt and not a help turn, increment contentTurns
      if (!isPracticeAttempt && helpKind === "content") {
        const priorUsers = sorted.filter(
          (turn) => turn !== item && turn?.role === "user" && (Number(turn.requestId) || 0) < rid
        );
        const previousUser = priorUsers[priorUsers.length - 1];
        const repeatedSameAnswer =
          isFullSpokenSentence(text) && previousUser && sameSpokenLine(previousUser.content, text);
        if (!repeatedSameAnswer) contentTurns += 1;
      }

      const covered = learnCallCoveredFacets([item], guide);
      let matchedFacet = covered.answered[0] || null;

      if (pendingQuestion?.intent === "job" && lastClassification.intentOk) matchedFacet = "job";
      if (!matchedFacet && pendingQuestion?.intent) {
        const pFacet = pendingQuestion.intent;
        if (pFacet === "name") {
          const words = text.toLowerCase().replace(/[^a-z0-9à-ỹ\s]/gi, "").trim().split(/\s+/).filter(Boolean);
          if (!words.some((w) => NON_NAME_SET.has(w)) && words.length >= 1 && words.length <= 3 && !/\d/.test(text)) {
            matchedFacet = "name";
          }
        } else if (pFacet === "age") {
          if (/^\s*(?:\d{1,2}|(?:twenty|thirty|forty|fifty|sixty)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?|fifteen|sixteen|seventeen|eighteen|nineteen)\s*[.!?]?$/i.test(text)) {
            matchedFacet = "age";
          }
        } else if (pFacet === "greeting") {
          if (/^(?:good|fine|ok|okay|great|yes|hi|hello)[.!?]?$/i.test(text)) {
            matchedFacet = "greeting";
          }
        }
      }

      if (learnCallPersonalCorrection(text) && learnCallAge(text) !== null && confirmedFacts.some(f => f.facet === "age")) matchedFacet = "age";
      if (matchedFacet === "age" && learnCallAge(text) === null) {
        const index = confirmedFacts.findIndex(f => f.facet === "age");
        if (index >= 0) confirmedFacts.splice(index, 1);
        matchedFacet = null;
      }
      if (matchedFacet) {
        if (matchedFacet === "age" || matchedFacet === "name") {
          const previousIndex = confirmedFacts.findIndex(f => f.facet === matchedFacet);
          if (previousIndex >= 0) confirmedFacts.splice(previousIndex, 1);
        }
        if (!confirmedFacts.some((f) => f.facet === matchedFacet)) {
          confirmedFacts.push({
            facet: matchedFacet,
            turnRequestId: rid,
            turnEvidence: text,
            status: "confirmed",
          });
        }
        if (pendingQuestion && pendingQuestion.intent === matchedFacet) {
          pendingQuestion.status = "confirmed";
        }
        helpLevel = 0;
      }
    }
  }

  return {
    sessionMode: mode,
    pendingQuestion,
    confirmedFacts,
    helpLevel,
    currentPractice,
    contentTurns,
    retriesByTarget,
    intentOkFacets,
    targetUsedFacets,
    lastClassification,
    covered: learnCallCoveredFacets(memory, guide),
  };
}

/**
 * Decide the tutor's next turn from server data only.
 * memory: session memory (any order). remainingMs: time to the server deadline.
 * topicCtx: optional session topic fields used to track covered practice facets.
 */
export function learnCallTurnPlan({ memory, remainingMs, topicCtx = null, sessionMode = null } = {}) {
  const learnerTurns = countLearnerTurns(memory);
  const mode = sessionMode || topicCtx?.sessionMode || "lesson";
  const state = evaluateLearnCallState(memory, { topicCtx, sessionMode: mode });
  // Respect contentTurns from state so practice attempts don't inflate turns
  const contentTurns = state.contentTurns;
  const left = Number(remainingMs);
  const remainingSeconds = Number.isFinite(left) ? Math.max(0, Math.floor(left / 1000)) : null;
  const guide = learnCallTopicGuide({
    topic: topicCtx?.topic || topicCtx?.title || "",
    title: topicCtx?.lessonTitle || "",
    sectionId: topicCtx?.sectionId || "",
  });
  const covered = state.covered;
  const goals = learnCallSessionGoals(guide, topicCtx?.selection);
  const selected = learnCallSelectQuestion({ guide, sessionId: topicCtx?.sessionId, difficulty: topicCtx?.difficulty,
    covered, lastIntent: state.pendingQuestion?.status === "confirmed" ? state.pendingQuestion.intent : "", selection: topicCtx?.selection });
  const lastQuestion = learnCallLastTutorQuestion(memory);
  const askedFacet = learnCallQuestionFacet(lastQuestion, guide);

  if (learnCallHasClosing(memory)) return { mode: "closed", learnerTurns, contentTurns, covered, goals, sessionMode: mode, state };
  if (Number.isFinite(left) && left < LEARN_CALL_MIN_REPLY_MS) return { mode: "none", learnerTurns, contentTurns, covered, goals, sessionMode: mode, state };
  if (learnerTurns === 0) {
    const opening = learnCallShouldTutorOpen({
      sessionMode: mode,
      memory,
      openingClaimed: Boolean(topicCtx?.openingClaimed),
    });
    if (opening.open) {
      return {
        mode: "greet",
        learnerTurns,
        contentTurns,
        remainingSeconds,
        covered,
        goals,
        topicKey: guide.key,
        nextFacet: selected?.targetId || null,
        nextAngle: selected?.angle || null,
        avoidUntilClosing: [...(guide.avoidUntilClosing || [])],
        sessionMode: mode,
        openingReason: opening.reason,
        state,
      };
    }
    return {
      mode: "none",
      reason: opening.reason,
      invite: opening.invite,
      learnerTurns,
      contentTurns,
      remainingSeconds,
      covered,
      goals,
      topicKey: guide.key,
      sessionMode: mode,
      state,
    };
  }
  const closing = (reason) => ({
    mode: "closing",
    reason,
    learnerTurns,
    contentTurns,
    meaningfulAnswers: countMeaningfulAnswers(memory),
    remainingSeconds,
    covered,
    goals,
    topicKey: guide.key,
    sessionMode: mode,
    state,
  });
  const latest = latestAnswer(memory)?.content;
  const helpKind = learnCallHelpKind(latest);
  if (helpKind === "stop" || learnCallLearnerWantsToStop(latest)) return closing("stop");
  if (mode === "lesson" && contentTurns >= LEARN_CALL_TARGET_TURNS_MAX) return closing("turns");
  if (Number.isFinite(left) && left <= LEARN_CALL_CLOSING_LEAD_MS) return closing("time");
  if (mode === "lesson" && contentTurns >= LEARN_CALL_TARGET_TURNS_MIN && Number.isFinite(left) && left <= LEARN_CALL_SOFT_CLOSING_MS) {
    return closing("time");
  }
  return {
    mode: "ask",
    learnerTurns,
    contentTurns,
    remainingSeconds,
    stuckTurns: countStuckTurns(memory),
    wantsVietnamese: helpKind === "vietnamese" || asksForVietnamese(latest),
    wantsExample: helpKind === "example" || asksForExample(latest),
    unclear: helpKind === "unclear" || learnCallTranscriptUnclear(latest),
    unclearTurns: learnCallUnclearStreak(memory),
    asksTutor: learnCallAsksAboutTutor(latest),
    asksTutorFacet: askedFacet,
    helpKind,
    teacherName: String(topicCtx?.teacherName || "Beego"),
    covered,
    goals,
    topicKey: guide.key,
    nextFacet: selected?.targetId || null,
    nextAngle: selected?.angle || null,
    avoidUntilClosing: [...(guide.avoidUntilClosing || [])],
    sessionMode: mode,
    pendingQuestion: state.pendingQuestion,
    confirmedFacts: state.confirmedFacts,
    helpLevel: state.helpLevel,
    currentPractice: state.currentPractice,
    answerKind: state.lastClassification?.kind || "",
    answerTargetId: state.lastClassification?.targetId || "",
    answerConfirm: state.lastClassification?.confirm || "",
    retriesByTarget: state.retriesByTarget,
    intentOkFacets: state.intentOkFacets,
    targetUsedFacets: state.targetUsedFacets,
    state,
  };
}

const GREET_QUESTION = {
  easy: "open the topic with one short personal question (examples for greetings: How are you? What's your name?). Do not start with goodbye.",
  medium: "open the topic with one basic question they can answer in 1–2 short sentences. Do not start with goodbye.",
  hard: "open the topic with one open question that needs a short explanation or opinion. Do not start with goodbye.",
};

const ASK_DIRECTIVE = {
  easy: [
    "React in a few words to what they just said (one-word or Vietnamese answers are fine), then ask exactly one short follow-up on the same topic. Do not stop after only repeating what they said.",
    "Basic What/Where/How personal questions are allowed. Do not raise the difficulty. Do not ask for long explanations.",
  ],
  medium: [
    "React naturally to what they just said, then ask one basic open question that follows on from it and moves the topic forward or draws out one more short detail.",
  ],
  hard: [
    "Respond to what they just said, then ask one deeper follow-up: a reason, an example, a comparison, or an opinion — still only one idea.",
    "If their answer was short, ask them to say more.",
  ],
};

const ASK_SPECIAL_CASES =
  "If they asked you a question, answer it briefly first. If they asked you to repeat, say your last question again instead of a new one. If they asked for an example, give one short example and invite their own idea. If they asked for Vietnamese, explain briefly in Vietnamese as a statement, then ask one easy English question. If their words look misheard or unclear, gently check what they meant. If they ask you to speak more slowly, do not say you will speak slowly; just ask your last question again in shorter, simpler words. If they did not understand, ask the same question more simply; if they are still stuck, give a short hint or two simple choices.";

const ASK_OWN_WORDS =
  "The question must be a real question the learner answers in their own words with the lesson words: about their own life, feelings or ideas, or, in a role-play, what that person would really ask. Do not give them a word or sentence to say, try or repeat (no: Can you say ...? Say: ... Can you try that?) unless they asked for an example. Do not ask anything they already answered in this call (if they said I am fine, do not ask How are you?). If the lesson task is already done, ask about a related part of their life instead (for example: Who do you say hello to at school?).";

/** Seconds left below which an ask turn stays brief and does not open a new part of the task. */
export const LEARN_CALL_SHORT_TIME_SECONDS = 60;

function turnStatus(plan) {
  const seconds = Number(plan?.remainingSeconds);
  const time = Number.isFinite(seconds) && plan?.remainingSeconds !== null ? `, about ${seconds} seconds left in the call` : "";
  return `Turn status from the system: mode ${plan?.mode || "ask"}${time}.`;
}

function closingDirective(plan) {
  const answered = Number(plan?.meaningfulAnswers) > 0;
  const covered = Array.isArray(plan?.covered?.answered) ? plan.covered.answered.filter(f => !["age", "name", "number"].includes(f)) : [];
  return [
    "This is your last turn.",
    plan?.reason === "stop" ? "The learner asked to stop: respect that and do not try to keep them talking." : "",
    "Thank the learner in one short sentence. Do not repeat their name, age or personal numbers.",
    answered
      ? covered.length
        ? `Then name one specific thing they really said in this call (facts heard: ${covered.join(", ")}).`
        : "Then name one specific thing they really said well in this call, in one short sentence."
      : "They have not given a real answer in this call yet: do not praise an answer and do not say they reached the goal; kindly encourage them to try again next time.",
    answered
      ? "Only if one learner sentence really has a clear grammar mistake, add one short review tip with the right form and a brief Vietnamese note. If you are not sure, skip the tip. Do not invent pronunciation feedback."
      : "",
    "Then say goodbye once. Do not ask any question (no “Do you like to say goodbye?”). Do not claim mastery, and do not say you have ended or closed the call.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function learnCallTurnDirective(plan, difficulty = LEARN_CALL_DEFAULT_DIFFICULTY) {
  const level = difficultyOrDefault(difficulty);
  const status = turnStatus(plan);
  if (plan?.mode === "greet") {
    const opening = learnCallOpeningScript(
      { topic: plan?.topicKey, title: "", sectionId: "" },
      level
    );
    if (plan?.topicKey === "greetings" || opening.spoken.includes("neighbor")) {
      return `${status} This is the only opening turn. Say: "${opening.spoken}" Then wait. Do not give a long introduction, do not give the answer, do not ask a second question, and do not ask about goodbye.`;
    }
    const first =
      plan?.nextAngle?.[level] ||
      "";
    const hint = first ? ` A good opening for this topic is: ${first}.` : "";
    return `${status} Start the call now: say hello in one short sentence, set up the topic in a few words, then ${GREET_QUESTION[level]}${hint} Do not give a long introduction, do not give the answer, and do not ask about goodbye.`;
  }
  if (plan?.mode === "closing") return `${status} ${closingDirective(plan)}`;
  const seconds = Number(plan?.remainingSeconds);
  const shortTime =
    plan?.remainingSeconds !== null && Number.isFinite(seconds) && seconds <= LEARN_CALL_SHORT_TIME_SECONDS
      ? "Time is short: keep this turn brief and do not start a new part of the task."
      : "";
  return [status, shortTime, askDirective(plan, level)].filter(Boolean).join(" ");
}

function classifyDirective(plan) {
  if (plan?.answerKind === "accept") {
    const answered = Array.isArray(plan?.covered?.answered) ? plan.covered.answered.filter(Boolean) : [];
    const avoid = Array.isArray(plan?.avoidUntilClosing) ? plan.avoidUntilClosing.filter(Boolean) : [];
    const afterName = plan?.nextAngle ? ` Ask this new question: ${plan.nextAngle.easy}` : "";
    const factsLine = Array.isArray(plan?.confirmedFacts) && plan.confirmedFacts.length
      ? `Confirmed student facts: ${plan.confirmedFacts.filter(f => !["age", "name", "number"].includes(f.facet)).map((f) => `${f.facet}: "${f.turnEvidence}"`).join(", ")}. Never change or contradict these confirmed facts.`
      : "";
    return [
      "The learner already answered the question in a valid way. Accept it. Do not ask them to repeat the same sentence.",
      "Do not start a pronunciation drill. Do not coach pronunciation from the transcript. Forbidden after they already produced the sentence: “Now, say”, “Let’s say”, “Let’s try”, “Let’s slow down”, “Now you try”, “You try”, “your turn”, “step by step”, “Listen:”, “Can you say”, “repeat”, “focus on the sound”, or splitting the sentence with dots (I am … 40 … years … old).",
      answered.length ? `Already answered by the learner: ${answered.join(", ")}.` : "",
      avoid.length ? `Do not ask about: ${avoid.join(", ")}.` : "",
      factsLine,
      "You may mention one natural alternative in passing (for example after a job answer: some people also say I work in tech), then ask exactly one new follow-up.",
      "Do not turn a correct answer into a drill.",
      afterName,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (plan?.answerKind === "nudge_target") {
    return [
      "They communicated the right idea. Acknowledge that first.",
      "Then, in a separate short move, give a natural reason to try the target form once. Do not say they were wrong.",
      "Record intent as achieved even if the target form is still missing.",
    ].join(" ");
  }
  if (plan?.answerKind === "correct") {
    return [
      "There is one clear error that changes the meaning or the lesson target.",
      "Recast only that point in a natural model, keep their meaning, add one short Vietnamese note if needed, and invite them to try once.",
      "Do not list other errors. Do not ask them to repeat a long sentence.",
    ].join(" ");
  }
  if (plan?.answerKind === "correct_exhausted") {
    return [
      "They already had one retry on this same target. Do not invite the same correction again, even with different wording.",
      "Move on to a new question or easier situation. No further retry or syllable breakdown for this target. Mark the target as not yet achieved if still missing.",
    ].join(" ");
  }
  return "";
}

function askDirective(plan, level) {
  if (plan?.helpKind === "skip") {
    return [
      "They asked to skip this question. Do not treat that as an answer to the fact.",
      "Move on with one new short question on the next uncovered goal.",
      "Do not answer the skipped question for them.",
    ].join(" ");
  }
  if (plan?.helpKind === "repeat") {
    return "They asked you to repeat. Say your last question again in shorter words. Do not ask a new personal fact.";
  }
  if (plan?.helpKind === "slower") {
    return "They asked you to speak more slowly. Repeat your last question in shorter, simpler words. Do not say you changed your speaking speed, and do not ask a new personal fact.";
  }
  if (plan?.wantsVietnamese || plan?.helpKind === "vietnamese") {
    return [
      "The learner asked for an explanation in Vietnamese.",
      "Reply in exactly two parts: first one short Vietnamese sentence that explains what your last question means (a statement, with no question mark), then ask your last question again in simple English.",
      "Do not translate the question into a Vietnamese question and do not ask anything else.",
    ].join(" ");
  }
  if (plan?.wantsExample || plan?.helpKind === "example") {
    return [
      "The learner asked for an example.",
      "Provide one clear, short model answer immediately with a brief Vietnamese translation, without making them wait through earlier hint levels, then invite them to try.",
    ].join(" ");
  }
  if (plan?.unclear || plan?.answerKind === "unclear") {
    const repeats = Number(plan?.unclearTurns) || 1;
    if (repeats >= 2) {
      return [
        "The latest transcripts are still unclear after more than one try, so this may be a recognition problem.",
        "Do not say “Could you say that again?” again.",
        "Help once: give one short model answer or two very short choices for the same question, then ask that same easy question one time.",
        "Do not praise, do not correct grammar, do not decide the learner is wrong, and do not move on to a new personal fact.",
      ].join(" ");
    }
    return [
      "The latest transcript looks unclear or meaningless, so it may be a recognition error.",
      plan?.answerConfirm
        ? `Ask this short check: “${plan.answerConfirm}”`
        : "Ask one short check, such as “Could you say that again?”",
      "Do not praise, do not correct grammar, and do not decide the learner is wrong.",
      "Do not move on to a new personal fact.",
    ].join(" ");
  }
  const skipClassify =
    plan?.asksTutor === true ||
    (Boolean(plan?.currentPractice?.active) &&
      plan?.answerKind !== "correct_exhausted" &&
      plan?.answerKind !== "accept");
  if (!skipClassify) {
    const classified = classifyDirective(plan);
    if (classified) return classified;
  }
  const stuck = Number(plan?.stuckTurns) || 0;
  const stuckLine =
    stuck >= 3
      ? "They are still stuck: break the hard chunk into a smaller piece, give one short example with a Vietnamese note, then ask only that smaller piece. Do not make them repeat the whole original sentence, and do not answer for them."
      : stuck === 2
        ? "Give a short sentence frame they can finish, then ask the same question. Do not fill the answer for them."
        : stuck === 1
          ? "Give one keyword hint for the same question, then ask it again. Do not give the full answer yet."
          : "";
  const answered = Array.isArray(plan?.covered?.answered) ? plan.covered.answered.filter(Boolean) : [];
  const asked = Array.isArray(plan?.covered?.asked) ? plan.covered.asked.filter(Boolean) : [];
  const next =
    plan?.nextAngle?.[level] ||
    plan?.nextAngle?.easy ||
    "";
  const avoid = Array.isArray(plan?.avoidUntilClosing) ? plan.avoidUntilClosing.filter(Boolean) : [];
  const memoryLine = [
    answered.length ? `Already answered by the learner: ${answered.join(", ")}.` : "",
    asked.length ? `Already asked by you: ${asked.join(", ")}.` : "",
    next ? `Suggested next angle (use if it fits naturally; do not read a script): ${next}.` : "",
    avoid.length ? `Do not ask about: ${avoid.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const ownWords =
    level === "easy"
      ? "Ask one real short question about their life on this topic. Do not ask them to read aloud or say a fixed sentence. One-word and Vietnamese answers are success."
      : ASK_OWN_WORDS;
  const self = learnCallTutorSelfAnswer(plan?.asksTutorFacet, plan?.teacherName);
  const tutorLine = plan?.asksTutor
    ? `They asked about you (“and you?”) after a ${plan?.asksTutorFacet || "name"} question. Answer with exactly this sentence: ${self} Do not invent an age, hometown or private life. Do not ask “and you?” back. Then ask the suggested next question.`
    : "";
  const goalLine = Array.isArray(plan?.goals) && plan.goals.length
    ? `Session goals (follow their answers, do not run a list): ${plan.goals.join(", ")}.`
    : "";
  const practiceLine = plan?.currentPractice?.active
    ? `The learner is practicing the target phrase: "${plan.currentPractice.targetPhrase}". Acknowledge their practice attempt kindly, help them complete the sentence, and do not treat fragments as speech recognition failure.`
    : "";
  const factsLine = Array.isArray(plan?.confirmedFacts) && plan.confirmedFacts.length
    ? `Confirmed student facts: ${plan.confirmedFacts.filter(f => !["age", "name", "number"].includes(f.facet)).map((f) => `${f.facet}: "${f.turnEvidence}"`).join(", ")}. Never change or contradict these confirmed facts.`
    : "";
  return [
    `The learner has given ${Number(plan?.contentTurns) || 0} content answer(s) and ${Number(plan?.learnerTurns) || 0} spoken turn(s). Help or repeat turns do not count as new facts.`,
    ...ASK_DIRECTIVE[level],
    goalLine,
    memoryLine,
    factsLine,
    practiceLine,
    tutorLine,
    stuckLine,
    ASK_SPECIAL_CASES,
    ownWords,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Chat messages for the Learn worker: one system prompt, chronological memory, the turn directive. */
export function buildLearnCallMessages({ system, memory, directive } = {}) {
  const chronological = [...(Array.isArray(memory) ? memory : [])].reverse();
  const personalTurns = learnCallPersonalTurnIds(chronological);
  const history = [];
  for (const item of chronological) {
    const role = item?.role === "user" ? "user" : item?.role === "assistant" ? "assistant" : "";
    const content = personalTurns.has(item) || (item.role === "assistant" && learnCallPersonalAssistantTurn(item.content)) ? "[Personal detail omitted; acknowledge neutrally and continue.]" : cleanText(item?.content, 600);
    if (!role || !content) continue;
    history.push({ role, content });
  }
  const messages = [{ role: "system", content: String(system || "") }, ...history];
  if (!history.length) messages.push({ role: "user", content: "(The learner joined the call.)" });
  if (directive) messages.push({ role: "system", content: String(directive) });
  return messages;
}

const QUOTED = /"[^"]{1,120}"|“[^“”]{1,120}”/g;
const QUOTE_MASK = { ".": "\uE000", "!": "\uE001", "?": "\uE002" };
const QUOTE_UNMASK = { "\uE000": ".", "\uE001": "!", "\uE002": "?" };

/** Sentences of a reply; punctuation inside quotes (You said "How much is it?" well.) does not split. */
function sentences(text) {
  const masked = collapseSpokenGaps(text)
    .replace(QUOTED, (quote) => quote.replace(/[.!?]/g, (c) => QUOTE_MASK[c]));
  return (masked.match(/[^.!?]+[.!?]*/g) || [])
    .map((s) => s.replace(/[\uE000-\uE002]/g, (c) => QUOTE_UNMASK[c]).trim())
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
function clipAtWord(text, maxChars) {
  const clean = String(text || "").trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const space = cut.lastIndexOf(" ");
  const kept = space > Math.floor(maxChars * 0.55) ? cut.slice(0, space) : cut;
  return kept.replace(/[,:;–-]+$/, "").trim();
}

/** Drop a trailing fragment when the model stopped because it ran out of tokens. */
export function learnCallDropIncompleteTail(text) {
  const clean = String(text || "").trim();
  if (!clean || /[.!?…"»]$/.test(clean)) return clean;
  const cut = clean.replace(/\s+\S+$/, "").trim();
  return cut || clean;
}

/** Words that leave the clause waiting for a complement. */
const OPEN_TAIL =
  /\b(?:a|an|the|my|your|his|her|our|their|its|to|of|in|on|at|for|from|about|into|and|or|but|because|if|than|do|does|did|don'?t|can|could|would|will|should|am|is|are|was|were|be|been|have|has|had|tell|what|where|when|who|why|how|which|some|any)\s*$/i;
const BARE_WH =
  /^(?:where|what|who|when|why|how|which)\s+(?:do|does|did|can|could|would|will|should)\s+you$/i;
const BARE_REQUEST =
  /^(?:could|can|would|will)\s+you(?:\s+please)?(?:\s+tell(?:\s+me)?)?(?:\s+(?:your|the|a|me|about))?$/i;
const BARE_LIVE = /^who\s+do\s+you\s+live$/i;
const RECIPROCAL_QUESTION = /^(?:and you|how about you|what about you|good, and you)$/i;

function endsSentence(text) {
  return /[.!?…]["»”']?$/.test(String(text || "").trim());
}

function stripEndPunct(text) {
  return String(text || "")
    .trim()
    .replace(/["»”']+$/, "")
    .replace(/[.!?…]+$/, "")
    .trim();
}

/** A clause that can stand alone. “Where do you” and “Could you tell me your” cannot. */
export function learnCallThoughtComplete(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const body = stripEndPunct(raw);
  if (!body || BARE_WH.test(body) || BARE_REQUEST.test(body) || BARE_LIVE.test(body) || OPEN_TAIL.test(body)) return false;
  if (!endsSentence(raw) && body.split(/\s+/).length < 2) return false;
  return true;
}

function closeThought(text) {
  const raw = String(text || "").trim();
  if (endsSentence(raw)) return raw;
  const body = stripEndPunct(raw);
  const question = /^(?:who|what|where|when|why|how|which|can|could|would|will|do|does|did|are|is|am)\b/i.test(body);
  return `${body}${question ? "?" : "."}`;
}

function repairClause(text) {
  let current = String(text || "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 8; i += 1) {
    if (!current) return "";
    if (learnCallThoughtComplete(current)) return closeThought(current);
    const shorter = current.replace(/\s+\S+$/, "").trim();
    if (!shorter || shorter === current) return "";
    current = shorter;
  }
  return "";
}

/**
 * Keep only whole clauses. A dangling tail such as “Where do you” is removed,
 * and a finished clause gets its closing punctuation. Empty means the caller
 * should use one fallback sentence.
 */
export function learnCallRepairThought(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  const parts = sentences(raw);
  if (parts.length <= 1) return repairClause(raw);
  const kept = [];
  for (const part of parts) {
    const fixed = repairClause(part);
    if (!fixed) break;
    kept.push(fixed);
  }
  return kept.join(" ").trim();
}

function oneQuestion(raw) {
  const repaired = learnCallRepairThought(clipAtWord(String(raw || "").replace(/\s+/g, " ").trim(), 90));
  return repaired.includes("?") ? repaired : "";
}

const REPEAT_CHECK = /could you say that again/i;
const UNCLEAR_FALLBACK = "You can say: I'm good. How are you?";

/** First unclear turn asks for a repeat. Later turns give one model instead of the same question. */
export function learnCallUnclearLine(turns, helpText = "") {
  const n = Number(turns) || 1;
  if (n < 2) return "Could you say that again?";
  const help = learnCallRepairThought(helpText);
  if (help.includes("?")) return help;
  return UNCLEAR_FALLBACK;
}

/** One finite help line for the question the learner was trying to answer. */
export function learnCallUnclearHelp({ question = "", samples = [] } = {}) {
  const whole = learnCallRepairThought(question);
  const ask = whole.includes("?") ? whole : "";
  const choices = (Array.isArray(samples) ? samples : [])
    .map((sample) => String(sample?.en || sample || "").replace(/\s+/g, " ").trim().replace(/[.]+$/, ""))
    .filter(Boolean)
    .slice(0, 2);
  if (choices.length >= 2 && ask) return `You can say: ${choices[0]}, or ${choices[1]}. ${ask}`;
  if (choices.length === 1 && ask) return `You can say: ${choices[0]}. ${ask}`;
  if (ask) return `Let's try a short answer. ${ask}`;
  return UNCLEAR_FALLBACK;
}

export function learnCallLastTutorQuestion(memory) {
  const items = (Array.isArray(memory) ? memory : [])
    .filter((item) => item?.role === "assistant" && String(item.content || "").trim())
    .sort((a, b) => (Number(b.requestId) || 0) - (Number(a.requestId) || 0));
  for (const item of items) {
    const parts = String(item.content)
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      if (parts[i].includes("?")) return parts[i].trim();
    }
  }
  return "";
}

function isReciprocalQuestion(text) {
  return RECIPROCAL_QUESTION.test(stripEndPunct(text).replace(/[.!?…]+$/, "").trim());
}

function hasSelfAnswer(text, selfAnswer) {
  const self = String(selfAnswer || "").replace(/[.!?]+$/, "").trim();
  if (!self) return false;
  return String(text || "").toLowerCase().includes(self.toLowerCase());
}

function swapReciprocal(result, nextQuestion, selfAnswer) {
  const next = oneQuestion(nextQuestion);
  const self = String(selfAnswer || "").trim();
  if (!next) return result;
  const parts = sentences(result);
  const index = parts.findIndex((part) => part.endsWith("?") && isReciprocalQuestion(part));
  if (index < 0) return result;
  const lead = parts.slice(0, index).filter((part) => !part.endsWith("?")).join(" ").trim();
  if (!lead) return self ? `${self} ${next}` : next;
  if (self && hasSelfAnswer(lead, self)) return `${lead} ${next}`;
  return self ? `${self} ${lead} ${next}` : `${lead} ${next}`;
}

const WHOLE_FALLBACK = "Could you tell me a little more?";

function isUnclearRepeatCheck(sentence) {
  return REPEAT_CHECK.test(sentence) && !/can you say\s*[:：]/i.test(sentence);
}

function isPronunciationDrillSentence(sentence) {
  const s = String(sentence || "").trim();
  if (!s || isUnclearRepeatCheck(s)) return false;
  if (RECITATION_CUE.test(s) && extractLearnCallPracticePhrase(s)) return true;
  if (RECITATION_CUE.test(s) && !s.includes("?")) return true;
  return /(?:can you (?:say|try|repeat|read)\s*[:：]|now,?\s+you\s+try|step by step|listen:)/i.test(s);
}

function learnerAlreadyProducedModel(last, parts) {
  const uttered = String(last || "").trim();
  if (!uttered) return false;
  return (Array.isArray(parts) ? parts : []).some((part) => {
    const invited = extractLearnCallPracticePhrase(part);
    if (invited && evaluatePracticeCompletion(uttered, invited).isComplete) return true;
    return tutorAsksToRepeatLearnerSentence(part, uttered);
  });
}

function dropPronunciationDrills(parts, { lastLearnerText = "", unclear = false } = {}) {
  if (unclear || !Array.isArray(parts) || !parts.length) return parts;
  const last = String(lastLearnerText || "").trim();
  const produced = learnerAlreadyProducedModel(last, parts);
  return parts.filter((part) => {
    if (isUnclearRepeatCheck(part)) return true;
    const invited = extractLearnCallPracticePhrase(part);
    const already = last && invited && evaluatePracticeCompletion(last, invited).isComplete;
    if (already || tutorAsksToRepeatLearnerSentence(part, last)) return false;
    if (produced && isPronunciationDrillSentence(part)) return false;
    if (produced && invited) return false;
    return true;
  });
}

function isRecitationReply(raw) {
  return RECITATION_CUE.test(raw) || /focus on the sound|listen:|your turn|now you (?:say|try)|say it\b/i.test(raw);
}

function rawContainsLearnerSentence(raw, last) {
  if (!isFullSpokenSentence(last)) return false;
  const hay = normalizePracticeTokens(raw).join(" ");
  const needle = normalizePracticeTokens(last).join(" ");
  return needle.length >= 8 && hay.includes(needle);
}

function recitationPraise(raw) {
  const first = sentences(raw)[0] || "";
  if (first && /^(?:good(?:\s+try|\s+effort|\s+job)?|great|nice|thank you|i understand|that's okay|ok|okay)\b/i.test(first) && !isRecitationReply(first)) {
    return first;
  }
  return "Good.";
}

function shouldKillRecitationLoop({ raw, lastLearnerText, practiceCompleted = false } = {}) {
  const spoken = collapseSpokenGaps(raw);
  if (!isRecitationReply(spoken)) return false;
  if (practiceCompleted) return true;
  const last = String(lastLearnerText || "").trim();
  if (!last) return false;
  const invited = extractLearnCallPracticePhrase(spoken);
  if (invited && evaluatePracticeCompletion(last, invited).isComplete) return true;
  if (rawContainsLearnerSentence(spoken, last)) return true;
  return false;
}

export function learnCallShapeReply(
  text,
  { closing = false, difficulty = LEARN_CALL_DEFAULT_DIFFICULTY, truncated = false, nextQuestion = "", unclear = false, unclearTurns = 0, helpText = "", asksTutor = false, selfAnswer = "", answerKind = "", lastLearnerText = "", practiceCompleted = false } = {}
) {
  let spoken = collapseSpokenGaps(learnCallSpokenText(text));
  if (truncated) spoken = learnCallDropIncompleteTail(spoken);
  spoken = learnCallRepairThought(spoken);
  if (shouldKillRecitationLoop({ raw: spoken, lastLearnerText, practiceCompleted }) && !closing) {
    const praise = recitationPraise(spoken);
    const extra = oneQuestion(nextQuestion) || WHOLE_FALLBACK;
    return learnCallRepairThought(`${praise} ${extra}`).trim();
  }
  const originalParts = sentences(spoken);
  const producedModel = learnerAlreadyProducedModel(lastLearnerText, originalParts) || practiceCompleted;
  const parts = dropPronunciationDrills(originalParts, { lastLearnerText, unclear: unclear && !practiceCompleted });
  const maxChars = LEARN_CALL_DIFFICULTIES[difficultyOrDefault(difficulty)].maxReplyChars;
  if (closing) {
    const kept = parts.filter((part) => part.endsWith(".") || part.endsWith("!")).slice(0, 4);
    const closed = learnCallRepairThought(kept.join(" "));
    return closed || "Thank you for practicing today. Goodbye!";
  }
  const englishQuestion = parts.findIndex((part) => part.endsWith("?") && !VIETNAMESE_LETTER.test(part));
  const question = englishQuestion >= 0 ? englishQuestion : parts.findIndex((part) => part.endsWith("?"));
  const kept = question < 0 ? parts.slice(0, 3) : parts.slice(Math.max(0, question - 2), question + 1);
  while (question >= 0 && kept.length > 1 && kept.join(" ").length > maxChars) kept.shift();
  let result = learnCallRepairThought(clipAtWord(kept.join(" "), maxChars));
  const originalQ = question >= 0 ? kept.at(-1) : "";
  const originalWhole = Boolean(originalQ && originalQ.endsWith("?") && learnCallThoughtComplete(originalQ));
  if (originalWhole && !String(result).endsWith(originalQ)) {
    const lead = sentences(result)
      .filter((part) => !part.endsWith("?"))
      .join(" ")
      .trim();
    const combined = lead ? `${lead} ${originalQ}` : originalQ;
    if (combined.length <= maxChars) result = combined;
    else if (originalQ.length <= maxChars) result = originalQ;
  }
  if (asksTutor) {
    const self = String(selfAnswer || "").trim();
    result = swapReciprocal(result, nextQuestion, self);
    if (self && !hasSelfAnswer(result, self)) {
      const answered = `${self} ${result}`.trim();
      result = answered.length <= maxChars ? answered : result;
    }
  }
  const repeats = Number(unclearTurns) || (unclear ? 1 : 0);
  if (!unclear && repeats < 2 && REPEAT_CHECK.test(result)) {
    const instead = oneQuestion(nextQuestion);
    if (instead) {
      const lead = sentences(result)
        .filter((part) => !REPEAT_CHECK.test(part))
        .join(" ")
        .trim();
      const combined = lead ? `${lead} ${instead}` : instead;
      result = combined.length <= maxChars ? combined : instead;
    }
  }
  if (repeats >= 2 && REPEAT_CHECK.test(result)) result = learnCallUnclearLine(repeats, helpText);

  // Stage 2: Allow practice invitations, role-play lines, and Vietnamese explanations without forcing a question mark
  const isPracticePrompt =
    !producedModel &&
    /(?:bạn thử|thử nói|hãy nói|bây giờ bạn|cùng nói|nói theo|you can say|try saying|let's try|practise saying|practice saying)/i.test(result);
  const isRolePlayReply = /(?:you're welcome|you are welcome|here you are|here it is|here's your|enjoy your|have a nice|no problem|my pleasure)/i.test(result);
  const isVietnameseExpl = VIETNAMESE_LETTER.test(result) && /(?:nghĩa là|nghĩa của|dùng khi|câu này|chúng ta|dịch là|trong tiếng việt|trong tiếng anh)/i.test(result);

  if (!result.includes("?") && !isPracticePrompt && !isRolePlayReply && !isVietnameseExpl) {
    const extra = unclear ? learnCallUnclearLine(repeats, helpText) : oneQuestion(nextQuestion) || WHOLE_FALLBACK;
    const lead = result && !REPEAT_CHECK.test(result) ? result : "";
    const both = lead ? `${lead} ${extra}` : extra;
    result = both.length <= maxChars ? both : extra;
  }
  const whole = learnCallRepairThought(result);
  return (whole || (unclear ? learnCallUnclearLine(repeats, helpText) : oneQuestion(nextQuestion) || WHOLE_FALLBACK)).trim();
}
