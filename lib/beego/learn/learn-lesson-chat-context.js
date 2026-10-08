/**
 * Build server-side lesson context + access check for Learn chat.
 */

import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import { flattenPathNodes } from "@/lib/beego/learning-path-build";

function pushWord(set, raw) {
  const w = String(raw || "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .trim()
    .toLowerCase();
  if (!w || w.length > 48) return;
  if (w.split(/\s+/).length > 6) return;
  set.add(w);
}

/**
 * Deterministic vocab/phrase extraction from lesson content (no client input).
 * @param {object} lesson
 * @returns {string[]}
 */
export function extractVocabularyFromLesson(lesson) {
  const set = new Set();
  if (!lesson) return [];

  pushWord(set, lesson.topicTitle);
  for (const q of lesson.questions || []) {
    pushWord(set, q.speakTarget);
    pushWord(set, q.extensions?.gradingTarget);
    pushWord(set, q.extensions?.ttsText);
    pushWord(set, q.ttsText);
    if (q.type === "vocabulary_choice" || q.type === "multiple_choice") {
      for (const opt of q.options || []) {
        if (String(opt.id) === String(q.correctAnswer)) pushWord(set, opt.text);
      }
    }
    if (Array.isArray(q.wordBank)) {
      for (const w of q.wordBank.slice(0, 8)) pushWord(set, w);
    }
  }
  return [...set].slice(0, 24);
}

/**
 * @param {object} lesson
 */
export function buildLessonChatContext(lesson) {
  return {
    lessonId: String(lesson.lessonId || ""),
    title: String(lesson.title || ""),
    objective: String(lesson.objective || ""),
    level: String(lesson.level || ""),
    topicTitle: String(lesson.topicTitle || ""),
    grammarPoint: String(lesson.grammarPoint || ""),
    lessonType: String(lesson.type || lesson.activityType || ""),
    vocabularyWords: extractVocabularyFromLesson(lesson),
  };
}

/**
 * Lesson must exist and not be locked on the user's path.
 * @param {number} userId
 * @param {string} lessonId
 */
export async function assertUserCanAccessLearnLessonChat(userId, lessonId) {
  const id = String(lessonId || "").trim();
  if (!id) {
    return { ok: false, status: 400, code: "LESSON_ID_REQUIRED", message: "lesson_id required." };
  }

  const lesson = getLessonContentById(id);
  if (!lesson) {
    return { ok: false, status: 404, code: "LESSON_NOT_FOUND", message: "Lesson not found." };
  }

  // Lazy import — keeps Node smoke tests free of TS-only transitive deps.
  const { getLearningPathForUser } = await import("@/lib/beego/learning-path-progress");
  const path = await getLearningPathForUser(userId);
  const nodes = flattenPathNodes(path.sections || []);
  const node = nodes.find((n) => n.lessonId === id);
  if (!node) {
    return { ok: false, status: 404, code: "LESSON_NOT_FOUND", message: "Lesson not on path." };
  }

  const status = String(node.status || "");
  if (status === "locked") {
    return {
      ok: false,
      status: 403,
      code: "LESSON_LOCKED",
      message: "Complete previous lessons to unlock this conversation.",
    };
  }

  const context = buildLessonChatContext(lesson);
  return { ok: true, lesson, node, context };
}
