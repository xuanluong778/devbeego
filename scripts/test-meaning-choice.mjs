#!/usr/bin/env node
/**
 * Meaning choice quality, both directions, and listening-picture regression.
 * node --import ./scripts/register-alias.mjs scripts/test-meaning-choice.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { checkAnswer } from "../lib/beego/learn/exercise-check.js";
import { prepareViToEnMeaning } from "../lib/beego/learn/meaning-choice.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function lesson(part, nodeType, id) {
  return generateLessonQuestions({
    lessonId: id,
    nodeType,
    gate: { topicTitle: "topic", grammarPoint: "grammar" },
    part: { partNumber: part },
    blueprint: { listenSlot: 1 },
  });
}

function lengthOk(options, correctText) {
  const correct = options.find((opt) => opt.text === correctText);
  const others = options.filter((opt) => opt !== correct).map((opt) => opt.text.length);
  const longestOther = Math.max(...others);
  return correct.text.length <= longestOther + 8;
}

const vocab = lesson(1, "vocabulary", "p1-g1-n01");
const meanings = vocab.filter((q) => q.extensions?.meaningChoice);
assert(meanings.length === 1, "each lesson has one meaning activity");
const enToVi = meanings.filter((q) => q.extensions.meaningDirection === "en-to-vi");
assert(enToVi.length === 1, "the lesson meaning activity is English to Vietnamese");

for (const q of meanings) {
  assert(q.options.length === 4, "four options");
  assert(new Set(q.options.map((o) => o.id)).size === 4, "stable option ids");
  const correct = q.options.find((o) => o.id === q.correctAnswer);
  assert(correct, "one correct id");
  assert(q.options.filter((o) => o.id === q.correctAnswer).length === 1, "single correct");
  assert(checkAnswer(q, correct.id) === true, "grade by id");
  assert(checkAnswer(q, "0") === false, "position is not the answer");
  assert(q.explanation && /không phải|không đúng|nghĩa/.test(q.explanation), "Vietnamese explanation");
  assert(lengthOk(q.options, correct.text), `length stands out: ${q.prompt}`);
  assert(!q.options.some((o) => o.imageEmoji || o.imageUrl), "meaning options stay text");
}

const sample = enToVi[0];
assert(sample.extensions.ttsText, "listen text is the English stem");
assert(!sample.extensions.ttsText.includes(sample.options.find((o) => o.id === sample.correctAnswer).text), "listen does not speak the Vietnamese answer");

const reverse = prepareViToEnMeaning({
  vi: "xin chào",
  correct: "hello",
  pool: ["goodbye", "thanks", "please", "hello"],
  seed: 2,
});
assert(reverse.direction === "vi-to-en", "the reverse helper still exists for other surfaces");
assert(!reverse.ttsText, "reverse does not play the answer before a choice");

const listening = lesson(2, "listening", "p2-g1-n04");
const pictures = listening.filter((q) => q.extensions?.choicePresentation === "picture");
assert(pictures.length > 0, "picture listening remains");
assert(pictures.every((q) => !q.extensions.meaningChoice), "picture questions are not meaning choices");
assert(pictures.every((q) => q.options.every((o) => o.imageUrl)), "picture options keep images");

for (const part of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const qs = lesson(part, "vocabulary", `p${part}-g1-n01`);
  const sampleQ = qs.find((q) => q.extensions?.meaningChoice && q.extensions.meaningDirection === "en-to-vi" && q.prompt.includes("Trong câu") || (q.extensions?.ttsText && q.skillLabel === "Chọn nghĩa đúng" && q.prompt.includes("?")));
  assert(qs.some((q) => q.skillLabel === "Chọn nghĩa đúng"), `part ${part} has a meaning question`);
  assert(sampleQ, `part ${part} has an English stimulus`);
}

console.log("PASS meaning choice");
