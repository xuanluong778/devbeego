#!/usr/bin/env node
/**
 * Context cloze with one stable blank.
 * node --import ./scripts/register-alias.mjs scripts/test-context-cloze.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { buildLessonMixFromContent } from "../lib/beego/learn/lesson-mix-engine.js";
import { checkAnswer, hasAnswerSelected } from "../lib/beego/learn/exercise-check.js";
import { buildContextCloze, gapAt } from "../lib/beego/learn/context-cloze.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function lesson(id, part) {
  return generateLessonQuestions({
    lessonId: id,
    nodeType: "grammar",
    gate: { topicTitle: "topic", grammarPoint: "grammar" },
    part: { partNumber: part },
    blueprint: { listenSlot: 1 },
  });
}

assert(gapAt(["the", "cat", "and", "the", "dog"], 3) === "the cat and ___ dog", "only the chosen repeated word is blank");
const early = buildContextCloze(1, 0);
const other = buildContextCloze(1, 1);
assert(early.blankId !== other.blankId, "the same topic uses a different situation");
assert(early.display.split("___").length === 2, "early items have one blank");
assert(early.display.length > 0 && early.completed.includes(early.answers[0]), "the completed sentence restores that blank");

const basic = lesson("p1-g1-n05", 1).find((question) => question.type === "context_cloze");
assert(basic && basic.options.length === 4, "basic cloze uses four choices");
assert(basic.extensions.blankId && basic.extensions.gapIndex >= 0, "the blank has a stable id");
assert(checkAnswer(basic, basic.correctAnswer) === true, "the choice id still grades");
assert(basic.explanation.length > 0, "the explanation names the grammar point");
assert(!basic.extensions.ttsText, "context reading does not require TTS");

const later = lesson("p8-g1-n05", 8).find((question) => question.type === "context_cloze");
assert(later?.extensions?.inputMode === "text", "later cloze uses typed input");
assert(later.sentenceTemplate.length > 40, "the passage is long enough to decide the word");
assert(hasAnswerSelected(later, "   ") === false, "an empty typed answer cannot be checked");
assert(checkAnswer(later, later.extensions.answers[0]) === true, "the compiled word is accepted");
if (later.extensions.answers.length > 1) {
  assert(checkAnswer(later, later.extensions.answers[1]) === true, "a compiled variant is accepted");
  assert(checkAnswer(later, "However") === false || later.extensions.answers.includes("However"), "a meaning change is not accepted by overlap");
}
assert(later.explanation.length > 0, "the typed item explains the link");
const mix = buildLessonMixFromContent({ lessonId: "p1-g1-n05", type: "grammar", questions: lesson("p1-g1-n05", 1) }, {});
assert(mix.questions.some((question) => question.type === "context_cloze"), "the mix keeps the context cloze");
assert(mix.questions.some((question) => question.type === "multiple_choice"), "existing grammar choices stay in the mix");

console.log("PASS context cloze");
