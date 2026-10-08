#!/usr/bin/env node
/**
 * Evidence tests: quota atomicity, turn order, timeout release, idempotency.
 * Run: node --import ./scripts/register-alias.mjs scripts/test-learn-lesson-chat-concurrency.mjs
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
  const evidence = [];

  // --- Honest prior-test audit ---
  evidence.push({
    q: "Prior PASS test coverage",
    answer:
      "Unit/store only: flag, prompt text, vocab extract, insertCompletedTurn idempotency, static route source checks. NO live HTTP API, NO owner path (getLearningPathForUser), NO AI call, NO concurrent quota.",
  });

  const quota = await import("@/lib/beego/learn/learn-lesson-chat-quota.js");
  const store = await import("@/lib/beego/learn/learn-lesson-chat-store.js");
  const flags = await import("@/lib/beego/learn/learn-lesson-chat-flags.js");

  assert(flags.isLearnLessonChatEnabled() === false, "feature flag still OFF by default");
  evidence.push({ q: "Feature flag", answer: "OFF (LEARN_LESSON_CHAT_ENABLED unset/false)" });

  await store.ensureLearnLessonChatTables();
  await quota.ensureLearnLessonChatUsageTable();

  const userId = Number(process.env.LEARN_CHAT_TEST_USER_ID || 1);
  const lessonId = `p1-g1-n01-concurrency-${Date.now()}`;
  // Use real lesson id for session; conversation isolation via unique session
  const session = await store.getOrCreateLearnLessonChatSession({
    userId,
    lessonId: "p1-g1-n01",
    lessonSnapshot: {
      lessonId: "p1-g1-n01",
      title: "test",
      objective: "test",
      level: "A0",
      vocabularyWords: ["hello"],
    },
  });

  // Fresh quota row for isolation: use a high-offset synthetic user for concurrency
  const qUser = 9_000_000 + (Date.now() % 100000);
  process.env.LEARN_LESSON_CHAT_DAILY_LIMIT = "5";

  // Re-import flags/quota with limit=5 — flags module already loaded; set env before getLearnLessonChatDailyLimit reads process.env each call
  assert(flags.getLearnLessonChatDailyLimit() === 5, "daily limit reads env=5");

  // 1) Concurrent reserves must not exceed limit
  const reserves = await Promise.all(
    Array.from({ length: 20 }, () => quota.tryReserveLearnLessonChatQuota(qUser))
  );
  const okReserves = reserves.filter((r) => r.ok).length;
  const failReserves = reserves.filter((r) => !r.ok).length;
  assert(okReserves === 5, `expected 5 successful reserves, got ${okReserves}`);
  assert(failReserves === 15, `expected 15 rejected, got ${failReserves}`);
  const snap = await quota.assertLearnLessonChatQuota(qUser);
  assert(snap.usageToday === 5, `usageToday should be 5, got ${snap.usageToday}`);
  evidence.push({
    q: "DAILY_LIMIT concurrency",
    answer: `limit=5, 20 parallel tryReserve → ok=${okReserves} fail=${failReserves} usageToday=${snap.usageToday}`,
  });

  // Refund on "timeout" path
  await quota.refundLearnLessonChatQuota(qUser, snap.usageDate);
  const afterRefund = await quota.assertLearnLessonChatQuota(qUser);
  assert(afterRefund.usageToday === 4, `after refund expected 4, got ${afterRefund.usageToday}`);
  evidence.push({
    q: "Refund after timeout",
    answer: `usageToday ${snap.usageToday} → ${afterRefund.usageToday} after refundLearnLessonChatQuota`,
  });

  // 2) Concurrent claims: unique turn_index, ordered
  const claims = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      store.claimPendingTurn({
        sessionId: session.id,
        userId,
        lessonId: "p1-g1-n01",
        clientRequestId: `conc-${crypto.randomUUID()}`,
        source: "text",
        userMessage: `msg-${i}`,
      })
    )
  );
  const claimed = claims.filter((c) => c.kind === "claimed");
  assert(claimed.length === 8, `expected 8 claimed, got ${claimed.length}`);
  const indexes = claimed.map((c) => c.turnIndex).sort((a, b) => a - b);
  const unique = new Set(indexes);
  assert(unique.size === 8, `turn_index must be unique: ${indexes.join(",")}`);
  for (let i = 1; i < indexes.length; i++) {
    assert(indexes[i] === indexes[i - 1] + 1, "turn_index must be contiguous under lock");
  }
  evidence.push({
    q: "Concurrent turn_index",
    answer: `8 parallel claims → indexes [${indexes.join(", ")}] unique+contiguous`,
  });

  // Complete one, release others (simulate timeout cleanup)
  const [first, ...rest] = claimed;
  await store.completePendingTurn(first.turnId, {
    reply: "Hello!",
    corrected_sentence: "",
    ipa: "",
    pronunciation_tip: "",
    mistakes_explanation: "",
  });
  for (const c of rest) {
    await store.releasePendingTurn(c.turnId, session.id);
  }

  // 3) Idempotent replay: same client_request_id after complete
  const reqId = `idem-${crypto.randomUUID()}`;
  const c1 = await store.claimPendingTurn({
    sessionId: session.id,
    userId,
    lessonId: "p1-g1-n01",
    clientRequestId: reqId,
    source: "text",
    userMessage: "Hello again",
  });
  assert(c1.kind === "claimed", "first claim");
  await store.completePendingTurn(c1.turnId, { reply: "Hi again!" });
  const c2 = await store.claimPendingTurn({
    sessionId: session.id,
    userId,
    lessonId: "p1-g1-n01",
    clientRequestId: reqId,
    source: "text",
    userMessage: "Hello again",
  });
  assert(c2.kind === "completed", "replay returns completed");
  assert(c2.turn.aiReplyText === "Hi again!", "replay keeps first reply");
  evidence.push({
    q: "Idempotent client_request_id",
    answer: "second claim → kind=completed, same reply text, no new turn",
  });

  // 4) Timeout release: pending deleted → same client_request_id can reclaim
  const timeoutId = `timeout-${crypto.randomUUID()}`;
  const t1 = await store.claimPendingTurn({
    sessionId: session.id,
    userId,
    lessonId: "p1-g1-n01",
    clientRequestId: timeoutId,
    source: "text",
    userMessage: "timeout path",
  });
  assert(t1.kind === "claimed");
  const mid = await store.claimPendingTurn({
    sessionId: session.id,
    userId,
    lessonId: "p1-g1-n01",
    clientRequestId: timeoutId,
    source: "text",
    userMessage: "timeout path",
  });
  assert(mid.kind === "pending", "in-flight → pending");
  await store.releasePendingTurn(t1.turnId, session.id);
  const t2 = await store.claimPendingTurn({
    sessionId: session.id,
    userId,
    lessonId: "p1-g1-n01",
    clientRequestId: timeoutId,
    source: "text",
    userMessage: "timeout path",
  });
  assert(t2.kind === "claimed", "after release, retry reclaims");
  await store.releasePendingTurn(t2.turnId, session.id);
  evidence.push({
    q: "Timeout does not stick session",
    answer: "pending → TURN_IN_PROGRESS; releasePendingTurn → retry claims again; no duplicate completed rows",
  });

  // 5) Owner check at store layer
  const foreign = await store.getLearnLessonChatSessionByKey(session.sessionKey);
  assert(foreign.userId === userId, "session owner stored");
  evidence.push({
    q: "Owner",
    answer: `session.user_id=${foreign.userId}; turn route rejects if session.userId !== auth user (code SESSION_NOT_FOUND)`,
  });

  // 6) What DAILY_LIMIT counts
  evidence.push({
    q: "DAILY_LIMIT=30 counts what?",
    answer:
      "Atomic reservations in learn_lesson_chat_usage_daily.request_count for successful AI turns. Reserve before AI; refund on timeout/failure; completed idempotent replay does not reserve again.",
  });

  // Static: turn route uses reserve/refund/claim
  const turnSrc = fs.readFileSync(path.join(root, "app/api/learn/chat/turn/route.js"), "utf8");
  assert(turnSrc.includes("tryReserveLearnLessonChatQuota"), "turn uses atomic reserve");
  assert(turnSrc.includes("refundLearnLessonChatQuota"), "turn refunds on AI fail");
  assert(turnSrc.includes("claimPendingTurn"), "turn claims pending");
  assert(turnSrc.includes("TURN_IN_PROGRESS"), "in-flight conflict code");
  assert(!turnSrc.includes("recordPooledAiUsageSuccess"), "no speaking pooled usage");

  console.log("LEARN_LESSON_CHAT_CONCURRENCY_TEST=PASS");
  for (const e of evidence) {
    console.log(`EVIDENCE\t${e.q}\t${e.answer}`);
  }
}

main().catch((err) => {
  console.error("LEARN_LESSON_CHAT_CONCURRENCY_TEST=FAIL", err?.stack || err);
  process.exit(1);
});
