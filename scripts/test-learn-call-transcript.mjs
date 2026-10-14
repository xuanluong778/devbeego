/**
 * Learn Call CC transcript reducer. No browser, gateway, or production Redis.
 */
import assert from "node:assert/strict";
import {
  applyTranscriptEvent,
  createTranscript,
  learnTranscriptSnapshot,
  transcriptCaption,
  transcriptHasClosing,
  transcriptLastTutor,
  transcriptMaxRequestId,
} from "../lib/beego/learn/learn-call-transcript.js";

const run = (events, start = createTranscript()) => events.reduce((state, event) => applyTranscriptEvent(state, event), start);

const greeting = run([
  { type: "ai_stream", requestId: 1, token: "Hello" },
  { type: "ai_stream", requestId: 1, token: " there", speculative: true },
  { type: "ai_stream", requestId: 1, token: "!" },
]);
assert.equal(greeting.turns.length, 1);
assert.equal(greeting.turns[0].text, "Hello!");
assert.equal(greeting.turns[0].final, false);

const done = run([{ type: "ai_done", requestId: 1, text: "Hello! What is your name?" }], greeting);
assert.equal(done.turns[0].text, "Hello! What is your name?");
assert.equal(done.turns[0].final, true);
const lateToken = run([{ type: "ai_stream", requestId: 1, token: "extra" }], done);
assert.equal(lateToken.turns[0].text, "Hello! What is your name?");

const user = run([
  { type: "partial_transcript", requestId: 2, text: "my name" },
  { type: "partial_transcript", requestId: 2, text: "my name is Lan" },
], done);
assert.equal(user.turns.length, 2);
assert.equal(user.turns[1].final, false);
assert.equal(transcriptCaption(user), "my name is Lan");

const finalUser = run([
  { type: "final_transcript", requestId: 2, text: "My name is Lan." },
  { type: "final_transcript", requestId: 2, text: "My name is Lan." },
  { type: "partial_transcript", requestId: 2, text: "late partial" },
], user);
assert.equal(finalUser.turns.length, 2);
assert.equal(finalUser.turns[1].text, "My name is Lan.");
assert.equal(finalUser.turns[1].final, true);

const reply = run([
  { type: "ai_stream", requestId: 2, token: "Nice" },
  { type: "ai_done", requestId: 2, text: "Nice to meet you, Lan." },
  { type: "ai_done", requestId: 2, text: "Nice to meet you, Lan." },
], finalUser);
assert.equal(reply.turns.length, 3);
assert.deepEqual(reply.turns.map((turn) => turn.key), ["t:1", "u:2", "t:2"]);
assert.equal(transcriptCaption(reply), "Nice to meet you, Lan.");
assert.equal(transcriptCaption(reply, 2), "Nice to meet you, Lan.");
assert.equal(transcriptCaption(reply, 3), "");
assert.equal(transcriptCaption(finalUser, 2), "My name is Lan.");

const empty = run([
  { type: "partial_transcript", requestId: 3, text: "um" },
  { type: "final_transcript", requestId: 3, text: "   " },
], reply);
assert.equal(empty.turns.length, 3);

const played = run([
  { type: "playback", requestId: 1, kind: "turn", playback: "complete" },
  { type: "playback", requestId: 2, kind: "turn", playback: "interrupted" },
  { type: "playback", requestId: 2, kind: "turn", playback: "complete" },
], reply);
assert.equal(played.turns[0].playback, "complete");
assert.equal(played.turns[2].playback, "interrupted");

const replayed = run([
  { type: "playback", requestId: 1, kind: "replay", playback: "interrupted" },
  { type: "playback", requestId: 1, kind: "replay", playback: "complete" },
], played);
assert.equal(replayed.turns.length, 3);
assert.equal(replayed.turns[0].playback, "complete");
assert.equal(transcriptLastTutor(replayed).requestId, 2);

const memoryNewestFirst = [
  { role: "assistant", content: "Nice to meet you, Lan.", requestId: 2, playback: "pending" },
  { role: "user", content: "My name is Lan.", requestId: 2 },
  { role: "assistant", content: "Hello! What is your name?", requestId: 1, playback: "complete" },
  { role: "user", content: "legacy without id" },
];
const snapshot = learnTranscriptSnapshot(memoryNewestFirst);
assert.equal(snapshot.length, 3);
assert.deepEqual(snapshot.map((turn) => `${turn.role}:${turn.requestId}`), ["tutor:1", "user:2", "tutor:2"]);

const local = run([
  { type: "ai_done", requestId: 2, text: "Nice to meet you, Lan." },
  { type: "playback", requestId: 2, kind: "turn", playback: "interrupted" },
  { type: "partial_transcript", requestId: 3, text: "I like" },
]);
const hydrated = applyTranscriptEvent(local, { type: "hydrate", turns: snapshot });
assert.deepEqual(hydrated.turns.map((turn) => turn.key), ["t:1", "u:2", "t:2", "u:3"]);
assert.equal(hydrated.turns[2].playback, "interrupted");
assert.equal(hydrated.turns[0].playback, "complete");
const hydratedTwice = applyTranscriptEvent(hydrated, { type: "hydrate", turns: snapshot });
assert.equal(hydratedTwice.turns.length, 4);
assert.equal(transcriptMaxRequestId(hydratedTwice), 3);

const cut = run([
  { type: "ai_done", requestId: 5, text: "What do you drink?" },
  { type: "playback", requestId: 5, kind: "turn", playback: "cancelled" },
  { type: "playback", requestId: 5, kind: "turn", playback: "interrupted" },
  { type: "ai_done", requestId: 6, text: "Bye, Lan!", closing: true },
  { type: "ai_done", requestId: 6, text: "Bye, Lan!" },
]);
assert.equal(cut.turns[0].playback, "cancelled", "cancel before playback stays cancelled");
assert.equal(cut.turns[1].closing, true, "closing flag survives a repeated ai_done");
assert.equal(transcriptHasClosing(cut), true);
assert.equal(transcriptHasClosing(reply), false);
const cutHydrated = applyTranscriptEvent(createTranscript(), {
  type: "hydrate",
  turns: learnTranscriptSnapshot([
    { role: "assistant", content: "Bye, Lan!", requestId: 6, playback: "complete", closing: true },
    { role: "assistant", content: "What do you drink?", requestId: 5, playback: "cancelled" },
  ]),
});
assert.deepEqual(cutHydrated.turns.map((t) => `${t.key}:${t.playback}:${t.closing}`), ["t:5:cancelled:false", "t:6:complete:true"]);
const serverWins = applyTranscriptEvent(run([{ type: "ai_done", requestId: 5, text: "What do you drink?" }]), {
  type: "hydrate",
  turns: [{ role: "tutor", requestId: 5, text: "What do you drink?", playback: "cancelled" }],
});
assert.equal(serverWins.turns[0].playback, "cancelled");

const hostile = run([{ type: "ai_done", requestId: 4, text: "<img src=x onerror=alert(1)>" }]);
assert.equal(hostile.turns[0].text, "<img src=x onerror=alert(1)>");

console.log(JSON.stringify({
  speculativeIgnored: greeting.turns[0].text === "Hello!",
  duplicateFinalOnce: finalUser.turns.length === 2,
  orderedKeys: reply.turns.map((turn) => turn.key).join(","),
  replayAddsNoTurn: replayed.turns.length === 3,
  hydrateIdempotent: hydratedTwice.turns.length === 4,
}));
