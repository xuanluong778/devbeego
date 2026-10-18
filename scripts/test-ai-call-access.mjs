/**
 * Learn Call permission rules. Does not touch the database.
 * node --import ./scripts/register-alias.mjs scripts/test-ai-call-access.mjs
 */
import {
  decideLearnAiCallAccess,
  learnAiCallBindingMatches,
  learnAiCallLevelOnePrompt,
  learnAiCallEmailAllowed,
  learnAiCallSocketAllowed,
  learnAiCallSummary,
  learnAiCallWsUrl,
  learnCallEntryFromResponse,
  listOpenGateCallTargets,
  listSpeakingTabTopics,
  pickGateCallTarget,
  LEARN_AI_CALL_TEST_PACKAGE_QUOTA,
  learnAiCallPackageAllowanceMs,
  resolveLearnCallClock,
  resolveLearnCallPackage,
  settleLearnCallPackage,
} from "../lib/beego/learn/ai-call-access.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const off = decideLearnAiCallAccess({ enabled: false, plan: "vip", subscriptionLoaded: true, allowlisted: true });
assert(off.allowed === false && off.code === "FEATURE_DISABLED", "flag off blocks a paid plan");

const failed = decideLearnAiCallAccess({ enabled: true, subscriptionLoaded: false, plan: "vip", allowlisted: true });
assert(failed.allowed === false && failed.code === "SUBSCRIPTION_LOAD_FAILED", "subscription failure denies the call");

const outsider = decideLearnAiCallAccess({ enabled: true, subscriptionLoaded: true, plan: "pro", allowlisted: false });
assert(outsider.allowed === false && outsider.code === "FEATURE_DISABLED", "a paid account outside the allowlist cannot start a call");

for (const plan of ["trial", "expired", "free"]) {
  const decision = decideLearnAiCallAccess({ enabled: true, subscriptionLoaded: true, plan, allowlisted: true });
  assert(decision.allowed === false, `${plan} cannot start a Learn call`);
}

for (const plan of ["pro", "vip"]) {
  const decision = decideLearnAiCallAccess({ enabled: true, subscriptionLoaded: true, plan, allowlisted: true });
  assert(decision.allowed === true && decision.plan === plan && decision.adminBypass === false, `${plan} can start a Learn call`);
}

const admin = decideLearnAiCallAccess({
  enabled: true,
  subscriptionLoaded: true,
  plan: "expired",
  adminBypass: true,
  allowlisted: true,
});
assert(admin.allowed === true && admin.adminBypass === true && admin.code === "ADMIN_EXCEPTION", "admin exception is explicit");
const adminOutside = decideLearnAiCallAccess({
  enabled: true,
  subscriptionLoaded: true,
  plan: "vip",
  adminBypass: true,
  allowlisted: false,
});
assert(adminOutside.allowed === true && adminOutside.code === "ADMIN_EXCEPTION", "admin is not blocked by the test allowlist");
assert(learnAiCallEmailAllowed("learner@example.test", { LEARN_AI_CALL_ALLOWLIST: "Other@Example.test, learner@example.test" }), "allowlist matches email case");
assert(!learnAiCallEmailAllowed("learner@example.test", { LEARN_AI_CALL_ALLOWLIST: "" }), "an empty allowlist matches nobody");

const legacy = learnAiCallSocketAllowed({ purpose: "", plan: "trial", sid: "" });
assert(legacy.applies === false && legacy.allowed === true, "old speaking tokens are not blocked here");

const forged = learnAiCallSocketAllowed({ purpose: "learn_ai_call", plan: "trial", sid: "abc", learnAllow: 1 });
assert(forged.applies === true && forged.allowed === false, "a Learn token with trial is rejected");

const unbound = learnAiCallSocketAllowed({ purpose: "learn_ai_call", plan: "pro", sid: "sess-1" });
assert(unbound.allowed === false, "a Learn token without the allowlist claim is rejected");

const bound = learnAiCallSocketAllowed({ purpose: "learn_ai_call", plan: "pro", sid: "sess-1", learnAllow: 1 });
assert(bound.allowed === true && bound.sid === "sess-1", "an allowlisted Learn token keeps its session id");

assert(learnAiCallBindingMatches("42", "42") === true, "the session owner matches");
assert(learnAiCallBindingMatches("42", "99") === false, "another user cannot use the session");
assert(learnAiCallBindingMatches("", "42") === false, "a missing binding is rejected");

assert(learnCallEntryFromResponse(401, { code: "AUTH_REQUIRED" }).view === "login", "guest is asked to sign in");
assert(learnCallEntryFromResponse(403, { code: "TRIAL_NOT_INCLUDED" }).view === "upgrade", "trial sees upgrade");
assert(learnCallEntryFromResponse(402, { code: "PAYWALL" }).view === "upgrade", "expired sees upgrade");
assert(learnCallEntryFromResponse(200, { code: "ALLOWED", data: { allowed: true } }).view === "prepare", "pro or vip opens prepare");
assert(learnCallEntryFromResponse(200, { code: "ADMIN_EXCEPTION", data: { allowed: true } }).view === "prepare", "admin exception opens prepare");
assert(learnCallEntryFromResponse(503, { code: "SUBSCRIPTION_LOAD_FAILED" }).view === "retry", "a system error is retry, not a plan error");
assert(learnCallEntryFromResponse(403, { code: "FEATURE_DISABLED" }).view === "hidden", "flag off hides the entry");

const prompt = learnAiCallLevelOnePrompt({ title: "Greetings", objective: "Say hello" });
assert(prompt.includes("Greetings") && prompt.includes("Say hello") && prompt.includes("CONTEXT FROM THE SYSTEM"), "lesson context is in the tutor prompt");
assert(learnAiCallWsUrl({ LEARN_AI_CALL_WS_URL: "https://beego.vn/voice" }) === "", "only websocket urls are accepted");
assert(learnAiCallWsUrl({ LEARN_AI_CALL_WS_URL: "ws://127.0.0.1:3032" }) === "ws://127.0.0.1:3032", "preview websocket url is kept");

const summary = learnAiCallSummary({
  startedAt: 1_000,
  endedAt: 4_500,
  lesson: { title: "Chào một người mới", objective: "Nói tên" },
  memory: [
    { role: "assistant", content: "Nice to meet you, Lan.", requestId: 2, playback: "complete" },
    { role: "user", content: "My name is Lan." },
    { role: "assistant", content: "Hello before the cutoff", requestId: 1, playback: "interrupted" },
  ],
});
assert(summary.score === null, "summary has no score without Azure pronunciation turns");
assert(summary.pronunciation === "Chưa đánh giá" && summary.correctionNote === "Chưa đánh giá", "pronunciation stays unevaluated without Azure scores");
const graded = learnAiCallSummary({
  startedAt: 1_000,
  endedAt: 4_500,
  memory: [{ role: "user", content: "My name is Lan.", requestId: 1, pronunciationScore: 82, accuracyScore: 80, fluencyScore: 84 }],
});
assert(graded.score === 82 && graded.pronunciation === "82/100", "Azure pronunciation score is surfaced");
assert(/Azure Pronunciation Assessment/.test(graded.pronunciationNote || ""), "note explains Azure audio scoring");
assert(summary.durationSeconds === 4, "duration comes from the session clock");
assert(summary.learnerQuotes.length === 1 && summary.learnerQuotes[0] === "My name is Lan.", "learner evidence is quoted");
assert(summary.playedTutorQuotes.length === 1 && summary.playedTutorQuotes[0].includes("Lan"), "only fully played tutor lines are listed");
assert(summary.interruptedTutorQuotes.length === 1, "an interrupted tutor line stays separate");
assert(!summary.heardTutorQuotes, "playback is not described as heard");
assert(summary.durationSeconds !== summary.learnerQuotes.length, "duration is not the turn count");
const empty = learnAiCallSummary({ memory: [], startedAt: null, endedAt: null, lesson: { title: "Bài" } });
assert(empty.practiced === false && empty.durationSeconds === null && empty.score === null, "missing clock and speech stay unevaluated");

const firstClock = resolveLearnCallClock({ now: 10_000, maxMs: 5_000, existing: null });
const again = resolveLearnCallClock({
  now: 12_000,
  maxMs: 5_000,
  existing: { startedAt: firstClock.startedAt, deadlineAt: firstClock.deadlineAt },
});
assert(firstClock.reused === false && firstClock.remainingMs === 5_000, "the first connection starts the budget");
assert(again.reused === true && again.deadlineAt === firstClock.deadlineAt && again.remainingMs === 3_000, "reconnect keeps the same deadline");

assert(learnAiCallPackageAllowanceMs("pro", {}) == null, "package quota stays off without the test mode");
assert(
  learnAiCallPackageAllowanceMs("pro", { LEARN_AI_CALL_QUOTA_MODE: "test" }) === LEARN_AI_CALL_TEST_PACKAGE_QUOTA.proMs,
  "pro test quota is the documented preview budget"
);
assert(
  learnAiCallPackageAllowanceMs("vip", { LEARN_AI_CALL_QUOTA_MODE: "test" }) === LEARN_AI_CALL_TEST_PACKAGE_QUOTA.vipMs &&
    LEARN_AI_CALL_TEST_PACKAGE_QUOTA.proMs !== 2 * 60 * 1000,
  "package budget is not the 2-minute session cap"
);
const firstHold = resolveLearnCallPackage({ allowanceMs: 20_000, sessionId: "a", sessionCapMs: 120_000, holds: {} });
const secondHold = resolveLearnCallPackage({
  allowanceMs: 20_000,
  sessionId: "b",
  sessionCapMs: 120_000,
  holds: { a: firstHold.reservedMs },
});
const reconnectHold = resolveLearnCallPackage({
  allowanceMs: 20_000,
  sessionId: "a",
  sessionCapMs: 120_000,
  holds: { a: firstHold.reservedMs },
  elapsedMs: 4_000,
});
assert(firstHold.status === "granted" && firstHold.reservedMs === 20_000, "a session reserves only the package remainder");
assert(secondHold.status === "denied", "a second session cannot pass the reserved package");
assert(reconnectHold.status === "reused" && reconnectHold.reservedMs === 20_000 && reconnectHold.remainingMs === 16_000, "reconnect does not take a second slice");
const settled = settleLearnCallPackage({ reservedMs: 20_000, elapsedMs: 5_000, usedMs: 0 });
const againSettled = settleLearnCallPackage({ reservedMs: 20_000, elapsedMs: 5_000, usedMs: settled.usedMs, alreadySettled: true });
assert(settled.consumedMs === 5_000 && againSettled.consumedMs === 0 && againSettled.usedMs === 5_000, "closing twice does not add usage twice");
assert(learnCallEntryFromResponse(402, { code: "PACKAGE_QUOTA" }).view === "quota", "an empty package is not shown as an upgrade");

const pathFixture = {
  sections: [
    {
      sectionId: "s-locked",
      topicTitle: "Locked",
      nodes: [{ lessonId: "a", type: "vocabulary", status: "locked" }],
    },
    {
      sectionId: "s-open",
      topicTitle: "Greetings",
      nodes: [
        { lessonId: "b1", type: "vocabulary", status: "completed" },
        { lessonId: "b2", type: "grammar", status: "active" },
      ],
    },
    {
      sectionId: "s-done",
      sectionTitle: "Done topic",
      nodes: [
        { lessonId: "c1", type: "listening", status: "completed" },
        { lessonId: "c2", type: "test", status: "completed" },
      ],
    },
  ],
};
assert(pickGateCallTarget(pathFixture.sections[0]) === null, "a locked gate has no call target");
assert(pickGateCallTarget(pathFixture.sections[1])?.lessonId === "b2", "open gate prefers the active ordinary lesson");
const allTopics = listSpeakingTabTopics(pathFixture);
assert(allTopics.length === 3, "speaking tab lists every Học topic with ordinary lessons");
assert(allTopics[0].locked === true && allTopics[0].topicTitle === "Locked", "locked Học topic stays listed");
assert(allTopics[1].locked === false && allTopics[1].lessonId === "b2", "open topic is selectable");
assert(allTopics[2].locked === false && allTopics[2].lessonId === "c1" && allTopics[2].lessonType === "listening", "completed gate falls back to an ordinary lesson, not the test node");
const listed = listOpenGateCallTargets(pathFixture);
assert(listed.length === 2 && listed.every((item) => !item.locked), "open-only helper skips locked topics");
assert(listSpeakingTabTopics(null).length === 0, "missing path yields no speaking-tab topics");

console.log("PASS learn ai call access");
