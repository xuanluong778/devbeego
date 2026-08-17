/**
 * Mock lesson player content — replace with API fetch by lessonId later.
 */

/** @typedef {'vocabulary_choice'|'translate_word_bank'|'multiple_choice'|'listening_fill'|'sentence_complete'|'vocab_list'} QuestionType */

/**
 * @typedef {object} LessonQuestion
 * @property {string} id
 * @property {QuestionType} type
 * @property {string} skillLabel
 * @property {string} prompt
 * @property {Array<{ id: string, text: string, imageEmoji?: string }>} [options]
 * @property {string|string[]} correctAnswer
 * @property {string} [explanation]
 * @property {string} [audioUrl]
 * @property {string} [imageEmoji]
 * @property {string[]} [wordBank]
 * @property {string} [sentenceTemplate]
 */

/**
 * @typedef {object} LessonContent
 * @property {string} lessonId
 * @property {string} title
 * @property {number} lives
 * @property {number} honeyReward
 * @property {number} xpReward
 * @property {LessonQuestion[]} questions
 */

/** @type {Record<string, LessonContent>} */
export const LESSON_PLAYER_MOCK = {
  "s4-l3": {
    lessonId: "s4-l3",
    title: "Mời khách rót nước",
    lives: 3,
    honeyReward: 20,
    xpReward: 15,
    questions: [
      {
        id: "q1",
        type: "vocabulary_choice",
        skillLabel: "Từ vựng mới",
        prompt: "Đâu là nước?",
        imageEmoji: "💧",
        options: [
          { id: "a", text: "water", imageEmoji: "💧" },
          { id: "b", text: "coffee", imageEmoji: "☕" },
          { id: "c", text: "tea", imageEmoji: "🍵" },
          { id: "d", text: "juice", imageEmoji: "🧃" },
        ],
        correctAnswer: "a",
        explanation: "Water = nước",
      },
      {
        id: "q2",
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: '"Would you like some water?" nghĩa là gì?',
        options: [
          { id: "a", text: "Bạn muốn uống nước không?" },
          { id: "b", text: "Bạn thích cà phê không?" },
          { id: "c", text: "Bạn đói chưa?" },
        ],
        correctAnswer: "a",
        explanation: "Would you like...? = Bạn có muốn... không?",
      },
      {
        id: "q3",
        type: "translate_word_bank",
        skillLabel: "Bài tập khó",
        prompt: "Dịch câu sau sang tiếng Anh:",
        sentenceTemplate: "Bạn có muốn nước không?",
        wordBank: ["you", "like", "Would", "water", "some", "?", "Do"],
        correctAnswer: ["Would", "you", "like", "some", "water", "?"],
        explanation: "Would you like some water?",
      },
      {
        id: "q4",
        type: "listening_fill",
        skillLabel: "Nghe và điền",
        prompt: "Nghe và chọn từ còn thiếu: “Can I get you some ___?”",
        audioUrl: null,
        options: [
          { id: "a", text: "water" },
          { id: "b", text: "bread" },
          { id: "c", text: "sugar" },
        ],
        correctAnswer: "a",
        explanation: "Can I get you some water?",
      },
      {
        id: "q5",
        type: "sentence_complete",
        skillLabel: "Chọn câu hoàn chỉnh",
        prompt: "Chọn câu lịch sự khi mời khách:",
        options: [
          { id: "a", text: "Would you like some tea or coffee?" },
          { id: "b", text: "Give me water now." },
          { id: "c", text: "You drink water." },
        ],
        correctAnswer: "a",
        explanation: "Would you like...? là cách mời lịch sự.",
      },
      {
        id: "q6",
        type: "vocab_list",
        skillLabel: "Ôn từ vựng",
        prompt: "Chọn cặp từ đúng:",
        options: [
          { id: "a", text: "water — nước" },
          { id: "b", text: "coffee — trà" },
          { id: "c", text: "juice — sữa" },
        ],
        correctAnswer: "a",
        explanation: "coffee = cà phê, juice = nước ép",
      },
    ],
  },
  "s4-l1": {
    lessonId: "s4-l1",
    title: "Từ vựng đồ uống",
    lives: 3,
    honeyReward: 15,
    xpReward: 10,
    questions: [
      {
        id: "q1",
        type: "vocabulary_choice",
        skillLabel: "Từ vựng mới",
        prompt: "Đâu là cà phê?",
        options: [
          { id: "a", text: "coffee", imageEmoji: "☕" },
          { id: "b", text: "water", imageEmoji: "💧" },
          { id: "c", text: "milk", imageEmoji: "🥛" },
        ],
        correctAnswer: "a",
        explanation: "Coffee = cà phê",
      },
      {
        id: "q2",
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: '"tea" nghĩa là gì?',
        options: [
          { id: "a", text: "trà" },
          { id: "b", text: "nước" },
          { id: "c", text: "sữa" },
        ],
        correctAnswer: "a",
        explanation: "Tea = trà",
      },
    ],
  },
};

/** Default lesson for unknown lessonIds — TODO: replace with API error/redirect */
export function getDefaultLesson(lessonId) {
  return {
    lessonId,
    title: "Bài học Beego",
    lives: 3,
    honeyReward: 15,
    xpReward: 10,
    questions: LESSON_PLAYER_MOCK["s4-l3"].questions.slice(0, 3),
  };
}
