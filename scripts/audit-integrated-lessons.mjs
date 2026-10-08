#!/usr/bin/env node
/**
 * Validator for the 112 ordinary integrated lessons.
 * Boss Test and SRS are reported separately and are not required to have 12 activities.
 * node --import ./scripts/register-alias.mjs scripts/audit-integrated-lessons.mjs
 */
import { buildLessonContentRegistry, clearLessonContentRegistryCache } from "../lib/beego/learn/lesson-content-build.js";
import { buildLessonMixFromContent } from "../lib/beego/learn/lesson-mix-engine.js";
import { resumeStartIndex } from "../lib/beego/learn/lesson-resume.js";
import { getTopicBank } from "../lib/beego/learn/lesson-topic-banks.js";
import storyWordPictogram from "../lib/kids-vocabulary/story-word-pictogram.generated.js";

clearLessonContentRegistryCache();
const registry = buildLessonContentRegistry();
const ids = Object.keys(registry).sort();
const ordinary = ids.filter((id) => !id.endsWith("-n15") && !id.endsWith("-n16"));
const tests = ids.filter((id) => id.endsWith("-n15"));
const reviews = ids.filter((id) => id.endsWith("-n16"));
const failures = [];
const fail = (id, msg) => failures.push(`${id}: ${msg}`);

const EXPECTED = [1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12];

function sourceId(question) {
  return String(question.activityMeta?.sourceQuestionId || question.id || "");
}

for (const lessonId of ordinary) {
  const lesson = registry[lessonId];
  const questions = lesson.questions || [];
  const activities = questions.map((question) => question.extensions?.activity);
  if (activities.join(",") !== EXPECTED.join(",")) {
    fail(lessonId, `order ${activities.join(",") || "empty"} gaps=${JSON.stringify(lesson.contentGaps || [])}`);
  }
  const translations = questions.filter((question) => question.type === "translation");
  const directions = translations.map((question) => question.extensions?.translationDirection);
  if (directions.join(",") !== "vi-to-en,en-to-vi") fail(lessonId, `translation ${directions.join(",")}`);
  for (const question of translations) {
    if (!Array.isArray(question.acceptedAnswers) || !question.acceptedAnswers.length) {
      fail(lessonId, "translation missing acceptedAnswers");
    }
  }
  const story = questions.find((question) => question.type === "story_comprehension");
  if (!story?.storyText || !story.prompt || (story.options || []).length !== 4) {
    fail(lessonId, "story missing text or four answers");
  } else if (story.options.filter((option) => option.id === story.correctAnswer).length !== 1) {
    fail(lessonId, "story correct answer is not unique");
  }
  const picture = questions.find((question) => question.extensions?.activity === 1);
  if (!picture || picture.extensions?.choicePresentation !== "picture") fail(lessonId, "activity 1 is not picture listening");
  const urls = (picture?.options || []).map((option) => option.imageUrl || "");
  if (urls.length !== 4 || urls.some((url) => !url || url.includes("placeholder"))) {
    fail(lessonId, "picture asset missing or placeholder");
  }
  if (new Set(urls).size !== urls.length) fail(lessonId, "picture urls repeat");
  for (const question of questions.filter((item) => item.type === "matching_pairs")) {
    const ids = (question.pairs || []).map((pair) => pair.pairId);
    if (ids.length < 4 || new Set(ids).size !== ids.length) fail(lessonId, "matching pair ids are not unique");
    if ((question.pairs || []).some((pair) => !pair.en || !pair.vi)) fail(lessonId, "matching pair is empty");
  }
  for (const question of questions.filter((item) => item.type === "word_order")) {
    const answer = question.correctAnswer || [];
    const bank = question.wordBank || [];
    for (const word of answer) {
      const need = answer.filter((item) => String(item).toLowerCase() === String(word).toLowerCase()).length;
      const have = bank.filter((item) => String(item).toLowerCase() === String(word).toLowerCase()).length;
      if (have < need) fail(lessonId, `word bank missing repeated ${word}`);
    }
  }
  const blob = JSON.stringify(questions);
  if (blob.includes("Lựa chọn") || blob.includes("placeholder") || blob.includes("___WAIT")) {
    fail(lessonId, "placeholder content");
  }
  const mix = buildLessonMixFromContent(lesson, {});
  if ((mix.questions || []).map((question) => question.extensions?.activity).join(",") !== EXPECTED.join(",")) {
    fail(lessonId, "mix changed the activity order");
  }
  const answered = (mix.questions || []).slice(0, 3).map(sourceId);
  if (resumeStartIndex(mix.questions, answered) !== 3) fail(lessonId, "resume index is wrong");
  if (resumeStartIndex(mix.questions, (mix.questions || []).map(sourceId)) !== mix.questions.length) {
    fail(lessonId, "finished resume should pass the last question");
  }
}

const storyByPart = new Map();
const clozeByPart = new Map();
const talkByPart = new Map();
for (const lessonId of ordinary) {
  const part = lessonId.slice(0, 2);
  const partNumber = Number(part.slice(1));
  const questions = registry[lessonId].questions;
  const story = questions.find((question) => question.type === "story_comprehension")?.storyText;
  const list = storyByPart.get(part) || [];
  if (list.includes(story)) fail(lessonId, "story text repeats inside the part");
  list.push(story);
  storyByPart.set(part, list);

  const cloze = questions.find((question) => question.type === "context_cloze");
  const clozeKey = cloze?.extensions?.blankId || "";
  const clozeDone = cloze?.extensions?.completedSentence || "";
  const clozeList = clozeByPart.get(part) || [];
  if (!clozeKey || clozeList.some((item) => item.key === clozeKey || item.done === clozeDone)) {
    fail(lessonId, "context cloze repeats inside the part");
  }
  clozeList.push({ key: clozeKey, done: clozeDone });
  clozeByPart.set(part, clozeList);
  const copied = [story, ...questions.map((question) => question.prompt || ""), ...questions.map((question) => question.sentenceTemplate || "")]
    .filter(Boolean);
  if (copied.includes(clozeDone)) fail(lessonId, "context cloze copies another activity sentence");

  const talk = questions.find((question) => question.type === "dialogue_response");
  const talkKey = talk?.extensions?.blankId || "";
  const reply = talk?.extensions?.reply || "";
  const talkList = talkByPart.get(part) || [];
  if (!talkKey || talkList.some((item) => item.key === talkKey || item.reply === reply)) {
    fail(lessonId, "dialogue repeats inside the part");
  }
  talkList.push({ key: talkKey, reply });
  talkByPart.set(part, talkList);
  if ((talk?.options || []).length !== 4) fail(lessonId, "dialogue does not have four replies");

  const vocab = new Map((getTopicBank(partNumber).vocab || []).map((item) => [String(item.en).toLowerCase(), item.vi]));
  const picture = questions.find((question) => question.extensions?.activity === 1);
  for (const option of picture?.options || []) {
    const word = String(option.text || "").toLowerCase();
    const meaning = vocab.get(word);
    if (!meaning || meaning !== option.meaningVi) fail(lessonId, `picture ${option.text} is off the part topic`);
    const exact = storyWordPictogram[word];
    const stem = exact ? word : Object.keys(storyWordPictogram).find((key) => word === `${key}s` || word === `${key}es`);
    if (!exact && !stem) fail(lessonId, `picture ${option.text} does not match its pictogram word`);
    if (["team", "voice"].includes(word)) fail(lessonId, `picture ${option.text} uses an off-topic drawing`);
  }
}

let testOk = 0;
for (const lessonId of tests) {
  const lesson = registry[lessonId];
  if (lesson.type === "test" && !lesson.questions.some((question) => question.extensions?.integratedLesson) && lesson.questions.length >= 10) {
    testOk += 1;
  } else fail(lessonId, "boss test was converted");
}
let reviewOk = 0;
for (const lessonId of reviews) {
  const lesson = registry[lessonId];
  if (lesson.type === "review" && !lesson.questions.some((question) => question.extensions?.integratedLesson) && lesson.questions.length >= 1) {
    reviewOk += 1;
  } else fail(lessonId, "SRS review was converted");
}

const full = ordinary.length - new Set(failures.map((line) => line.split(":")[0])).size;
console.log("ORDINARY_LESSONS=" + ordinary.length);
console.log("ORDINARY_WITH_12=" + (failures.length ? ordinary.length - new Set(failures.filter((line) => ordinary.some((id) => line.startsWith(id))).map((line) => line.split(":")[0])).size : ordinary.length));
console.log("BOSS_TEST=" + testOk + "/" + tests.length);
console.log("SRS_REVIEW=" + reviewOk + "/" + reviews.length);
if (failures.length) console.log("FAILURE_SAMPLE=" + JSON.stringify(failures.slice(0, 30), null, 2));
console.log("INTEGRATED_AUDIT=" + (failures.length === 0 && ordinary.length === 112 && testOk === 8 && reviewOk === 8 ? "PASS" : "FAIL"));
process.exit(failures.length === 0 && ordinary.length === 112 ? 0 : 1);
