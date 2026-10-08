#!/usr/bin/env node
/**
 * LEARN CONTENT V3 audit — 128 lessons.
 * FAIL on: <10 exercises, choice!=4, hint leak, duplicates, listening misalign, near-duplicate lessons.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { clearLessonContentRegistryCache, buildLessonContentRegistry } = await import(
  new URL("../lib/beego/learn/lesson-content-build.js", import.meta.url).href
);
const { buildLessonMixFromContent } = await import(
  new URL("../lib/beego/learn/lesson-mix-engine.js", import.meta.url).href
);
const { normalizeExercise } = await import(
  new URL("../lib/beego/learn/normalize-lesson-exercises.js", import.meta.url).href
);
const { buildLearningPathFromCatalog, flattenPathNodes } = await import(
  new URL("../lib/beego/learning-path-build.js", import.meta.url).href
);

clearLessonContentRegistryCache();
const registry = buildLessonContentRegistry();
const pathNodes = flattenPathNodes(buildLearningPathFromCatalog({}).sections);

const NORMAL = new Set([
  "vocabulary",
  "sentence_patterns",
  "grammar",
  "listening",
  "speaking",
  "story",
  "test",
]);
const CHOICE_TYPES = new Set([
  "multiple_choice",
  "vocabulary_choice",
  "fill_blank",
  "listening_choice",
  "listening_fill",
  "story_comprehension",
]);

const failures = [];
const fail = (id, msg) => failures.push({ lessonId: id, msg });

let with10 = 0;
let choiceChecked = 0;
let choiceOk = 0;
let hintLeaks = 0;
let audited = 0;

const allIds = Object.keys(registry).sort();
if (allIds.length !== 128) fail("*", `expected 128 lessons got ${allIds.length}`);

for (const lessonId of allIds) {
  audited += 1;
  const lesson = registry[lessonId];
  const qs = (lesson.questions || []).map(normalizeExercise);

    if (NORMAL.has(lesson.type)) {
    if (qs.length < 10) fail(lessonId, `normal has ${qs.length} < 10`);
    else with10 += 1;

    const types = new Set(qs.map((q) => q.type));
    if (lesson.type === "vocabulary" && types.size < 3) {
      fail(lessonId, `vocabulary lesson not diverse enough types=${[...types]}`);
    }

    const mix = buildLessonMixFromContent(lesson, {});
    if (lesson.type === "test") {
      if ((mix.questions || []).length < 10) {
        fail(lessonId, `mix length ${(mix.questions || []).length} < 10`);
      }
    } else if ((mix.questions || []).length !== qs.length) {
      fail(lessonId, `integrated mix dropped questions ${mix.questions?.length} != ${qs.length}`);
    }
    if (lesson.type !== "test") {
      const activities = qs.map((question) => question.extensions?.activity);
      const expected = [1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12];
      const gaps = new Set((lesson.contentGaps || []).map((gap) => gap.activity));
      const wanted = expected.filter((activity) => !gaps.has(activity));
      if (activities.join(",") !== wanted.join(",")) {
        fail(lessonId, `activity order ${activities.join(",")} != ${wanted.join(",")}`);
      }
      if (gaps.has(1) && qs.some((question) => question.extensions?.choicePresentation === "picture")) {
        fail(lessonId, "picture gap still contains a picture question");
      }
      if (!gaps.has(1)) {
        const picture = qs.find((question) => question.extensions?.activity === 1);
        if (picture?.extensions?.choicePresentation !== "picture") {
          fail(lessonId, "activity 1 is not picture listening");
        }
        if ((picture?.options || []).some((option) => !option.imageUrl)) {
          fail(lessonId, "picture listening has an option without an image");
        }
      }
    }
  }

  const idSet = new Set();
  const contentSet = new Set();
  for (const q of qs) {
    if (!q.id) fail(lessonId, "missing id");
    if (idSet.has(q.id)) fail(lessonId, `dup id ${q.id}`);
    idSet.add(q.id);

    const ckey = [
      q.type,
      q.prompt,
      q.speakTarget,
      q.extensions?.ttsText,
      JSON.stringify((q.options || []).map((o) => o.text)),
    ].join("|");
    if (contentSet.has(ckey)) fail(lessonId, `dup content ${q.id}`);
    contentSet.add(ckey);

    if (CHOICE_TYPES.has(q.type)) {
      choiceChecked += 1;
      const opts = q.options || [];
      if (opts.length !== 4) {
        fail(lessonId, `${q.id} has ${opts.length} options (need 4)`);
      } else {
        choiceOk += 1;
      }
      const texts = opts.map((o) => String(o.text || "").trim().toLowerCase());
      if (new Set(texts).size !== texts.length) fail(lessonId, `${q.id} duplicate option text`);
      const correctOpts = opts.filter((o) => o.id === q.correctAnswer);
      if (correctOpts.length !== 1) fail(lessonId, `${q.id} correctAnswer mismatch`);

      // Hint leak: some options have imageEmoji, others don't — or only correct has "real" emoji vs ❔
      const withEmoji = opts.filter((o) => o.imageEmoji);
      if (withEmoji.length > 0 && withEmoji.length !== opts.length) {
        hintLeaks += 1;
        fail(lessonId, `${q.id} answer hint leak (partial emoji)`);
      }
      const marks = opts.map((o) => o.imageEmoji || "");
      if (marks.some((m) => m === "❔" || m === "?") && marks.some((m) => m && m !== "❔" && m !== "?")) {
        hintLeaks += 1;
        fail(lessonId, `${q.id} answer hint leak (❓ vs real emoji)`);
      }

      if (q.type === "listening_choice" || q.type === "listening_fill") {
        const target = String(q.extensions?.gradingTarget || q.extensions?.ttsText || q.ttsText || "").trim();
        if (!target) fail(lessonId, `${q.id} missing listening target`);
        const correct = opts.find((o) => o.id === q.correctAnswer);
        if (q.type === "listening_choice" && correct && String(correct.text).trim() !== target) {
          fail(lessonId, `${q.id} listening audio≠correct option`);
        }
        if (q.type === "listening_fill" && correct && !target.toLowerCase().includes(String(correct.text).toLowerCase())) {
          fail(lessonId, `${q.id} listening fill gap not in audio`);
        }
      }
    }
  }
}

// Path node title diversity for listening slots in same gate
const listenTitles = pathNodes.filter((n) => n.nodeType === "listening").map((n) => n.title);
const listenUnique = new Set(listenTitles);
if (listenUnique.size < listenTitles.length * 0.5) {
  fail("*", `listening path titles too repetitive unique=${listenUnique.size}/${listenTitles.length}`);
}
// Within p1 gate, listening titles should not all equal topic-only pattern
const p1Listen = pathNodes.filter((n) => n.lessonId?.startsWith("p1-g1-n") && n.nodeType === "listening");
const p1ListenTitles = new Set(p1Listen.map((n) => n.title));
if (p1Listen.length >= 4 && p1ListenTitles.size < 4) {
  fail("*", `p1 listening titles not diversified: ${[...p1ListenTitles].join(" | ")}`);
}

const choicePct = choiceChecked ? (100 * choiceOk) / choiceChecked : 0;
const pass =
  failures.length === 0 &&
  audited === 128 &&
  with10 === 120 &&
  choicePct === 100 &&
  hintLeaks === 0;

console.log("LESSONS_AUDITED=" + audited);
console.log("NORMAL_LESSONS_WITH_10_EXERCISES=" + with10 + "/120");
console.log("CHOICE_WITH_4_OPTIONS=" + choicePct.toFixed(0) + "% (" + choiceOk + "/" + choiceChecked + ")");
console.log("ANSWER_HINT_LEAK=" + hintLeaks);
console.log("CONTENT_DIVERSITY=" + (p1ListenTitles.size >= 4 ? "PASS" : "FAIL"));
if (failures.length) console.log("FAILURE_SAMPLE=" + JSON.stringify(failures.slice(0, 20), null, 2));
console.log("CONTENT_AUDIT_V3=" + (pass ? "PASS" : "FAIL"));
process.exit(pass ? 0 : 1);
