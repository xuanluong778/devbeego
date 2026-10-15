/**
 * Learn-tab Call access. Does not change chat, translation, or the old speaking page.
 * A paid plan is Pro or VIP with an active subscription. Trial and expired plans cannot start a call.
 */
import {
  LEARN_CALL_DEFAULT_DIFFICULTY,
  LEARN_CALL_DIFFICULTIES,
  learnCallDifficulty,
  learnCallTutorPrompt,
} from "./learn-call-tutor.js";

export const LEARN_AI_CALL_PURPOSE = "learn_ai_call";

export function learnAiCallEnabled(env = process.env) {
  return String(env.LEARN_AI_CALL_ENABLED || "").trim() === "1";
}

export function learnAiCallGateKey() {
  return "voice:learn-call-gate";
}

/** Fail closed. Open Learn sockets stop when this key is not exactly "1". */
export async function learnAiCallGateOpen(redis) {
  if (!redis) return false;
  try {
    return (await redis.get(learnAiCallGateKey())) === "1";
  } catch {
    return false;
  }
}

/** Server-only list. An empty list allows nobody, even when the feature flag is on. */
export function learnAiCallEmailAllowed(email, env = process.env) {
  const list = String(env.LEARN_AI_CALL_ALLOWLIST || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const value = String(email || "").trim().toLowerCase();
  return Boolean(value) && list.includes(value);
}

export function learnAiCallSessionKey(sessionId) {
  return `voice:learn-call:${sessionId}`;
}

/** One open Learn Call per user. Same Redis family as the existing session, not a new auth system. */
export function learnAiCallOpenUserKey(userId) {
  return `voice:learn-call-open:${userId}`;
}

/** Set while a Learn session is finished. A still-valid JWT must not reopen it. */
export function learnAiCallEndedKey(sessionId) {
  return `voice:learn-call-ended:${sessionId}`;
}

export function learnAiCallControlChannel() {
  return "voice:learn-call-control";
}

/**
 * Open-lock lifetime follows the call clock, not the 10-minute JWT.
 * Extra seconds cover a slow connect; they do not lengthen hello.callClock.
 */
export function learnCallOpenLockTtlSeconds(maxMinutes = 2) {
  const minutes = Number(maxMinutes);
  const callSeconds = Number.isFinite(minutes) && minutes > 0 ? Math.ceil(minutes * 60) : 120;
  return callSeconds + 60;
}

/**
 * Once the call clock exists, binding and the open lock last until that deadline.
 * A slow hello does not stretch the 2-minute clock, and the 10-minute JWT does not either.
 */
export function learnCallBindingTtlSeconds({ deadlineAt, now, graceSeconds = 15 } = {}) {
  const leftMs = Number(deadlineAt) - Number(now);
  const grace = Number.isFinite(Number(graceSeconds)) ? Math.max(0, Number(graceSeconds)) : 15;
  if (!Number.isFinite(leftMs)) return 1;
  return Math.max(1, Math.ceil(leftMs / 1000) + grace);
}

export async function refreshLearnCallBinding(redis, { userId, sessionId, deadlineAt, now = Date.now(), graceSeconds = 15 } = {}) {
  if (!redis || !sessionId) return 0;
  const ttl = learnCallBindingTtlSeconds({ deadlineAt, now, graceSeconds });
  await redis.expire(learnAiCallSessionKey(sessionId), ttl);
  if (userId != null && String(userId) !== "") {
    await redis.expire(learnAiCallOpenUserKey(userId), ttl);
  }
  return ttl;
}

const CLAIM_OPEN_LOCK_LUA = `
local existing = redis.call('GET', KEYS[1])
if existing then
  return { '0', existing }
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]))
return { '1', ARGV[1] }
`;

const RELEASE_OPEN_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export async function claimLearnCallOpenLock(redis, { userId, sessionId, ttlSeconds } = {}) {
  const ttl = Math.max(1, Math.floor(Number(ttlSeconds) || 0));
  const raw = await redis.eval(
    CLAIM_OPEN_LOCK_LUA,
    1,
    learnAiCallOpenUserKey(userId),
    String(sessionId),
    String(ttl)
  );
  const flag = Array.isArray(raw) ? raw[0] : raw;
  const holder = Array.isArray(raw) ? raw[1] : "";
  return { granted: String(flag) === "1", holder: String(holder || "") };
}

export async function releaseLearnCallOpenLock(redis, { userId, sessionId } = {}) {
  const removed = await redis.eval(
    RELEASE_OPEN_LOCK_LUA,
    1,
    learnAiCallOpenUserKey(userId),
    String(sessionId)
  );
  return Number(removed) > 0;
}

/**
 * Marks the session ended, releases only this session's open lock, and asks the
 * Learn gateway to stop STT, jobs, and the socket. Context, clock, and memory stay.
 */
export async function finalizeLearnCallSession(redis, { userId, sessionId } = {}) {
  const sid = String(sessionId || "");
  if (!sid || !redis) return { ended: false, released: false };
  await redis.set(learnAiCallEndedKey(sid), "1", "EX", 60 * 60);
  let released = false;
  if (userId != null && String(userId) !== "") {
    released = await releaseLearnCallOpenLock(redis, { userId, sessionId: sid });
  }
  try {
    await redis.publish(
      learnAiCallControlChannel(),
      JSON.stringify({ type: "end_session", sessionId: sid, userId: userId == null ? "" : String(userId) })
    );
  } catch {
    /* the ended key still blocks reconnect */
  }
  return { ended: true, released };
}

export async function learnCallSessionEnded(redis, sessionId) {
  if (!redis) return false;
  return (await redis.get(learnAiCallEndedKey(sessionId))) === "1";
}

export function learnCallReconnectAllowed({ ended, bindingMatches, remainingMs } = {}) {
  if (ended) return false;
  if (!bindingMatches) return false;
  return Number(remainingMs) > 0;
}

export function learnCallMediaStillAllowed({ closed, deadlineAt, now = Date.now() } = {}) {
  if (closed) return false;
  const deadline = Number(deadlineAt);
  if (Number.isFinite(deadline) && deadline > 0 && now >= deadline) return false;
  return true;
}

export function learnCallSocketCloseKind({ code, reason } = {}) {
  const why = String(reason || "");
  if (Number(code) === 1000 && (why === "client" || why === "reconnect")) return "intentional";
  return "unexpected";
}

export function learnCallEventIsCurrent(eventId, currentId) {
  return eventId != null && eventId === currentId;
}

export function learnAiCallContextKey(sessionId) {
  return `voice:learn-call-ctx:${sessionId}`;
}

export function learnAiCallClockKey(sessionId) {
  return `voice:learn-call-clock:${sessionId}`;
}

export function learnAiCallUsageKey(sessionId) {
  return `voice:learn-call-usage:${sessionId}`;
}

export function learnAiCallBudgetKey(userId, ymd) {
  return `voice:learn-call-budget:${userId}:${ymd}`;
}

export function learnAiCallHoldKey(userId) {
  return `voice:learn-call-hold:${userId}`;
}

export function learnAiCallSettledKey(sessionId) {
  return `voice:learn-call-settled:${sessionId}`;
}

/** Test-only Redis override. Not an HTTP setting and not a commercial quota. */
export function learnAiCallQuotaTestKey(userId) {
  return `voice:learn-call-quota-test:${userId}`;
}

/**
 * Preview test package budget for one UTC day.
 * This is wall-clock call time, separate from the 2-minute session cap and from STT/LLM/TTS counters.
 * It is not the commercial Pro/VIP quota. It applies only when LEARN_AI_CALL_QUOTA_MODE=test.
 */
export const LEARN_AI_CALL_TEST_PACKAGE_QUOTA = {
  label: "Hạn mức thử nghiệm preview",
  proMs: 8 * 60 * 1000,
  vipMs: 12 * 60 * 1000,
};

export function learnAiCallPackageAllowanceMs(plan, env = process.env) {
  if (String(env.LEARN_AI_CALL_QUOTA_MODE || "").trim() !== "test") return null;
  if (plan === "vip") return LEARN_AI_CALL_TEST_PACKAGE_QUOTA.vipMs;
  if (plan === "pro") return LEARN_AI_CALL_TEST_PACKAGE_QUOTA.proMs;
  return 0;
}

export function learnAiCallBudgetDay(now = Date.now()) {
  const t = new Date(now);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function learnCallPackageRemainingMs({ allowanceMs, usedMs = 0, heldMs = 0, reservedMs = 0, elapsedMs = 0 } = {}) {
  const allowance = Number(allowanceMs) || 0;
  const used = Math.max(0, Number(usedMs) || 0);
  const held = Math.max(0, Number(heldMs) || 0);
  const reserved = Math.max(0, Number(reservedMs) || 0);
  const elapsed = Math.min(reserved, Math.max(0, Number(elapsedMs) || 0));
  return Math.max(0, allowance - used - held + reserved - elapsed);
}

/**
 * Decide a new reservation without Redis. Holds are sessionId -> reserved milliseconds.
 * A session that already has a hold is a reconnect and does not take a second slice.
 */
export function resolveLearnCallPackage({ allowanceMs, usedMs = 0, holds = {}, sessionId, sessionCapMs, elapsedMs = 0 } = {}) {
  const allowance = Number(allowanceMs) || 0;
  const cap = Number(sessionCapMs);
  const used = Math.max(0, Number(usedMs) || 0);
  const sid = String(sessionId || "");
  const map = holds && typeof holds === "object" ? holds : {};
  let held = 0;
  for (const value of Object.values(map)) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) held += n;
  }
  const own = Number(map[sid]);
  const reservedOwn = Number.isFinite(own) && own > 0 ? own : 0;
  if (reservedOwn > 0) {
    return {
      status: "reused",
      reservedMs: reservedOwn,
      remainingMs: learnCallPackageRemainingMs({
        allowanceMs: allowance,
        usedMs: used,
        heldMs: held,
        reservedMs: reservedOwn,
        elapsedMs,
      }),
      allowanceMs: allowance,
      usedMs: used,
      heldMs: held,
    };
  }
  const free = allowance - used - held;
  if (!(free > 0) || !(cap > 0)) {
    return {
      status: "denied",
      reservedMs: 0,
      remainingMs: Math.max(0, free),
      allowanceMs: allowance,
      usedMs: used,
      heldMs: held,
    };
  }
  const grant = Math.min(cap, free);
  return {
    status: "granted",
    reservedMs: grant,
    remainingMs: free,
    allowanceMs: allowance,
    usedMs: used,
    heldMs: held + grant,
  };
}

export function settleLearnCallPackage({ reservedMs = 0, elapsedMs = 0, usedMs = 0, alreadySettled = false } = {}) {
  const used = Math.max(0, Number(usedMs) || 0);
  if (alreadySettled) return { status: "duplicate", consumedMs: 0, usedMs: used };
  const reserved = Math.max(0, Number(reservedMs) || 0);
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const consumed = Math.min(reserved, elapsed);
  return { status: "settled", consumedMs: consumed, usedMs: used + consumed };
}

const RESERVE_PACKAGE_LUA = `
local sessionId = ARGV[1]
local allowance = tonumber(ARGV[2]) or 0
local sessionCap = tonumber(ARGV[3]) or 0
local ttl = tonumber(ARGV[4]) or 3600
local existing = redis.call('HGET', KEYS[2], sessionId)
local function heldSum()
  local rows = redis.call('HGETALL', KEYS[2])
  local total = 0
  for i = 2, #rows, 2 do
    total = total + (tonumber(rows[i]) or 0)
  end
  return total
end
local used = tonumber(redis.call('HGET', KEYS[1], 'usedMs') or '0') or 0
if existing then
  local reserved = tonumber(existing) or 0
  return { 'reused', reserved, allowance, used, heldSum() }
end
local held = heldSum()
local free = allowance - used - held
if free <= 0 or sessionCap <= 0 then
  return { 'denied', 0, allowance, used, held }
end
local grant = math.min(sessionCap, free)
redis.call('HSET', KEYS[2], sessionId, grant)
redis.call('EXPIRE', KEYS[2], ttl)
redis.call('EXPIRE', KEYS[1], ttl)
return { 'granted', grant, allowance, used, held + grant }
`;

const SETTLE_PACKAGE_LUA = `
local ok = redis.call('SET', KEYS[3], '1', 'EX', ARGV[3], 'NX')
local used = tonumber(redis.call('HGET', KEYS[1], 'usedMs') or '0') or 0
if not ok then
  return { 'duplicate', 0, used }
end
local reserved = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0') or 0
local elapsed = tonumber(ARGV[2]) or 0
if elapsed < 0 then elapsed = 0 end
local consumed = math.min(reserved, elapsed)
if consumed > 0 then
  used = tonumber(redis.call('HINCRBY', KEYS[1], 'usedMs', consumed)) or (used + consumed)
end
redis.call('HDEL', KEYS[2], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return { 'settled', consumed, used }
`;

async function allowanceForUser(redis, { userId, plan, env }) {
  const override = await redis.get(learnAiCallQuotaTestKey(userId));
  if (override != null && override !== "") {
    const n = Number(override);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return learnAiCallPackageAllowanceMs(plan, env);
}

export async function readLearnCallPackage(redis, { userId, plan, now = Date.now(), env = process.env } = {}) {
  const allowance = await allowanceForUser(redis, { userId, plan, env });
  if (allowance == null) return null;
  const ymd = learnAiCallBudgetDay(now);
  const used = Number((await redis.hget(learnAiCallBudgetKey(userId, ymd), "usedMs")) || 0);
  const holds = (await redis.hgetall(learnAiCallHoldKey(userId))) || {};
  let held = 0;
  for (const value of Object.values(holds)) held += Number(value) || 0;
  return {
    label: LEARN_AI_CALL_TEST_PACKAGE_QUOTA.label,
    allowanceMs: allowance,
    usedMs: used,
    heldMs: held,
    remainingMs: Math.max(0, allowance - used - held),
  };
}

export async function reserveLearnCallPackage(redis, { userId, plan, sessionId, sessionCapMs, now = Date.now(), env = process.env } = {}) {
  const allowance = await allowanceForUser(redis, { userId, plan, env });
  if (allowance == null) return { status: "unmetered" };
  const ymd = learnAiCallBudgetDay(now);
  const raw = await redis.eval(
    RESERVE_PACKAGE_LUA,
    2,
    learnAiCallBudgetKey(userId, ymd),
    learnAiCallHoldKey(userId),
    String(sessionId),
    String(allowance),
    String(sessionCapMs),
    "86400"
  );
  const status = String(raw?.[0] || "denied");
  const reservedMs = Number(raw?.[1] || 0);
  const allowanceMs = Number(raw?.[2] || allowance);
  const usedMs = Number(raw?.[3] || 0);
  const heldMs = Number(raw?.[4] || 0);
  return {
    status,
    reservedMs,
    allowanceMs,
    usedMs,
    heldMs,
    remainingMs: learnCallPackageRemainingMs({ allowanceMs, usedMs, heldMs, reservedMs, elapsedMs: 0 }),
    label: LEARN_AI_CALL_TEST_PACKAGE_QUOTA.label,
  };
}

export async function settleLearnCallHold(redis, { userId, sessionId, startedAt, now = Date.now() } = {}) {
  const start = Number(startedAt);
  const elapsed = Number.isFinite(start) ? Math.max(0, now - start) : 0;
  const ymd = learnAiCallBudgetDay(now);
  const raw = await redis.eval(
    SETTLE_PACKAGE_LUA,
    3,
    learnAiCallBudgetKey(userId, ymd),
    learnAiCallHoldKey(userId),
    learnAiCallSettledKey(sessionId),
    String(sessionId),
    String(elapsed),
    "86400"
  );
  return {
    status: String(raw?.[0] || "duplicate"),
    consumedMs: Number(raw?.[1] || 0),
    usedMs: Number(raw?.[2] || 0),
  };
}

/**
 * Wall-clock budget for one Learn Call. A reconnect keeps the original deadline.
 */
export function resolveLearnCallClock({ now, maxMs, existing } = {}) {
  const max = Number(maxMs);
  const safeMax = Number.isFinite(max) && max > 0 ? max : 2 * 60 * 1000;
  const startedAt = Number(existing?.startedAt);
  const deadlineAt = Number(existing?.deadlineAt);
  if (Number.isFinite(startedAt) && Number.isFinite(deadlineAt)) {
    return {
      startedAt,
      deadlineAt,
      remainingMs: deadlineAt - Number(now),
      reused: true,
    };
  }
  const start = Number(now);
  return {
    startedAt: start,
    deadlineAt: start + safeMax,
    remainingMs: safeMax,
    reused: false,
  };
}

const ORDINARY_LESSON_TYPES = new Set([
  "vocabulary",
  "sentence_patterns",
  "grammar",
  "listening",
  "speaking",
  "story",
]);

export function isOrdinaryLessonCall(lessonType) {
  return ORDINARY_LESSON_TYPES.has(String(lessonType || ""));
}

function gateCallNodeType(node) {
  return String(node?.type || node?.nodeType || "");
}

/** Active ordinary lesson, otherwise the latest completed ordinary lesson in an open gate. */
export function pickGateCallTarget(section) {
  const nodes = Array.isArray(section?.nodes) ? section.nodes : [];
  if (!nodes.some((node) => node?.status !== "locked")) return null;
  const ordinary = (node) => isOrdinaryLessonCall(gateCallNodeType(node));
  const active = nodes.find((node) => node.status === "active" && ordinary(node));
  if (active) return active;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if ((node.status === "completed" || node.status === "skipped") && ordinary(node)) return node;
  }
  return null;
}

/**
 * Server check that the requested gate is already unlocked in the existing path.
 * A locked lesson id inside an open gate falls back to the gate's current target.
 */
export function resolveUnlockedGateCall(path, { sectionId, lessonId } = {}) {
  const sections = Array.isArray(path?.sections) ? path.sections : [];
  const requestedSection = String(sectionId || "").trim();
  const requestedId = String(lessonId || "").trim();
  let section = requestedSection ? sections.find((item) => item.sectionId === requestedSection) : null;
  if (!section && requestedId) {
    section = sections.find((item) => item.nodes?.some((node) => node.lessonId === requestedId)) || null;
  }
  if (!section) {
    return { ok: false, code: "GATE_LOCKED", message: "Cửa này chưa mở." };
  }
  const fallback = pickGateCallTarget(section);
  if (!fallback) {
    return { ok: false, code: "GATE_LOCKED", message: "Cửa này chưa mở." };
  }
  const requested = section.nodes.find((node) => node.lessonId === requestedId);
  const requestedOk =
    requested &&
    requested.status !== "locked" &&
    isOrdinaryLessonCall(gateCallNodeType(requested));
  const lesson = requestedOk ? requested : fallback;
  return {
    ok: true,
    sectionId: section.sectionId,
    topicTitle: section.topicTitle || section.sectionTitle || "",
    lessonId: lesson.lessonId,
    lessonType: gateCallNodeType(lesson),
  };
}

/** Level 1 cap from the Learn Call spec. Not derived from STT milliseconds. */
export function learnAiCallLevelOneLimits(difficulty = LEARN_CALL_DEFAULT_DIFFICULTY) {
  const key = learnCallDifficulty(difficulty) || LEARN_CALL_DEFAULT_DIFFICULTY;
  return {
    level: 1,
    difficulty: key,
    difficultyLabel: LEARN_CALL_DIFFICULTIES[key].label,
    levelLabel: `Mức ${LEARN_CALL_DIFFICULTIES[key].label}`,
    maxMinutes: 2,
    targetTurns: "3–4 lượt",
    remainingMinutes: null,
  };
}

export function learnAiCallWsUrl(env = process.env) {
  const raw = String(env.LEARN_AI_CALL_WS_URL || "").trim();
  if (!/^wss?:\/\//i.test(raw)) return "";
  return raw;
}

export function learnAiCallLevelOnePrompt(ctx = {}) {
  return learnCallTutorPrompt(ctx);
}

export function learnAiCallLevelOneHints(lesson) {
  const found = [];
  const questions = Array.isArray(lesson?.questions) ? lesson.questions : [];
  for (const question of questions) {
    const options = Array.isArray(question?.options) ? question.options : [];
    for (const option of options) {
      const text = String(option?.text || option?.en || "").trim();
      if (/[A-Za-z]/.test(text) && text.length <= 80 && !found.includes(text)) found.push(text);
      if (found.length >= 3) return found;
    }
  }
  return ["Hello! My name is ...", "I like ...", "Nice to meet you."];
}

/**
 * End-of-call summary from the stored session turns (memory is newest first).
 * No score and no pronunciation grade. Duration comes only from the server clock.
 * Tutor lines: complete = "Đã phát hết", interrupted = cut while playing,
 * cancelled = cancelled before any audio played, pending = not confirmed.
 */
export function learnAiCallSummary({ memory, startedAt, endedAt, deadlineAt, lesson } = {}) {
  const turns = Array.isArray(memory) ? memory : [];
  const chronological = [...turns].reverse();
  const transcript = [];
  for (const item of chronological) {
    const text = String(item?.content || "").trim();
    if (!text || (item?.role !== "user" && item?.role !== "assistant")) continue;
    const tutor = item.role === "assistant";
    transcript.push({
      role: tutor ? "tutor" : "user",
      requestId: Number(item.requestId) || 0,
      text,
      playback: tutor ? (["complete", "interrupted", "cancelled"].includes(item.playback) ? item.playback : "pending") : null,
      closing: tutor && item.closing === true,
    });
  }
  const learnerQuotes = transcript.filter((t) => t.role === "user").map((t) => t.text);
  const tutorBy = (playback) => transcript.filter((t) => t.role === "tutor" && t.playback === playback).map((t) => t.text);
  const playedTutorQuotes = tutorBy("complete");
  const interruptedTutorQuotes = tutorBy("interrupted");
  const cancelledTutorQuotes = tutorBy("cancelled");
  const unconfirmedTutorQuotes = tutorBy("pending");
  const start = startedAt == null || startedAt === "" ? NaN : Number(startedAt);
  let end = endedAt == null || endedAt === "" ? NaN : Number(endedAt);
  const deadline = deadlineAt == null || deadlineAt === "" ? NaN : Number(deadlineAt);
  if (Number.isFinite(end) && Number.isFinite(deadline)) end = Math.min(end, deadline);
  const durationSeconds = Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 1000) : null;
  return {
    score: null,
    pronunciation: "Chưa đánh giá",
    corrections: [],
    correctionNote: "Chưa đánh giá",
    durationSeconds,
    lessonTitle: String(lesson?.title || ""),
    objective: String(lesson?.objective || ""),
    learnerTurns: learnerQuotes.length,
    learnerQuotes,
    playedTutorQuotes,
    interruptedTutorQuotes,
    cancelledTutorQuotes,
    unconfirmedTutorQuotes,
    tutorPlayback: {
      complete: playedTutorQuotes.length,
      interrupted: interruptedTutorQuotes.length,
      cancelled: cancelledTutorQuotes.length,
      unconfirmed: unconfirmedTutorQuotes.length,
    },
    closed: transcript.some((t) => t.closing),
    transcript,
    practiced: learnerQuotes.length > 0,
  };
}

export function learnAiCallBindingMatches(boundUser, userId) {
  const bound = String(boundUser || "").trim();
  const current = String(userId || "").trim();
  return Boolean(bound) && bound === current;
}

export function learnCallEntryFromResponse(httpStatus, body) {
  const code = String(body?.code || "");
  if (httpStatus === 401 || code === "AUTH_REQUIRED") return { view: "login" };
  if (code === "SUBSCRIPTION_LOAD_FAILED" || httpStatus >= 500) return { view: "retry" };
  if (code === "FEATURE_DISABLED") return { view: "hidden" };
  if (code === "LESSON_NOT_CALLABLE" || code === "GATE_LOCKED") return { view: "unavailable" };
  if (code === "CALL_IN_PROGRESS") return { view: "retry" };
  if (code === "PACKAGE_QUOTA") return { view: "quota" };
  if (code === "TRIAL_NOT_INCLUDED" || code === "PAYWALL" || httpStatus === 402) return { view: "upgrade" };
  if (httpStatus === 403) return { view: "upgrade" };
  if (body?.data?.allowed) return { view: "prepare" };
  return { view: "retry" };
}

export function decideLearnAiCallAccess({
  enabled = false,
  plan = "expired",
  subscriptionLoaded = false,
  adminBypass = false,
  allowlisted = false,
} = {}) {
  if (!enabled) {
    return {
      allowed: false,
      status: 403,
      code: "FEATURE_DISABLED",
      plan: plan || "expired",
      adminBypass: false,
      message: "Cuộc gọi AI trong tab Học chưa mở.",
    };
  }

  if (!subscriptionLoaded) {
    return {
      allowed: false,
      status: 503,
      code: "SUBSCRIPTION_LOAD_FAILED",
      plan: "expired",
      adminBypass: false,
      message: "Không kiểm tra được gói học. Cuộc gọi chưa được mở.",
    };
  }

  if (adminBypass) {
    return {
      allowed: true,
      status: 200,
      code: "ADMIN_EXCEPTION",
      plan: "vip",
      adminBypass: true,
      reason: "Tài khoản quản trị được phép gọi để kiểm tra. Đây không phải gói học viên.",
    };
  }

  if (!allowlisted) {
    return {
      allowed: false,
      status: 403,
      code: "FEATURE_DISABLED",
      plan: plan || "expired",
      adminBypass: false,
      message: "Cuộc gọi AI trong tab Học chưa mở.",
    };
  }

  if (plan === "pro" || plan === "vip") {
    return {
      allowed: true,
      status: 200,
      code: "ALLOWED",
      plan,
      adminBypass: false,
    };
  }

  if (plan === "trial") {
    return {
      allowed: false,
      status: 403,
      code: "TRIAL_NOT_INCLUDED",
      plan,
      adminBypass: false,
      message: "Gói dùng thử chưa bao gồm cuộc gọi AI trong tab Học.",
    };
  }

  return {
    allowed: false,
    status: 402,
    code: "PAYWALL",
    plan: plan || "expired",
    adminBypass: false,
    message: "Cần gói Pro hoặc VIP còn hạn để gọi AI trong tab Học.",
  };
}

/**
 * Gateway check for Learn Call sockets only.
 * Tokens without this purpose keep the existing speaking-page behavior.
 */
export function learnAiCallSocketAllowed({ purpose, plan, sid, learnAllow } = {}) {
  if (purpose !== LEARN_AI_CALL_PURPOSE) {
    return { applies: false, allowed: true };
  }
  const sessionId = String(sid || "").trim();
  const currentPlan = String(plan || "");
  if ((currentPlan !== "pro" && currentPlan !== "vip") || !sessionId || Number(learnAllow) !== 1) {
    return { applies: true, allowed: false, reason: "plan" };
  }
  return { applies: true, allowed: true, sid: sessionId };
}
