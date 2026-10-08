#!/usr/bin/env node
/**
 * Adaptive support on one lesson, retry quota, and XP/Honey isolation.
 * node --import ./scripts/register-alias.mjs scripts/test-learn-lesson-difficulty.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    const key = t.slice(0, eq).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const userId = Number(process.env.LEARN_CHAT_TEST_USER_ID || 4);
const lessonId = `test-diff-${Date.now()}`;

async function main() {
  const { decideLearnAdaptation, resolveLearnLessonDifficulty } = await import(
    "../lib/beego/learn/learn-lesson-difficulty.js"
  );
  const { getLearnLessonTutorSystemPrompt } = await import(
    "../lib/ai/prompts/learn-lesson-tutor.js"
  );

  const lesson = {
    lessonId: "p1-g1-n08",
    level: "A0",
    title: "Hello",
    objective: "Greet a friend",
    vocabularyWords: ["hello", "friend"],
  };
  const start = resolveLearnLessonDifficulty(lesson);
  assert(start.supportLevel === "medium" && start.languageComplexity === "lesson", "mid lesson starts at medium support");
  assert(start.level === "A0", "catalog level is not raised");

  const needsHelp = decideLearnAdaptation({
    ...lesson,
    message: "không hiểu, giải thích giúp",
    sessionId: "s-help",
    start,
  });
  const independent = decideLearnAdaptation({
    ...lesson,
    message: "I say hello to my friend",
    sessionId: "s-3",
    start,
    state: {
      supportLevel: "medium",
      languageComplexity: "lesson",
      sessions: [
        { sessionId: "s-1", independent: true, goalMet: true },
        { sessionId: "s-2", independent: true, goalMet: true },
      ],
    },
  });
  assert(needsHelp.supportLevel === "high" && needsHelp.languageComplexity === "simplified", "help increases support and simplifies");
  assert(needsHelp.communicativeGoal === lesson.objective, "goal stays when simplifying");
  assert(independent.supportLevel === "low" && independent.languageComplexity === "stretch", "evidence lowers support");
  assert(needsHelp.reason !== independent.reason, "reasons differ");
  assert(!/shorter English|2–4|therefore|because/.test(needsHelp.reason + independent.reason), "length is not the rule");

  const helpPrompt = getLearnLessonTutorSystemPrompt({ ...lesson, adaptation: needsHelp });
  const ownPrompt = getLearnLessonTutorSystemPrompt({ ...lesson, adaptation: independent });
  assert(helpPrompt.includes("support: high") && helpPrompt.includes(needsHelp.reason), "help prompt");
  assert(ownPrompt.includes("support: low") && ownPrompt.includes(independent.reason), "independent prompt");
  assert(helpPrompt !== ownPrompt, "same lesson, different tutor instructions");
  assert(!helpPrompt.includes("Later lessons must not fall back"), "shorter sentence is allowed");
  assert(helpPrompt.includes("Do not raise CEFR") && ownPrompt.includes("catalog level stays A0"), "CEFR stays");
  console.log("PASS same lesson adapts for help vs independent answers");

  const turnSrc = fs.readFileSync(path.join(root, "app/api/learn/chat/turn/route.js"), "utf8");
  const sessionSrc = fs.readFileSync(path.join(root, "app/api/learn/chat/session/route.js"), "utf8");
  assert(!/xp_total|honey_total|completeLesson/.test(turnSrc + sessionSrc), "chat routes do not award XP");
  console.log("PASS chat routes do not reference XP/Honey");

  const adapt = await import("../lib/beego/learn/learn-lesson-adaptation-store.js");
  const store = await import("../lib/beego/learn/learn-lesson-chat-store.js");
  const quota = await import("../lib/beego/learn/learn-lesson-chat-quota.js");
  const pool = (await import("../lib/db.js")).default;

  const [before] = await pool.query(
    `SELECT xp_total, honey_total FROM user_stats WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const xp0 = Number(before[0]?.xp_total || 0);
  const honey0 = Number(before[0]?.honey_total || 0);
  const beforeQuota = await quota.assertLearnLessonChatQuota(userId);

  const session = await store.getOrCreateLearnLessonChatSession({
    userId,
    lessonId,
    lessonSnapshot: { lessonId, level: "A0", objective: "test", vocabularyWords: ["hello"] },
  });
  const reqId = crypto.randomUUID();
  const reserved = await quota.tryReserveLearnLessonChatQuota(userId);
  assert(reserved.ok, "reserve");
  const claim = await store.claimPendingTurn({
    sessionId: session.id,
    userId,
    lessonId,
    clientRequestId: reqId,
    source: "text",
    userMessage: "Hello",
    intent: "practice",
  });
  assert(claim.kind === "claimed", "first claim");
  await store.completePendingTurn(claim.turnId, { reply: "Hi! What is your name?" });

  const replay = await store.claimPendingTurn({
    sessionId: session.id,
    userId,
    lessonId,
    clientRequestId: reqId,
    source: "text",
    userMessage: "Hello",
    intent: "practice",
  });
  assert(replay.kind === "completed", "retry is completed replay");
  const afterQuota = await quota.assertLearnLessonChatQuota(userId);
  assert(
    afterQuota.usageToday === beforeQuota.usageToday + 1,
    `quota incremented once, before ${beforeQuota.usageToday} after ${afterQuota.usageToday}`
  );
  const turns = await store.listSessionTurns(session.id, 20);
  assert(turns.length === 1, `one turn, got ${turns.length}`);

  const [after] = await pool.query(
    `SELECT xp_total, honey_total FROM user_stats WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  assert(Number(after[0]?.xp_total || 0) === xp0, "XP unchanged");
  assert(Number(after[0]?.honey_total || 0) === honey0, "Honey unchanged");

  await adapt.ensureLearnLessonAdaptationTable();
  await pool.query(`DELETE FROM learn_lesson_chat_adaptation WHERE user_id = ? AND lesson_id = ?`, [
    userId,
    lesson.lessonId,
  ]);
  const helped = await adapt.planLearnLessonAdaptation({
    userId,
    lessonId: lesson.lessonId,
    level: "A0",
    objective: lesson.objective,
    vocabularyWords: lesson.vocabularyWords,
    message: "không hiểu, giải thích giúp",
    sessionId: "db-help",
    clientRequestId: "adapt-help-1",
  });
  await adapt.commitLearnLessonAdaptation({ userId, lessonId: lesson.lessonId, decision: helped });
  const again = await adapt.planLearnLessonAdaptation({
    userId,
    lessonId: lesson.lessonId,
    level: "A0",
    objective: lesson.objective,
    vocabularyWords: lesson.vocabularyWords,
    message: "không hiểu, giải thích giúp",
    sessionId: "db-help",
    clientRequestId: "adapt-help-1",
  });
  assert(again.duplicate === true, "same request does not count twice");
  const [savedHelp] = await pool.query(
    `SELECT support_level, language_complexity, evidence_json FROM learn_lesson_chat_adaptation WHERE user_id = ? AND lesson_id = ?`,
    [userId, lesson.lessonId]
  );
  assert(savedHelp[0].support_level === "high" && savedHelp[0].language_complexity === "simplified", "help evidence stored");

  await pool.query(`DELETE FROM learn_lesson_chat_adaptation WHERE user_id = ? AND lesson_id = ?`, [
    userId,
    lesson.lessonId,
  ]);
  for (const sessionId of ["db-1", "db-2", "db-3"]) {
    const planned = await adapt.planLearnLessonAdaptation({
      userId,
      lessonId: lesson.lessonId,
      level: "A0",
      objective: lesson.objective,
      vocabularyWords: lesson.vocabularyWords,
      message: "I say hello to my friend",
      sessionId,
      clientRequestId: `adapt-${sessionId}`,
    });
    await adapt.commitLearnLessonAdaptation({ userId, lessonId: lesson.lessonId, decision: planned });
    if (sessionId === "db-1") {
      assert(
        planned.supportLevel === "medium" && planned.languageComplexity === "lesson",
        "one independent session does not raise the challenge"
      );
    }
    if (sessionId === "db-3") {
      assert(planned.supportLevel === "low" && planned.languageComplexity === "stretch", "third session raises challenge");
      assert(planned.catalogLevel === "A0", "stored path does not raise CEFR");
    }
  }
  const [afterAdapt] = await pool.query(
    `SELECT xp_total, honey_total FROM user_stats WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  assert(Number(afterAdapt[0]?.xp_total || 0) === xp0, "adaptation did not change XP");
  assert(Number(afterAdapt[0]?.honey_total || 0) === honey0, "adaptation did not change Honey");

  await quota.refundLearnLessonChatQuota(userId, reserved.usageDate);
  await pool.query(`DELETE FROM learn_lesson_chat_adaptation WHERE user_id = ? AND lesson_id = ?`, [
    userId,
    lesson.lessonId,
  ]);
  await pool.query(`DELETE FROM learn_lesson_chat_turns WHERE lesson_id = ?`, [lessonId]);
  await pool.query(`DELETE FROM learn_lesson_chat_sessions WHERE lesson_id = ?`, [lessonId]);
  const restored = await quota.assertLearnLessonChatQuota(userId);
  assert(restored.usageToday === beforeQuota.usageToday, "test quota refunded");
  console.log("PASS retry once and XP/Honey unchanged");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
