/**
 * Learn playback acks and replay cache. No gateway, microphone, or production Redis.
 */
import assert from "node:assert/strict";
import {
  LEARN_CALL_AUDIO_CACHE_MAX_BYTES,
  applyLearnPlaybackAck,
  createLearnAudioCache,
  createLearnPlaybackController,
  learnCallPcmBytesForSeconds,
} from "../lib/beego/learn/learn-call-playback.js";

function playUntilServerEnd(playback, bytes) {
  const started = playback.startTurn(7);
  playback.chunk({ playbackId: started.playbackId, generation: started.generation, bytes });
  return started;
}

const buffered = createLearnPlaybackController();
const started = playUntilServerEnd(buffered, 4800);
const early = buffered.serverEnd({ playbackId: started.playbackId, generation: started.generation });
assert.equal(early.ack, null);
assert.equal(early.waiting, true);
assert.equal(buffered.snapshot().pendingBytes > 0, true);

const tiny = createLearnPlaybackController();
const tinyStart = playUntilServerEnd(tiny, 40);
assert.equal(tiny.serverEnd({ playbackId: tinyStart.playbackId }).ack, null);
const tinyFlush = tiny.flushBuffer();
assert.equal(tinyFlush.ack, null);
assert.equal(tinyFlush.waiting, true);
const tinyDone = tiny.sourceEnded({ generation: tiny.snapshot().generation });
assert.equal(tinyDone.ack.playback, "complete");
assert.equal(tiny.sourceEnded({ generation: tiny.snapshot().generation }).ack, null);
assert.equal(tiny.snapshot().ackCount, 1);

const gap = createLearnPlaybackController();
const gapStart = playUntilServerEnd(gap, 4800);
const underrun = gap.sourceEnded({ generation: gapStart.generation });
assert.equal(underrun.ack, null);
assert.equal(underrun.waiting, true);
gap.chunk({ playbackId: gapStart.playbackId, generation: gapStart.generation, bytes: 4800 });
assert.equal(gap.serverEnd({ playbackId: gapStart.playbackId }).waiting, true);
assert.equal(gap.flushBuffer().waiting, true);
assert.equal(gap.sourceEnded({ generation: gapStart.generation }).ack.playback, "complete");

const afterEnd = createLearnPlaybackController();
const afterEndStart = playUntilServerEnd(afterEnd, 4800);
afterEnd.serverEnd({ playbackId: afterEndStart.playbackId });
assert.equal(afterEnd.flushBuffer().waiting, true);
afterEnd.chunk({ playbackId: afterEndStart.playbackId, generation: afterEndStart.generation, bytes: 4800 });
assert.equal(afterEnd.flushBuffer().waiting, true);
const afterEndDone = afterEnd.sourceEnded({ generation: afterEndStart.generation });
assert.equal(afterEndDone.ack.playback, "complete");
assert.equal(afterEnd.snapshot().ackCount, 1);

const once = createLearnPlaybackController();
const onceStart = playUntilServerEnd(once, 200);
once.serverEnd({ playbackId: onceStart.playbackId });
once.flushBuffer();
const firstDone = once.sourceEnded({ generation: once.snapshot().generation });
const secondDone = once.sourceEnded({ generation: once.snapshot().generation });
assert.equal(firstDone.ack.playback, "complete");
assert.equal(secondDone.ack, null);
assert.equal(once.snapshot().ackCount, 1);

const stopped = createLearnPlaybackController();
const stoppedStart = playUntilServerEnd(stopped, 200);
stopped.serverEnd({ playbackId: stoppedStart.playbackId });
stopped.flushBuffer();
const interrupted = stopped.interrupt();
assert.equal(interrupted.ack.playback, "interrupted");
assert.equal(interrupted.ack.kind, "turn");
const ignoredEnd = stopped.sourceEnded({ generation: stoppedStart.generation, fromInterrupt: true });
assert.equal(ignoredEnd.ignored, true);
assert.equal(ignoredEnd.complete, false);
assert.notEqual(stopped.snapshot().origin.playback, "complete");

const late = createLearnPlaybackController();
const lateStart = playUntilServerEnd(late, 200);
late.interrupt();
const dropped = late.chunk({ playbackId: lateStart.playbackId, generation: lateStart.generation, bytes: 80 });
assert.equal(dropped.drop, true);
assert.equal(dropped.ack, null);

const replay = createLearnPlaybackController();
const replayStart = playUntilServerEnd(replay, 200);
replay.serverEnd({ playbackId: replayStart.playbackId });
replay.flushBuffer();
assert.equal(replay.sourceEnded({ generation: replay.snapshot().generation }).ack.playback, "complete");
const cache = createLearnAudioCache({ maxBytes: 300, maxTurns: 2 });
assert.equal(cache.append(7, new Uint8Array(120)), true);
assert.equal(cache.append(8, new Uint8Array(120)), true);
assert.equal(cache.append(9, new Uint8Array(120)), true);
assert.equal(cache.turnCount() <= 2, true);
const cached = cache.replay(cache.turnCount() === 1 ? 9 : 8);
assert.ok(cached);
assert.notEqual(cached.playbackId, cached.requestId);
const replayArm = replay.startReplay(cached);
replay.chunk({ playbackId: replayArm.playbackId, generation: replayArm.generation, bytes: 120 });
replay.serverEnd({ playbackId: replayArm.playbackId });
replay.flushBuffer();
const replayCut = replay.interrupt();
assert.equal(replayCut.ack.kind, "replay");
assert.equal(replayCut.ack.playback, "interrupted");
assert.equal(replay.snapshot().origin.playback, "complete");
cache.clear();
assert.equal(cache.replay(8), null);
const fourSeconds = 192 * 1024;
assert.ok(fourSeconds / learnCallPcmBytesForSeconds(1) < 5);
assert.ok(LEARN_CALL_AUDIO_CACHE_MAX_BYTES >= learnCallPcmBytesForSeconds(20));
const fullSentence = createLearnAudioCache();
const sentence = new Uint8Array(learnCallPcmBytesForSeconds(8));
assert.equal(fullSentence.append(3, sentence), true);
const fullReplay = fullSentence.replay(3);
assert.equal(fullReplay.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0), sentence.byteLength);
const clipped = createLearnAudioCache({ maxBytes: 1000 });
assert.equal(clipped.append(3, new Uint8Array(700)), true);
assert.equal(clipped.append(3, new Uint8Array(700)), false);
assert.equal(clipped.replay(3), null);

const droppedLink = createLearnPlaybackController();
playUntilServerEnd(droppedLink, 200);
const abandoned = droppedLink.disconnect();
assert.equal(abandoned.ack, null);
assert.equal(abandoned.complete, false);
assert.equal(abandoned.origin.playback, "pending");

const timed = createLearnPlaybackController();
const timedStart = playUntilServerEnd(timed, 200);
timed.serverEnd({ playbackId: timedStart.playbackId });
timed.flushBuffer();
const cutoff = timed.timeLimit();
assert.equal(cutoff.ack, null);
assert.equal(cutoff.complete, false);
assert.equal(cutoff.origin.playback, "pending");

const turns = [{ role: "assistant", content: "Hello", requestId: 7, playback: "pending" }];
const sent = { bytes: 4800, ended: true, cancelled: false };
const noProof = applyLearnPlaybackAck(turns, { kind: "turn", playback: "complete", requestId: 7, playbackId: 7 });
assert.equal(noProof.changed, false);
assert.equal(noProof.rejected, true);
const stillSending = applyLearnPlaybackAck(turns, { kind: "turn", playback: "complete", requestId: 7, playbackId: 7 }, { bytes: 4800, ended: false });
assert.equal(stillSending.changed, false);
const cancelledTts = applyLearnPlaybackAck(turns, { kind: "turn", playback: "complete", requestId: 7, playbackId: 7 }, { bytes: 4800, ended: true, cancelled: true });
assert.equal(cancelledTts.changed, false);
const noAudioInterrupt = applyLearnPlaybackAck(turns, { kind: "turn", playback: "interrupted", requestId: 7, playbackId: 7 }, { bytes: 0 });
assert.equal(noAudioInterrupt.changed, false);
const completed = applyLearnPlaybackAck(turns, { kind: "turn", playback: "complete", requestId: 7, playbackId: 7 }, sent);
assert.equal(completed.changed, true);
assert.equal(completed.turns[0].playback, "complete");
const duplicate = applyLearnPlaybackAck(completed.turns, { kind: "turn", playback: "complete", requestId: 7, playbackId: 7 }, sent);
assert.equal(duplicate.changed, false);
const lateCancel = applyLearnPlaybackAck(completed.turns, { kind: "turn", playback: "cancelled", requestId: 7, playbackId: 7 }, sent);
assert.equal(lateCancel.changed, false);
const replayAck = applyLearnPlaybackAck(completed.turns, { kind: "replay", playback: "interrupted", requestId: 7, playbackId: cached.playbackId }, sent);
assert.equal(replayAck.changed, false);
assert.equal(replayAck.turns[0].playback, "complete");
const missing = applyLearnPlaybackAck(completed.turns, { kind: "turn", playback: "complete", requestId: 99, playbackId: 99 }, sent);
assert.equal(missing.changed, false);
assert.equal(missing.turns.length, 1);
const cancelled = applyLearnPlaybackAck(turns, { kind: "turn", playback: "cancelled", requestId: 7, playbackId: 7 }, { bytes: 0 });
assert.equal(cancelled.turns[0].playback, "cancelled");
const interruptedAck = applyLearnPlaybackAck(turns, { kind: "turn", playback: "interrupted", requestId: 7, playbackId: 7 }, { bytes: 9600, ended: false });
assert.equal(interruptedAck.turns[0].playback, "interrupted");

console.log(JSON.stringify({
  bufferedAtServerEnd: true,
  completeNeedsServerProof: noProof.rejected === true && !stillSending.changed && !cancelledTts.changed,
  cancelVsInterrupt: `${cancelled.turns[0].playback}/${interruptedAck.turns[0].playback}`,
  tinyChunkCompletedOnce: tiny.snapshot().ackCount === 1,
  interruptNotComplete: stopped.snapshot().origin.playback === "interrupted",
  lateChunkDropped: dropped.drop,
  replayKeepsOrigin: replay.snapshot().origin.playback === "complete",
  disconnectUnconfirmed: abandoned.origin.playback === "pending",
  timeLimitUnconfirmed: cutoff.origin.playback === "pending",
}));
