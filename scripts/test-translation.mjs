#!/usr/bin/env node
/**
 * Bidirectional translation grading and compatibility with older word banks.
 * node --import ./scripts/register-alias.mjs scripts/test-translation.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { buildLessonMixFromContent } from "../lib/beego/learn/lesson-mix-engine.js";
import { checkAnswer, hasAnswerSelected } from "../lib/beego/learn/exercise-check.js";
import { normalizeExercise } from "../lib/beego/learn/normalize-lesson-exercises.js";
import { gradeListenDictation } from "../lib/beego/learn/listen-dictation.js";
import { gradeTranslation, buildTranslationExercise } from "../lib/beego/learn/translation.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function lesson(part) {
  return generateLessonQuestions({
    lessonId: `p${part}-g1-n03`,
    nodeType: "sentence_patterns",
    gate: { topicTitle: "topic", grammarPoint: "grammar" },
    part: { partNumber: part },
    blueprint: { listenSlot: 1 },
  });
}

const basic = lesson(1);
const toEn = basic.find((question) => question.extensions?.translationDirection === "vi-to-en");
const toVi = basic.find((question) => question.extensions?.translationDirection === "en-to-vi");
assert(toEn && toVi, "both translation directions are present");
assert(toEn.prompt === "Dịch sang tiếng Anh." && toVi.prompt === "Dịch sang tiếng Việt.", "the direction is explicit");
assert(toEn.extensions.inputMode === "tiles" && toVi.extensions.inputMode === "tiles", "basic lessons use word tiles");
assert(checkAnswer(toEn, toEn.correctAnswer) === true, "the compiled English answer is accepted");
const name = buildTranslationExercise(
  { en: "My name is Beego.", vi: "Tôi tên là Beego." },
  "vi-to-en",
  { partNumber: 1, distractors: ["You"] }
);
assert(gradeTranslation({ acceptedAnswers: name.accepted, correctAnswer: name.correctAnswer }, ["My", "name", "is", "Beego"]) === true, "the compiled English answer is accepted");
assert(gradeTranslation({ acceptedAnswers: name.accepted, correctAnswer: name.correctAnswer }, ["I", "am", "Beego"]) === true, "an equivalent English answer is accepted");
assert(gradeTranslation({ acceptedAnswers: name.accepted, correctAnswer: name.correctAnswer }, ["You", "are", "Beego"]) === false, "a different subject is rejected");
assert(checkAnswer(toVi, toVi.correctAnswer) === true, "the compiled Vietnamese answer is accepted");
assert(gradeTranslation({ acceptedAnswers: ["Tôi khỏe", "Tôi ổn"], correctAnswer: ["Tôi", "khỏe"] }, ["Tôi", "không", "khỏe"]) === false, "adding negation changes the meaning");
assert(gradeTranslation({ acceptedAnswers: ["I am fine"], correctAnswer: "I am fine" }, "He is fine") === false, "a different subject is rejected");
assert(gradeTranslation({ acceptedAnswers: ["I am fine"], correctAnswer: "I am fine" }, "They are fine") === false, "a different number is rejected");
assert(gradeTranslation({ acceptedAnswers: ["I am fine"], correctAnswer: "I am fine" }, "I was fine") === false, "a different time is rejected");
assert(gradeTranslation(toEn, "beego") === false, "a shared keyword is not enough");
assert(normalizeExercise({ type: "translate_word_bank", correctAnswer: ["I", "am", "Beego"], wordBank: ["I", "am", "Beego"] }).type === "word_order", "older translation items stay word banks");
const legacy = normalizeExercise({
  type: "translate_word_bank",
  prompt: "Sắp xếp: «Tôi tên là Beego»",
  wordBank: ["I", "am", "Beego", "You", "is"],
  correctAnswer: ["I", "am", "Beego"],
});
assert(checkAnswer(legacy, ["I", "am", "Beego"]) === true, "older translation data still grades");
assert(checkAnswer(legacy, ["I", "am", "fine"]) === false, "older translation data still rejects a different sentence");
assert(gradeListenDictation("I am fine", "I'm fine") === true, "dictation still allows its own contraction policy");
assert(gradeTranslation({ acceptedAnswers: ["I am fine"], correctAnswer: "I am fine" }, "I'm fine") === false, "translation does not copy the dictation contraction rule");
const fine = buildTranslationExercise({ en: "I am fine.", vi: "Tôi khỏe." }, "vi-to-en", { partNumber: 1, distractors: ["You"] });
assert(fine.accepted.includes("I'm fine") && fine.accepted.includes("I am fine"), "the full form and the contraction are both compiled");
assert(fine.inputMode === "tiles" && fine.wordBank.some((token) => token === "I'm"), "tile mode can build the contraction");
assert(gradeTranslation({ acceptedAnswers: fine.accepted, correctAnswer: fine.correctAnswer }, ["I'm", "fine"]) === true, "tile mode accepts I'm fine");
assert(gradeTranslation({ acceptedAnswers: fine.accepted, correctAnswer: fine.correctAnswer }, ["I", "am", "fine"]) === true, "tile mode accepts I am fine");
assert(gradeTranslation({ acceptedAnswers: fine.accepted, correctAnswer: fine.correctAnswer }, ["I", "am", "not", "fine"]) === false, "negation is still rejected");
const morning = buildTranslationExercise(
  { en: "Good morning.", vi: "Chào buổi sáng." },
  "en-to-vi",
  { partNumber: 1, distractors: ["hello", "goodbye", "thanks", "Tạm biệt", "Cảm ơn"] }
);
assert(
  morning.wordBank.every((token) => !["hello", "goodbye", "thanks"].includes(token.toLowerCase())),
  "a Vietnamese tile bank does not include English distractors"
);
assert(morning.wordBank.includes("Chào") && morning.wordBank.includes("Tạm"), "Vietnamese distractors stay on the Vietnamese bank");
const typedFine = buildTranslationExercise({ en: "I am fine.", vi: "Tôi khỏe." }, "en-to-vi", { partNumber: 6 });
assert(typedFine.inputMode === "text", "later translation uses free text");
assert(gradeTranslation({ acceptedAnswers: typedFine.accepted, correctAnswer: typedFine.correctAnswer }, "Mình khỏe.") === true, "a compiled Vietnamese equivalent is accepted");
assert(gradeTranslation({ acceptedAnswers: typedFine.accepted, correctAnswer: typedFine.correctAnswer }, "Toi khoe") === false, "Vietnamese diacritics still matter");
assert(gradeTranslation({ acceptedAnswers: ["Tôi khỏe"], correctAnswer: "Tôi khỏe" }, "Toi khoe") === false, "Vietnamese diacritics still matter");
assert(hasAnswerSelected(toEn, []) === false, "an empty tile answer cannot be checked");

const advanced = lesson(6).find((question) => question.type === "translation");
assert(advanced?.extensions?.inputMode === "text", "later lessons can use free text");
assert(String(advanced.explanation).includes("không phải cách đúng duy nhất"), "the model sentence is not presented as the only answer");
const mix = buildLessonMixFromContent({ lessonId: "p1-g1-n03", type: "sentence_patterns", questions: basic }, {});
assert(mix.questions.some((question) => question.type === "word_order"), "existing sentence arrangement stays in the mix");
assert(mix.questions.some((question) => question.extensions?.translationDirection === "vi-to-en"), "English translation stays in the mix");
assert(mix.questions.some((question) => question.extensions?.translationDirection === "en-to-vi"), "Vietnamese translation stays in the mix");

console.log("PASS translation");
