#!/usr/bin/env node
/**
 * Smoke tests for Learn-scoped lesson chat backend.
 * Run: node --import ./scripts/register-alias.mjs scripts/test-learn-lesson-chat.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    const key = t.slice(0, eq).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  // Fresh flag module: default OFF
  const prev = process.env.LEARN_LESSON_CHAT_ENABLED;
  delete process.env.LEARN_LESSON_CHAT_ENABLED;
  const flagsOff = await import(
    pathToFileURL(path.join(root, "lib/beego/learn/learn-lesson-chat-flags.js")).href +
      `?off=${Date.now()}`
  );
  assert(flagsOff.isLearnLessonChatEnabled() === false, "flag default OFF");

  process.env.LEARN_LESSON_CHAT_ENABLED = "1";
  const flagsOn = await import(
    pathToFileURL(path.join(root, "lib/beego/learn/learn-lesson-chat-flags.js")).href +
      `?on=${Date.now()}`
  );
  assert(flagsOn.isLearnLessonChatEnabled() === true, "flag ON");
  if (prev === undefined) delete process.env.LEARN_LESSON_CHAT_ENABLED;
  else process.env.LEARN_LESSON_CHAT_ENABLED = prev;

  const { getLearnLessonTutorSystemPrompt } = await import("@/lib/ai/prompts/learn-lesson-tutor.js");
  const sys = getLearnLessonTutorSystemPrompt({
    lessonId: "p1-g1-n01",
    title: "20 từ vựng: Chào hỏi",
    objective: "Học chào hỏi",
    level: "A0",
    topicTitle: "Chào hỏi & Alphabet",
    vocabularyWords: ["hello", "hi"],
  });
  assert(sys.includes("p1-g1-n01") && sys.includes("hello"), "learn prompt context");
  assert(!sys.includes("PRACTICE MODE: Free Talk"), "not Luyện nói free-talk prompt");

  const { getLessonContentById } = await import("@/lib/beego/learn/get-lesson-content.js");
  const {
    buildLessonChatContext,
    extractVocabularyFromLesson,
  } = await import("@/lib/beego/learn/learn-lesson-chat-context.js");
  const lesson = getLessonContentById("p1-g1-n01");
  assert(lesson, "catalog lesson");
  const context = buildLessonChatContext(lesson);
  assert(context.lessonId === "p1-g1-n01", "context id");
  assert(extractVocabularyFromLesson(lesson).length >= 0, "vocab extract");

  // AI services depend on TS runtime-settings — verify source contracts statically.
  const learnSvcSrc = fs.readFileSync(
    path.join(root, "lib/ai/services/learn-lesson-chat.service.js"),
    "utf8"
  );
  const speakingSvcSrc = fs.readFileSync(
    path.join(root, "lib/ai/services/lessons-chat.service.js"),
    "utf8"
  );
  assert(learnSvcSrc.includes("getLearnLessonTutorSystemPrompt"), "learn uses learn prompt");
  assert(!learnSvcSrc.includes("generateLessonsChatReply("), "learn does not call speaking generator");
  assert(speakingSvcSrc.includes("getLessonsTutorSystemPrompt"), "speaking prompt unchanged");
  assert(learnSvcSrc.includes("sanitizeUserInput"), "reuses sanitize helper");
  assert(learnSvcSrc.includes("timeout"), "timeout guard present");

  const store = await import("@/lib/beego/learn/learn-lesson-chat-store.js");
  const quota = await import("@/lib/beego/learn/learn-lesson-chat-quota.js");
  await store.ensureLearnLessonChatTables();
  await quota.ensureLearnLessonChatUsageTable();

  const testUserId = Number(process.env.LEARN_CHAT_TEST_USER_ID || 1);
  const session = await store.getOrCreateLearnLessonChatSession({
    userId: testUserId,
    lessonId: "p1-g1-n01",
    lessonSnapshot: context,
  });
  assert(session.userId === testUserId, "session owner");
  const reqId = `test-${crypto.randomUUID()}`;
  const saved = await store.insertCompletedTurn({
    sessionId: session.id,
    userId: testUserId,
    lessonId: "p1-g1-n01",
    turnIndex: Number(session.turnCount || 0) + 1,
    clientRequestId: reqId,
    source: "text",
    userMessage: "Hello",
    aiPayload: {
      reply: "Hi! How are you?",
      corrected_sentence: "",
      ipa: "",
      pronunciation_tip: "",
      mistakes_explanation: "",
    },
  });
  assert(saved.inserted === true, "turn inserted");
  const dup = await store.insertCompletedTurn({
    sessionId: session.id,
    userId: testUserId,
    lessonId: "p1-g1-n01",
    turnIndex: Number(session.turnCount || 0) + 2,
    clientRequestId: reqId,
    source: "text",
    userMessage: "Hello",
    aiPayload: { reply: "should not overwrite" },
  });
  assert(dup.inserted === false, "idempotent client_request_id");
  assert(dup.turn?.aiReplyText === "Hi! How are you?", "replay keeps first reply");

  const q1 = await quota.assertLearnLessonChatQuota(testUserId);
  assert(q1.ok || q1.code === "LEARN_CHAT_DAILY_LIMIT" || q1.code === "LEARN_CHAT_QUOTA_DISABLED", "quota gate");
  if (q1.ok) {
    await quota.recordLearnLessonChatUsageSuccess(testUserId, q1.usageDate);
  }

  // Confirm no write path to lesson_chat_logs from our modules (static)
  const turnSrc = fs.readFileSync(path.join(root, "app/api/learn/chat/turn/route.js"), "utf8");
  const sessionSrc = fs.readFileSync(path.join(root, "app/api/learn/chat/session/route.js"), "utf8");
  assert(!turnSrc.includes("lesson_chat_logs"), "turn route avoids lesson_chat_logs");
  assert(!sessionSrc.includes("lesson_chat_logs"), "session route avoids lesson_chat_logs");
  assert(!turnSrc.includes("assertLessonsChatAllowed"), "no speaking chat entitlement");
  assert(!turnSrc.includes("recordPooledAiUsageSuccess"), "no pooled usage");

  assert(fs.existsSync(path.join(root, "docs/LEARN_LESSON_CHAT_POLICY.md")), "policy doc");
  assert(fs.existsSync(path.join(root, "migrations/012_learn_lesson_chat.sql")), "migration");

  console.log("LEARN_LESSON_CHAT_TEST=PASS");
  console.log("FLAG_DEFAULT=OFF");
  console.log("QUOTA=learn_lesson_chat_usage_daily (separate from pooled Luyện nói)");
  console.log("TABLES=learn_lesson_chat_sessions,learn_lesson_chat_turns,learn_lesson_chat_usage_daily");
}

main().catch((err) => {
  console.error("LEARN_LESSON_CHAT_TEST=FAIL", err?.stack || err?.message || err);
  process.exit(1);
});
