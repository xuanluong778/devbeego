#!/usr/bin/env node
/**
 * Listen-and-type grading, plus a check that older listening items remain.
 * node --import ./scripts/register-alias.mjs scripts/test-listen-dictation.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { buildLessonMixFromContent } from "../lib/beego/learn/lesson-mix-engine.js";
import { checkAnswer, hasAnswerSelected } from "../lib/beego/learn/exercise-check.js";
import {
  canonicalListenText,
  dictationRecordsAttempt,
  dictationTokenDiff,
  gradeListenDictation,
  shouldSubmitDictation,
} from "../lib/beego/learn/listen-dictation.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const target = "I don't like the cat and the dog.";
assert(gradeListenDictation(target, "i dont like the cat and the dog") === false, "a missing apostrophe is not silently accepted");
assert(gradeListenDictation(target, "I do not like the cat and the dog") === true, "don't and do not match the contraction policy");
assert(gradeListenDictation(target, "  I   do not like the cat and the dog! ") === true, "space, case, and final punctuation are normalized");
assert(gradeListenDictation(target, "I do like the cat and the dog") === false, "dropping not changes the meaning");
assert(gradeListenDictation(target, "I do not like the cap and the dog") === false, "one wrong word is not correct");
assert(gradeListenDictation(target, "") === false, "an empty answer is not correct");
assert(canonicalListenText("It’s fine.") === "it is fine", "curly apostrophes use the same contraction");
assert(gradeListenDictation("It's fine.", "its fine") === false, "its and it's stay different");

const repeated = dictationTokenDiff(target, "I do not like the cat and dog");
assert(repeated.some((mark) => mark.kind === "missing" && mark.text === "the"), "a repeated word can be missing once");
const wrong = dictationTokenDiff(target, "I do not like the cap and the dog");
assert(wrong.some((mark) => mark.kind === "wrong" && mark.text === "cat" && mark.written === "cap"), "a wrong word is labeled");
assert(gradeListenDictation(target, "I do not like the cap and the dog") === false, "the diff does not decide correctness");
assert(!shouldSubmitDictation({ key: "Enter", isComposing: true, value: "I do not" }), "Enter during IME does not submit");
assert(shouldSubmitDictation({ key: "Enter", isComposing: false, value: "I do not" }), "Enter submits a finished answer");
assert(!shouldSubmitDictation({ key: "Enter", isComposing: false, value: "   " }), "Enter does not submit an empty answer");
assert(dictationRecordsAttempt("first") === true && dictationRecordsAttempt("practice") === false, "practice does not create another attempt");

const questions = generateLessonQuestions({
  lessonId: "p1-g1-n02",
  nodeType: "listening",
  gate: { topicTitle: "topic", grammarPoint: "grammar" },
  part: { partNumber: 1 },
  blueprint: { listenSlot: 1 },
});
const dictated = questions.find((question) => question.type === "listening_dictation");
const fill = questions.find((question) => question.type === "listening_fill");
const picture = questions.find((question) => question.extensions?.choicePresentation === "picture");
assert(dictated && fill && picture, "dictation is added beside fill and picture listening");
assert(dictated.prompt === "Nghe và nhập lại câu.", "the prompt hides the transcript");
assert(!dictated.sentenceTemplate, "no gapped sentence is shown for dictation");
assert(!String(dictated.prompt).includes(dictated.extensions.transcript), "the transcript is not in the prompt");
assert(dictated.extensions.hintMode === "count" && !String(dictated.extensions.wordCount).includes(dictated.extensions.transcript), "the early hint is only a word count");
assert(hasAnswerSelected(dictated, "  ") === false, "blank input cannot be checked");
assert(checkAnswer(dictated, dictated.extensions.transcript) === true, "the heard sentence grades through the existing checker");
const advanced = generateLessonQuestions({
  lessonId: "p6-g1-n02",
  nodeType: "listening",
  gate: { topicTitle: "topic", grammarPoint: "grammar" },
  part: { partNumber: 6 },
  blueprint: { listenSlot: 1 },
}).find((question) => question.type === "listening_dictation");
assert(advanced?.extensions?.hintMode === "none", "later lessons do not offer the word-count hint");
const mix = buildLessonMixFromContent({ lessonId: "p1-g1-n02", type: "listening", questions }, {});
assert(mix.questions.some((question) => question.type === "listening_dictation"), "the mix keeps dictation");
assert(mix.questions.some((question) => question.type === "listening_fill"), "the mix keeps missing-word listening");
assert(mix.questions.some((question) => question.extensions?.choicePresentation === "picture"), "the mix keeps picture listening");

console.log("PASS listen dictation");
