/**
 * Push-to-talk for Learn Call only. One press path, one Azure utterance, one reply.
 * Sample hints are not turned into transcripts.
 */

export const LEARN_TALK_RECOGNITION_TIMEOUT_MS = 8000;
export const LEARN_TALK_SEGMENT_FLUSH_MS = 700;
/** Longest wait for Azure to finish after recognition_end. Must stay below LEARN_TALK_RECOGNITION_TIMEOUT_MS. */
export const LEARN_TALK_FINAL_WAIT_MS = 3000;

export function learnCallRemainingView({ startedAt, deadlineAt, now } = {}) {
  const start = Number(startedAt);
  const end = Number(deadlineAt);
  const t = Number(now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(t)) {
    return { known: false, label: "--:--", ratio: 0, remainingMs: 0, deadlineAt: null };
  }
  const total = end - start;
  const remainingMs = Math.max(0, end - t);
  const seconds = Math.ceil(remainingMs / 1000);
  const label = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return {
    known: true,
    label,
    ratio: Math.min(1, Math.max(0, remainingMs / total)),
    remainingMs,
    deadlineAt: end,
  };
}

export function joinLearnSegments(parts) {
  return (Array.isArray(parts) ? parts : [])
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createLearnUtterance(requestId) {
  const parts = [];
  let closed = false;
  return {
    requestId: Number(requestId) || 0,
    addSegment(text) {
      if (closed) return { accepted: false, duplicate: true, text: joinLearnSegments(parts) };
      const piece = String(text || "").trim();
      if (!piece) return { accepted: false, empty: true, text: joinLearnSegments(parts) };
      parts.push(piece);
      return { accepted: true, text: joinLearnSegments(parts), segments: parts.length };
    },
    finish() {
      const text = joinLearnSegments(parts);
      if (closed) return { text, queued: false, duplicate: true };
      closed = true;
      return { text, queued: Boolean(text), duplicate: false };
    },
    abandon() {
      closed = true;
      return { text: "", queued: false, duplicate: true };
    },
  };
}

export function createLearnTalkController() {
  let phase = "connecting";
  let generation = 0;
  let requestId = 0;
  let busy = false;
  let pcmBytes = 0;

  const snap = (extra = {}) => ({ phase, generation, requestId, busy, pcmBytes, allowsPcm: phase === "listening", ...extra });

  return {
    snapshot: snap,
    hello({ azure, requestId: serverRequestId } = {}) {
      if (!azure) {
        phase = "error";
        return snap({ action: "azure_required" });
      }
      const floor = Number(serverRequestId);
      if (Number.isFinite(floor) && floor > requestId) requestId = Math.floor(floor);
      phase = "ready";
      busy = false;
      return snap({ action: "wait_for_press" });
    },
    press() {
      if (busy || phase === "transcribing" || phase === "thinking" || phase === "connecting") {
        return snap({ ignored: true, action: "locked" });
      }
      if (phase === "ready" || phase === "mic") {
        generation += 1;
        requestId += 1;
        busy = true;
        pcmBytes = 0;
        return snap({ ignored: false, action: "arm_listen" });
      }
      if (phase === "listening") {
        if (pcmBytes <= 0) {
          phase = "ready";
          return snap({ ignored: false, action: "empty_audio" });
        }
        phase = "transcribing";
        return snap({ ignored: false, action: "submit" });
      }
      if (phase === "speaking") {
        const previousRequestId = requestId;
        generation += 1;
        requestId += 1;
        busy = true;
        pcmBytes = 0;
        return snap({ ignored: false, action: "interrupt_listen", previousRequestId });
      }
      return snap({ ignored: true, action: "locked" });
    },
    mediaReady({ generation: gen, running } = {}) {
      if (gen !== generation || phase === "ended" || phase === "error") {
        return snap({ ignored: true, stale: true, action: "drop_media" });
      }
      busy = false;
      if (running !== true) {
        phase = "mic";
        return snap({ action: "mic_unavailable" });
      }
      phase = "listening";
      pcmBytes = 0;
      return snap({ action: "send_pcm" });
    },
    notePcm(bytes) {
      if (phase !== "listening") return false;
      pcmBytes += Math.max(0, Number(bytes) || 0);
      return true;
    },
    noteFinal(text) {
      if (phase !== "transcribing") return snap({ ignored: true, action: "ignore_final" });
      const spoken = String(text || "").trim();
      if (!spoken) {
        phase = "ready";
        return snap({ action: "empty_transcript" });
      }
      phase = "thinking";
      return snap({ action: "one_reply", text: spoken });
    },
    noteTimeout() {
      if (phase !== "transcribing") return snap({ ignored: true, action: "ignore_timeout" });
      generation += 1;
      phase = "ready";
      return snap({ action: "timeout" });
    },
    noteSpeaking() {
      if (phase === "ended" || phase === "error") return snap({ ignored: true });
      phase = "speaking";
      busy = false;
      return snap({ action: "tutor_speaking" });
    },
    noteReady() {
      if (busy || phase !== "speaking") return snap({ ignored: true, action: "keep_phase" });
      phase = "ready";
      return snap({ action: "ready" });
    },
    exit() {
      generation += 1;
      busy = false;
      phase = "ended";
      return snap({ action: "cleanup" });
    },
  };
}
