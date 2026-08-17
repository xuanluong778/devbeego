import { LESSON_PLAYER_MOCK, getDefaultLesson } from "@/lib/beego/lesson-player-mock";

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
 * Load lesson by id — swap for API later.
 * @param {string} lessonId
 */
export function loadLesson(lessonId) {
  const lesson = LESSON_PLAYER_MOCK[lessonId];
  if (lesson) return JSON.parse(JSON.stringify(lesson));
  return getDefaultLesson(lessonId);
}

export function getLessonPlayerPath(lessonId) {
  return `/learn/lesson/${lessonId}`;
}

/**
 * @param {object} question
 * @param {string|string[]|null} answer
 */
export function checkAnswer(question, answer) {
  if (answer == null) return false;

  if (question.type === "translate_word_bank") {
    const expected = Array.isArray(question.correctAnswer)
      ? question.correctAnswer
      : String(question.correctAnswer).split(" ");
    const given = Array.isArray(answer) ? answer : [];
    if (expected.length !== given.length) return false;
    return expected.every((w, i) => w === given[i]);
  }

  return String(answer) === String(question.correctAnswer);
}

export function getCorrectAnswerDisplay(question) {
  if (question.type === "translate_word_bank") {
    const words = Array.isArray(question.correctAnswer)
      ? question.correctAnswer
      : String(question.correctAnswer).split(" ");
    return words.join(" ");
  }
  const opt = question.options?.find((o) => o.id === question.correctAnswer);
  return opt?.text || String(question.correctAnswer);
}

export function hasAnswerSelected(question, answer) {
  if (answer == null) return false;
  if (question.type === "translate_word_bank") {
    return Array.isArray(answer) && answer.length > 0;
  }
  return String(answer).length > 0;
}
