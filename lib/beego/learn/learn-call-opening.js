/**
 * One tutor opening per Learn Call session.
 * Lesson mode greets first; open chat waits for the learner.
 * Reconnect, duplicate ready events, and learner-first speech must not create a second opening.
 */

import { learnCallTopicGuide } from "./learn-call-topics.js";

export const LEARN_CALL_OPENING_TTL_SEC = 60 * 60;

export function learnCallOpeningKey(sessionId) {
  return `voice:learn-open:${String(sessionId || "").trim()}`;
}

function hasRole(memory, role) {
  return (Array.isArray(memory) ? memory : []).some(
    (item) => item?.role === role && String(item.content || "").trim()
  );
}

/**
 * @returns {{ open: boolean, invite: boolean, reason: string }}
 */
export function learnCallShouldTutorOpen({
  sessionMode = "lesson",
  memory = [],
  openingClaimed = false,
  learnerSpeaking = false,
  audioReady = true,
} = {}) {
  if (openingClaimed) return { open: false, invite: false, reason: "already_opened" };
  if (!audioReady) return { open: false, invite: false, reason: "audio_not_ready" };
  if (learnerSpeaking || hasRole(memory, "user")) {
    return { open: false, invite: false, reason: "learner_first" };
  }
  if (hasRole(memory, "assistant")) return { open: false, invite: false, reason: "already_opened" };
  if (sessionMode === "open") return { open: false, invite: true, reason: "open_mode_waits" };
  return { open: true, invite: false, reason: "lesson_open" };
}

export function learnCallOpeningScript(topicCtx = {}, difficulty = "easy") {
  const guide = learnCallTopicGuide({
    topic: topicCtx?.topic || topicCtx?.title || "",
    title: topicCtx?.lessonTitle || topicCtx?.title || "",
    sectionId: topicCtx?.sectionId || "",
  });
  if (guide.key === "greetings") {
    return {
      spoken: "Hi! I'm your new neighbor. What's your name?",
      hint: { en: "My name is …", vi: "Tên tôi là …" },
      nextAfterName: "Do you live nearby?",
      targetId: "name",
    };
  }
  const level = difficulty === "hard" || difficulty === "medium" ? difficulty : "easy";
  const first = guide.facets?.[0]?.angles?.[0]?.[level] || guide.facets?.[0]?.angles?.[0]?.easy || "How are you?";
  const sample = guide.facets?.[0]?.samples?.[0] || { en: "I'm fine.", vi: "Tôi khỏe." };
  return {
    spoken: `Hi! ${first}`,
    hint: { en: sample.en, vi: sample.vi || "" },
    nextAfterName: "",
    targetId: guide.facets?.[0]?.id || "greeting",
  };
}

export function learnCallOpeningInstructions(topicCtx = {}, difficulty = "easy") {
  const script = learnCallOpeningScript(topicCtx, difficulty);
  return [
    "This is the only opening turn of the lesson. Speak it now.",
    `Say exactly this, or a very close short paraphrase with the same question: "${script.spoken}"`,
    "Do not wait for the learner. Do not give a long introduction. Do not ask a second question.",
    script.hint?.en ? `A good answer frame is: ${script.hint.en}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function learnCallOpeningPayload(topicCtx = {}, difficulty = "easy", decision = null) {
  const script = learnCallOpeningScript(topicCtx, difficulty);
  const resolved = decision || learnCallShouldTutorOpen({ sessionMode: topicCtx?.sessionMode || "lesson" });
  return {
    shouldSpeak: resolved.open === true,
    invite: resolved.invite === true,
    reason: resolved.reason || "",
    spoken: script.spoken,
    hint: script.hint,
    nextAfterName: script.nextAfterName,
    targetId: script.targetId,
  };
}

/** SET NX so reconnect / duplicate ready events cannot open twice. */
export async function learnCallClaimOpening(redis, sessionId, ttlSeconds = LEARN_CALL_OPENING_TTL_SEC) {
  const sid = String(sessionId || "").trim();
  if (!redis || !sid) return { claimed: false, reason: "no_session" };
  const ok = await redis.set(learnCallOpeningKey(sid), "tutor", "EX", ttlSeconds, "NX");
  return { claimed: ok === "OK", reason: ok === "OK" ? "claimed" : "already_opened" };
}

/** Mark the session so a later greet cannot run (learner already started, or opening was sent). */
export async function learnCallMarkOpening(redis, sessionId, value = "1", ttlSeconds = LEARN_CALL_OPENING_TTL_SEC) {
  const sid = String(sessionId || "").trim();
  if (!redis || !sid) return false;
  await redis.set(learnCallOpeningKey(sid), String(value || "1"), "EX", ttlSeconds);
  return true;
}

export async function learnCallOpeningClaimed(redis, sessionId) {
  const sid = String(sessionId || "").trim();
  if (!redis || !sid) return false;
  return Boolean(await redis.get(learnCallOpeningKey(sid)));
}

/** Drop the opening NX so a failed create can retry the same sessionId. */
export async function learnCallReleaseOpening(redis, sessionId) {
  const sid = String(sessionId || "").trim();
  if (!redis || !sid) return false;
  await redis.del(learnCallOpeningKey(sid));
  return true;
}
