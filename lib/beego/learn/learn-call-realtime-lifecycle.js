import { learnCallOpeningInstructions, learnCallShouldTutorOpen } from "./learn-call-opening.js";

/** Server clock and sign-off, entirely inside the existing call deadline. */
export const REALTIME_CLOSING_RESERVE_MS = 12_000;
export const REALTIME_CLOSING_FORCE_MS = 8_000;
export const REALTIME_GOODBYE = "Great work today! Goodbye, see you later!";

export function realtimeCallClock(session, serverNow = Date.now()) {
  const startedAt = Number(session?.createdAt ?? session?.startedAt);
  const deadlineAt = Number(session?.deadlineAt);
  if (!(startedAt > 0 && deadlineAt > startedAt && Number.isFinite(deadlineAt))) return null;
  return { startedAt, deadlineAt, serverNow };
}

export function syncRealtimeCallClock(clock, now = Date.now(), previous = null) {
  const startedAt = Number(clock?.startedAt);
  const deadlineAt = Number(clock?.deadlineAt);
  const serverNow = Number(clock?.serverNow);
  if (!(startedAt > 0 && deadlineAt > startedAt && Number.isFinite(deadlineAt) && serverNow > 0)) return previous;
  // Translate the server clock to this device. Heartbeats must not extend it.
  let localDeadline = now + Math.max(0, deadlineAt - serverNow);
  if (previous?.serverDeadlineAt === deadlineAt) localDeadline = Math.min(localDeadline, previous.deadlineAt);
  return { startedAt: localDeadline - (deadlineAt - startedAt), deadlineAt: localDeadline,
    serverDeadlineAt: deadlineAt, serverStartedAt: startedAt };
}

export function createRealtimeCallLifecycle() {
  let clock = null;
  let closing = false;
  let ended = false;
  let requested = false;
  let closingResponseId = "";
  let generating = "";
  let playing = "";
  let cancelSent = "";
  let clearSent = "";
  let manualDeadline = Infinity;
  let sessionMode = "lesson";
  let topicCtx = null;
  let difficulty = "easy";
  let shouldSpeak = false;
  let selectedOpening = null;
  let opened = false;
  let learnerSpoke = false;
  let audioReady = false;
  const send = event => ({ type: "send", event });

  function openingEffects() {
    if (ended || closing || opened) return [];
    const decision = learnCallShouldTutorOpen({
      sessionMode,
      openingClaimed: opened,
      learnerSpeaking: learnerSpoke,
      audioReady,
    });
    if (decision.invite) {
      opened = true;
      return [{ type: "invite" }];
    }
    if (!decision.open || !shouldSpeak) return [];
    opened = true;
    return [send({
      type: "response.create",
      response: {
        conversation: "none",
        input: [],
        metadata: { beego_opening: "1" },
        output_modalities: ["audio"],
        max_output_tokens: 80,
        instructions: selectedOpening?.spoken ? `Speak exactly this opening, then wait: ${JSON.stringify(selectedOpening.spoken)}` : learnCallOpeningInstructions(topicCtx, difficulty),
      },
    })];
  }

  function end(reason) {
    if (ended) return [];
    ended = true;
    return [{ type: "end", reason, message: reason === "lesson_complete"
      ? "Buổi luyện nói đã kết thúc. Hẹn gặp bạn ở buổi tiếp theo!"
      : "Đã hết thời gian phiên học. Hẹn gặp bạn ở buổi tiếp theo!" }];
  }
  function advance(now) {
    if (ended) return [];
    const effects = [];
    const deadline = Math.min(clock?.deadlineAt ?? Infinity, manualDeadline);
    const remaining = deadline - now;
    if (remaining <= 0) return end("time_limit");
    if (!closing && remaining <= REALTIME_CLOSING_RESERVE_MS) {
      closing = true;
      effects.push({ type: "closing" }, send({ type: "session.update", session: {
        type: "realtime", audio: { input: { turn_detection: null } },
      } }));
      // A turn reply that has not started playing would ask a new question; the goodbye replaces it.
      if (generating && !playing && cancelSent !== generating) {
        cancelSent = generating;
        effects.push(send({ type: "response.cancel", response_id: generating }));
      }
    }
    if (!closing || requested) return effects;
    // Let the current sentence drain naturally when there is time. Reserve
    // enough time for sign-off if an unusually long response is still running.
    if (remaining <= REALTIME_CLOSING_FORCE_MS) {
      if (generating && cancelSent !== generating) {
        cancelSent = generating;
        effects.push(send({ type: "response.cancel", response_id: generating }));
      }
      if (playing && clearSent !== playing) {
        clearSent = playing;
        effects.push(send({ type: "output_audio_buffer.clear" }));
      }
    }
    if (!generating && !playing) {
      requested = true;
      effects.push(send({ type: "response.create", response: {
        conversation: "none",
        input: [],
        metadata: { beego_closing: "1" },
        output_modalities: ["audio"],
        max_output_tokens: 40,
        instructions: `Speak exactly this goodbye, then stop. Do not answer, ask, or add any other words. Goodbye: ${JSON.stringify(REALTIME_GOODBYE)}`,
      } }));
    }
    return effects;
  }
  return {
    get clock() { return clock; },
    get closing() { return closing; },
    get ended() { return ended; },
    get opened() { return opened; },
    configureOpening({ sessionMode: mode = "lesson", topicCtx: ctx = null, difficulty: level = "easy", shouldSpeak: speak = false, opening = null } = {}) {
      sessionMode = mode === "open" ? "open" : "lesson";
      topicCtx = ctx;
      difficulty = level;
      shouldSpeak = speak === true;
      selectedOpening = opening;
    },
    noteReady() {
      audioReady = true;
      return openingEffects();
    },
    noteLearnerSpeech() {
      learnerSpoke = true;
      if (!opened) opened = true;
      return [];
    },
    notePolicyClosing() {
      if (closing || ended) return [];
      closing = true;
      requested = true;
      return [{ type: "closing" }, send({ type: "session.update", session: { type: "realtime", audio: { input: { turn_detection: null } } } })];
    },
    stop() { ended = true; },
    setClock(data, now = Date.now()) { clock = syncRealtimeCallClock(data, now, clock); return clock; },
    tick: advance,
    endGracefully(now = Date.now()) {
      manualDeadline = Math.min(manualDeadline, now + REALTIME_CLOSING_FORCE_MS);
      return advance(now);
    },
    observe(event, now = Date.now()) {
      if (ended || !event) return [];
      const id = event.responseId;
      if (event.type === "assistant_turn_started") {
        generating = id;
        if (event.closing) closingResponseId = id;
      } else if (event.type === "assistant_turn_done") {
        if (generating === id) generating = "";
        if (closingResponseId && closingResponseId === id && event.status !== "completed") return end("lesson_complete");
      } else if (event.type === "assistant_audio_started") {
        playing = id;
      } else if (["assistant_audio_stopped", "assistant_audio_cleared"].includes(event.type)) {
        if (playing === id) playing = "";
        if (id && id === closingResponseId && event.type === "assistant_audio_stopped") return end("lesson_complete");
      }
      return advance(now);
    },
  };
}
