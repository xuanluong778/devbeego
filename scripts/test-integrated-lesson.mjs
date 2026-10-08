#!/usr/bin/env node
/**
 * Integrated 12-activity lessons.
 * node --import ./scripts/register-alias.mjs scripts/test-integrated-lesson.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { buildLessonMixFromContent } from "../lib/beego/learn/lesson-mix-engine.js";
import { buildLessonContentRegistry } from "../lib/beego/learn/lesson-content-build.js";
import { buildIntegratedLessonQuestions } from "../lib/beego/learn/integrated-lesson.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function lesson(id, type, part) {
  return generateLessonQuestions({
    lessonId: id,
    nodeType: type,
    gate: { topicTitle: "topic", grammarPoint: "grammar" },
    part: { partNumber: part },
    blueprint: { nodeIndex: Number(id.slice(-2)) },
  });
}

function activities(questions) {
  return questions.map((question) => question.extensions?.activity);
}

const first = lesson("p1-g1-n01", "vocabulary", 1);
const middle = lesson("p4-g1-n08", "listening", 4);
const last = lesson("p8-g1-n14", "story", 8);
const boss = lesson("p1-g1-n15", "test", 1);
const review = lesson("p1-g1-n16", "review", 1);

for (const sample of [first, middle]) {
  assert(activities(sample).join(",") === "1,2,3,4,5,6,7,8,8,9,10,11,12", "twelve activities stay in order");
  assert(sample.filter((question) => question.extensions?.activity === 8).length === 2, "translation has two directions");
  const directions = sample
    .filter((question) => question.type === "translation")
    .map((question) => question.extensions.translationDirection);
  assert(directions.join(",") === "vi-to-en,en-to-vi", "translation is Vietnamese then English");
  assert(sample[0].extensions.choicePresentation === "picture", "the first activity is picture listening");
  assert(sample[0].options.every((option) => option.imageUrl), "picture options use real images");
}

assert(activities(last).join(",") === "1,2,3,4,5,6,7,8,8,9,10,11,12", "part 8 has picture listening from real pictograms");
assert(last[0].options.every((option) => option.imageUrl && !String(option.imageUrl).includes("placeholder")), "part 8 pictures are real urls");

const earlyBuilt = buildIntegratedLessonQuestions({
  lessonId: "p7-g1-n01",
  nodeType: "vocabulary",
  part: { partNumber: 7 },
  blueprint: { nodeIndex: 1 },
});
const lateBuilt = buildIntegratedLessonQuestions({
  lessonId: "p8-g1-n14",
  nodeType: "story",
  part: { partNumber: 8 },
  blueprint: { nodeIndex: 14 },
});
assert(!earlyBuilt.gaps.some((gap) => gap.code === "picture_listening"), "part 7 uses real pictograms");
assert(!lateBuilt.gaps.some((gap) => gap.code === "picture_listening"), "part 8 uses real pictograms");

assert(!boss.some((question) => question.extensions?.integratedLesson), "the boss test keeps its own questions");
assert(!review.some((question) => question.extensions?.integratedLesson), "review keeps its own questions");
assert(boss.length >= 10 && review.length >= 1, "special lessons still have their own length");

const keys = (questions) =>
  questions
    .map((question) =>
      [question.extensions?.transcript, question.extensions?.modelSentence, question.speakTarget, question.storyText]
        .filter(Boolean)
        .join("|")
    )
    .filter(Boolean);
assert(keys(first).join("||") !== keys(middle).join("||"), "an early lesson and a middle lesson do not copy one script");

const mix = buildLessonMixFromContent({ lessonId: "p1-g1-n01", type: "vocabulary", questions: first }, {});
assert(mix.questions.length === first.length, "the mix does not drop an activity");
assert(mix.mixMeta.mode === "integrated", "integrated delivery stays in order");
assert(
  mix.questions.map((question) => question.activityMeta.sourceQuestionId).join(",") === first.map((question) => question.id).join(","),
  "source question ids stay attached"
);

const registry = buildLessonContentRegistry();
assert(registry["p1-g1-n01"].contentGaps.length === 0, "part 1 can fill every activity");
assert(!registry["p7-g1-n01"].contentGaps.some((gap) => gap.activity === 1), "part 7 no longer records a picture gap");
assert(registry["p1-g1-n15"].type === "test" && !registry["p1-g1-n15"].questions.some((question) => question.extensions?.integratedLesson), "test payload is unchanged in kind");
assert(Object.keys(registry).length === 128, "node count and lesson ids stay");

console.log("PASS integrated lesson");
