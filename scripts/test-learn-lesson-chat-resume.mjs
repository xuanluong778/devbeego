#!/usr/bin/env node
/**
 * Resume + wrap_up lock + panel gates. Does not call OpenAI.
 * node --import ./scripts/register-alias.mjs scripts/test-learn-lesson-chat-resume.mjs
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

const lessonId = `test-resume-${Date.now()}`;
const userId = Number(process.env.LEARN_CHAT_TEST_USER_ID || 1);

async function main() {
  const { assistToggleLabel, assistToggleBody, createPanelActivityGate } = await import(
    "../lib/beego/learn/lesson-ai-panel-guards.js"
  );
  assert(assistToggleLabel({ vi: "Giải thích ngắn" }, false) === "Giải thích", "explanation label");
  assert(assistToggleLabel({ translation: "xin lỗi" }, false) === "Dịch", "translation label");
  assert(assistToggleLabel({ vi: "x", translation: "sorry" }, true) === "Ẩn dịch", "translation wins");
  assert(assistToggleBody({ vi: "chỉ giải thích" }).kind === "explanation", "body explanation");
  assert(assistToggleLabel({}, false) === "", "empty assist");

  const gate = createPanelActivityGate();
  const token = gate.beginSpeak();
  assert(token > 0 && gate.canFinishSpeak(token), "speak token live");
  gate.close();
  assert(!gate.canApplyTranscript(), "closed drops transcript");
  assert(gate.beginSpeak() === 0, "no speak after close");
  assert(!gate.canFinishSpeak(token), "in-flight speak cancelled");

  delete process.env.LEARN_LESSON_CHAT_ENABLED;
  const flags = await import("../lib/beego/learn/learn-lesson-chat-flags.js");
  assert(flags.isLearnLessonChatEnabled() === false, "flag default off");
  process.env.LEARN_LESSON_CHAT_ENABLED = "1";
  assert(flags.isLearnLessonChatEnabled() === true, "flag on");
  delete process.env.LEARN_LESSON_CHAT_ENABLED;
  assert(flags.isLearnLessonChatEnabled() === false, "flag off again");

  const store = await import("../lib/beego/learn/learn-lesson-chat-store.js");
  const pool = (await import("../lib/db.js")).default;

  const created = await store.getOrCreateLearnLessonChatSession({
    userId,
    lessonId,
    lessonSnapshot: { lessonId, title: "Resume test", objective: "say hello", level: "A1", vocabularyWords: ["hello"] },
  });
  assert(created.status === "active", "new session active");

  const again = await store.getOrCreateLearnLessonChatSession({
    userId,
    lessonId,
    lessonSnapshot: { lessonId },
  });
  assert(again.sessionKey === created.sessionKey, "resume same active session");

  const practice = await store.claimPendingTurn({
    sessionId: created.id,
    userId,
    lessonId,
    clientRequestId: crypto.randomUUID(),
    source: "text",
    userMessage: "Hello",
    intent: "practice",
  });
  assert(practice.kind === "claimed", "practice claimed");
  await store.completePendingTurn(practice.turnId, {
    reply: "Hi! What is your name?",
    mistakes_explanation: "Chào và hỏi tên.",
  });

  const wrapA = crypto.randomUUID();
  const wrapB = crypto.randomUUID();
  const [first, second] = await Promise.all([
    store.claimPendingTurn({
      sessionId: created.id,
      userId,
      lessonId,
      clientRequestId: wrapA,
      source: "text",
      userMessage: "feedback please",
      intent: "wrap_up",
    }),
    store.claimPendingTurn({
      sessionId: created.id,
      userId,
      lessonId,
      clientRequestId: wrapB,
      source: "text",
      userMessage: "feedback please",
      intent: "wrap_up",
    }),
  ]);
  const kinds = [first.kind, second.kind].sort();
  assert(kinds[0] === "claimed" && kinds[1] === "pending", `one wrap claim, got ${kinds.join(",")}`);
  const claimed = first.kind === "claimed" ? first : second;
  const saved = await store.completePendingTurn(claimed.turnId, {
    reply: "You said hello clearly. Nice work.",
    mistakes_explanation: "Bạn chào rõ.",
  });
  assert(saved.ok, "wrap saved");
  await store.closeLearnLessonChatSession(created.id);

  const third = await store.claimPendingTurn({
    sessionId: created.id,
    userId,
    lessonId,
    clientRequestId: crypto.randomUUID(),
    source: "text",
    userMessage: "again",
    intent: "wrap_up",
  });
  assert(third.kind === "session_closed", "closed session rejects another wrap");

  const latest = await store.findLatestLearnLessonChatSession({ userId, lessonId });
  assert(latest.status === "closed" && latest.sessionKey === created.sessionKey, "latest is closed original");
  const turns = await store.listSessionTurns(latest.id, 20);
  const wrap = turns.find((t) => t.source === "wrap_up" && t.status === "completed");
  assert(wrap && wrap.aiReplyText.includes("hello clearly"), "wrap feedback readable");

  const resumed = await store.getOrCreateLearnLessonChatSession({
    userId,
    lessonId,
    lessonSnapshot: { lessonId },
  });
  assert(resumed.sessionKey === created.sessionKey && resumed.status === "closed", "post resume does not open a new chat");

  await pool.query(`DELETE FROM learn_lesson_chat_turns WHERE lesson_id = ?`, [lessonId]);
  await pool.query(`DELETE FROM learn_lesson_chat_sessions WHERE lesson_id = ?`, [lessonId]);
  console.log("PASS resume wrap_up lock flag gates");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
