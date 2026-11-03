/**
 * Prompt 1 Learn Call pedagogy: one opening, A/B/C/D before correction, one retry, honest summary.
 * Simulation only — no live WebSocket, Realtime, or production Redis.
 */
import assert from "node:assert/strict";
import {
  learnCallClaimOpening,
  learnCallMarkOpening,
  learnCallOpeningClaimed,
  learnCallOpeningScript,
  learnCallShouldTutorOpen,
} from "../lib/beego/learn/learn-call-opening.js";
import { learnCallClassifyAnswer, nextRetriesByTarget } from "../lib/beego/learn/learn-call-answer.js";
import {
  evaluateLearnCallState,
  extractLearnCallPracticePhrase,
  learnCallHelpKind,
  learnCallShapeReply,
  learnCallTurnDirective,
  learnCallTurnPlan,
} from "../lib/beego/learn/learn-call-tutor.js";
import { learnAiCallSummary } from "../lib/beego/learn/ai-call-access.js";
import { createRealtimeCallLifecycle } from "../lib/beego/learn/learn-call-realtime-lifecycle.js";

const topicCtx = { topic: "Chào hỏi", title: "Chào hỏi và làm quen", lessonTitle: "Chào hỏi và làm quen", sectionId: "p1-g1", sessionMode: "lesson" };
const user = (rid, text) => ({ role: "user", content: text, requestId: rid });
const tutor = (rid, text, extra = {}) => ({ role: "assistant", content: text, requestId: rid, playback: "complete", ...extra });

function mockRedis() {
  const store = new Map();
  return {
    store,
    async get(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    async set(key, value, ...args) {
      const nx = args.includes("NX");
      if (nx && store.has(String(key))) return null;
      store.set(String(key), String(value));
      return "OK";
    },
  };
}

console.log("=== Prompt 1 · opening once ===");
const script = learnCallOpeningScript(topicCtx, "easy");
assert.equal(script.spoken, "Hi! I'm your new neighbor. What's your name?");
assert.equal(script.hint.en, "My name is …");
assert.equal(learnCallShouldTutorOpen({ sessionMode: "lesson" }).open, true);
assert.equal(learnCallShouldTutorOpen({ sessionMode: "open" }).open, false);
assert.equal(learnCallShouldTutorOpen({ sessionMode: "open" }).invite, true);
assert.equal(learnCallShouldTutorOpen({ sessionMode: "lesson", learnerSpeaking: true }).reason, "learner_first");
assert.equal(learnCallShouldTutorOpen({ sessionMode: "lesson", memory: [user(1, "Hi")] }).reason, "learner_first");
assert.equal(learnCallShouldTutorOpen({ sessionMode: "lesson", memory: [tutor(1, "Hi")] }).reason, "already_opened");
assert.equal(learnCallTurnPlan({ memory: [], remainingMs: 100_000, topicCtx }).mode, "greet");
assert.equal(learnCallTurnPlan({ memory: [], remainingMs: 100_000, topicCtx: { ...topicCtx, sessionMode: "open" } }).mode, "none");
assert.equal(learnCallTurnPlan({ memory: [tutor(1, script.spoken)], remainingMs: 100_000, topicCtx }).mode, "none");
const greetDir = learnCallTurnDirective({ mode: "greet", topicKey: "greetings" }, "easy");
assert.ok(greetDir.includes("Hi! I'm your new neighbor. What's your name?"));
assert.ok(greetDir.includes("do not ask about goodbye"));

const redis = mockRedis();
const first = await learnCallClaimOpening(redis, "sid-1");
const second = await learnCallClaimOpening(redis, "sid-1");
assert.equal(first.claimed, true);
assert.equal(second.claimed, false);
await learnCallMarkOpening(redis, "sid-2", "learner");
assert.equal(await learnCallOpeningClaimed(redis, "sid-2"), true);
assert.equal((await learnCallClaimOpening(redis, "sid-2")).claimed, false);
console.log("  [PASS] one opening, open-mode waits, learner-first, NX lock");

console.log("=== Prompt 1 · classify A/B/C/D ===");
const jobQ = { text: "What do you do?", intent: "job" };
assert.equal(learnCallClassifyAnswer("I work in IT", { pendingQuestion: jobQ, topicCtx }).kind, "accept");
assert.equal(learnCallClassifyAnswer("I work in technology", { pendingQuestion: jobQ, topicCtx }).kind, "accept");
const fragment = learnCallClassifyAnswer("technology", { pendingQuestion: jobQ, topicCtx });
assert.equal(fragment.kind, "unclear");
assert.equal(fragment.confirm, "Do you mean you work in tech?");
const nameOnly = learnCallClassifyAnswer("Lan", { pendingQuestion: { text: "What's your name?", intent: "name" }, topicCtx });
assert.equal(nameOnly.kind, "accept");
assert.equal(nameOnly.intentOk, true);
const nudge = learnCallClassifyAnswer("I am student", { pendingQuestion: jobQ, topicCtx });
assert.equal(nudge.kind, "nudge_target");
assert.equal(nudge.intentOk, true);
assert.equal(nudge.targetUsed, false);
const firstGap = learnCallClassifyAnswer("She my neighbor", { pendingQuestion: { text: "Who is she?", intent: "general" }, topicCtx });
assert.equal(firstGap.kind, "correct");
assert.equal(firstGap.targetId, "copula:is");
const afterRetry = nextRetriesByTarget({}, firstGap);
const secondGap = learnCallClassifyAnswer("She my neighbor", {
  pendingQuestion: { text: "Who is she?", intent: "general" },
  topicCtx,
  retriesByTarget: afterRetry,
});
assert.equal(secondGap.kind, "correct_exhausted");
const stillExhausted = learnCallClassifyAnswer("She my neighbor", {
  pendingQuestion: { text: "Try: She is my neighbor.", intent: "general" },
  topicCtx,
  retriesByTarget: nextRetriesByTarget(afterRetry, secondGap),
});
assert.equal(stillExhausted.kind, "correct_exhausted", "paraphrase / reconnect must not reset the retry");
assert.equal(learnCallClassifyAnswer("Bỏ qua", { pendingQuestion: jobQ, topicCtx, helpKind: "skip" }).kind, "help");
assert.equal(learnCallHelpKind("Speak slowly please"), "slower");
assert.equal(learnCallHelpKind("Bỏ qua"), "skip");
console.log("  [PASS] accept synonyms, name-only, nudge, unclear fragment, one retry");

console.log("=== Prompt 1 · turn plan uses classification ===");
const itPlan = learnCallTurnPlan({
  memory: [user(2, "I work in IT"), tutor(1, "What do you do?")],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(itPlan.answerKind, "accept");
assert.ok(learnCallTurnDirective(itPlan, "easy").includes("Do not turn a correct answer into a drill"));
const copulaMem = [user(4, "She my neighbor"), tutor(3, "Who is she?"), user(2, "She my neighbor"), tutor(1, "Who is she?")];
const exhaustedPlan = learnCallTurnPlan({ memory: copulaMem, remainingMs: 90_000, topicCtx });
assert.equal(exhaustedPlan.answerKind, "correct_exhausted");
assert.ok(learnCallTurnDirective(exhaustedPlan, "easy").includes("already had one retry"));
const skipPlan = learnCallTurnPlan({
  memory: [user(2, "Bỏ qua"), tutor(1, "How old are you?")],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(skipPlan.helpKind, "skip");
const viPlan = learnCallTurnPlan({
  memory: [user(2, "Giải thích tiếng Việt"), tutor(1, "What's your name?")],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(viPlan.helpKind, "vietnamese");
const namePlan = learnCallTurnPlan({
  memory: [user(2, "Lan"), tutor(1, "Hi! I'm your new neighbor. What's your name?")],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(namePlan.answerKind, "accept");
assert.ok(learnCallTurnDirective(namePlan, "easy").includes("Do you live nearby?"));
const state = evaluateLearnCallState(
  [tutor(1, "What do you do?"), user(2, "I am student")],
  { topicCtx }
);
assert.ok(state.intentOkFacets.includes("job"));
assert.equal(state.targetUsedFacets.includes("job"), false);
console.log("  [PASS] planner A/D/help/role follow-up");

console.log("=== Prompt 1 · Realtime opening lifecycle ===");
const life = createRealtimeCallLifecycle();
life.configureOpening({ sessionMode: "lesson", topicCtx, difficulty: "easy", shouldSpeak: true });
const opens = life.noteReady().filter((e) => e.type === "send" && e.event?.type === "response.create");
assert.equal(opens.length, 1);
assert.match(opens[0].event.response.instructions, /What's your name/);
assert.equal(life.noteReady().length, 0, "duplicate ready does not open twice");
const reconnect = createRealtimeCallLifecycle();
reconnect.configureOpening({ sessionMode: "lesson", topicCtx, shouldSpeak: false });
assert.equal(reconnect.noteReady().length, 0, "reconnect with claimed opening stays silent");
const learnerFirst = createRealtimeCallLifecycle();
learnerFirst.configureOpening({ sessionMode: "lesson", topicCtx, shouldSpeak: true });
learnerFirst.noteLearnerSpeech();
assert.equal(learnerFirst.noteReady().length, 0, "learner-first wins");
const openChat = createRealtimeCallLifecycle();
openChat.configureOpening({ sessionMode: "open", topicCtx, shouldSpeak: false });
const invite = openChat.noteReady();
assert.equal(invite.some((e) => e.type === "invite"), true);
assert.equal(invite.some((e) => e.event?.type === "response.create"), false);
console.log("  [PASS] Realtime one opening, reconnect, learner-first, open invite");

console.log("=== Prompt 1 · no pronunciation repeat loop ===");
const hcmc = "I live in Ho Chi Minh City.";
assert.equal(
  extractLearnCallPracticePhrase("Let's slow down: I live in Ho Chi Minh City. Now you say: I live in... your turn."),
  "I live in Ho Chi Minh City"
);
assert.equal(extractLearnCallPracticePhrase("Now, say: I live in Ho Chi Minh City."), "I live in Ho Chi Minh City");
const livePlan = learnCallTurnPlan({
  memory: [user(2, hcmc), tutor(1, "Where do you live?")],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(livePlan.answerKind, "accept");
assert.equal(livePlan.currentPractice?.active, false);
assert.ok(learnCallTurnDirective(livePlan, "easy").includes("Do not start a pronunciation drill"));
const afterForcedDrill = learnCallTurnPlan({
  memory: [
    user(4, hcmc),
    tutor(3, "Good, I understand. Bạn ở Sài Gòn, đúng không? Now, say: I live in Ho Chi Minh City."),
    user(2, hcmc),
    tutor(1, "Where do you live?"),
  ],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(afterForcedDrill.currentPractice?.active, false, "already-said sentence must not open a drill");
assert.equal(afterForcedDrill.answerKind, "accept");
const loopPlan = learnCallTurnPlan({
  memory: [
    user(8, hcmc),
    tutor(7, "Good effort! Let's slow down: I live in Ho Chi Minh City. You try."),
    user(6, hcmc),
    tutor(5, "Good job! Now, let's try again, slowly: I live in Ho Chi Minh City. You try."),
    user(4, hcmc),
    tutor(3, "Good try! Let's slow down: I live in Ho Chi Minh City. Now you say: I live in... your turn."),
    user(2, hcmc),
    tutor(1, "Where do you live?"),
  ],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(loopPlan.mode, "ask");
assert.equal(loopPlan.currentPractice?.active, false);
assert.equal(loopPlan.answerKind, "accept");
const shapedAccept = learnCallShapeReply(
  "Good, I understand. Bạn ở Sài Gòn, đúng không? Now, say: I live in Ho Chi Minh City.",
  { answerKind: "accept", lastLearnerText: hcmc, nextQuestion: "What do you do?" }
);
assert.equal(/now,?\s+say|slow down|you try|your turn/i.test(shapedAccept), false);
assert.ok(/Sài Gòn|understand|What do you do/i.test(shapedAccept));
const shapedLoop = learnCallShapeReply(
  "Good try! Let's slow down: I live in Ho Chi Minh City. Now you say: I live in... your turn.",
  { answerKind: "accept", lastLearnerText: hcmc, nextQuestion: "What do you do?" }
);
assert.equal(/slow down|now you say|your turn|you try/i.test(shapedLoop), false);
const keepScaffold = learnCallShapeReply('Tuyệt vời! Bạn thử nói cả câu nhé: "The coffee in this cafe is very delicious."', {
  answerKind: "accept",
  lastLearnerText: "Coffee ngon.",
  nextQuestion: "What did you drink?",
});
assert.ok(/The coffee in this cafe is very delicious/i.test(keepScaffold), "short answers may still get one sentence-building invite");

const age = "I am 25 years old.";
assert.equal(extractLearnCallPracticePhrase("Can you say: I am 25 years old?"), "I am 25 years old");
assert.equal(extractLearnCallPracticePhrase("Let's say: I am 25 years old. Now you try: I am 25 years old."), "I am 25 years old");
assert.equal(
  extractLearnCallPracticePhrase('Let\'s say it step by step: "I am 25 years old." Now you try: "I am 25 years old."'),
  "I am 25 years old"
);
const ageRetry = learnCallTurnPlan({
  memory: [
    user(4, "I am 75 years old."),
    tutor(3, "You are 25. Good. Can you say: I am 25 years old?"),
    user(2, "25"),
    tutor(1, "How old are you?"),
  ],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(ageRetry.currentPractice?.active, true, "one recast is allowed after a wrong number");
const ageDone = learnCallTurnPlan({
  memory: [
    user(6, age),
    tutor(5, "Good try. Let's say: I am 25 years old. Now you try: I am 25 years old."),
    user(4, "I am 75 years old."),
    tutor(3, "You are 25. Good. Can you say: I am 25 years old?"),
    user(2, "25"),
    tutor(1, "How old are you?"),
  ],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(ageDone.currentPractice?.active, false);
assert.equal(ageDone.answerKind, "accept");
const ageLoop = learnCallTurnPlan({
  memory: [
    user(10, age),
    tutor(9, 'Let\'s slow down. Listen: "I am 25 years old." Now you try: "I am 25 years old."'),
    user(8, age),
    tutor(7, "That's okay. Let's try again, step by step: I am 25 years old. Now you try: I am 25 years old."),
    user(6, age),
    tutor(5, "Good try. Let's say: I am 25 years old. Now you try: I am 25 years old."),
    user(4, "I am 75 years old."),
    tutor(3, "You are 25. Good. Can you say: I am 25 years old?"),
    user(2, "25"),
    tutor(1, "How old are you?"),
  ],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(ageLoop.mode, "ask");
assert.equal(ageLoop.currentPractice?.active, false);
assert.equal(ageLoop.answerKind, "accept");
for (const raw of [
  "Good try. Let's say: I am 25 years old. Now you try: I am 25 years old.",
  "Good effort! Let's slow down: I am 25 years old. Now, you try: I am 25 years old.",
  "That's okay. Let's try again, slowly: I am 25 years old. Now, repeat: 25 years old.",
  "Let's break it down: I am 25 years old. Now, your turn: 25 years old.",
  'I understand. Let\'s say it step by step: "I am" ... "25" ... "years old." Now, you try: "I am 25 years old."',
  "Let's slow down. Listen: I am 25 years old. Now you try: I am 25 years old.",
  "You are 25. Good. Can you say: I am 25 years old?",
]) {
  const shaped = learnCallShapeReply(raw, { answerKind: "accept", lastLearnerText: age, nextQuestion: "Where do you live?" });
  assert.equal(
    /let'?s say|slow down|now you try|you try|your turn|step by step|listen:|can you say|repeat:/i.test(shaped),
    false,
    `must strip recitation from: ${raw}`
  );
  assert.ok(/where do you live/i.test(shaped), `must move on after correct age sentence: ${shaped}`);
}
const keepAgeRecast = learnCallShapeReply("Good try. Let's say: I am 25 years old. Now you try: I am 25 years old.", {
  answerKind: "correct",
  lastLearnerText: "I am 75 years old.",
  nextQuestion: "Where do you live?",
});
assert.ok(/I am 25 years old/i.test(keepAgeRecast), "one retry may still model the target once");

const forty = "I am 40 years old.";
assert.equal(
  extractLearnCallPracticePhrase("Good effort! Let's try again, slowly: I am ... 40 ... years ... old. Your turn."),
  "I am 40 years old"
);
const fortyDone = learnCallTurnPlan({
  memory: [
    user(6, forty),
    tutor(5, "Good try! Let's slow down: I am 40 years old. Now you say it: I am 40 years old."),
    user(4, "I'm 34 years old."),
    tutor(3, "Thank you. You're 40 years old. Let's try: I am 40 years old. Your turn."),
    user(2, "40"),
    tutor(1, "How old are you?"),
  ],
  remainingMs: 90_000,
  topicCtx,
});
assert.equal(fortyDone.currentPractice?.active, false);
assert.equal(fortyDone.currentPractice?.completed, true);
assert.equal(fortyDone.answerKind, "accept");
for (const raw of [
  "Good effort! Let's try again, slowly: I am ... 40 ... years ... old. Your turn.",
  "Good, let's break it down: I am 40 years old. Now, you try: I am 40 years old.",
  'Good try! Let\'s focus on the sound: "forty years old." Listen: forty. Now, your turn: forty years old.',
  'I understand. Let\'s slow down. Listen: "forty years old." Now you try: "forty years old."',
]) {
  const shaped = learnCallShapeReply(raw, {
    answerKind: "accept",
    lastLearnerText: forty,
    practiceCompleted: true,
    nextQuestion: "Where do you live?",
  });
  assert.equal(
    /let'?s try|slow down|your turn|you try|focus on the sound|listen:|forty years old|i am \.\.\./i.test(shaped),
    false,
    `must kill recitation: ${raw} -> ${shaped}`
  );
  assert.ok(/where do you live/i.test(shaped), `must move on: ${shaped}`);
}
const keepFortyRecast = learnCallShapeReply("Good try! Let's slow down: I am 40 years old. Now you say it: I am 40 years old.", {
  answerKind: "correct",
  lastLearnerText: "I'm 34 years old.",
  nextQuestion: "Where do you live?",
});
assert.ok(/I am 40 years old/i.test(keepFortyRecast), "one retry may still model 40 after 34");
console.log("  [PASS] complete sentence is accepted; spoken pronunciation loop is stripped");

console.log("=== Prompt 1 · summary evidence ===");
const summary = learnAiCallSummary({
  startedAt: 1_000,
  endedAt: 20_000,
  lesson: { title: "Chào hỏi và làm quen", topic: "Chào hỏi", sectionId: "p1-g1" },
  memory: [
    tutor(3, 'You can say: "I am a technology worker".', { playback: "complete" }),
    user(2, "I work in IT"),
    tutor(1, "What do you do?"),
  ],
});
assert.equal(summary.learnerSaid, "I work in IT");
assert.ok(summary.learnerQuotes.includes("I work in IT"));
assert.equal(summary.learnerQuotes.some((q) => /technology worker/i.test(q)), false);
assert.ok(summary.tutorModelQuotes.some((q) => /technology worker/i.test(q)));
assert.ok(summary.evidenceNote);
const empty = learnAiCallSummary({ memory: [tutor(1, script.spoken)], startedAt: 0, endedAt: 5_000, lesson: { title: "Chào hỏi" } });
assert.equal(empty.practiced, false);
assert.equal(empty.learnerSaid, "");
assert.match(empty.evidenceNote, /Chưa có bằng chứng/);
console.log("  [PASS] summary splits learner evidence from tutor models");

console.log("PASS Prompt 1 behavior (simulation, no live call).");
