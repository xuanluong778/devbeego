/**
 * Learn Call playback bookkeeping. Old speaking does not import this module.
 * tts_end means the server finished sending. Ack playback "complete" means the
 * queued audio finished playing ("Đã phát hết"), not that the learner heard it.
 *
 * Learn replay frames use a separate binary prefix so old speaking clients ignore them:
 * 0x03 | playbackId uint32 LE | requestId uint32 LE | PCM s16le mono.
 * Original tutor audio stays 0x02 | requestId uint32 LE | PCM s16le.
 */

export const LEARN_CALL_PCM_SAMPLE_RATE = 24000;
export const LEARN_CALL_PCM_BYTES_PER_SAMPLE = 2;
export const LEARN_CALL_AUDIO_CACHE_MAX_SECONDS = 20;
export const LEARN_CALL_AUDIO_CACHE_MAX_BYTES =
  LEARN_CALL_PCM_SAMPLE_RATE * LEARN_CALL_PCM_BYTES_PER_SAMPLE * LEARN_CALL_AUDIO_CACHE_MAX_SECONDS;
export const LEARN_CALL_AUDIO_CACHE_MAX_TURNS = 3;
/** Audio gap with no tts_end after which the client stops waiting; the turn stays unconfirmed. */
export const LEARN_CALL_TTS_STALL_MS = 5000;

export function learnCallPcmBytesForSeconds(seconds) {
  return Math.round(Number(seconds) * LEARN_CALL_PCM_SAMPLE_RATE * LEARN_CALL_PCM_BYTES_PER_SAMPLE);
}

export function createLearnAudioCache({
  maxBytes = LEARN_CALL_AUDIO_CACHE_MAX_BYTES,
  maxTurns = LEARN_CALL_AUDIO_CACHE_MAX_TURNS,
} = {}) {
  const turns = [];
  let replaySeq = 0;
  const trim = () => {
    while (turns.length > maxTurns) turns.shift();
    let used = turns.reduce((sum, turn) => sum + turn.bytes, 0);
    while (turns.length > 1 && used > maxBytes) {
      used -= turns[0].bytes;
      turns.shift();
    }
  };
  return {
    append(requestId, chunk) {
      const rid = Number(requestId);
      const bytes = chunk instanceof Uint8Array ? chunk : Uint8Array.from(chunk || []);
      if (!rid || !bytes.byteLength) return false;
      let turn = turns.find((item) => item.requestId === rid);
      if (!turn) {
        turn = { requestId: rid, chunks: [], bytes: 0, truncated: false };
        turns.push(turn);
      }
      if (turn.truncated) return false;
      if (turn.bytes + bytes.byteLength > maxBytes) {
        turn.truncated = true;
        turn.chunks = [];
        turn.bytes = 0;
        return false;
      }
      turn.chunks.push(bytes.slice());
      turn.bytes += bytes.byteLength;
      trim();
      const kept = turns.find((item) => item.requestId === rid);
      return Boolean(kept && !kept.truncated);
    },
    replay(requestId) {
      const turn = turns.find((item) => item.requestId === Number(requestId));
      if (!turn || turn.truncated || !turn.chunks.length) return null;
      replaySeq += 1;
      return {
        requestId: turn.requestId,
        playbackId: 0x40000000 + replaySeq,
        kind: "replay",
        chunks: turn.chunks.map((chunk) => chunk.slice()),
      };
    },
    clear() {
      turns.length = 0;
    },
    turnCount() {
      return turns.length;
    },
  };
}

export function createLearnPlaybackController() {
  let generation = 1;
  let active = null;
  let origin = null;
  let ackCount = 0;

  function ackOnce(playback) {
    if (!active || active.acked || active.kind === "replay" && playback === "complete" && active.bytes <= 0) return null;
    if (active.acked) return null;
    active.acked = playback;
    ackCount += 1;
    const ack = {
      kind: active.kind,
      playback,
      requestId: active.requestId,
      playbackId: active.playbackId,
    };
    if (active.kind === "turn") origin = { requestId: active.requestId, playback };
    return ack;
  }

  function maybeComplete() {
    if (!active || active.acked || active.abandoned || active.interrupted) return { ack: null, waiting: false, status: active?.interrupted ? "interrupted" : "idle" };
    if (!active.serverEnded || active.pendingBytes > 0 || active.playingSources > 0) {
      return { ack: null, waiting: true, status: "playing" };
    }
    if (active.bytes <= 0) return { ack: null, waiting: false, status: "ready" };
    active.closed = true;
    return { ack: ackOnce("complete"), waiting: false, status: "ready", origin };
  }

  return {
    startTurn(requestId) {
      generation += 1;
      const rid = Number(requestId);
      active = {
        requestId: rid,
        playbackId: rid,
        kind: "turn",
        generation,
        serverEnded: false,
        pendingBytes: 0,
        playingSources: 0,
        bytes: 0,
        acked: null,
        interrupted: false,
        abandoned: false,
        closed: false,
      };
      origin = { requestId: rid, playback: "pending" };
      return { playbackId: rid, generation, origin };
    },
    startReplay(replay) {
      generation += 1;
      active = {
        requestId: Number(replay.requestId),
        playbackId: Number(replay.playbackId),
        kind: "replay",
        generation,
        serverEnded: false,
        pendingBytes: 0,
        playingSources: 0,
        bytes: 0,
        acked: null,
        interrupted: false,
        abandoned: false,
        closed: false,
      };
      return { playbackId: active.playbackId, generation, origin };
    },
    chunk({ playbackId, generation: gen, bytes }) {
      if (!active || Number(playbackId) !== active.playbackId || Number(gen) !== active.generation || active.closed) {
        return { drop: true, ack: null };
      }
      const size = Math.max(0, Number(bytes) || 0);
      if (!size) return { drop: true, ack: null };
      active.pendingBytes += size;
      active.bytes += size;
      return { drop: false, ack: null, pendingBytes: active.pendingBytes };
    },
    serverEnd({ playbackId, generation: gen } = {}) {
      if (!active || active.closed) return { ack: null, waiting: false };
      if (playbackId != null && Number(playbackId) !== active.playbackId) return { ack: null, waiting: false, drop: true };
      if (gen != null && Number(gen) !== active.generation) return { ack: null, waiting: false, drop: true };
      active.serverEnded = true;
      return maybeComplete();
    },
    flushBuffer() {
      if (!active || active.closed) return { ack: null, waiting: false };
      // The player reports one drain when all queued audio ends, so one pending source covers every flush.
      if (active.pendingBytes > 0) {
        active.pendingBytes = 0;
        active.playingSources = 1;
      }
      return maybeComplete();
    },
    sourceEnded({ generation: gen, fromInterrupt = false } = {}) {
      if (!active || fromInterrupt || Number(gen) !== active.generation || active.interrupted || active.abandoned) {
        return { ack: null, ignored: true, complete: false };
      }
      active.playingSources = Math.max(0, active.playingSources - 1);
      const result = maybeComplete();
      return { ...result, ignored: false, complete: result.ack?.playback === "complete" };
    },
    interrupt() {
      if (!active || active.acked || active.abandoned) {
        generation += 1;
        return { ack: null, origin, generation };
      }
      active.interrupted = true;
      active.closed = true;
      active.pendingBytes = 0;
      active.playingSources = 0;
      const ack = ackOnce("interrupted");
      generation += 1;
      return { ack, origin, generation };
    },
    disconnect() {
      if (active && !active.acked) {
        active.abandoned = true;
        active.closed = true;
      }
      return { ack: null, complete: false, origin };
    },
    timeLimit() {
      return this.disconnect();
    },
    snapshot() {
      return {
        generation: active?.generation ?? generation,
        origin: origin ? { ...origin } : null,
        ackCount,
        pendingBytes: active?.pendingBytes ?? 0,
        serverEnded: Boolean(active?.serverEnded),
        kind: active?.kind || "",
        playbackId: active?.playbackId ?? 0,
        requestId: active?.requestId ?? 0,
        acked: active?.acked || null,
        bytes: active?.bytes ?? 0,
      };
    },
  };
}

/**
 * Server evidence for a turn ack. "complete" needs every chunk sent and no cancel;
 * "interrupted" needs some audio sent; "cancelled" means nothing played on the client.
 */
export function learnCallAckAllowed(playback, audio) {
  const bytes = Number(audio?.bytes) || 0;
  if (playback === "complete") return bytes > 0 && audio?.ended === true && audio?.cancelled !== true;
  if (playback === "interrupted") return bytes > 0;
  return playback === "cancelled";
}

export const LEARN_PLAYBACK_SETTLED = Object.freeze(["complete", "interrupted", "cancelled"]);

/** First settled state wins. Replay acks never change a turn. */
export function applyLearnPlaybackAck(turns, ack, audio) {
  const list = Array.isArray(turns) ? turns : [];
  if (!ack || ack.kind === "replay") return { turns: list, changed: false };
  if (!LEARN_PLAYBACK_SETTLED.includes(ack.playback)) return { turns: list, changed: false };
  if (!learnCallAckAllowed(ack.playback, audio)) return { turns: list, changed: false, rejected: true };
  const rid = Number(ack.requestId);
  if (!rid) return { turns: list, changed: false };
  let matched = false;
  let changed = false;
  const next = list.map((item) => {
    if (item?.role !== "assistant" || Number(item.requestId) !== rid) return item;
    matched = true;
    if (item.playback !== "pending") return item;
    changed = true;
    return { ...item, playback: ack.playback };
  });
  if (!matched || !changed) return { turns: list, changed: false };
  return { turns: next, changed: true };
}
