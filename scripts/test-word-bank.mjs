#!/usr/bin/env node
/**
 * Word bank tokens, exact sequences, and existing lesson grading.
 * node --import ./scripts/register-alias.mjs scripts/test-word-bank.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { checkAnswer, hasAnswerSelected } from "../lib/beego/learn/exercise-check.js";
import {
  clearWordBank,
  createWordBank,
  gradeWordOrder,
  placeToken,
  returnToken,
  tokenizeLessonWords,
  undoWordBank,
  wordBankAnswerTexts,
  wordOrderMeaning,
  wordOrderModel,
} from "../lib/beego/learn/word-bank.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(
  tokenizeLessonWords("I'm at check-in. It's 3 p.m., don't wait!").join("|") ===
    "I'm|at|check-in|It's|3|p.m.|don't|wait",
  "contractions, hyphens, and abbreviations stay whole"
);
assert(!tokenizeLessonWords("Hello!").includes("!"), "punctuation is not a word tile");

const repeated = createWordBank(["The", "room", "is", "on", "the", "second", "floor", "the"]);
const theIds = repeated.tokens.filter((token) => token.text === "the" || token.text === "The").map((token) => token.id);
assert(new Set(theIds).size === 3, "repeated words have separate ids");
let state = repeated;
for (const id of theIds) state = placeToken(state, id);
assert(wordBankAnswerTexts(state).length === 3, "each repeated tile can be placed");
state = returnToken(state, theIds[1]);
assert(!state.placed.includes(theIds[1]) && state.placed.includes(theIds[0]), "returning one tile keeps the others");
state = undoWordBank(state);
assert(state.placed.length === 1, "undo removes only the last tile");
state = clearWordBank(state);
assert(state.placed.length === 0, "clear removes the sentence");

let rapid = createWordBank(["the", "the"]);
rapid = placeToken(rapid, rapid.tokens[0].id);
rapid = placeToken(rapid, rapid.tokens[0].id);
rapid = placeToken(rapid, rapid.tokens[1].id);
assert(rapid.placed.length === 2, "a rapid second tap does not place the same tile twice");

const orders = {
  type: "word_order",
  correctAnswer: ["I", "am", "fine"],
  acceptedAnswers: [
    ["I", "am", "fine"],
    ["Fine", "I", "am"],
  ],
};
assert(gradeWordOrder(orders, ["I", "am", "fine"]) && gradeWordOrder(orders, ["Fine", "I", "am"]), "listed orders are accepted");
assert(!gradeWordOrder(orders, ["fine", "I", "am"]), "a different token is not a fuzzy match");
assert(!gradeWordOrder({ type: "word_order", correctAnswer: ["Hello"] }, ["Hello!"]), "punctuation changes the token");
assert(!hasAnswerSelected({ type: "word_order" }, []), "an empty sentence cannot be checked");

const words = ["The", "room", "is", "on", "the", "second", "floor"];
const longOrder = {
  type: "word_order",
  prompt: "Sắp xếp: «Phòng ở tầng hai.»",
  wordBank: [...words, "taxi", "map"],
  correctAnswer: words,
  explanation: "The room is on the second floor.",
  extensions: { modelSentence: "The room is on the second floor.", meaning: "Phòng ở tầng hai." },
};
const bankTexts = longOrder.wordBank.join(" ").toLowerCase();
for (const word of longOrder.correctAnswer) {
  assert(bankTexts.includes(String(word).toLowerCase()), `bank keeps ${word}`);
}
assert(checkAnswer(longOrder, longOrder.correctAnswer) === true, "the original order still grades correct");
assert(checkAnswer(longOrder, [...longOrder.correctAnswer].reverse()) === false, "a reversed sentence is not correct");
assert(wordOrderModel(longOrder).includes("floor"), "the model sentence is available after grading");
assert(wordOrderMeaning(longOrder).length > 0, "the Vietnamese meaning is available after grading");

const generated = generateLessonQuestions({
  lessonId: "p6-g1-n01",
  nodeType: "sentence_patterns",
  gate: { topicTitle: "topic", grammarPoint: "grammar" },
  part: { partNumber: 6 },
  blueprint: { listenSlot: 1 },
}).find((question) => question.type === "word_order");
assert(generated.correctAnswer.every((word) => generated.wordBank.includes(word)), "generated bank keeps every answer token");
assert(checkAnswer(generated, generated.correctAnswer) === true, "existing word-order grading is unchanged");
const extra = generated.wordBank.filter((word) => !generated.correctAnswer.some((answer) => answer.toLowerCase() === String(word).toLowerCase()));
assert(extra.length > 0, "distractors remain");
assert(new Set(extra.map((word) => word.toLowerCase())).size === extra.length, "distractors do not copy answer words");

console.log("PASS word bank");
