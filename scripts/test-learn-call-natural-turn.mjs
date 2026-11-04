import assert from "node:assert/strict";
import { createLearnCallPolicy, planLearnCallPolicy } from "../lib/beego/learn/learn-call-policy.js";
import { learnCallSttDecision, learnCallSttTranscription } from "../lib/beego/learn/learn-call-realtime.js";
import { createRealtimeTurnCoordinator } from "../lib/beego/learn/learn-call-realtime-turns.js";
import { learnCallShownCaption } from "../lib/beego/learn/learn-call-transcript.js";

const topicCtx = { topic: "Chào hỏi", title: "Chào hỏi", sectionId: "p1-g1", sessionMode: "open", teacherName: "Beego" };

function policy(intent, question, extra = {}) {
  const state = createLearnCallPolicy({
    sessionId: "natural-neighbor",
    topicCtx: { ...topicCtx, selection: { id: "neighbor", context: "meeting a new neighbor", targetId: "name", spoken: "Hi! I'm your new neighbor. What's your name?" } },
    ...extra,
  });
  state.selection = { ...(state.selection || {}), id: "neighbor", context: "meeting a new neighbor" };
  state.pending = { intent, targetId: intent, question };
  state.asked = [intent];
  state.askedMeanings = [intent === "home_enjoy" ? "home_enjoy" : intent === "job_enjoy" ? "job_enjoy" : intent];
  return state;
}

let count = 0;
function check(name, fn) {
  fn();
  count += 1;
  console.log(`PASS ${name}`);
}

check("meaning question explains the name prompt and asks it once", () => {
  const first = planLearnCallPolicy(policy("name", "What's your name?"), { eventId: "mean-1", text: "Câu này nói về gì?" });
  assert.equal(first.decision.action, "support");
  assert.match(first.decision.spoken, /Câu này hỏi tên bạn/);
  assert.match(first.decision.spoken, /What's your name\?/);
  assert.equal(first.state.answered.includes("name"), false);
  const second = planLearnCallPolicy(first.state, { eventId: "mean-2", text: "Câu này nói về gì?" });
  assert.equal(second.state.answered.includes("name"), false);
  assert.notEqual(second.state.pending?.targetId, "name");
});

check("Yes answers a yes/no question and does not answer a name question", () => {
  const name = planLearnCallPolicy(policy("name", "What's your name?"), { eventId: "yes-name", text: "Yes" });
  assert.equal(name.state.answered.includes("name"), false);
  assert.equal(name.state.facts.name, undefined);
  assert.match(name.decision.spoken, /What's your name\?/);
  const nearby = planLearnCallPolicy(policy("home", "Do you live nearby?"), { eventId: "yes-home", text: "Yes!" });
  assert.equal(nearby.decision.action, "advance");
  assert.equal(nearby.state.answered.includes("home"), true);
  assert.equal(nearby.state.pending.intent, "home_enjoy");
});

check("Where are you from is answered in role, then the conversation continues", () => {
  const turn = planLearnCallPolicy(policy("home", "Do you live nearby?"), { eventId: "from-1", text: "Where are you from?" });
  assert.match(turn.decision.spoken, /I live near here/);
  assert.match(turn.decision.spoken, /Do you live nearby\?/);
  assert.equal(turn.state.answered.includes("home"), false);
  assert.notEqual(turn.state.pending?.intent, "home_enjoy");
  assert.equal((turn.decision.spoken.match(/\?/g) || []).length, 1);
});

check("a place after a work question does not assume a job", () => {
  const turn = planLearnCallPolicy(policy("job", "Do you work or study?"), { eventId: "place-job", text: "I like living in Ojimae City." });
  assert.equal(turn.state.answered.includes("job"), false);
  assert.equal(turn.state.facts.job, undefined);
  assert.doesNotMatch(turn.decision.spoken, /your work/i);
  assert.equal((turn.decision.spoken.match(/\?/g) || []).length, 1);
});

check("M350NU is not stored as an age; one confirmation then skip", () => {
  const first = planLearnCallPolicy(policy("age", "May I ask your age?"), { eventId: "noise-age", text: "M350NU" });
  assert.equal(first.decision.action, "confirm_personal");
  assert.equal(first.state.facts.age, undefined);
  assert.match(first.decision.spoken, /confirm your age/i);
  assert.doesNotMatch(first.decision.spoken, /350/);
  const second = planLearnCallPolicy(first.state, { eventId: "noise-age-2", text: "M350NU" });
  assert.equal(second.decision.action, "advance");
  assert.equal(second.state.facts.age, undefined);
  assert.equal(second.state.answered.includes("age"), false);
  assert.doesNotMatch(second.decision.spoken, /350|years old/i);
});

check("a correction replaces the reported name without echoing it", () => {
  const named = planLearnCallPolicy(policy("name", "What's your name?"), { eventId: "name-mai", text: "My name is Mai" });
  const fixed = planLearnCallPolicy(named.state, { eventId: "name-linh", text: "No, my name is Linh" });
  assert.equal(fixed.state.facts.name.value, "Linh");
  assert.doesNotMatch(fixed.decision.spoken, /Mai|Linh/);
});

check("skip, one pronunciation try, and a repeated event do not replay", () => {
  const skipped = planLearnCallPolicy(policy("job", "What do you do?"), { eventId: "skip-now", text: "Bỏ qua" });
  assert.equal(skipped.decision.action, "advance");
  assert.notEqual(skipped.state.pending?.targetId, "job");
  const practice = planLearnCallPolicy(policy("job", "What do you do?"), { eventId: "practice", text: "Help me practise" });
  assert.equal(practice.decision.action, "practice_once");
  const again = planLearnCallPolicy(practice.state, { eventId: "practice-2", text: "Help me practise again" });
  assert.notEqual(again.decision.action, "practice_once");
  const dup = planLearnCallPolicy(practice.state, { eventId: "practice", text: "Help me practise" });
  assert.equal(dup.duplicate, true);
});

check("same-meaning age questions are not both asked", () => {
  const state = policy("greeting", "How are you?");
  state.askedMeanings = ["greeting", "age"];
  state.asked = ["greeting", "age"];
  state.answered = ["greeting"];
  const turn = planLearnCallPolicy(state, { eventId: "greet-ok", text: "I'm fine." });
  assert.notEqual(turn.decision.nextTargetId, "age");
  assert.doesNotMatch(turn.decision.spoken, /how old|your age/i);
});

check("closing is not spoken again for a later event", () => {
  const closed = planLearnCallPolicy(policy("greeting", "Are you having a good day?"), { eventId: "stop-now", text: "stop" });
  assert.equal(closed.decision.action, "closing");
  const extra = planLearnCallPolicy(closed.state, { eventId: "after-close", text: "Hello again" });
  assert.equal(extra.decision.action, "ignore");
  assert.equal(extra.decision.spoken, "");
});

check("learner hold does not cover the robot caption", () => {
  const shown = learnCallShownCaption(
    { role: "tutor", text: "Do you live nearby?", label: "ROBOT BEEGO", pending: false },
    { text: "", until: 0, requestId: 0 },
    1000,
    2500,
    { text: "Where are you from?", requestId: 4, role: "user" },
  );
  assert.equal(shown.view.role, "tutor");
  assert.equal(shown.view.text, "Do you live nearby?");
  assert.equal(shown.learner.text, "Where are you from?");
  assert.equal(shown.learner.role, "user");
});

check("STT stays in English when the place or language signal disagrees", () => {
  const current = learnCallSttTranscription();
  const odd = learnCallSttDecision({
    current,
    proposed: { model: "whisper-1", language: "vi" },
    itemId: "item-a",
    audioItemId: "item-b",
    transcript: "M350NU",
    finalTranscript: "I live in Hanoi",
  });
  assert.equal(odd.changed, false);
  assert.equal(odd.transcription.language, "en");
  const agreed = learnCallSttDecision({
    current,
    proposed: { model: "whisper-1", language: "en" },
    itemId: "item-a",
    audioItemId: "item-a",
    transcript: "I live in Hanoi.",
    finalTranscript: "I live in Hanoi.",
  });
  assert.equal(agreed.transcription.language, "en");
  assert.equal(agreed.changed, false);
});

check("bye ends the call instead of asking another question", () => {
  const turn = planLearnCallPolicy(policy("home_enjoy", "Do you like living there?"), { eventId: "bye-guys", text: "Bye guys." });
  assert.equal(turn.decision.action, "closing");
  assert.equal(turn.state.pending, null);
  assert.doesNotMatch(turn.decision.spoken, /\?/);
});

check("an off-topic sentence does not jump to a new question", () => {
  const turn = planLearnCallPolicy(policy("age", "How old are you?"), { eventId: "wet", text: "It's wet." });
  assert.equal(turn.decision.action, "support");
  assert.match(turn.decision.spoken, /How old are you\?/);
  assert.equal(turn.state.answered.includes("age"), false);
  assert.equal(turn.state.facts.age, undefined);
});

check("a foreign-script transcript is not an answer", () => {
  const turn = planLearnCallPolicy(policy("home", "Where do you live?"), { eventId: "thai", text: "อารียะของริมยดี" });
  assert.equal(turn.decision.action, "support");
  assert.match(turn.decision.spoken, /Could you say that again\?/);
  assert.equal(turn.state.answered.includes("home"), false);
});

check("the call stops after four questions instead of repeating the bank", () => {
  let state = policy("greeting", "How are you?");
  state.asked = ["greeting", "name", "job", "job_enjoy"];
  const turn = planLearnCallPolicy(state, { eventId: "enough", text: "I'm fine." });
  assert.equal(turn.decision.action, "closing");
  assert.equal(turn.state.pending, null);
  assert.doesNotMatch(turn.decision.spoken, /where do you live|how old|for fun/i);
});

const sent = [];
let calls = 0;
const coordinator = createRealtimeTurnCoordinator({
  requestTurn: async () => {
    calls += 1;
    return calls === 1
      ? { duplicate: true, decision: { action: "closing", spoken: "Thank you for talking with me. See you next time!" } }
      : { duplicate: false, decision: { action: "ignore", spoken: "" } };
  },
  sendEvent: (event) => { sent.push(event); return true; },
});
coordinator.connect("natural-neighbor");
await coordinator.observe({ type: "user_transcript_final", itemId: "dup-close", text: "I'm fine." });
await coordinator.observe({ type: "user_transcript_final", itemId: "dup-close-2", text: "Hello again" });
assert.equal(sent.length, 0);
count += 1;
console.log("PASS coordinator does not replay a duplicate or empty closing");

console.log(`PASS ${count} natural-turn checks`);
