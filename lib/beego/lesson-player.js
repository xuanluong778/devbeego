import { LESSON_PLAYER_MOCK, getDefaultLesson } from "@/lib/beego/lesson-player-mock";
import {
  checkAnswer as checkExerciseAnswer,
  getCorrectAnswerDisplay as getExerciseCorrectDisplay,
  hasAnswerSelected as hasExerciseAnswer,
} from "@/lib/beego/learn/exercise-check";
import { normalizeExercise } from "@/lib/beego/learn/normalize-lesson-exercises";

const SKILL_LABELS = {
  vocabulary_choice: "Từ vựng mới",
  translate_word_bank: "Bài tập khó",
  multiple_choice: "Chọn nghĩa đúng",
  listening_fill: "Nghe và điền",
  sentence_complete: "Chọn câu hoàn chỉnh",
  vocab_list: "Ôn từ vựng",
};

export function getSkillLabel(question) {
  return question.skillLabel || SKILL_LABELS[question.type] || "Bài học";
}

/**
 * Sync mock fallback only — prefer fetchLessonForPlayer() in client.
 * @param {string} lessonId
 */
export function loadLessonFallback(lessonId) {
  const lesson = LESSON_PLAYER_MOCK[lessonId];
  if (lesson) return JSON.parse(JSON.stringify(lesson));
  return getDefaultLesson(lessonId);
}

/** @deprecated Use fetchLessonForPlayer */
export function loadLesson(lessonId) {
  return loadLessonFallback(lessonId);
}

export function getLessonPlayerPath(lessonId) {
  return `/learn/lesson/${lessonId}`;
}

/**
 * @param {object} question
 * @param {string|string[]|null} answer
 */
export function checkAnswer(question, answer) {
  return checkExerciseAnswer(normalizeExercise(question), answer);
}

export function getCorrectAnswerDisplay(question) {
  return getExerciseCorrectDisplay(normalizeExercise(question));
}

export function hasAnswerSelected(question, answer) {
  return hasExerciseAnswer(normalizeExercise(question), answer);
}
