#!/usr/bin/env node
/**
 * Curated dialogue response inside the lesson player.
 * node --import ./scripts/register-alias.mjs scripts/test-dialogue-response.mjs
 */
import { readFileSync } from "node:fs";
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { buildLessonMixFromContent } from "../lib/beego/learn/lesson-mix-engine.js";
import { checkAnswer, hasAnswerSelected } from "../lib/beego/learn/exercise-check.js";
import { buildDialogueResponse, visibleDialogueTurns } from "../lib/beego/learn/dialogue-response.js";
import { normalizeExercise } from "../lib/beego/learn/normalize-lesson-exercises.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function story(id, part) {
  return generateLessonQuestions({
    lessonId: id,
    nodeType: "story",
    gate: { topicTitle: "topic", grammarPoint: "grammar" },
    part: { partNumber: part },
    blueprint: {},
  });
}

for (let part = 1; part <= 8; part += 1) {
  const first = buildDialogueResponse(part, 0);
  const second = buildDialogueResponse(part, 1);
  assert(first.situation !== second.situation, `part ${part} uses two situations`);
  assert(first.blankId !== second.blankId, `part ${part} blank ids differ`);
  for (const built of [first, second]) {
    assert(built.lines.filter((line) => line.pending).length === 1, "one reply slot");
    assert(built.lines.every((line) => line.turnId && line.speaker && line.avatar), "each turn has a speaker");
    assert(!built.distractors.includes(built.reply), "distractors are not the reply");
    assert(new Set([built.reply, ...built.distractors]).size === 4, "four distinct lines");
  }
}

const early = buildDialogueResponse(1, 0);
const hidden = visibleDialogueTurns(
  { extensions: early, options: [{ id: "a", text: early.reply }], correctAnswer: "a" },
  false
);
assert(hidden.length === early.lines.length, "the next turn stays hidden before grading");
assert(hidden[1].pending && hidden[1].text === "", "the reply slot is empty before grading");
assert(hidden.map((line) => line.speaker).join(",") === early.lines.map((line) => line.speaker).join(","), "turn order stays");

const shown = visibleDialogueTurns(
  { extensions: early, options: [{ id: "a", text: early.reply }], correctAnswer: "a" },
  true
);
assert(shown.at(-2).text === early.reply, "the graded dialogue uses the compiled reply");
assert(shown.at(-1).turnId === early.followUp.turnId, "one follow-up appears after grading");

const questions = story("p1-g1-n14", 1);
const dialogue = questions.find((question) => question.type === "dialogue_response");
const storyItem = questions.find((question) => question.type === "story_comprehension");
assert(dialogue && storyItem, "story lessons keep comprehension and add one dialogue");
assert(dialogue.options.length === 4, "the dialogue offers four replies");
assert(dialogue.prompt === "Chọn câu đáp để hoàn thành hội thoại.", "prompt");
assert(checkAnswer(dialogue, dialogue.correctAnswer) === true, "the existing choice id grades the reply");
const wrong = dialogue.options.find((option) => option.id !== dialogue.correctAnswer);
assert(checkAnswer(dialogue, wrong.id) === false, "a contextual distractor is wrong");
assert(hasAnswerSelected(dialogue, "") === false, "an empty choice cannot be checked");
assert(hasAnswerSelected(dialogue, dialogue.correctAnswer) === true, "a selected reply can be checked");
assert(dialogue.explanation.length > 20, "the explanation says why the reply fits");
assert(!dialogue.ttsText, "dialogue TTS is per turn, not a required transcript");

const normalized = normalizeExercise(dialogue);
assert(normalized.type === "dialogue_response", "dialogue is not remapped");

const mix = buildLessonMixFromContent(
  { lessonId: "p1-g1-n14", type: "story", questions },
  {}
);
const types = new Set((mix.questions || []).map((question) => question.type));
assert(types.has("dialogue_response"), "the mix keeps the dialogue");
assert(types.has("story_comprehension"), "story questions stay in the mix");
assert((mix.questions || []).length === questions.length, "the integrated mix keeps every activity");
assert(
  (mix.questions || []).map((question) => question.extensions?.activity).join(",") ===
    questions.map((question) => question.extensions?.activity).join(","),
  "the mix keeps the activity order"
);

const source = readFileSync(new URL("../lib/beego/learn/dialogue-response.js", import.meta.url), "utf8");
assert(!source.includes("LessonAiConversation") && !source.includes("/api/learn/chat"), "dialogue does not call lesson chat");

console.log("PASS dialogue response");
