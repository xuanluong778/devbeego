/**
 * Learn push-to-talk controller. No browser, microphone, or production gateway.
 */
import assert from "node:assert/strict";
import { createLearnTalkController, createLearnUtterance, learnCallRemainingView } from "../lib/beego/learn/learn-call-talk.js";

const talk = createLearnTalkController();
assert.equal(talk.hello({ azure: true }).action, "wait_for_press");
assert.equal(talk.snapshot().phase, "ready");

const arm = talk.press();
assert.equal(arm.action, "arm_listen");
const repeat = talk.press();
assert.equal(repeat.ignored, true);
const media = talk.mediaReady({ generation: arm.generation, running: true });
assert.equal(media.phase, "listening");
assert.equal(media.allowsPcm, true);
assert.equal(talk.notePcm(320), true);

const submit = talk.press();
assert.equal(submit.action, "submit");
assert.equal(submit.phase, "transcribing");
assert.equal(talk.snapshot().allowsPcm, false);
assert.equal(talk.notePcm(160), false);
assert.equal(talk.press().ignored, true);

const utterance = createLearnUtterance(submit.requestId);
assert.equal(utterance.addSegment("Hello").accepted, true);
assert.equal(utterance.addSegment("my name is Beego").accepted, true);
assert.equal(utterance.addSegment("  ").empty, true);
const finished = utterance.finish();
assert.equal(finished.queued, true);
assert.equal(finished.text, "Hello my name is Beego");
assert.equal(utterance.finish().duplicate, true);
const reply = talk.noteFinal(finished.text);
assert.equal(reply.action, "one_reply");
assert.equal(reply.phase, "thinking");
assert.equal(talk.noteFinal("second answer").ignored, true);

talk.noteSpeaking();
assert.equal(talk.snapshot().phase, "speaking");
const cut = talk.press();
assert.equal(cut.action, "interrupt_listen");
assert.equal(talk.press().ignored, true);
talk.exit();
const late = talk.mediaReady({ generation: cut.generation, running: true });
assert.equal(late.stale, true);
assert.equal(late.action, "drop_media");

const emptyTalk = createLearnTalkController();
emptyTalk.hello({ azure: true });
const emptyArm = emptyTalk.press();
emptyTalk.mediaReady({ generation: emptyArm.generation, running: true });
assert.equal(emptyTalk.press().action, "empty_audio");
const silent = createLearnUtterance(1);
assert.equal(silent.finish().queued, false);
assert.equal(silent.finish().text, "");

const denied = createLearnTalkController();
denied.hello({ azure: true });
const deniedArm = denied.press();
assert.equal(denied.mediaReady({ generation: deniedArm.generation, running: false }).action, "mic_unavailable");

const timeoutTalk = createLearnTalkController();
timeoutTalk.hello({ azure: true });
const timeoutArm = timeoutTalk.press();
timeoutTalk.mediaReady({ generation: timeoutArm.generation, running: true });
timeoutTalk.notePcm(10);
assert.equal(timeoutTalk.press().phase, "transcribing");
assert.equal(timeoutTalk.noteTimeout().action, "timeout");
assert.equal(timeoutTalk.snapshot().phase, "ready");

const resumed = createLearnTalkController();
resumed.hello({ azure: true, requestId: 5 });
assert.equal(resumed.press().requestId, 6);
const fresh = createLearnTalkController();
fresh.hello({ azure: true, requestId: 1 });
assert.equal(fresh.press().requestId, 2);

const noBrowser = createLearnTalkController();
assert.equal(noBrowser.hello({ azure: false }).action, "azure_required");

const startedAt = 1_000_000;
const deadlineAt = startedAt + 120_000;
const firstView = learnCallRemainingView({ startedAt, deadlineAt, now: startedAt + 10_000 });
const reconnectView = learnCallRemainingView({ startedAt, deadlineAt, now: startedAt + 40_000 });
assert.equal(firstView.deadlineAt, deadlineAt);
assert.equal(reconnectView.deadlineAt, firstView.deadlineAt);
assert.equal(firstView.label, "01:50");
assert.ok(reconnectView.remainingMs < firstView.remainingMs);
assert.equal(learnCallRemainingView({}).label, "--:--");

console.log(JSON.stringify({
  oneReply: reply.action === "one_reply",
  joinedSegments: finished.text,
  emptyQueued: silent.finish().queued,
  rapidIgnored: repeat.ignored,
  lateMediaDropped: late.stale,
  timeoutReady: timeoutTalk.snapshot().phase === "ready",
}));
