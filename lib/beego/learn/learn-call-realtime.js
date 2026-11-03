/**
 * Learn Call Realtime Adapter & Server Controls (AI Tutor Stage 3 - GA Architecture)
 *
 * Implements official OpenAI Realtime API GA (Calls API over WebRTC):
 * 1. Unified single GA flow: POST https://api.openai.com/v1/realtime/calls
 *    - Sends multipart/form-data with `sdp` (application/sdp) and `session` (application/json).
 *    - Receives SDP answer and extracts official `call_id` from Location header (/v1/realtime/calls/{call_id}).
 * 2. Strict GA models only: gpt-realtime (default), gpt-realtime-2.1, gpt-realtime-2.1-mini.
 *    (All deprecated/shutdown preview models removed).
 * 3. Official Server Hangup: POST https://api.openai.com/v1/realtime/calls/{call_id}/hangup
 *    with retry and failure backoff; active call records are NEVER deleted on failure.
 * 4. Dual Watchdog:
 *    - Deadline Watchdog: Enforces max call minutes / daily package allowance.
 *    - Liveness Watchdog: Detects client disconnect / tab close / lost network when heartbeats cease.
 * 5. WebRTC VAD: Native server VAD manages turn-taking and barge-in cutoffs automatically.
 *    No artificial or arbitrary audio.currentTime truncation on MediaStream.
 *
 * Official docs reference:
 * - Realtime Calls API: https://platform.openai.com/docs/api-reference/realtime/calls
 * - Realtime WebRTC Guide: https://platform.openai.com/docs/guides/realtime-webrtc
 */

import { buildAiTutorSystemPromptV2 } from "./prompts/ai-tutor-system-prompt.v2.js";
import {
  claimLearnCallOpenLock,
  closeLearnCallAccounting,
  learnAiCallControlChannel,
  learnAiCallGateOpen,
  learnAiCallSessionKey,
  releaseLearnCallHold,
  releaseLearnCallOpenLock,
} from "./ai-call-access.js";
import { learnCallReleaseOpening } from "./learn-call-opening.js";
import { ingestLearnCallPilotSnapshot } from "./learn-call-pilot.js";

export { claimLearnCallOpenLock, releaseLearnCallOpenLock };

// GA Realtime models only. All preview/shutdown models strictly removed.
export const REALTIME_DEFAULT_MODEL = "gpt-realtime-mini";
export const REALTIME_DEFAULT_VOICE = "alloy";

export const REALTIME_ALLOWED_MODELS = new Set([
  "gpt-realtime",
  "gpt-realtime-mini",
  "gpt-realtime-1.5",
  "gpt-realtime-2",
  "gpt-realtime-2.1",
  "gpt-realtime-2.1-mini",
  "gpt-realtime-2025-08-28",
  "gpt-realtime-mini-2025-12-15",
]);

export const REALTIME_ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
]);

export const REALTIME_LIVENESS_TIMEOUT_MS = Number(process.env.LEARN_AI_CALL_REALTIME_LIVENESS_TIMEOUT_MS) || 25_000;
export const REALTIME_MAX_HANGUP_RETRIES = 3;

/** Server feature flag check for Realtime WebRTC transport */
export function isRealtimeEnabled(env = process.env) {
  return String(env.LEARN_AI_CALL_REALTIME_ENABLED || "").trim() === "1";
}

/**
 * Check if a specific user/caller is allowlisted for Realtime testing.
 * When LEARN_AI_CALL_REALTIME_ALLOWLIST is configured, strictly checks
 * against allowlisted emails/user IDs, or admin users in ADMIN_EMAILS.
 * Guarantees Realtime is NEVER opened to all users during staging/testing.
 */
export function isRealtimeUserAllowed({ email, userId, env = process.env } = {}) {
  if (!isRealtimeEnabled(env)) return false;

  const rawList = String(env.LEARN_AI_CALL_REALTIME_ALLOWLIST || "").trim();
  // Wildcard allows all (only if explicitly set)
  if (rawList === "*") return true;

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedUserId = String(userId || "").trim();

  // 1. Check explicit allowlist
  if (rawList) {
    const allowed = rawList.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (normalizedEmail && allowed.includes(normalizedEmail)) return true;
    if (normalizedUserId && allowed.includes(normalizedUserId)) return true;
  }

  // 2. Also check ADMIN_EMAILS for convenience on dev/staging
  const adminRaw = String(env.ADMIN_EMAILS || env.ADMIN_EMAIL || "").trim();
  if (adminRaw && normalizedEmail) {
    const adminEmails = adminRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.includes(normalizedEmail)) return true;
  }

  return false;
}

/** Validate and normalize Realtime model */
export function validateRealtimeModel(model) {
  const m = String(model || "").trim().toLowerCase();
  if (REALTIME_ALLOWED_MODELS.has(m)) return m;
  return REALTIME_DEFAULT_MODEL;
}

/** Validate and normalize Realtime voice (rejects legacy TTS voices like nova, fable, onyx) */
export function validateRealtimeVoice(voice) {
  const v = String(voice || "").trim().toLowerCase();
  if (REALTIME_ALLOWED_VOICES.has(v)) return v;
  return REALTIME_DEFAULT_VOICE;
}

/** Get validated Realtime configuration from environment */
export function getRealtimeConfig(env = process.env) {
  return {
    enabled: isRealtimeEnabled(env),
    model: validateRealtimeModel(env.OPENAI_REALTIME_MODEL),
    voice: validateRealtimeVoice(env.OPENAI_REALTIME_VOICE),
  };
}

/**
 * Builds Realtime instructions carrying forward Stage 2 pedagogy.
 * Enforces voice-first concise responses, bilingual assistance on request,
 * and targeted phrase scaffolding.
 */
export function buildRealtimeInstructions({ topicCtx = null, sessionMode = "lesson", teacherName = "Beego", opening = null } = {}) {
  const basePrompt = buildAiTutorSystemPromptV2({
    topic: topicCtx?.title || topicCtx?.topic || "Chào hỏi",
    sectionId: topicCtx?.sectionId || "",
    level: topicCtx?.level || "easy",
    teacherName: teacherName || topicCtx?.teacherName || "Beego",
  });

  const voicePolicy = [
    "REALTIME VOICE MODE CONSTRAINTS:",
    "1. You are speaking directly through natural two-way voice. Keep each response concise (1-2 short sentences max).",
    "2. Never produce markdown formatting, bullet points, asterisks, or unpronounceable symbols in voice output.",
    "3. Natural conversation rhythm: react warmly to the student's answer, then ask ONE question or offer ONE practice invitation.",
    "4. When the learner asks for help, explanation, or says 'em chưa hiểu' / 'giải thích tiếng Việt', provide 1-2 clear Vietnamese sentences immediately.",
    "5. Do NOT hallucinate personal facts about the user. When the learner asks 'and you?', answer briefly about your AI tutor persona and return focus to them.",
    sessionMode === "open"
      ? "6. Open Conversation Mode: Wait for the learner to start. Only invite briefly if they stay silent. Do not deliver a lesson greeting."
      : "6. Lesson Mode: Guide through 3-4 structured communicative steps to achieve the lesson goal. The app sends one opening turn; do not greet a second time after reconnect.",
    opening?.spoken
      ? `7. If you are asked to open, say: "${opening.spoken}" then wait.`
      : "",
  ].filter(Boolean).join("\n");

  return `${basePrompt}\n\n${voicePolicy}`;
}

/**
 * Creates an active Realtime WebRTC call directly via official OpenAI GA Calls API:
 * POST https://api.openai.com/v1/realtime/calls
 *
 * Uses multipart/form-data with:
 * - `sdp`: application/sdp
 * - `session`: application/json
 * Extracts official `call_id` from response Location header (/v1/realtime/calls/{call_id}).
 *
 * @param {object} params
 * @param {string} params.apiKey Server OpenAI API key (never leaked to client)
 * @param {string} params.sdpOffer WebRTC SDP offer string from client
 * @param {string} [params.model] Realtime GA model (e.g. gpt-realtime)
 * @param {string} [params.voice] Validated voice
 * @param {string} [params.instructions] Pedagogical instructions
 * @param {object} [params.turnDetection] VAD settings
 * @param {Function} [params.fetchFn] Injected fetch implementation
 * @returns {Promise<{ ok: boolean, callId?: string, sdpAnswer?: string, status?: number, error?: string, message?: string }>}
 */
export async function createRealtimeCall({
  apiKey,
  sdpOffer,
  model = REALTIME_DEFAULT_MODEL,
  voice = REALTIME_DEFAULT_VOICE,
  instructions = "",
  turnDetection = null,
  fetchFn = fetch,
} = {}) {
  if (!apiKey || typeof apiKey !== "string") {
    return { ok: false, status: 500, error: "MISSING_API_KEY", message: "Server OpenAI API key is not configured." };
  }
  if (!sdpOffer || typeof sdpOffer !== "string" || !sdpOffer.includes("v=")) {
    return { ok: false, status: 400, error: "INVALID_SDP_OFFER", message: "Valid SDP offer is required." };
  }

  const validatedModel = validateRealtimeModel(model);
  const validatedVoice = validateRealtimeVoice(voice);

  const sessionConfig = {
    type: "realtime",
    model: validatedModel,
    // The GA Calls API uses nested audio configuration, unlike Realtime beta.
    // Audio output also includes transcript events; requesting both is invalid.
    output_modalities: ["audio"],
    instructions: instructions || "You are Beego, an empathetic and supportive AI English tutor.",
    audio: {
      input: {
        turn_detection: turnDetection || {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        transcription: {
          model: "whisper-1",
        },
      },
      output: {
        voice: validatedVoice,
      },
    },
  };

  try {
    const formData = new FormData();
    formData.append("sdp", sdpOffer);
    formData.append("session", JSON.stringify(sessionConfig));

    const res = await fetchFn("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        error: "CREATE_CALL_FAILED",
        message: `OpenAI Realtime call creation failed (${res.status}): ${errText}`,
      };
    }

    // Extract call_id from official Location header (/v1/realtime/calls/{call_id})
    let callId = "";
    const location = res.headers?.get?.("location") || "";
    const match = location.match(/\/calls\/([^/?#]+)/);
    if (match) {
      callId = match[1];
    } else {
      callId = res.headers?.get?.("x-call-id") || "";
    }

    const sdpAnswer = await res.text();
    return {
      ok: true,
      status: res.status,
      callId,
      sdpAnswer,
      model: validatedModel,
      voice: validatedVoice,
    };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      error: "CALL_NETWORK_ERROR",
      message: err?.message || "Network error while connecting to OpenAI Realtime Calls API.",
    };
  }
}

/**
 * Officially terminates an active Realtime call via OpenAI calls API:
 * POST https://api.openai.com/v1/realtime/calls/{call_id}/hangup
 * Official docs: https://platform.openai.com/docs/api-reference/realtime/calls
 */
export async function hangupRealtimeCall({ apiKey, callId, fetchFn = fetch } = {}) {
  if (!apiKey || !callId) {
    return { ok: false, error: "MISSING_PARAMS", message: "API key and callId are required for hangup." };
  }

  try {
    const res = await fetchFn(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    // 200/204: Successful hangup
    // 404/410: Call already terminated or does not exist on provider -> treat as closed
    if (res.ok || res.status === 404 || res.status === 410) {
      return { ok: true, status: res.status, alreadyClosed: res.status === 404 || res.status === 410 };
    }

    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: "HANGUP_FAILED",
      message: `OpenAI hangup call failed (${res.status}): ${errText}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      error: "HANGUP_NETWORK_ERROR",
      message: err?.message || "Network error while calling hangup endpoint.",
    };
  }
}

// ============================================================================
// Redis Session Binding, Dual Watchdog (Deadline & Liveness) & Controls
// ============================================================================

export function realtimeSessionKey(sessionId) {
  return `voice:realtime-session:${sessionId}`;
}

export function realtimeProviderIndexKey(callId) {
  return `voice:realtime-provider:${callId}`;
}

export function realtimeLivenessKey(sessionId) {
  return `voice:realtime-liveness:${sessionId}`;
}

export const REALTIME_ACTIVE_CALLS_SET = "voice:realtime-active-calls";
export const REALTIME_DEAD_LETTER_KEY = "voice:realtime-dead-letter";
export const REALTIME_RECONCILIATION_KEY = "voice:realtime-reconciliation";

/** Register active call in sorted set scored by deadlineAt for server watchdog */
export async function registerActiveRealtimeCall(redis, { sessionId, deadlineAt }) {
  if (!redis || !sessionId) return;
  const deadline = Number(deadlineAt) || Date.now() + 120_000;
  if (typeof redis.zadd === "function") {
    await redis.zadd(REALTIME_ACTIVE_CALLS_SET, deadline, String(sessionId));
  }
}

/** Unregister call from active watchdog set */
export async function unregisterActiveRealtimeCall(redis, sessionId) {
  if (!redis || !sessionId) return;
  if (typeof redis.zrem === "function") {
    await redis.zrem(REALTIME_ACTIVE_CALLS_SET, String(sessionId));
  }
}

/** Record or update client liveness heartbeat */
export async function touchRealtimeLiveness(redis, sessionId, now = Date.now()) {
  if (!redis || !sessionId) return;
  await redis.set(realtimeLivenessKey(sessionId), String(now), "EX", 60);
}

/**
 * Idempotently reserves a Realtime session in Redis.
 * Explicitly separates:
 * - sessionId (Beego internal session UUID)
 * - callId (OpenAI active WebRTC call ID from Location header)
 */
export async function reserveRealtimeSession(
  redis,
  { userId, sessionId, callId, deadlineAt, limits = {} } = {}
) {
  if (!redis || !sessionId) return { ok: false, error: "INVALID_PARAMS" };

  const sessionKey = realtimeSessionKey(sessionId);
  const now = Date.now();
  const deadline = Number(deadlineAt) || now + 120_000;
  const ttlSeconds = Math.max(60, Math.ceil((deadline - now) / 1000) + 60);

  const sessionData = {
    userId: String(userId),
    sessionId: String(sessionId),
    callId: String(callId || ""),
    status: "active",
    createdAt: now,
    deadlineAt: deadline,
    lastLivenessAt: now,
    hangupAttempts: 0,
    reservedUsageMs: limits?.packageReservedMs || limits?.packageRemainingMs || 120_000,
    model: String(limits?.model || ""),
    settled: false,
    beegoSettled: false,
    durationMs: 0,
  };

  await redis.set(sessionKey, JSON.stringify(sessionData), "EX", ttlSeconds);

  if (callId) {
    await redis.set(realtimeProviderIndexKey(callId), String(sessionId), "EX", ttlSeconds);
  }

  // Register in active watchdog set and initialize liveness
  await registerActiveRealtimeCall(redis, { sessionId, deadlineAt: deadline });
  await touchRealtimeLiveness(redis, sessionId, now);

  return { ok: true, session: sessionData };
}

/**
 * Clean rollback if Realtime call creation fails after user lock was claimed.
 */
export async function rollbackRealtimeSession(redis, { userId, sessionId } = {}) {
  if (!redis || !sessionId) return;
  try {
    const raw = await redis.get(realtimeSessionKey(sessionId));
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.callId) {
        await redis.del(realtimeProviderIndexKey(data.callId));
      }
      await redis.del(realtimeSessionKey(sessionId));
    }
    await unregisterActiveRealtimeCall(redis, sessionId);
    await redis.del(realtimeLivenessKey(sessionId));
    await redis.del(learnAiCallSessionKey(sessionId));
    await learnCallReleaseOpening(redis, sessionId);
    await releaseLearnCallHold(redis, { userId, sessionId });
    await releaseLearnCallOpenLock(redis, { userId, sessionId });
  } catch {
    /* ignore cleanup errors */
  }
}

async function persistRealtimePilotLedger(redis, sessionData, { reason, durationMs, settle } = {}) {
  if (!redis || !sessionData?.sessionId) return null;
  try {
    const telemetry = sessionData.pilotTelemetry && typeof sessionData.pilotTelemetry === "object" ? sessionData.pilotTelemetry : {};
    return await ingestLearnCallPilotSnapshot(redis, {
      sessionId: sessionData.sessionId,
      transport: "realtime",
      model: sessionData.model || telemetry.model || "",
      startedAt: sessionData.createdAt,
      endedAt: Date.now(),
      durationMs,
      endReason: reason || sessionData.terminationReason || "",
      quotaChargedMs: settle?.consumedMs,
      quotaStatus: settle?.status || "",
      usage: telemetry.usage,
      experience: { ...(telemetry.experience || {}), endReason: reason || "" },
    });
  } catch {
    return null;
  }
}

async function settleRealtimeBeegoSide(redis, sessionData, { reason, durationMs } = {}) {
  const accounting = await closeLearnCallAccounting(redis, {
    userId: sessionData?.userId,
    sessionId: sessionData?.sessionId,
    startedAt: sessionData?.createdAt,
  });
  await persistRealtimePilotLedger(redis, sessionData, {
    reason,
    durationMs,
    settle: accounting.settle,
  });
  return accounting;
}

/**
 * Idempotently settles a Realtime session.
 * Guarantees single-settlement even if called multiple times or on reconnect.
 */
export async function settleRealtimeSession(
  redis,
  { userId, sessionId, durationMs = 0, reason = "ended" } = {}
) {
  if (!redis || !sessionId) return { settled: false, reason: "missing_redis_or_id" };

  const sessionKey = realtimeSessionKey(sessionId);
  const raw = await redis.get(sessionKey);
  if (!raw) {
    return { settled: false, reason: "session_not_found" };
  }

  let sessionData = null;
  try {
    sessionData = JSON.parse(raw);
  } catch {
    return { settled: false, reason: "corrupted_session" };
  }

  // Idempotency: do NOT double-charge or settle twice
  if (sessionData.settled) {
    if (!sessionData.beegoSettled) {
      await settleRealtimeBeegoSide(redis, { ...sessionData, userId: userId || sessionData.userId }, {
        reason: sessionData.terminationReason || reason,
        durationMs: sessionData.durationMs,
      });
    }
    return { settled: false, alreadySettled: true, durationMs: sessionData.durationMs };
  }

  sessionData.userId = userId || sessionData.userId;
  sessionData.settled = true;
  sessionData.beegoSettled = true;
  sessionData.status = "terminated";
  sessionData.durationMs = Math.max(0, Number(durationMs) || Date.now() - Number(sessionData.createdAt || Date.now()));
  sessionData.settledAt = Date.now();
  sessionData.terminationReason = reason;

  // Persist settled state with short TTL
  await redis.set(sessionKey, JSON.stringify(sessionData), "EX", 300);

  // Unregister from watchdog active set and cleanup liveness
  await unregisterActiveRealtimeCall(redis, sessionId);
  await redis.del(realtimeLivenessKey(sessionId));

  const accounting = await settleRealtimeBeegoSide(redis, sessionData, {
    reason,
    durationMs: sessionData.durationMs,
  });

  return {
    settled: true,
    alreadySettled: false,
    durationMs: sessionData.durationMs,
    quotaStatus: accounting.settle?.status || "",
    quotaChargedMs: accounting.settle?.consumedMs || 0,
  };
}

/**
 * Server-controlled termination / hangup with retry safety.
 * Active call record is NOT deleted if hangup fails.
 */
export async function terminateRealtimeSession(
  redis,
  { sessionId, reason = "user_hangup", userId, apiKey, fetchFn = fetch } = {}
) {
  if (!redis || !sessionId) return { ok: false, error: "MISSING_SESSION_ID" };

  const raw = await redis.get(realtimeSessionKey(sessionId));
  let sessionData = null;
  try {
    sessionData = raw ? JSON.parse(raw) : null;
  } catch {
    sessionData = null;
  }

  const callId = sessionData?.callId;
  const effectiveUserId = userId || sessionData?.userId;

  if (sessionData?.settled) {
    if (callId && apiKey) {
      await hangupRealtimeCall({ apiKey, callId, fetchFn });
    }
    await unregisterActiveRealtimeCall(redis, sessionId);
    return { ok: true, alreadySettled: true, terminated: true };
  }

  // 1. Proactively call OpenAI hangup endpoint if callId and apiKey are present
  if (callId && apiKey) {
    const hangupRes = await hangupRealtimeCall({ apiKey, callId, fetchFn });
    if (!hangupRes.ok) {
      const attempts = (sessionData?.hangupAttempts || 0) + 1;
      if (sessionData) {
        sessionData.hangupAttempts = attempts;
        sessionData.lastHangupError = hangupRes.message;
        if (attempts < REALTIME_MAX_HANGUP_RETRIES) {
          sessionData.status = "hangup_pending";
          await redis.set(realtimeSessionKey(sessionId), JSON.stringify(sessionData), "KEEPTTL");
          return { ok: false, retrying: true, attempts, error: hangupRes.error, message: hangupRes.message };
        } else {
          sessionData.status = "hangup_failed_reconciliation_needed";
          sessionData.unresolved = true;
          sessionData.failedAt = Date.now();
          await redis.set(realtimeSessionKey(sessionId), JSON.stringify(sessionData), "EX", 86400 * 7);
          if (typeof redis.hset === "function") {
            await redis.hset(
              REALTIME_RECONCILIATION_KEY,
              sessionId,
              JSON.stringify({
                sessionId,
                callId,
                userId: effectiveUserId,
                attempts,
                error: hangupRes.message,
                failedAt: Date.now(),
                status: "pending_reconciliation",
              })
            );
          }
          if (typeof redis.lpush === "function") {
            await redis.lpush(
              REALTIME_DEAD_LETTER_KEY,
              JSON.stringify({ sid: sessionId, callId, userId: effectiveUserId, error: hangupRes.message, at: Date.now() })
            );
          }
          await unregisterActiveRealtimeCall(redis, sessionId);
          // Provider hangup is unresolved, but Beego lock/quota must not stay held.
          if (!sessionData.beegoSettled) {
            const durationMs = Math.max(0, Date.now() - Number(sessionData.createdAt || Date.now()));
            await settleRealtimeBeegoSide(redis, { ...sessionData, userId: effectiveUserId }, {
              reason: "hangup_failed",
              durationMs,
            });
            sessionData.beegoSettled = true;
            await redis.set(realtimeSessionKey(sessionId), JSON.stringify(sessionData), "EX", 86400 * 7);
          }
          return { ok: false, reconciliationNeeded: true, attempts, error: hangupRes.error, message: hangupRes.message };
        }
      }
      return { ok: false, retrying: false, attempts, error: hangupRes.error, message: hangupRes.message };
    }
  }

  // 2. Unregister from watchdog active set
  await unregisterActiveRealtimeCall(redis, sessionId);

  // 3. Publish termination signal to control channel
  try {
    await redis.publish(
      learnAiCallControlChannel(),
      JSON.stringify({
        type: "terminate",
        sessionId,
        callId,
        reason,
        timestamp: Date.now(),
      })
    );
  } catch {
    /* continue to settle */
  }

  // 4. Settle session in Redis
  await settleRealtimeSession(redis, { userId: effectiveUserId, sessionId, reason });
  return { ok: true, terminated: true };
}

/**
 * Dual Server Watchdog:
 * Proactively checks:
 * 1. Admin Gate Closed: immediately terminates all active calls.
 * 2. Deadline Exceeded: terminates calls past deadlineAt.
 * 3. Client Disconnect / Lost Liveness: terminates calls when no heartbeat received within REALTIME_LIVENESS_TIMEOUT_MS.
 *
 * Retry & Failure Safety:
 * - If hangup fails, the active-call record is RETAINED with exponential retry backoff.
 * - Call is only unregistered upon verified hangup (or 404/410) or after exceeding REALTIME_MAX_HANGUP_RETRIES.
 */
export async function scanAndHangupExpiredRealtimeCalls(
  redis,
  { apiKey, now = Date.now(), fetchFn = fetch } = {}
) {
  if (!redis || typeof redis.zrange !== "function") return { scanned: 0, terminated: 0, retried: 0, expiredSessionIds: [] };

  const gateOpen = await learnAiCallGateOpen(redis);
  const activeSessionIds = await redis.zrange(REALTIME_ACTIVE_CALLS_SET, 0, -1);

  if (!Array.isArray(activeSessionIds) || activeSessionIds.length === 0) {
    return { scanned: 0, terminated: 0, retried: 0, expiredSessionIds: [] };
  }

  let terminatedCount = 0;
  let retriedCount = 0;
  const processedSessionIds = [];

  for (const sid of activeSessionIds) {
    const raw = await redis.get(realtimeSessionKey(sid));
    let sessionData = null;
    try {
      sessionData = raw ? JSON.parse(raw) : null;
    } catch {
      sessionData = null;
    }

    if (!sessionData) {
      // Missing data, purge invalid member
      await unregisterActiveRealtimeCall(redis, sid);
      continue;
    }

    const deadlineAt = Number(sessionData.deadlineAt) || 0;
    const livenessRaw = await redis.get(realtimeLivenessKey(sid));
    const lastLivenessAt = livenessRaw ? Number(livenessRaw) : Number(sessionData.lastLivenessAt) || 0;

    let shouldTerminate = false;
    let terminationReason = "";

    if (!gateOpen) {
      shouldTerminate = true;
      terminationReason = "gate_closed";
    } else if (now >= deadlineAt) {
      shouldTerminate = true;
      terminationReason = "deadline_exceeded";
    } else if (now - lastLivenessAt > REALTIME_LIVENESS_TIMEOUT_MS) {
      // Liveness watchdog: Client dropped connection / closed tab without DELETE
      shouldTerminate = true;
      terminationReason = "client_disconnect_liveness_timeout";
    }

    if (shouldTerminate) {
      const callId = sessionData.callId;
      const userId = sessionData.userId;

      if (callId && apiKey) {
        const hangupRes = await hangupRealtimeCall({ apiKey, callId, fetchFn });
        if (!hangupRes.ok) {
          // Failure handling: do NOT delete active-call record and leave orphan!
          const attempts = (sessionData.hangupAttempts || 0) + 1;
          sessionData.hangupAttempts = attempts;
          sessionData.lastHangupError = hangupRes.message;

          if (attempts < REALTIME_MAX_HANGUP_RETRIES) {
            // Keep in active set with short backoff for next tick
            await redis.set(realtimeSessionKey(sid), JSON.stringify(sessionData), "KEEPTTL");
            retriedCount += 1;
            continue; // Skip unregistering! Retries on next tick.
          } else {
            // Max retries exceeded: retain in reconciliation registry, do NOT settle cleanly!
            sessionData.status = "hangup_failed_reconciliation_needed";
            sessionData.unresolved = true;
            sessionData.failedAt = now;
            await redis.set(realtimeSessionKey(sid), JSON.stringify(sessionData), "EX", 86400 * 7);
            if (typeof redis.hset === "function") {
              await redis.hset(
                REALTIME_RECONCILIATION_KEY,
                sid,
                JSON.stringify({
                  sessionId: sid,
                  callId,
                  userId,
                  attempts,
                  error: hangupRes.message,
                  failedAt: now,
                  status: "pending_reconciliation",
                })
              );
            }
            if (typeof redis.lpush === "function") {
              await redis.lpush(
                REALTIME_DEAD_LETTER_KEY,
                JSON.stringify({ sid, callId, userId, error: hangupRes.message, at: now })
              );
            }
            // Remove from rapid active watchdog scan set to prevent tight polling
            await unregisterActiveRealtimeCall(redis, sid);
            if (!sessionData.beegoSettled) {
              const durationMs = Math.max(0, now - Number(sessionData.createdAt || now));
              await settleRealtimeBeegoSide(redis, sessionData, {
                reason: "hangup_failed",
                durationMs,
              });
              sessionData.beegoSettled = true;
              await redis.set(realtimeSessionKey(sid), JSON.stringify(sessionData), "EX", 86400 * 7);
            }
            console.warn(
              `[REALTIME_ALERT] Hangup failed after ${attempts} attempts for callId ${callId}, sessionId ${sid}. Beego quota/lock released; provider hangup retained in reconciliation registry.`
            );
            continue; // Do NOT mark provider settled; retry hangup from the dead-letter path.
          }
        }
      }

      // Successful hangup or already dead: settle and unregister cleanly
      await settleRealtimeSession(redis, {
        userId,
        sessionId: sid,
        reason: terminationReason,
      });

      await unregisterActiveRealtimeCall(redis, sid);
      terminatedCount += 1;
      processedSessionIds.push(sid);
    }
  }

  return { scanned: activeSessionIds.length, terminated: terminatedCount, retried: retriedCount, expiredSessionIds: processedSessionIds };
}

/**
 * Returns all active reconciliation records for unclosed Realtime calls.
 */
export async function getRealtimeReconciliationCalls(redis) {
  if (!redis || typeof redis.hgetall !== "function") return [];
  const all = await redis.hgetall(REALTIME_RECONCILIATION_KEY);
  if (!all) return [];
  return Object.values(all)
    .map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Manually marks a failed Realtime hangup as reconciled by operator or reconciliation worker.
 */
export async function resolveRealtimeReconciliation(redis, sessionId, { resolutionNotes = "" } = {}) {
  if (!redis || !sessionId) return { ok: false };
  if (typeof redis.hdel === "function") {
    await redis.hdel(REALTIME_RECONCILIATION_KEY, sessionId);
  }
  const raw = await redis.get(realtimeSessionKey(sessionId));
  if (raw) {
    try {
      const data = JSON.parse(raw);
      const needsBeego = !data.beegoSettled;
      data.status = "reconciled_manual";
      data.settled = true;
      data.beegoSettled = true;
      data.resolutionNotes = resolutionNotes;
      await redis.set(realtimeSessionKey(sessionId), JSON.stringify(data), "EX", 86400);
      if (needsBeego) {
        await settleRealtimeBeegoSide(redis, data, { reason: "reconciled_manual", durationMs: data.durationMs });
      }
    } catch {
      /* ignore */
    }
  }
  return { ok: true, sessionId };
}

// ============================================================================
// Event Mapping (Server VAD handles interruption; no arbitrary currentTime truncate)
// ============================================================================

/**
 * Maps OpenAI DataChannel events into structured Beego Learn Call events.
 * Clearly separates generated vs played states.
 */
export function mapRealtimeEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== "object") return null;
  const meta = {
    eventId: rawEvent.event_id || "",
    responseId: rawEvent.response_id || rawEvent.response?.id || "",
    closing: rawEvent.response?.metadata?.beego_closing === "1",
    itemId: rawEvent.item_id || rawEvent.item?.id || "",
    outputIndex: Number.isInteger(rawEvent.output_index) ? rawEvent.output_index : null,
    contentIndex: Number.isInteger(rawEvent.content_index) ? rawEvent.content_index : 0,
    ...(Object.hasOwn(rawEvent, "previous_item_id") ? { previousItemId: rawEvent.previous_item_id } : {}),
  };

  switch (rawEvent.type) {
    case "session.created":
      return {
        type: "realtime_session_ready",
        sessionId: rawEvent.session?.id || "",
        model: rawEvent.session?.model || "",
        voice: rawEvent.session?.audio?.output?.voice || rawEvent.session?.voice || "",
      };

    case "input_audio_buffer.speech_started":
      // User started speaking -> Trigger immediate client audio mute/pause.
      // Server VAD natively stops AI audio generation on provider.
      return {
        ...meta,
        type: "user_speech_started",
        itemId: rawEvent.item_id || "",
        audioStartTimeMs: rawEvent.audio_start_ms || 0,
      };

    case "input_audio_buffer.speech_stopped":
      return {
        ...meta,
        type: "user_speech_stopped",
        itemId: rawEvent.item_id || "",
        audioEndTimeMs: rawEvent.audio_end_ms || 0,
      };

    case "input_audio_buffer.committed":
      return { ...meta, type: "user_item_committed" };

    case "conversation.item.created":
    case "conversation.item.added":
      return { ...meta, type: "conversation_item", role: rawEvent.item?.role || "" };

    case "response.output_item.added":
      return { ...meta, type: "assistant_item_added" };

    case "conversation.item.input_audio_transcription.delta":
      return { ...meta, type: "user_transcript_delta", delta: String(rawEvent.delta || "") };

    case "conversation.item.input_audio_transcription.completed":
      return {
        ...meta,
        type: "user_transcript_final",
        itemId: rawEvent.item_id || "",
        text: String(rawEvent.transcript || "").trim(),
        role: "user",
      };

    case "response.created":
      return {
        ...meta,
        type: "assistant_turn_started",
        responseId: rawEvent.response?.id || "",
      };

    case "response.output_audio_transcript.delta":
    case "response.audio_transcript.delta":
      return {
        ...meta,
        type: "assistant_transcript_delta",
        responseId: rawEvent.response_id || "",
        itemId: rawEvent.item_id || "",
        delta: rawEvent.delta || "",
        role: "assistant",
      };

    case "response.output_audio_transcript.done":
    case "response.audio_transcript.done":
      return { ...meta, type: "assistant_transcript_final", text: String(rawEvent.transcript || "") };

    case "output_audio_buffer.started":
      return { ...meta, type: "assistant_audio_started" };
    case "output_audio_buffer.stopped":
      return { ...meta, type: "assistant_audio_stopped" };
    case "output_audio_buffer.cleared":
      return { ...meta, type: "assistant_audio_cleared" };

    case "conversation.item.input_audio_transcription.failed":
      return { ...meta, type: "transcription_error", error: rawEvent.error || {} };
    case "error":
      return { ...meta, type: "provider_error", error: rawEvent.error || {} };

    case "response.done":
      return {
        ...meta,
        type: "assistant_turn_done",
        responseId: rawEvent.response?.id || "",
        status: rawEvent.response?.status || "completed",
        usage: rawEvent.response?.usage || null,
        generationDone: true,
        error: rawEvent.response?.status_details?.error || null,
        // Keep item/content boundaries: a response can contain multiple outputs.
        transcripts: (rawEvent.response?.output || []).flatMap((item, outputIndex) =>
          (item.content || []).flatMap((part, contentIndex) =>
            typeof part.transcript === "string"
              ? [{ responseId: meta.responseId, itemId: item.id || "", outputIndex, contentIndex, text: part.transcript }]
              : []
          )
        ),
      };

    default:
      return null;
  }
}

/**
 * Builds OpenAI response cancel event for explicit manual cancellation.
 */
export function buildCancelEvent() {
  return {
    type: "response.cancel",
  };
}

/** Official OpenAI Realtime GA pricing table (per 1,000,000 tokens) */
export const REALTIME_PRICING = {
  "gpt-realtime-mini": {
    textInputPerMillion: 0.6,
    textOutputPerMillion: 2.4,
    audioInputPerMillion: 10.0,
    audioOutputPerMillion: 20.0,
  },
  "gpt-realtime": {
    textInputPerMillion: 5.0,
    textOutputPerMillion: 20.0,
    audioInputPerMillion: 40.0,
    audioOutputPerMillion: 80.0,
  },
};

/**
 * Calculates exact session cost from OpenAI Realtime usage event without hardcoded caps.
 */
export function calculateRealtimeCost({ model = "gpt-realtime-mini", usage = {} } = {}) {
  const normModel = String(model || "").includes("mini") ? "gpt-realtime-mini" : "gpt-realtime";
  const rates = REALTIME_PRICING[normModel] || REALTIME_PRICING["gpt-realtime-mini"];

  const textIn = Number(usage?.input_token_details?.text_tokens ?? (usage?.input_tokens || 0));
  const audioIn = Number(usage?.input_token_details?.audio_tokens ?? 0);
  const textOut = Number(usage?.output_token_details?.text_tokens ?? (usage?.output_tokens || 0));
  const audioOut = Number(usage?.output_token_details?.audio_tokens ?? 0);

  const costTextIn = (textIn / 1_000_000) * rates.textInputPerMillion;
  const costAudioIn = (audioIn / 1_000_000) * rates.audioInputPerMillion;
  const costTextOut = (textOut / 1_000_000) * rates.textOutputPerMillion;
  const costAudioOut = (audioOut / 1_000_000) * rates.audioOutputPerMillion;

  const totalCostUsd = costTextIn + costAudioIn + costTextOut + costAudioOut;

  return {
    totalCostUsd: Number(totalCostUsd.toFixed(6)),
    breakdown: {
      model: normModel,
      textInputCostUsd: Number(costTextIn.toFixed(6)),
      audioInputCostUsd: Number(costAudioIn.toFixed(6)),
      textOutputCostUsd: Number(costTextOut.toFixed(6)),
      audioOutputCostUsd: Number(costAudioOut.toFixed(6)),
      tokens: {
        textIn,
        audioIn,
        textOut,
        audioOut,
        total: usage?.total_tokens || textIn + audioIn + textOut + audioOut,
      },
    },
  };
}
