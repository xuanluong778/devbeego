import assert from "node:assert/strict";
import { createRealtimeCallLifecycle, realtimeCallClock, syncRealtimeCallClock, REALTIME_GOODBYE } from "../lib/beego/learn/learn-call-realtime-lifecycle.js";
import { learnCallRemainingView } from "../lib/beego/learn/learn-call-talk.js";
import { mapRealtimeEvent } from "../lib/beego/learn/learn-call-realtime.js";
import { createRealtimeTranscriptAdapter, dispatchRealtimeTranscriptEvent } from "../lib/beego/learn/learn-call-realtime-transcript.js";
import { applyTranscriptEvent, createTranscript } from "../lib/beego/learn/learn-call-transcript.js";

const start = 1_000_000;
const clock = { startedAt: start, deadlineAt: start + 120_000, serverNow: start };
const sent = effects => effects.filter(e => e.type === "send").map(e => e.event);
const responses = effects => sent(effects).filter(e => e.type === "response.create");
const life = () => { const value = createRealtimeCallLifecycle(); value.setClock(clock, start); return value; };

// Canonical timestamps survive server/client clock skew and heartbeat refreshes.
assert.deepEqual(realtimeCallClock({ createdAt: start, deadlineAt: clock.deadlineAt }, start), clock);
const shifted = syncRealtimeCallClock({ ...clock, serverNow: start + 30_000 }, 5_000);
assert.equal(learnCallRemainingView({ ...shifted, now: 5_000 }).label, "01:30");
assert.equal(learnCallRemainingView({ ...shifted, now: 35_000 }).label, "01:00");
assert.equal(learnCallRemainingView({ ...shifted, now: shifted.deadlineAt }).label, "00:00");
const refreshed = syncRealtimeCallClock({ ...clock, serverNow: start + 40_000 }, 16_000, shifted);
assert.equal(refreshed.deadlineAt, shifted.deadlineAt, "Heartbeat latency never extends the session");
assert.equal(syncRealtimeCallClock(null, start, shifted), shifted);
assert.equal(realtimeCallClock({ createdAt: 0, deadlineAt: 1 }), null);

// Idle calls say goodbye once, before the cap, using the existing voice stream.
const idle = life();
assert.deepEqual(idle.tick(start + 107_000), []);
const closing = idle.tick(start + 108_000);
assert.equal(idle.closing, true);
assert.equal(responses(closing).length, 1);
assert.match(responses(closing)[0].response.instructions, /Goodbye, see you later!/);
assert.equal(responses(closing)[0].response.metadata.beego_closing, "1");
assert.equal(sent(closing)[0].session.audio.input.turn_detection, null);
assert.equal(responses(idle.tick(start + 109_000)).length, 0);
assert.equal(idle.clock.deadlineAt, clock.deadlineAt);

// Finish only after the farewell audio drains, never at response.done or an old stop.
const mapped = raw => mapRealtimeEvent(raw);
idle.observe(mapped({ type: "response.created", response: { id: "bye", metadata: { beego_closing: "1" } } }), start + 109_000);
idle.observe(mapped({ type: "output_audio_buffer.started", response_id: "bye" }), start + 109_500);
assert.equal(idle.observe(mapped({ type: "response.done", response: { id: "bye", status: "completed" } }), start + 110_000).some(e => e.type === "end"), false);
assert.equal(idle.observe(mapped({ type: "output_audio_buffer.stopped", response_id: "old" }), start + 110_500).some(e => e.type === "end"), false);
assert.equal(idle.observe(mapped({ type: "output_audio_buffer.stopped", response_id: "bye" }), start + 112_000)[0].reason, "lesson_complete");
assert.deepEqual(idle.tick(start + 120_000), [], "Closure is idempotent");

// Allow a normal sentence to finish before sign-off when enough time remains.
const flowing = life();
flowing.observe({ type: "assistant_turn_started", responseId: "normal" }, start + 100_000);
flowing.observe({ type: "assistant_audio_started", responseId: "normal" }, start + 101_000);
assert.equal(responses(flowing.tick(start + 108_000)).length, 0);
assert.equal(sent(flowing.tick(start + 109_000)).some(e => e.type === "response.cancel"), false);
flowing.observe({ type: "assistant_turn_done", responseId: "normal", status: "completed" }, start + 109_500);
assert.equal(responses(flowing.observe({ type: "assistant_audio_stopped", responseId: "normal" }, start + 110_000)).length, 1);

// A long generation is cancelled once, then sign-off waits for its cancellation.
const long = life();
long.observe({ type: "assistant_turn_started", responseId: "long" }, start + 100_000);
long.observe({ type: "assistant_audio_started", responseId: "long" }, start + 101_000);
long.tick(start + 108_000);
const forced = long.tick(start + 112_000);
assert.deepEqual(sent(forced).map(e => e.type), ["response.cancel", "output_audio_buffer.clear"]);
assert.deepEqual(long.tick(start + 112_100), []);
assert.equal(responses(long.observe({ type: "assistant_audio_cleared", responseId: "long" }, start + 112_200)).length, 0);
assert.equal(responses(long.observe({ type: "assistant_turn_done", responseId: "long", status: "cancelled" }, start + 112_300)).length, 1);

// Network/provider stalls and short package allowances still have a hard end.
const stalled = life();
stalled.tick(start + 108_000);
assert.equal(stalled.tick(start + 120_000)[0].reason, "time_limit");
const short = createRealtimeCallLifecycle();
short.setClock({ startedAt: start, deadlineAt: start + 5_000, serverNow: start }, start);
assert.equal(responses(short.tick(start)).length, 1);
assert.equal(short.tick(start + 5_000)[0].type, "end");
const manual = life();
assert.equal(responses(manual.endGracefully(start + 30_000)).length, 1);
assert.equal(responses(manual.endGracefully(start + 31_000)).length, 0);
assert.equal(manual.tick(start + 38_000)[0].type, "end");
const cancelled = life(); cancelled.stop();
assert.deepEqual(cancelled.tick(start + 120_000), []);

// The goodbye is a real tutor transcript, tagged closing, without TTS synthesis.
const adapter = createRealtimeTranscriptAdapter();
let transcript = createTranscript();
for (const event of [
  { type: "response.created", response: { id: "bye", metadata: { beego_closing: "1" } } },
  { type: "response.output_audio_transcript.delta", response_id: "bye", item_id: "bye-item", delta: "Great work today!" },
  { type: "response.output_audio_transcript.done", response_id: "bye", item_id: "bye-item", transcript: REALTIME_GOODBYE },
  { type: "response.done", response: { id: "bye", status: "completed" } },
]) dispatchRealtimeTranscriptEvent(adapter, mapped(event), { onTranscriptEvent(event) { transcript = applyTranscriptEvent(transcript, event); } });
assert.equal(transcript.turns[0].closing, true);
assert.equal(transcript.turns[0].text, REALTIME_GOODBYE);
assert.equal(transcript.turns[0].playback, "pending");
console.log("PASS Realtime clock/skew/heartbeat, countdown, graceful sign-off, audio-drain proof, long-turn cancellation, manual end, short quota and hard deadline (mock).");
