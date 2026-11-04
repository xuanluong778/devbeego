import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mapRealtimeEvent } from "../lib/beego/learn/learn-call-realtime.js";
import { createRealtimeTranscriptAdapter, dispatchRealtimeTranscriptEvent } from "../lib/beego/learn/learn-call-realtime-transcript.js";
import { applyTranscriptEvent, createTranscript, learnCallCaptionView, learnCallLearnerBeforeTutor, learnCallShownCaption } from "../lib/beego/learn/learn-call-transcript.js";
import { createLearnTalkController } from "../lib/beego/learn/learn-call-talk.js";

function session() {
  const adapter = createRealtimeTranscriptAdapter();
  let state = createTranscript();
  let target;
  const notices = [];
  const forwarded = [];
  return {
    get state() { return state; },
    get notices() { return notices; },
    get forwarded() { return forwarded; },
    send(raw) {
      return dispatchRealtimeTranscriptEvent(adapter, mapRealtimeEvent(raw), {
        onTranscriptEvent(event) { forwarded.push(event); state = applyTranscriptEvent(state, event); },
        onCaptionChange(value) { target = value; },
        onNotice(message) { notices.push(message); },
      });
    },
    view(captionsOn = true) { return learnCallCaptionView(state, { realtime: true, target, captionsOn, tutorName: "MS LINH" }); },
  };
}

const response = (s, id) => s.send({ type: "response.created", response: { id } });
const speech = (s, id) => s.send({ type: "input_audio_buffer.speech_started", item_id: id });
const delta = (s, id, text, extra = {}) => s.send({ type: "response.output_audio_transcript.delta", response_id: id, item_id: `${id}-item`, output_index: 0, content_index: 0, delta: text, ...extra });
const final = (s, id, text, extra = {}) => s.send({ type: "response.output_audio_transcript.done", response_id: id, item_id: `${id}-item`, output_index: 0, content_index: 0, transcript: text, ...extra });
const userFinal = (s, id, text) => s.send({ type: "conversation.item.input_audio_transcription.completed", item_id: id, content_index: 0, transcript: text });
const done = (s, id, extra = {}) => s.send({ type: "response.done", response: { id, status: "completed", ...extra } });

export function runRealtimeTranscriptTests() {
  // 1. Exercise the same callback dispatch path used by useRealtimeTutor.
  const live = session();
  response(live, "r1");
  delta(live, "r1", "Hello", { event_id: "delta-1" });
  assert.equal(live.view().text, "Hello");
  delta(live, "r1", " there");
  assert.equal(live.view().text, "Hello there");
  const ids = live.forwarded.filter(e => e.type === "ai_stream").map(e => e.requestId);
  assert.equal(new Set(ids).size, 1, "All deltas share a valid stable turn");
  assert.ok(ids[0] > 0);
  assert.equal(live.forwarded.find(e => e.type === "ai_stream").eventId, "delta-1");
  final(live, "r1", "Hello there!");
  assert.equal(live.view().text, "Hello there!");
  assert.equal(live.view().label, "MS LINH");
  done(live, "r1");
  assert.equal(live.state.turns[0].playback, "pending", "Generation completion never proves audio playback completion");
  live.send({ type: "output_audio_buffer.stopped", response_id: "r1" });
  assert.equal(live.state.turns[0].playback, "complete");

  // 2. A learner final has a real identity and the correct caption label.
  const learner = session();
  speech(learner, "u1");
  userFinal(learner, "u1", "My name is Lan.");
  userFinal(learner, "u1", "My name is Lan.");
  assert.deepEqual(learner.view(), { text: "My name is Lan.", role: "user", label: "BẠN", visible: true, pending: false });
  assert.equal(learner.state.turns.length, 1);
  const committed = session();
  committed.send({ type: "input_audio_buffer.committed", item_id: "committed", previous_item_id: null });
  committed.send({ type: "conversation.item.input_audio_transcription.delta", item_id: "committed", delta: "My " });
  committed.send({ type: "conversation.item.input_audio_transcription.delta", item_id: "committed", delta: "name" });
  assert.equal(committed.view().text, "My name");
  userFinal(committed, "committed", "My name is Lan.");
  assert.equal(committed.view().label, "BẠN");

  // Video reproduction: manual commit has no VAD start; the old opening must not label learner speech.
  const manual = session();
  response(manual, "opening");
  final(manual, "opening", "Hi! What's your name?");
  done(manual, "opening");
  const commit = manual.send({ type: "input_audio_buffer.committed", item_id: "manual-input", previous_item_id: "opening-item" });
  assert.equal(commit.caption.role, "user", "Commit alone reserves and selects the learner turn");
  assert.ok(commit.caption.requestId > 0);
  assert.equal(manual.view().text, "", "Do not show old tutor speech while waiting for the learner transcript");
  assert.equal(learnCallCaptionView(manual.state, { realtime: true, target: commit.caption, pendingCaption: "Đang nhận dạng…" }).text, "Đang nhận dạng…");
  assert.equal(learnCallCaptionView(manual.state, { realtime: true, target: commit.caption, pendingCaption: "Đang nghe…", openingText: "Hi! What's your name?" }).text, "Đang nghe…");
  assert.equal(manual.view().label, "BẠN");
  userFinal(manual, "manual-input", "Technology");
  assert.equal(manual.view().text, "Technology");
  assert.equal(manual.state.turns.at(-1).role, "user");
  const openingText = "Hi! I'm your new neighbor. What's your name?";
  assert.equal(learnCallCaptionView(createTranscript(), { realtime: true, target: { requestId: 0, role: "tutor" }, openingText }).text, openingText);
  assert.equal(learnCallCaptionView(createTranscript(), { realtime: true, target: { requestId: 1, role: "user" }, openingText }).text, "");
  assert.equal(learnCallCaptionView(createTranscript(), { realtime: true, target: { requestId: 0, role: "tutor" }, openingText, captionsOn: false }).text, "");

  // 3. Input identity is reserved before asynchronously delivered transcripts.
  const late = session();
  speech(late, "u1");
  late.send({ type: "input_audio_buffer.committed", item_id: "u1", previous_item_id: null });
  response(late, "a1");
  delta(late, "a1", "Nice to meet you.");
  userFinal(late, "u1", "I'm Lan.");
  assert.deepEqual(late.state.turns.map(t => t.text), ["I'm Lan.", "Nice to meet you."]);
  assert.equal(late.view().text, "Nice to meet you.", "Late user final cannot steal AI caption");
  speech(late, "u2");
  response(late, "a2");
  delta(late, "a2", "How are you?");
  userFinal(late, "u1", "I'm Lan.");
  userFinal(late, "u2", "Hello!");
  assert.deepEqual(late.state.turns.map(t => t.text), ["I'm Lan.", "Nice to meet you.", "Hello!", "How are you?"]);
  assert.equal(late.view().text, "How are you?");

  // 4. Finals, aliases, fallback response output and omitted transcript.
  const fallback = session();
  response(fallback, "f1");
  delta(fallback, "f1", "Partial");
  done(fallback, "f1", { output: [{ id: "f1-item", content: [{ type: "audio", transcript: "Full sentence." }] }] });
  assert.equal(fallback.view().text, "Full sentence.");
  done(fallback, "f1");
  assert.equal(fallback.view().text, "Full sentence.");
  const legacy = session();
  response(legacy, "legacy");
  delta(legacy, "legacy", "Old", { type: "response.audio_transcript.delta" });
  final(legacy, "legacy", "Old event supported.", { type: "response.audio_transcript.done" });
  assert.equal(legacy.view().text, "Old event supported.");
  const noFinalText = session();
  response(noFinalText, "n1");
  delta(noFinalText, "n1", "Keep this");
  done(noFinalText, "n1");
  assert.equal(noFinalText.view().text, "Keep this");
  assert.equal(noFinalText.state.turns[0].final, true);

  // 5. Re-delivery, empty finals and post-final deltas cannot duplicate or erase.
  const duplicate = session();
  response(duplicate, "d1");
  delta(duplicate, "d1", "   ");
  assert.equal(duplicate.state.turns.length, 0, "Whitespace-only delta creates no bubble");
  delta(duplicate, "d1", "Hello", { event_id: "same-delta" });
  delta(duplicate, "d1", "Hello", { event_id: "same-delta" });
  final(duplicate, "d1", "   ");
  assert.equal(duplicate.view().text, "Hello");
  final(duplicate, "d1", "Hello!");
  final(duplicate, "d1", "Hello!");
  delta(duplicate, "d1", " late");
  done(duplicate, "d1");
  assert.deepEqual(duplicate.state.turns.map(t => t.text), ["Hello!"]);
  speech(duplicate, "empty");
  userFinal(duplicate, "empty", " ");
  assert.equal(duplicate.state.turns.length, 1, "Empty input creates no bubble");

  // 6. Two consecutive interruptions preserve received text and allow new turns.
  const cut = session();
  for (let i = 1; i <= 2; i += 1) {
    response(cut, `cut${i}`);
    cut.send({ type: "output_audio_buffer.started", response_id: `cut${i}` });
    delta(cut, `cut${i}`, `Sentence ${i}`);
    speech(cut, `student${i}`);
    userFinal(cut, `student${i}`, `Answer ${i}`);
    assert.equal(done(cut, `cut${i}`, { status: "cancelled" }).status, "", "Old response cannot reset current listening status");
    delta(cut, `cut${i}`, " stale");
  }
  response(cut, "after");
  delta(cut, "after", "Still showing.");
  final(cut, "cut1", "Sentence 1");
  assert.equal(cut.view().text, "Still showing.");
  assert.deepEqual(cut.state.turns.filter(t => t.role === "tutor").map(t => [t.text, t.playback]), [
    ["Sentence 1", "interrupted"], ["Sentence 2", "interrupted"], ["Still showing.", "pending"],
  ]);
  assert.equal(cut.send({ type: "output_audio_buffer.stopped", response_id: "cut1" }).status, "");
  assert.equal(cut.state.turns[0].playback, "interrupted");

  // 7. CC visibility is a projection only; callbacks continue storing all text.
  const cc = session();
  response(cc, "cc");
  delta(cc, "cc", "While ");
  assert.equal(cc.view(false).text, "");
  assert.equal(cc.view(false).visible, false);
  delta(cc, "cc", "hidden");
  final(cc, "cc", "While hidden.");
  assert.equal(cc.state.turns[0].text, "While hidden.");
  assert.equal(cc.view(true).text, "While hidden.");

  // 8. Existing WebSocket IDs and talk-controller selection remain compatible.
  const talk = createLearnTalkController();
  talk.hello({ azure: true, requestId: 1 });
  let ws = applyTranscriptEvent(createTranscript(), { type: "ai_done", requestId: 1, text: "Hello!" });
  const press = talk.press();
  talk.mediaReady({ generation: press.generation, running: true });
  talk.notePcm(3200);
  talk.press();
  for (const event of [
    { type: "partial_transcript", requestId: press.requestId, text: "My name" },
    { type: "final_transcript", requestId: press.requestId, text: "My name is Lan." },
  ]) ws = applyTranscriptEvent(ws, event);
  assert.equal(learnCallCaptionView(ws, { requestId: press.requestId }).label, "BẠN");
  talk.noteFinal("My name is Lan.", { requestId: press.requestId });
  ws = applyTranscriptEvent(ws, { type: "ai_stream", requestId: press.requestId, token: "Nice" });
  ws = applyTranscriptEvent(ws, { type: "ai_done", requestId: press.requestId, text: "Nice to meet you." });
  assert.equal(learnCallCaptionView(ws, { requestId: talk.snapshot().requestId }).text, "Nice to meet you.");
  assert.deepEqual(ws.turns.map(t => t.key), ["t:1", "u:2", "t:2"]);

  // Separate output items AND content parts within one response.
  const multi = session();
  response(multi, "multi");
  delta(multi, "multi", "Second", { item_id: "out2", output_index: 1 });
  delta(multi, "multi", "First", { item_id: "out1", output_index: 0 });
  delta(multi, "multi", "Other content", { item_id: "out1", output_index: 0, content_index: 1 });
  assert.equal(multi.view().text, "Second", "Late earlier output does not steal caption");
  done(multi, "multi", { output: [
    { id: "out1", content: [{ transcript: "First." }, { transcript: "Other content." }] },
    { id: "out2", content: [{ transcript: "Second." }] },
    { id: "tool", type: "function_call" },
  ] });
  assert.deepEqual(multi.state.turns.map(t => t.text), ["First.", "Other content.", "Second."]);
  assert.equal(multi.view().text, "Second.");
  assert.equal(new Set(multi.state.turns.map(t => t.requestId)).size, 3);

  // Item links repair history even when a user anchor itself arrives late.
  const links = session();
  response(links, "greeting");
  delta(links, "greeting", "Hi.");
  response(links, "reply");
  delta(links, "reply", "Nice.");
  links.send({ type: "conversation.item.added", previous_item_id: "greeting-item", item: { id: "late-input", role: "user" } });
  userFinal(links, "late-input", "Lan.");
  assert.deepEqual(links.state.turns.map(t => t.text), ["Hi.", "Lan.", "Nice."]);
  assert.equal(links.view().text, "Nice.");

  const paired = session();
  const speak = (itemId, previous, text, responseId, reply) => {
    paired.send({ type: "input_audio_buffer.speech_started", item_id: itemId });
    paired.send({ type: "input_audio_buffer.committed", item_id: itemId, previous_item_id: previous });
    paired.send({ type: "conversation.item.input_audio_transcription.completed", item_id: itemId, transcript: text });
    paired.send({ type: "response.created", response: { id: responseId, metadata: { beego_turn: itemId, beego_input_items: itemId, beego_action: "advance" } } });
    paired.send({ type: "response.output_audio_transcript.done", response_id: responseId, transcript: reply });
    paired.send({ type: "response.done", response: { id: responseId, status: "completed", metadata: { beego_turn: itemId, beego_input_items: itemId }, output: [{ id: `${responseId}-item`, content: [{ transcript: reply }] }] } });
    paired.send({ type: "response.done", response: { id: responseId, status: "completed", metadata: { beego_turn: itemId, beego_input_items: itemId }, output: [{ id: `${responseId}-item`, content: [{ transcript: reply }] }] } });
  };
  speak("u-name", null, "My name is Nan.", "r-name", "What's your name?");
  speak("u-job", "u-name", "Allies my team", "r-job", "What do you do?");
  speak("u-home", "u-job", "I live in Ojibwe City.", "r-home", "Where do you live?");
  assert.deepEqual(paired.state.turns.map((turn) => turn.text), [
    "My name is Nan.", "What's your name?",
    "Allies my team", "What do you do?",
    "I live in Ojibwe City.", "Where do you live?",
  ]);
  assert.equal(paired.state.turns.filter((turn) => turn.text === "My name is Nan.").length, 1);
  const split = session();
  split.send({ type: "input_audio_buffer.committed", item_id: "part-a" });
  split.send({ type: "conversation.item.input_audio_transcription.completed", item_id: "part-a", transcript: "I live" });
  split.send({ type: "input_audio_buffer.committed", item_id: "part-b", previous_item_id: "part-a" });
  split.send({ type: "conversation.item.input_audio_transcription.completed", item_id: "part-b", transcript: "in the city." });
  split.send({ type: "response.created", response: { id: "r-split", metadata: { beego_turn: "part-a", beego_input_items: "part-a,part-b", beego_action: "advance" } } });
  split.send({ type: "response.output_audio_transcript.done", response_id: "r-split", transcript: "Do you like living there?" });
  assert.deepEqual(split.state.turns.map((turn) => `${turn.role}:${turn.text}`), [
    "user:I live", "user:in the city.", "tutor:Do you like living there?",
  ]);
  const heard = learnCallCaptionView(paired.state, { realtime: true, target: { requestId: paired.state.turns[0].requestId, role: "user" } });
  const tutorTurn = paired.state.turns.find((turn) => turn.role === "tutor");
  const pairedLearner = learnCallLearnerBeforeTutor(paired.state, tutorTurn.requestId);
  const immediate = learnCallShownCaption(
    { role: "tutor", text: tutorTurn.text, label: "MS LINH", pending: false },
    { text: "", until: 0, requestId: 0 },
    1000,
    2500,
    pairedLearner,
  );
  assert.equal(immediate.view.role, "tutor");
  assert.equal(immediate.view.text, tutorTurn.text);
  assert.equal(immediate.learner.role, "user");
  assert.equal(immediate.learner.text, "My name is Nan.");
  const held = learnCallShownCaption({ role: "tutor", text: "What's your name?", label: "MS LINH", pending: false }, { text: heard.text, requestId: heard.requestId || pairedLearner?.requestId, until: 3000 }, 1000);
  assert.equal(held.view.role, "tutor");
  assert.equal(held.view.text, "What's your name?");
  assert.equal(held.learner.text, "My name is Nan.");
  const released = learnCallShownCaption({ role: "tutor", text: "What's your name?", label: "MS LINH", pending: false }, { text: heard.text, until: 3000 }, 4000);
  assert.equal(released.view.role, "tutor");
  assert.equal(released.view.text, "What's your name?");
  assert.equal(released.learner, null);

  const errors = session();
  errors.send({ type: "conversation.item.input_audio_transcription.failed", item_id: "bad", error: { message: "Unintelligible audio" } });
  errors.send({ type: "error", error: { message: "Provider problem" } });
  response(errors, "failed");
  done(errors, "failed", { status: "failed", status_details: { error: { message: "Generation failed" } } });
  assert.equal(errors.notices.length, 3);
  assert.match(errors.notices[0], /nhận dạng/);
  assert.match(errors.notices[1], /Provider problem/);
  assert.match(errors.notices[2], /Generation failed/);
  assert.equal(errors.state.turns.length, 0);
  console.log("PASS Realtime mapper -> hook callbacks -> reducer -> caption: 8 required scenarios, multi-output/content, late item links and provider errors (mock only).");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runRealtimeTranscriptTests();
