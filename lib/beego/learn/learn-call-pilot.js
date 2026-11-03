/**
 * Pilot ledger for Learn Call: per-session usage, cost quality, and experience metrics.
 * Operational telemetry only — no transcripts, audio, names, or selling prices.
 */

/** Keep in sync with REALTIME_PRICING in learn-call-realtime.js. Internal cost math only — not a selling price. */
const REALTIME_COST_RATES = {
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

export const LEARN_CALL_LEDGER_TTL_SEC = 60 * 60 * 24 * 7;
export const LEARN_CALL_FIRST_UTTERANCE_WINDOW_MS = 20_000;

/** Public-list estimates for Azure Speech. Not a selling price and not billed from this table. */
export const AZURE_SPEECH_COST_ESTIMATE = Object.freeze({
  source: "estimate",
  sttUsdPerHour: 1,
  ttsUsdPerMillionChars: 15,
  note: "Public list approximation for STT audio-hour and neural TTS characters. Pronunciation Assessment is treated as STT when audio ms exist.",
});

/** Suggested DEV/pilot knobs. Code does not apply these automatically. */
export const LEARN_CALL_PILOT_PROPOSAL = Object.freeze({
  sessionMaxMinutes: 2,
  keepTwoMinuteCap: true,
  lengthenOnlyIf: "learners regularly hit the deadline before role-reversal or applying the target",
  dailyTestQuotaMs: {
    pro: 8 * 60 * 1000,
    vip: 12 * 60 * 1000,
  },
  flags: ["LEARN_AI_CALL_ENABLED=1", "LEARN_AI_CALL_ALLOWLIST", "voice:learn-call-gate=1", "LEARN_AI_CALL_QUOTA_MODE=test"],
  firstUtteranceWindowMs: LEARN_CALL_FIRST_UTTERANCE_WINDOW_MS,
});

export function learnCallLedgerKey(sessionId) {
  return `voice:learn-call-ledger:${String(sessionId || "").trim()}`;
}

export function learnCallUsageSeenKey(sessionId) {
  return `voice:learn-call-usage-seen:${String(sessionId || "").trim()}`;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function asInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function emptyLearnCallUsage() {
  return {
    audioInTokens: 0,
    audioOutTokens: 0,
    textInTokens: 0,
    textOutTokens: 0,
    sttAudioMs: 0,
    ttsBytes: 0,
    ttsChars: 0,
    pronunciationAudioMs: 0,
    llmTokensIn: 0,
    llmTokensOut: 0,
  };
}

export function usageFromRealtimeEvent(usage = {}) {
  return {
    audioInTokens: asInt(usage?.input_token_details?.audio_tokens),
    audioOutTokens: asInt(usage?.output_token_details?.audio_tokens),
    textInTokens: asInt(usage?.input_token_details?.text_tokens ?? usage?.input_tokens),
    textOutTokens: asInt(usage?.output_token_details?.text_tokens ?? usage?.output_tokens),
  };
}

/**
 * Drop duplicate provider responses; add later/late events that carry new totals or deltas.
 * `mode: "delta"` adds; `mode: "snapshot"` keeps the max (client cumulative).
 */
export function mergeLearnCallUsage(previous, incoming, { mode = "delta", responseId = "" } = {}) {
  const prev = { ...emptyLearnCallUsage(), ...(previous && typeof previous === "object" ? previous : {}) };
  const seen = Array.isArray(prev.seenResponseIds) ? [...prev.seenResponseIds] : [];
  const rid = String(responseId || "").trim();
  if (rid && seen.includes(rid)) {
    return { ...prev, seenResponseIds: seen, duplicate: true };
  }
  if (rid) seen.push(rid);
  const next = { ...emptyLearnCallUsage(), ...(incoming && typeof incoming === "object" ? incoming : {}) };
  const out = { ...prev, seenResponseIds: seen, duplicate: false };
  for (const key of Object.keys(emptyLearnCallUsage())) {
    const a = asInt(prev[key]);
    const b = asInt(next[key]);
    out[key] = mode === "snapshot" ? Math.max(a, b) : a + b;
  }
  return out;
}

export function estimateAzureSpeechUsd({ sttAudioMs = 0, ttsChars = 0, ttsBytes = 0, pronunciationAudioMs = 0 } = {}) {
  const sttHours = (asInt(sttAudioMs) + asInt(pronunciationAudioMs)) / 3_600_000;
  const chars = asInt(ttsChars) || Math.round(asInt(ttsBytes) / 2);
  const sttUsd = sttHours * AZURE_SPEECH_COST_ESTIMATE.sttUsdPerHour;
  const ttsUsd = (chars / 1_000_000) * AZURE_SPEECH_COST_ESTIMATE.ttsUsdPerMillionChars;
  return {
    source: "estimate",
    sttUsd: Number(sttUsd.toFixed(6)),
    ttsUsd: Number(ttsUsd.toFixed(6)),
    pronunciationUsd: Number(((asInt(pronunciationAudioMs) / 3_600_000) * AZURE_SPEECH_COST_ESTIMATE.sttUsdPerHour).toFixed(6)),
    totalUsd: Number((sttUsd + ttsUsd).toFixed(6)),
  };
}

function realtimeProviderCost({ model = "", usage = {} } = {}) {
  const normModel = String(model || "").includes("mini") ? "gpt-realtime-mini" : "gpt-realtime";
  const rates = REALTIME_COST_RATES[normModel] || REALTIME_COST_RATES["gpt-realtime-mini"];
  const textIn = asInt(usage.textInTokens);
  const audioIn = asInt(usage.audioInTokens);
  const textOut = asInt(usage.textOutTokens);
  const audioOut = asInt(usage.audioOutTokens);
  const costTextIn = (textIn / 1_000_000) * rates.textInputPerMillion;
  const costAudioIn = (audioIn / 1_000_000) * rates.audioInputPerMillion;
  const costTextOut = (textOut / 1_000_000) * rates.textOutputPerMillion;
  const costAudioOut = (audioOut / 1_000_000) * rates.audioOutputPerMillion;
  return {
    totalCostUsd: Number((costTextIn + costAudioIn + costTextOut + costAudioOut).toFixed(6)),
    breakdown: {
      model: normModel,
      textInputCostUsd: Number(costTextIn.toFixed(6)),
      audioInputCostUsd: Number(costAudioIn.toFixed(6)),
      textOutputCostUsd: Number(costTextOut.toFixed(6)),
      audioOutputCostUsd: Number(costAudioOut.toFixed(6)),
      tokens: { textIn, audioIn, textOut, audioOut, total: textIn + audioIn + textOut + audioOut },
    },
  };
}

export function learnCallSessionCost({ model = "", usage = {}, transport = "ws" } = {}) {
  const realtimeTokens =
    asInt(usage.audioInTokens) + asInt(usage.audioOutTokens) + asInt(usage.textInTokens) + asInt(usage.textOutTokens);
  const azure = estimateAzureSpeechUsd(usage);
  if (transport === "realtime" && realtimeTokens > 0) {
    const provider = realtimeProviderCost({ model, usage });
    return {
      quality: "provider",
      totalUsd: Number((provider.totalCostUsd + azure.totalUsd).toFixed(6)),
      realtime: { source: "provider", ...provider },
      azure,
    };
  }
  if (transport === "ws" && (asInt(usage.sttAudioMs) > 0 || asInt(usage.ttsBytes) > 0 || asInt(usage.llmTokensIn) > 0)) {
    return {
      quality: "estimate",
      totalUsd: azure.totalUsd,
      realtime: { source: "missing", totalCostUsd: 0 },
      azure,
      note: "WebSocket Learn Call skips shared speaking counters; Azure/OpenAI here are estimates from gateway audio/chars, not a provider invoice.",
    };
  }
  return {
    quality: "missing",
    totalUsd: 0,
    realtime: { source: "missing", totalCostUsd: 0 },
    azure: { source: "missing", totalUsd: 0 },
  };
}

export function percentile(values, p) {
  const list = (Array.isArray(values) ? values : []).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!list.length) return null;
  const rank = Math.min(list.length - 1, Math.max(0, Math.ceil((p / 100) * list.length) - 1));
  return list[rank];
}

export function learnCallExperienceSummary({
  callReadyAt = 0,
  openingAudibleAt = 0,
  firstValidLearnerAt = 0,
  turnLatenciesMs = [],
  achieved = [],
  retryExhausted = 0,
  learnerContentTurns = 0,
  endReason = "",
  usageQuality = "missing",
} = {}) {
  const ready = num(callReadyAt);
  const opening = num(openingAudibleAt);
  const first = num(firstValidLearnerAt);
  const openingMs = ready && opening && opening >= ready ? opening - ready : null;
  const timeToFirstValidMs = ready && first && first >= ready ? first - ready : null;
  return {
    openingMs,
    timeToFirstValidMs,
    firstValidWithin20s: timeToFirstValidMs != null ? timeToFirstValidMs <= LEARN_CALL_FIRST_UTTERANCE_WINDOW_MS : false,
    hadValidUtterance: Boolean(first),
    turnLatencyP50Ms: percentile(turnLatenciesMs, 50),
    turnLatencyP95Ms: percentile(turnLatenciesMs, 95),
    goalEvidence: Array.isArray(achieved) && achieved.length > 0,
    retryExceeded: asInt(retryExhausted) > 0,
    learnerContentTurns: asInt(learnerContentTurns),
    endReason: String(endReason || ""),
    usageQuality: String(usageQuality || "missing"),
    abnormalEnd: ["error", "worker_outdated", "feature_disabled", "client_disconnect_liveness_timeout", "hangup_failed"].includes(
      String(endReason || "")
    ),
  };
}

export function buildLearnCallLedger({
  sessionId,
  transport,
  model = "",
  startedAt = 0,
  endedAt = 0,
  durationMs = 0,
  endReason = "",
  quotaChargedMs = 0,
  quotaStatus = "",
  usage = {},
  experience = {},
} = {}) {
  const cost = learnCallSessionCost({ model, usage, transport });
  return {
    sessionId: String(sessionId || ""),
    transport: transport === "realtime" ? "realtime" : "ws",
    model: String(model || ""),
    startedAt: asInt(startedAt),
    endedAt: asInt(endedAt),
    durationMs: asInt(durationMs) || Math.max(0, asInt(endedAt) - asInt(startedAt)),
    endReason: String(endReason || ""),
    quotaChargedMs: asInt(quotaChargedMs),
    quotaStatus: String(quotaStatus || ""),
    usage: { ...emptyLearnCallUsage(), ...usage },
    costUsd: cost.totalUsd,
    costQuality: cost.quality,
    cost: cost,
    experience: learnCallExperienceSummary(experience),
    recordedAt: Date.now(),
  };
}

function parseLedger(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

export async function readLearnCallLedger(redis, sessionId) {
  if (!redis || !sessionId) return null;
  return parseLedger(await redis.get(learnCallLedgerKey(sessionId)));
}

export async function writeLearnCallLedger(redis, ledger, { ttlSeconds = LEARN_CALL_LEDGER_TTL_SEC } = {}) {
  const sid = String(ledger?.sessionId || "").trim();
  if (!redis || !sid) return null;
  const key = learnCallLedgerKey(sid);
  const previous = parseLedger(await redis.get(key)) || {};
  const usage = mergeLearnCallUsage(previous.usage, ledger.usage, { mode: "snapshot" });
  const next = {
    ...previous,
    ...ledger,
    usage,
    cost: learnCallSessionCost({ model: ledger.model || previous.model, usage, transport: ledger.transport || previous.transport }),
  };
  next.costUsd = next.cost.totalUsd;
  next.costQuality = next.cost.quality;
  const body = JSON.stringify(next);
  await redis.set(key, body, "EX", ttlSeconds);
  return next;
}

export async function markLearnCallUsageSeen(redis, sessionId, responseId, ttlSeconds = LEARN_CALL_LEDGER_TTL_SEC) {
  const sid = String(sessionId || "").trim();
  const rid = String(responseId || "").trim();
  if (!redis || !sid || !rid || typeof redis.sadd !== "function") return true;
  const key = learnCallUsageSeenKey(sid);
  const added = await redis.sadd(key, rid);
  await redis.expire(key, ttlSeconds);
  return Number(added) > 0;
}

export async function incrLearnCallLedgerUsage(redis, sessionId, delta = {}, { ttlSeconds = LEARN_CALL_LEDGER_TTL_SEC } = {}) {
  const sid = String(sessionId || "").trim();
  if (!redis || !sid) return null;
  const previous = (await readLearnCallLedger(redis, sid)) || { sessionId: sid, usage: emptyLearnCallUsage() };
  const usage = mergeLearnCallUsage(previous.usage, delta, { mode: "delta" });
  return writeLearnCallLedger(redis, { ...previous, sessionId: sid, usage }, { ttlSeconds });
}

export function sanitizePilotLedger(ledger) {
  if (!ledger || typeof ledger !== "object") return null;
  const { sessionId, transport, model, durationMs, endReason, quotaChargedMs, quotaStatus, usage, costUsd, costQuality, experience } = ledger;
  return { sessionId, transport, model, durationMs, endReason, quotaChargedMs, quotaStatus, usage, costUsd, costQuality, experience };
}

export function sanitizePilotExperience(raw = {}) {
  const latencies = Array.isArray(raw.turnLatenciesMs) ? raw.turnLatenciesMs : [];
  const achieved = Array.isArray(raw.achieved) ? raw.achieved : [];
  return {
    callReadyAt: asInt(raw.callReadyAt),
    openingAudibleAt: asInt(raw.openingAudibleAt),
    firstValidLearnerAt: asInt(raw.firstValidLearnerAt),
    turnLatenciesMs: latencies.map(asInt).filter((n) => n > 0).slice(0, 40),
    achieved: achieved.map((item) => String(item || "").slice(0, 40)).filter(Boolean).slice(0, 8),
    retryExhausted: asInt(raw.retryExhausted),
    learnerContentTurns: asInt(raw.learnerContentTurns),
    endReason: String(raw.endReason || "").slice(0, 80),
    usageQuality: String(raw.usageQuality || "").slice(0, 24),
  };
}

export function sanitizePilotUsage(raw = {}) {
  const base = emptyLearnCallUsage();
  for (const key of Object.keys(base)) base[key] = asInt(raw[key]);
  return base;
}

function mergeExperienceSnapshot(previous = {}, incoming = {}) {
  const next = { ...previous };
  const src = sanitizePilotExperience(incoming);
  if (src.callReadyAt) next.callReadyAt = previous.callReadyAt || src.callReadyAt;
  if (src.openingAudibleAt) next.openingAudibleAt = previous.openingAudibleAt || src.openingAudibleAt;
  if (src.firstValidLearnerAt) next.firstValidLearnerAt = previous.firstValidLearnerAt || src.firstValidLearnerAt;
  if (src.turnLatenciesMs.length >= (previous.turnLatenciesMs || []).length) next.turnLatenciesMs = src.turnLatenciesMs;
  if (src.achieved.length) next.achieved = src.achieved;
  if (src.retryExhausted) next.retryExhausted = Math.max(asInt(previous.retryExhausted), src.retryExhausted);
  if (src.learnerContentTurns) next.learnerContentTurns = Math.max(asInt(previous.learnerContentTurns), src.learnerContentTurns);
  if (src.endReason) next.endReason = src.endReason;
  if (src.usageQuality) next.usageQuality = src.usageQuality;
  return next;
}

/** Heartbeat/DELETE snapshot: max-merge usage, no transcripts or audio. */
export async function ingestLearnCallPilotSnapshot(redis, payload = {}) {
  const sessionId = String(payload.sessionId || "").trim();
  if (!redis || !sessionId) return null;
  const previous = (await readLearnCallLedger(redis, sessionId)) || {};
  const incomingUsage = sanitizePilotUsage(payload.usage);
  const usage = mergeLearnCallUsage(previous.usage, incomingUsage, { mode: "snapshot" });
  const experience = mergeExperienceSnapshot(previous.experienceRaw || {}, payload.experience || {});
  if (payload.endReason) experience.endReason = String(payload.endReason).slice(0, 80);
  const ledger = buildLearnCallLedger({
    sessionId,
    transport: payload.transport || previous.transport || "ws",
    model: payload.model || previous.model || "",
    startedAt: payload.startedAt || previous.startedAt,
    endedAt: payload.endedAt || previous.endedAt,
    durationMs: payload.durationMs || previous.durationMs,
    endReason: payload.endReason || previous.endReason || "",
    quotaChargedMs: payload.quotaChargedMs ?? previous.quotaChargedMs,
    quotaStatus: payload.quotaStatus || previous.quotaStatus || "",
    usage,
    experience: { ...experience, usageQuality: learnCallSessionCost({ model: payload.model || previous.model, usage, transport: payload.transport || previous.transport }).quality },
  });
  ledger.experienceRaw = experience;
  return writeLearnCallLedger(redis, ledger);
}
