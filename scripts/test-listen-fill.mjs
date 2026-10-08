#!/usr/bin/env node
/**
 * Listen-and-choose the missing word, plus older exercise regression checks.
 * node --import ./scripts/register-alias.mjs scripts/test-listen-fill.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { checkAnswer, hasAnswerSelected } from "../lib/beego/learn/exercise-check.js";
import {
  LISTEN_FILL_PLAYBACK_ERROR,
  LISTEN_FILL_SLOW_RATE,
  buildListenFill,
  gapSentence,
  lengthsTooRevealing,
  listenFillPlaybackIssue,
} from "../lib/beego/learn/listen-fill.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function lesson(nodeType, id, part = 1) {
  return generateLessonQuestions({
    lessonId: id,
    nodeType,
    gate: { topicTitle: "topic", grammarPoint: "grammar" },
    part: { partNumber: part },
    blueprint: { listenSlot: 1 },
  });
}

const repeated = buildListenFill("the cat and the dog", {
  vocab: [
    { en: "cat", vi: "mèo" },
    { en: "dog", vi: "chó" },
    { en: "cap", vi: "mũ" },
    { en: "cup", vi: "cốc" },
    { en: "map", vi: "bản đồ" },
  ],
  listening: ["the cat and the dog", "a red cap", "a blue cup", "an old map"],
  phrases: [{ en: "the cat and the dog", vi: "con mèo và con chó" }],
  seed: 3,
});
assert(repeated, "a sentence with a repeated word can be built");
assert(repeated.displaySentence.split("___").length === 2, "only one blank is opened");
assert(repeated.displaySentence.includes("the"), "the other copy of the repeated word stays visible");
assert(gapSentence(["the", "cat", "and", "the", "dog"], 3) === "the cat and ___ dog", "the blank follows the token index");
assert(!repeated.displaySentence.includes(repeated.transcript), "the gapped sentence is not the full transcript");
assert(repeated.transcript === "the cat and the dog", "the spoken line stays complete");

const listening = lesson("listening", "p2-g1-n04", 2);
const fills = listening.filter((question) => question.type === "listening_fill");
const pictures = listening.filter((question) => question.extensions?.choicePresentation === "picture");
assert(fills.length === 1, "each integrated lesson has one missing-word activity");
assert(pictures.length > 0 && pictures.every((question) => question.prompt === "Nghe và chọn hình đúng."), "picture listening is unchanged");
for (const question of fills) {
  const word = question.extensions.gapWord;
  const options = question.options.map((option) => option.text);
  assert(question.prompt === "Nghe và chọn từ còn thiếu.", "the prompt does not reveal the sentence");
  assert(!question.sentenceTemplate.includes(question.extensions.transcript), "the transcript is not the visible sentence");
  assert(question.sentenceTemplate.split("___").length === 2, "one blank");
  assert((question.sentenceTemplate.match(new RegExp(`\\b${word}\\b`, "i")) || []).length === 0, "the answer word is not left in the sentence");
  assert(question.options.length === 4, "four choices");
  assert(!lengthsTooRevealing(word, options), `${question.id} option length does not reveal ${word}`);
  assert(question.extensions.ttsText === question.extensions.transcript, "playback uses the full sentence");
  assert(question.extensions.gradingTarget.includes(word), "the heard sentence contains the answer");
  assert(hasAnswerSelected(question, "") === false, "an empty choice cannot be submitted");
  assert(checkAnswer(question, question.correctAnswer) === true, "the choice id still grades");
  assert(checkAnswer(question, "z") === false, "a wrong choice id is not correct");
}
assert(LISTEN_FILL_SLOW_RATE > 0 && LISTEN_FILL_SLOW_RATE < 1, "slow listen is slower than normal");
assert(listenFillPlaybackIssue({ ok: false, via: "error" }) === LISTEN_FILL_PLAYBACK_ERROR, "TTS failure offers retry");
assert(listenFillPlaybackIssue({ ok: false, via: "cancelled" }) === "", "stopping the previous clip is not a wrong answer");
assert(listenFillPlaybackIssue({ ok: true, via: "audio" }) === "", "a successful play is not an error");

const part7 = lesson("listening", "p7-g1-n01", 7);
const part7Picture = part7.find((question) => question.extensions?.choicePresentation === "picture");
assert(part7Picture && part7Picture.options.every((option) => option.imageUrl), "part 7 picture options use real images");
assert(part7.some((question) => question.type === "listening_fill"), "part 7 still has the missing-word activity");

console.log("PASS listen fill");
