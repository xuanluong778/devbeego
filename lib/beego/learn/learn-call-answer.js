/**
 * Classify one learner turn before the tutor corrects.
 * A accept · B intent ok, missing target form · C unclear · D one real error (one retry)
 */

import { learnCallCoveredFacets, learnCallTopicGuide } from "./learn-call-topics.js";

const JOB_LEX = /\b(?:it|tech|technology|software|engineer|developer|office|student|teacher|doctor|nurse|worker|job|work(?:s|ed|ing)?)\b/i;

export function learnCallStableTargetId(intent, extra = "") {
  const base = String(intent || "general").trim() || "general";
  const tail = String(extra || "").trim();
  return tail ? `${base}:${tail}` : base;
}

function usesTargetForm(text, intent) {
  const raw = String(text || "");
  if (intent === "name") {
    return /\b(?:my name is|i(?:'m| am)|tên (?:tôi )?là)\b/i.test(raw) || /^[a-zà-ỹ][a-zà-ỹ'-]{1,20}$/i.test(raw.trim());
  }
  if (intent === "job") return /\bi work\b|\bi(?:'m| am) a\b|học sinh|sinh viên/i.test(raw);
  if (intent === "home") return /\bi live\b|\bi(?:'m| am) from\b|sống|ở\s+/i.test(raw);
  if (intent === "age") return /\byears?\s*old\b|\btuổi\b|\bi(?:'m| am)\s+\d{1,2}\b/i.test(raw);
  if (intent === "greeting") return /\b(?:hello|hi|i(?:'m| am)\s+(?:fine|good|ok|okay))\b/i.test(raw);
  return true;
}

function intentMatched(text, intent, guide) {
  if (!intent || intent === "general") return Boolean(String(text || "").trim());
  const covered = learnCallCoveredFacets([{ role: "user", content: text }], guide);
  if (covered.answered.includes(intent)) return true;
  if (intent === "job" && JOB_LEX.test(text)) return true;
  if (intent === "name") {
    const one = String(text || "").trim();
    if (/^[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ'-]{1,20}$/.test(one) && !/\d/.test(one)) return true;
  }
  return false;
}

/**
 * @returns {{
 *   kind: "accept"|"nudge_target"|"unclear"|"correct"|"correct_exhausted"|"help",
 *   helpKind?: string,
 *   targetId: string,
 *   intentOk: boolean,
 *   targetUsed: boolean,
 *   retriesUsed: number,
 *   confirm?: string
 * }}
 */
export function learnCallClassifyAnswer(text, {
  pendingQuestion = null,
  topicCtx = null,
  helpKind = "content",
  unclear = false,
  practiceEval = null,
  retriesByTarget = {},
} = {}) {
  const raw = String(text || "").trim();
  const guide = learnCallTopicGuide({
    topic: topicCtx?.topic || topicCtx?.title || "",
    title: topicCtx?.lessonTitle || topicCtx?.title || "",
    sectionId: topicCtx?.sectionId || "",
  });
  const intent = pendingQuestion?.intent || (practiceEval ? "practice" : "");

  if (helpKind && helpKind !== "content" && helpKind !== "unclear" && helpKind !== "stuck" && helpKind !== "empty") {
    return {
      kind: "help",
      helpKind,
      targetId: learnCallStableTargetId(intent || "help"),
      intentOk: false,
      targetUsed: false,
      retriesUsed: 0,
    };
  }

  if (!raw || unclear) {
    const targetId = learnCallStableTargetId(intent || "unclear");
    return {
      kind: "unclear",
      targetId,
      intentOk: false,
      targetUsed: false,
      retriesUsed: Number(retriesByTarget[targetId]) || 0,
      confirm: intent === "job" && JOB_LEX.test(raw) ? "Do you mean you work in tech?" : "",
    };
  }


  const intentOk = intentMatched(raw, intent, guide);
  const targetUsed = Boolean(practiceEval?.isComplete) || usesTargetForm(raw, intent);

  if ((practiceEval?.isComplete || intentOk) && practiceEval?.missingFocus !== "not") {
    return {
      kind: "accept",
      targetId: learnCallStableTargetId(intent || "content"),
      intentOk: true,
      targetUsed,
      retriesUsed: 0,
    };
  }

  const errorId = practiceEval?.missingFocus === "not" ? learnCallStableTargetId(intent || "practice") : "";
  if (errorId) {
    const targetId = errorId || learnCallStableTargetId(intent || "practice");
    const retriesUsed = Number(retriesByTarget[targetId]) || 0;
    return {
      kind: retriesUsed >= 1 ? "correct_exhausted" : "correct",
      targetId,
      intentOk: false,
      targetUsed: false,
      retriesUsed,
    };
  }

  return {
    kind: "accept",
    targetId: learnCallStableTargetId(intent || "content"),
    intentOk: Boolean(intentOk),
    targetUsed: Boolean(targetUsed),
    retriesUsed: 0,
  };
}

export function nextRetriesByTarget(previous, classification) {
  const next = { ...(previous && typeof previous === "object" ? previous : {}) };
  if (!classification?.targetId) return next;
  if (classification.kind === "correct") {
    next[classification.targetId] = (Number(next[classification.targetId]) || 0) + 1;
  } else if (classification.kind === "correct_exhausted") {
    next[classification.targetId] = Math.max(Number(next[classification.targetId]) || 0, 1);
  }
  return next;
}
