#!/usr/bin/env node
/**
 * Content quality audit — all 128 lessons (LEARN_CONTENT_V2).
 * Exit 1 on any FAIL rule.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load via dynamic import of Next-aliased modules by relative path
const { clearLessonContentRegistryCache, buildLessonContentRegistry } = await import(
  pathToFileURL(path.join(root, "lib/beego/learn/lesson-content-build.js")).href
);
const { buildLessonMixFromContent } = await import(
  pathToFileURL(path.join(root, "lib/beego/learn/lesson-mix-engine.js")).href
);
const { normalizeExercise, SUPPORTED_EXERCISE_TYPES } = await import(
  pathToFileURL(path.join(root, "lib/beego/learn/normalize-lesson-exercises.js")).href
);
const { LEARNING_PARTS } = await import(
  pathToFileURL(path.join(root, "lib/beego/learning-path-catalog.js")).href
);

clearLessonContentRegistryCache();
const registry = buildLessonContentRegistry();

const NORMAL_TYPES = new Set([
  "vocabulary",
  "sentence_patterns",
  "grammar",
  "listening",
  "speaking",
  "story",
  "test",
]);

const report = {
  lessonsAudited: 0,
  with10: 0,
  reviewSkippedMin: 0,
  failures: [],
  warnings: [],
  byLesson: {},
  duplicatesFixedHint: [],
  topicBleed: [],
};

function fail(lessonId, msg) {
  report.failures.push({ lessonId, msg });
  const row = report.byLesson[lessonId] || (report.byLesson[lessonId] = { ok: true, issues: [] });
  row.ok = false;
  row.issues.push(msg);
}

function warn(lessonId, msg) {
  report.warnings.push({ lessonId, msg });
}

const GREETING_BLEED = /\b(hello|goodbye|alphabet|good morning)\b/i;
const topicByPart = Object.fromEntries(
  LEARNING_PARTS.map((p) => [p.partNumber, p.gates[0]?.topicTitle || ""])
);

const allIds = Object.keys(registry).sort();
if (allIds.length !== 128) {
  report.failures.push({ lessonId: "*", msg: `Expected 128 lessons, got ${allIds.length}` });
}

const globalPromptCounts = new Map();

for (const lessonId of allIds) {
  report.lessonsAudited += 1;
  const lesson = registry[lessonId];
  const qs = (lesson.questions || []).map(normalizeExercise);
  const partNum = Number(String(lessonId).match(/^p(\d+)/)?.[1] || 0);
  const topic = lesson.topicTitle || topicByPart[partNum] || "";

  report.byLesson[lessonId] = {
    ok: true,
    issues: [],
    type: lesson.type,
    topic,
    count: qs.length,
  };

  if (NORMAL_TYPES.has(lesson.type)) {
    if (qs.length < 10) {
      fail(lessonId, `normal lesson has ${qs.length} exercises (<10)`);
    } else {
      report.with10 += 1;
    }
  } else {
    report.reviewSkippedMin += 1;
  }

  const idSet = new Set();
  const promptSet = new Set();
  for (const q of qs) {
    if (!q.id) fail(lessonId, "missing question id");
    if (idSet.has(q.id)) fail(lessonId, `duplicate questionId ${q.id}`);
    idSet.add(q.id);

    if (!SUPPORTED_EXERCISE_TYPES.has(q.type) && q.type !== "unknown") {
      // after normalize should be supported
      warn(lessonId, `unusual type ${q.type} on ${q.id}`);
    }

    const contentKey = [
      q.type,
      String(q.prompt || "").trim().toLowerCase(),
      String(q.speakTarget || q.extensions?.speakTarget || ""),
      String(q.extensions?.ttsText || q.ttsText || ""),
      String(q.correctAnswer || ""),
      JSON.stringify((q.options || []).map((o) => o.text)),
    ].join("|");
    if (promptSet.has(contentKey)) fail(lessonId, `duplicate exercise content: ${q.id}`);
    promptSet.add(contentKey);
    const promptKey = `${q.type}|${String(q.prompt || "").trim().toLowerCase()}`;
    globalPromptCounts.set(promptKey, (globalPromptCounts.get(promptKey) || 0) + 1);

    if (Array.isArray(q.options) && q.options.length) {
      const ids = q.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) fail(lessonId, `duplicate option ids in ${q.id}`);
      if (q.correctAnswer != null && !["speaking", "pronunciation", "word_order"].includes(q.type)) {
        if (!ids.includes(q.correctAnswer)) {
          fail(lessonId, `correctAnswer not in choices: ${q.id}`);
        }
      }
    }

    if (q.type === "listening_choice" || q.type === "listening_fill") {
      const target = String(q.extensions?.gradingTarget || q.extensions?.ttsText || q.ttsText || "").trim();
      if (!target) fail(lessonId, `listening missing tts/gradingTarget: ${q.id}`);
      if (q.type === "listening_choice") {
        const opt = q.options?.find((o) => o.id === q.correctAnswer);
        if (!opt) fail(lessonId, `listening missing correct option: ${q.id}`);
        else if (String(opt.text).trim() !== target) {
          fail(
            lessonId,
            `listening audio≠correct option: ${q.id} audio="${target}" opt="${opt.text}"`
          );
        }
      }
      if (q.type === "listening_fill") {
        const gap = q.options?.find((o) => o.id === q.correctAnswer)?.text;
        if (gap && !target.toLowerCase().includes(String(gap).toLowerCase())) {
          fail(lessonId, `listening fill gap not in audio: ${q.id}`);
        }
      }
    }

    if (q.type === "speaking" || q.type === "pronunciation") {
      const target = String(q.speakTarget || q.extensions?.speakTarget || "").trim();
      if (!target) fail(lessonId, `speaking missing speakTarget: ${q.id}`);
    }

    // Topic bleed: later parts should not be dominated by greetings content
    if (partNum >= 3 && lesson.type !== "review") {
      const blob = `${q.prompt} ${q.speakTarget || ""} ${q.extensions?.ttsText || ""}`;
      if (GREETING_BLEED.test(blob) && /chào hỏi|alphabet|xin chào/i.test(blob)) {
        report.topicBleed.push({ lessonId, qid: q.id, topic });
        fail(lessonId, `topic bleed (greetings) in ${q.id} for topic ${topic}`);
      }
    }
  }

  // Title must mention topic for normal lessons
  if (NORMAL_TYPES.has(lesson.type) && topic && !String(lesson.title).includes(topic.split("&")[0].trim().slice(0, 6))) {
    // soft: title should reference topic
    if (!String(lesson.title).includes(topic) && !String(lesson.objective || "").includes(topic)) {
      warn(lessonId, `title/objective may not include topic ${topic}`);
    }
  }

  // Adaptive mix should still produce up to 10 unique activities
  if (NORMAL_TYPES.has(lesson.type)) {
    const mix = buildLessonMixFromContent(lesson, {});
    const mixCount = mix.questions?.length || 0;
    report.byLesson[lessonId].mixCount = mixCount;
    if (mixCount < 10) {
      fail(lessonId, `adaptive mix produced ${mixCount} (<10) from bank ${qs.length}`);
    }
    const mixSources = mix.questions.map((q) => q.activityMeta?.sourceQuestionId);
    if (new Set(mixSources).size !== mixSources.length) {
      fail(lessonId, "mix has duplicate sourceQuestionId");
    }
  }
}

// Cross-lesson identical prompts exceeding threshold (same exact prompt+type in >4 lessons)
for (const [key, count] of globalPromptCounts) {
  if (count > 4 && !key.includes("[review")) {
    report.warnings.push({
      lessonId: "*",
      msg: `prompt reused across ${count} lessons: ${key.slice(0, 80)}`,
    });
  }
}

const pass = report.failures.length === 0 && report.lessonsAudited === 128;

console.log("LESSONS_AUDITED=" + report.lessonsAudited);
console.log("LESSONS_WITH_10_EXERCISES=" + report.with10);
console.log("REVIEW_NODES=" + report.reviewSkippedMin);
console.log("FAILURES=" + report.failures.length);
console.log("WARNINGS=" + report.warnings.length);
if (report.failures.length) {
  console.log("FAILURE_SAMPLE=" + JSON.stringify(report.failures.slice(0, 25), null, 2));
}
console.log("CONTENT_AUDIT=" + (pass ? "PASS" : "FAIL"));
process.exit(pass ? 0 : 1);
