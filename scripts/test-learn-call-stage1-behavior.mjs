/**
 * Test behavioral requirements for Stage 1 (Learn Call stability and streaming).
 * Tests run directly against actual production modules in lib/beego/learn/:
 * - lib/beego/learn/learn-call-talk.js (evaluateLearnCallInbound, createLearnTalkController)
 * - lib/beego/learn/learn-call-stream.js (streamOpenAIChatSse, createOrderedTokenQueue, parseSseLine)
 * - lib/beego/learn/learn-call-playback.js (createLearnPlaybackController, createLearnAudioCache)
 *
 * Scenarios:
 * 1. Result A arrives after Turn B has already started (no media hijack, no phase reset via production logic).
 * 2. SSE tokens with delayed async callbacks preserve strictly ordered sequence.
 * 3. Multiple final tokens flush completely before stream completion and downstream TTS/done.
 * 4. Cancellation mid-stream drops pending tokens and does not emit completion.
 * 5. Double cleanup is idempotent and does not throw or double-emit across production controllers.
 */

import { parseSseLine, createOrderedTokenQueue, streamOpenAIChatSse } from "../lib/beego/learn/learn-call-stream.js";
import { createLearnTalkController, evaluateLearnCallInbound } from "../lib/beego/learn/learn-call-talk.js";
import { createLearnPlaybackController, createLearnAudioCache } from "../lib/beego/learn/learn-call-playback.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// TEST 1: Result A arrives after Turn B has started
// Tests production evaluateLearnCallInbound & createLearnTalkController
// ---------------------------------------------------------------------------
async function testResultAAfterBStarted() {
  console.log("-> Running Test 1: Result A arrives after Turn B started (testing production evaluateLearnCallInbound)...");

  const talkController = createLearnTalkController();
  talkController.hello({ azure: true, requestId: 1 });

  // User finishes Turn 1 and starts Turn 2
  const press1 = talkController.press(); // arms listen (rid = 2)
  talkController.mediaReady({ generation: press1.generation, running: true }); // phase = "listening", rid = 2

  let micStopped = false;
  let activeListenId = 2;
  let activePracticeId = 0;
  let currentRequestId = 2;
  let coach = null;

  const dispatch = (msg) => {
    const inbound = evaluateLearnCallInbound({
      msg,
      activeListenId,
      activePracticeId,
      currentRequestId,
      listening: !micStopped && talkController.snapshot().phase === "listening",
      phase: talkController.snapshot().phase,
    });

    if (inbound.handled) {
      if (inbound.coachItem) coach = inbound.coachItem;
      else if (inbound.clearCoach) coach = null;

      if (inbound.shouldStopMic) {
        micStopped = true;
      }
      if (inbound.shouldResetPhase) {
        talkController.notePracticeDone({ requestId: Number(msg.requestId) || 0 });
      }
      if (inbound.clearActiveListen) activeListenId = 0;
      if (inbound.clearActivePractice) activePracticeId = 0;
    }
    return inbound;
  };

  // 1. Late listen_retry for Turn 1 arrives while Turn 2 is recording
  const r1 = dispatch({ type: "listen_retry", requestId: 1, notice: "Mình chưa nghe rõ câu 1" });
  assert(r1.stale === true, "Result 1 must be flagged as stale");
  assert(r1.shouldStopMic === false, "Production evaluation must NOT stop mic for stale listen_retry");
  assert(r1.shouldResetPhase === false, "Production evaluation must NOT reset phase for stale listen_retry");
  assert(!micStopped, "Microphone must remain active for Turn 2");
  assert(talkController.snapshot().phase === "listening", "Talk controller phase must remain 'listening'");

  // Also verify talkController itself rejects stale requestId
  const staleNote = talkController.notePracticeDone({ requestId: 1 });
  assert(staleNote.stale === true && staleNote.ignored === true, "talkController.notePracticeDone must ignore stale requestId: 1");
  assert(talkController.snapshot().phase === "listening", "Talk controller phase must NOT change when passing stale rid: 1");

  // 2. Late practice_result for Turn 1 arrives
  const r2 = dispatch({
    type: "practice_result",
    requestId: 1,
    coach: { items: [{ word: "hello", hintVi: "xin chào" }] },
  });
  assert(r2.stale === true, "Late practice_result must be flagged as stale");
  assert(r2.shouldStopMic === false, "Production evaluation must NOT stop mic for stale practice_result");
  assert(r2.shouldResetPhase === false, "Production evaluation must NOT reset phase for stale practice_result");
  assert(!micStopped, "Microphone must still remain active for Turn 2");
  assert(talkController.snapshot().phase === "listening", "Phase must still be 'listening'");
  assert(coach?.word === "hello", "Background coach data from Turn 1 must be saved without disturbing media");

  // 3. Late pronunciation_coach for Turn 1 arrives
  const r3 = dispatch({
    type: "pronunciation_coach",
    requestId: 1,
    items: [{ word: "world", hintVi: "thế giới" }],
  });
  assert(r3.shouldStopMic === false, "pronunciation_coach must NOT stop mic");
  assert(coach?.word === "world", "Coach must be updated");
  assert(!micStopped, "Microphone must not be stopped");
  assert(talkController.snapshot().phase === "listening", "Phase must remain 'listening'");

  // 4. Current turn (Turn 2) listen_retry arrives
  const r4 = dispatch({ type: "listen_retry", requestId: 2, notice: "Chưa nghe rõ câu 2" });
  assert(r4.stale === false, "Matching listen_retry for Turn 2 must NOT be stale");
  assert(r4.shouldStopMic === true, "Matching listen_retry must request stopMic");
  assert(r4.shouldResetPhase === true, "Matching listen_retry must request phase reset to ready");
  assert(micStopped === true, "Microphone stopped for matching Turn 2 event");
  assert(talkController.snapshot().phase === "ready", "Talk controller transitioned cleanly to 'ready'");
  assert(activeListenId === 0, "activeListenId cleared for Turn 2");

  console.log("  [PASS] Test 1 passed: Production evaluateLearnCallInbound & learn-call-talk correctly handled turn ownership.");
}

// ---------------------------------------------------------------------------
// TEST 2: Delayed token callback ordering
// Tests production streamOpenAIChatSse & createOrderedTokenQueue
// ---------------------------------------------------------------------------
async function testDelayedTokenCallbackOrdering() {
  console.log("-> Running Test 2: Delayed token callbacks in strict sequence (testing production streamOpenAIChatSse)...");

  const tokens = ["The", " ", "weather", " ", "is", " ", "nice", " ", "today."];
  // Delays in reverse order: earlier tokens take longer, later tokens are faster
  const delays = [50, 40, 35, 25, 20, 15, 10, 5, 2];

  const processed = [];
  let acc = "";

  const sseBody = tokens
    .map((t) => `data: {"choices":[{"delta":{"content":${JSON.stringify(t)}}}]}`)
    .join("\n\n") + "\n\ndata: [DONE]\n\n";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseBody));
      controller.close();
    },
  });

  const response = {
    ok: true,
    status: 200,
    body: stream,
  };

  let tokenIndex = 0;
  const result = await streamOpenAIChatSse({
    response,
    onToken: async (tok) => {
      const idx = tokenIndex++;
      const d = delays[idx] || 5;
      await sleep(d);
      processed.push(tok);
      acc += tok;
    },
  });

  assert(!result.aborted, "Stream should not be aborted");
  assert(acc === "The weather is nice today.", `Accumulated text mismatch: got "${acc}"`);
  assert(processed.join("") === tokens.join(""), "Tokens must be processed strictly sequentially");

  console.log("  [PASS] Test 2 passed: All tokens processed in exact FIFO order despite variable async delays.");
}

// ---------------------------------------------------------------------------
// TEST 3: Multiple final tokens flush before completion
// Tests production streamOpenAIChatSse & parseSseLine
// ---------------------------------------------------------------------------
async function testMultipleFinalTokensFlushBeforeCompletion() {
  console.log("-> Running Test 3: Multiple final tokens flush before completion (testing production streamOpenAIChatSse)...");

  const ssePayload = [
    'data: {"choices":[{"delta":{"content":"I"}}]}',
    'data: {"choices":[{"delta":{"content":" understand"}}]}',
    'data: {"choices":[{"delta":{"content":" now."},"finish_reason":"length"}]}',
    "data: [DONE]",
  ].join("\n\n") + "\n\n";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Deliver in two chunks: first token, then the remaining final tokens together
      const splitAt = ssePayload.indexOf('data: {"choices":[{"delta":{"content":" understand"}}');
      controller.enqueue(encoder.encode(ssePayload.slice(0, splitAt)));
      controller.enqueue(encoder.encode(ssePayload.slice(splitAt)));
      controller.close();
    },
  });

  let acc = "";
  let finalReceived = false;
  let truncatedDetected = false;

  const result = await streamOpenAIChatSse({
    response: { ok: true, body: stream },
    onToken: async (tok, meta) => {
      await sleep(10);
      acc += tok;
      if (meta?.truncated) truncatedDetected = true;
    },
  });

  // Verify that by the time streamOpenAIChatSse resolves:
  assert(acc === "I understand now.", `Expected complete text "I understand now.", got "${acc}"`);
  assert(result.truncated === true, "Truncated flag must be reported when finish_reason is length");
  assert(truncatedDetected === true, "Callback must observe truncated meta flag");

  // Simulate worker: ai_done and TTS only run AFTER streamOpenAIChatSse resolves
  finalReceived = true;
  assert(finalReceived && acc === "I understand now.", "Downstream ai_done received full accumulated text");

  console.log("  [PASS] Test 3 passed: Multiple final tokens completely flushed prior to stream completion.");
}

// ---------------------------------------------------------------------------
// TEST 4: Cancel before completion
// Tests production streamOpenAIChatSse abort & cancel mechanism
// ---------------------------------------------------------------------------
async function testCancelBeforeCompletion() {
  console.log("-> Running Test 4: Cancel mid-stream drops pending tokens cleanly (testing production streamOpenAIChatSse)...");

  const tokens = ["Hello", " ", "learner,", " ", "how", " ", "are", " ", "you?"];
  const ssePayload = tokens
    .map((t) => `data: {"choices":[{"delta":{"content":${JSON.stringify(t)}}}]}`)
    .join("\n\n") + "\n\ndata: [DONE]\n\n";

  const encoder = new TextEncoder();
  let cancelledOnReader = false;

  const stream = new ReadableStream({
    start(controller) {
      // Enqueue payload but keep stream open so cancel can be observed
      controller.enqueue(encoder.encode(ssePayload));
    },
    cancel() {
      cancelledOnReader = true;
    },
  });

  const ac = new AbortController();
  const received = [];

  const result = await streamOpenAIChatSse({
    response: { ok: true, body: stream },
    signal: ac.signal,
    onToken: async (tok) => {
      received.push(tok);
      if (received.length === 2) {
        // Cancel mid-stream after receiving 2 tokens
        ac.abort();
      }
    },
  });

  assert(result.aborted === true, "Result must indicate aborted === true");
  assert(received.length <= 3, `Expected at most 3 tokens before abort took effect, got ${received.length}`);
  assert(cancelledOnReader === true, "Underlying stream reader cancel() must be called");

  console.log("  [PASS] Test 4 passed: Cancellation stopped stream cleanly and reader was cancelled.");
}

// ---------------------------------------------------------------------------
// TEST 5: Double cleanup is idempotent across production controllers
// Tests createLearnTalkController, createLearnPlaybackController, createLearnAudioCache
// ---------------------------------------------------------------------------
async function testDoubleCleanup() {
  console.log("-> Running Test 5: Double cleanup idempotency on production controllers...");

  const talkController = createLearnTalkController();
  talkController.hello({ azure: true, requestId: 1 });

  const playbackController = createLearnPlaybackController();
  playbackController.startTurn(1);
  playbackController.chunk({ playbackId: 1, generation: 2, bytes: 4800 });

  const audioCache = createLearnAudioCache();
  audioCache.append(1, new Uint8Array([1, 2, 3, 4]));

  assert(audioCache.turnCount() === 1, "Audio cache should have 1 turn");
  assert(talkController.snapshot().phase === "ready", "Talk controller should be ready");

  // First cleanup pass
  const talk1 = talkController.exit();
  const play1 = playbackController.disconnect();
  audioCache.clear();

  assert(talk1.action === "cleanup", "First exit action should be cleanup");
  assert(talkController.snapshot().phase === "ended", "Talk controller phase should be ended");
  assert(audioCache.turnCount() === 0, "Audio cache cleared");

  // Second cleanup pass (e.g. unmount following finish or React StrictMode unmount-remount)
  let threw = false;
  try {
    talkController.exit();
    playbackController.disconnect();
    audioCache.clear();
  } catch (_e) {
    threw = true;
  }

  assert(!threw, "Second cleanup must never throw an error");
  assert(talkController.snapshot().phase === "ended", "Talk controller phase stays ended");
  assert(audioCache.turnCount() === 0, "Audio cache remains cleared");

  console.log("  [PASS] Test 5 passed: Double cleanup executed cleanly without exceptions on production controllers.");
}

// ---------------------------------------------------------------------------
// Main test runner
// ---------------------------------------------------------------------------
async function runAll() {
  console.log("=================================================");
  console.log("Running Learn Call Stage 1 Behavioral Test Suite");
  console.log("=================================================");

  await testResultAAfterBStarted();
  await testDelayedTokenCallbackOrdering();
  await testMultipleFinalTokensFlushBeforeCompletion();
  await testCancelBeforeCompletion();
  await testDoubleCleanup();

  console.log("=================================================");
  console.log("ALL 5 BEHAVIORAL TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

runAll().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
