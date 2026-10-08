#!/usr/bin/env node
/**
 * Listen-and-choose-picture content and grading.
 * node --import ./scripts/register-alias.mjs scripts/test-listen-picture-choice.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { checkAnswer } from "../lib/beego/learn/exercise-check.js";
import { resolveLessonOptionVisualPolicy } from "../lib/beego/learn/lesson-option-visual-policy.js";
import { listDistinctPictureVocab } from "../lib/beego/learn/listen-picture-choice.js";
import { TOPIC_BANKS } from "../lib/beego/learn/lesson-topic-banks.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function listeningQuestions(partNumber) {
  return generateLessonQuestions({
    lessonId: `p${partNumber}-g1-n04`,
    nodeType: "listening",
    gate: { topicTitle: "topic" },
    part: { partNumber },
    blueprint: { listenSlot: 1 },
  }).filter((q) => q.type === "listening_choice");
}

const part2 = listeningQuestions(2);
const pictures = part2.filter((q) => q.extensions?.choicePresentation === "picture");
assert(pictures.length > 0, "part 2 listening has picture choices");

for (const q of pictures) {
  assert(q.prompt === "Nghe và chọn hình đúng.", "Vietnamese prompt");
  assert(q.options.length >= 3 && q.options.length <= 4, "3–4 options");
  const urls = q.options.map((o) => o.imageUrl);
  assert(new Set(urls).size === urls.length, "pictures are distinct");
  assert(q.options.every((o) => o.imageUrl && !o.imageEmoji), "real pictogram, no emoji placeholder");
  const correct = q.options.find((o) => o.id === q.correctAnswer);
  assert(correct, "correct id exists");
  assert(q.extensions.gradingTarget === correct.text, "audio matches the word, not the screen position");
  assert(!q.prompt.toLowerCase().includes(correct.text.toLowerCase()), "prompt hides the English word");
  assert(checkAnswer(q, correct.id) === true, "correct id grades true");
  assert(checkAnswer(q, "0") === false, "display position is not the answer");
  const wrong = q.options.find((o) => o.id !== correct.id);
  assert(checkAnswer(q, wrong.id) === false, "wrong id grades false");
  const policy = resolveLessonOptionVisualPolicy(q);
  assert(policy.pictureChoice === true && policy.showOptionVisuals === true, "picture policy");
}

const textChoice = {
  type: "multiple_choice",
  prompt: "Chọn từ nghĩa là «xin lỗi»",
  options: [
    { id: "a", text: "sorry", imageEmoji: "😔" },
    { id: "b", text: "hello", imageEmoji: "👋" },
    { id: "c", text: "thanks", imageEmoji: "🙏" },
    { id: "d", text: "please", imageEmoji: "🤲" },
  ],
  correctAnswer: "a",
};
const textPolicy = resolveLessonOptionVisualPolicy(textChoice);
assert(textPolicy.pictureChoice !== true && textPolicy.showOptionVisuals === false, "meaning choice stays text");

const grammar = generateLessonQuestions({
  lessonId: "p2-g1-n03",
  nodeType: "grammar",
  gate: { topicTitle: "topic", grammarPoint: "Thì hiện tại" },
  part: { partNumber: 2 },
  blueprint: {},
})[0];
assert(grammar.extensions?.activity === 1, "the first grammar-node activity is picture listening when pictures exist");
assert(grammar.extensions?.choicePresentation === "picture", "picture listening is not converted to text");
assert(grammar.options.every((o) => o.imageUrl), "every picture option has a real image");

const coverage = {};
for (const [part, bank] of Object.entries(TOPIC_BANKS)) {
  coverage[part] = listDistinctPictureVocab(bank.vocab).length;
}
for (const part of [7, 8]) {
  const pictures = listeningQuestions(part).filter((question) => question.extensions?.choicePresentation === "picture");
  assert(pictures.length === 1, `part ${part} has one real picture question`);
  const urls = pictures[0].options.map((option) => option.imageUrl);
  assert(urls.every((url) => url && url.includes("static.arasaac.org")), `part ${part} uses ARASAAC pictures`);
  assert(new Set(urls).size === urls.length, `part ${part} pictures are distinct`);
}
console.log("PICTURE_VOCAB=" + JSON.stringify(coverage));
console.log("PASS listen picture choice");
