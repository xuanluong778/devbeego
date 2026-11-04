/**
 * In-call transcript for Learn Call CC. One entry per (role, requestId), upserted.
 * Lives only for the session; nothing here is stored permanently.
 * Speculative tokens never enter a turn; replay never adds a turn.
 */

const SETTLED = new Set(["complete", "interrupted", "cancelled"]);

export function createTranscript() {
  return { turns: [] };
}

function turnKey(role, requestId) {
  return `${role === "user" ? "u" : "t"}:${requestId}`;
}

function sortTurns(turns) {
  const order = (turn) => turn.realtimeOrder ?? (turn.requestId * 2 + (turn.role === "user" ? 0 : 1));
  return [...turns].sort((a, b) => order(a) - order(b));
}

function upsert(state, role, requestId, mutate) {
  const rid = Number(requestId);
  if (!Number.isFinite(rid) || rid <= 0) return state;
  const key = turnKey(role, rid);
  const index = state.turns.findIndex((turn) => turn.key === key);
  const current = index >= 0 ? state.turns[index] : null;
  let next = mutate(current, { key, role, requestId: rid });
  if (next === current) return state;
  if (next && current?.realtimeOrder != null) next = { ...next, realtimeOrder: current.realtimeOrder };
  if (next == null) {
    if (index < 0) return state;
    return { turns: state.turns.filter((turn) => turn.key !== key) };
  }
  if (index >= 0) {
    const turns = state.turns.slice();
    turns[index] = next;
    return { turns };
  }
  return { turns: sortTurns([...state.turns, next]) };
}

function strongerPlayback(a, b) {
  if (SETTLED.has(a)) return a;
  if (SETTLED.has(b)) return b;
  return a || b || null;
}

export function applyTranscriptEvent(state, event) {
  const base = state && Array.isArray(state.turns) ? state : createTranscript();
  if (!event || typeof event !== "object") return base;
  const rid = Number(event.requestId);
  switch (event.type) {
    case "partial_transcript": {
      const text = String(event.text || "");
      return upsert(base, "user", rid, (current, id) => {
        if (current?.final) return current;
        if (!text.trim()) return current ? null : current;
        if (current && current.text === text) return current;
        return { ...id, text, final: false, playback: null };
      });
    }
    case "final_transcript": {
      const text = String(event.text || "").trim();
      return upsert(base, "user", rid, (current, id) => {
        if (!text) return current && !current.final ? null : current;
        if (current?.final && current.text === text) return current;
        return { ...id, text, final: true, playback: null };
      });
    }
    case "ai_stream": {
      if (event.speculative) return base;
      const token = String(event.token || "");
      if (!token) return base;
      return upsert(base, "tutor", rid, (current, id) => {
        if (current?.final) return current;
        if (!current && !token.trim()) return current;
        return { ...id, text: `${current?.text || ""}${token}`, final: false, playback: current?.playback || "pending" };
      });
    }
    case "ai_done": {
      return upsert(base, "tutor", rid, (current, id) => {
        // A generation-done event may omit transcript. Preserve streamed text.
        const text = String(event.text || current?.text || "").trim();
        if (!text) return current;
        if (current?.final && current.text === text) return current;
        return {
          ...id,
          text,
          final: true,
          playback: current?.playback || "pending",
          closing: Boolean(event.closing || current?.closing),
        };
      });
    }
    case "realtime_order": {
      // Adapter IDs stay stable when late input transcripts fill reserved turns.
      const ranks = new Map((event.requestIds || []).map((id, index) => [Number(id), index]));
      if (!ranks.size) return base;
      return { turns: sortTurns(base.turns.map(turn => ranks.has(turn.requestId)
        ? { ...turn, realtimeOrder: ranks.get(turn.requestId) } : turn)) };
    }
    case "playback": {
      if (event.kind === "replay") return base;
      const playback = event.playback;
      if (!SETTLED.has(playback)) return base;
      return upsert(base, "tutor", rid, (current) => {
        if (!current || SETTLED.has(current.playback)) return current;
        return { ...current, playback };
      });
    }
    case "hydrate": {
      const incoming = Array.isArray(event.turns) ? event.turns : [];
      const byKey = new Map();
      for (const item of incoming) {
        const role = item?.role === "user" ? "user" : item?.role === "tutor" || item?.role === "assistant" ? "tutor" : "";
        const itemRid = Number(item?.requestId);
        const text = String(item?.text ?? item?.content ?? "").trim();
        if (!role || !Number.isFinite(itemRid) || itemRid <= 0 || !text) continue;
        const key = turnKey(role, itemRid);
        byKey.set(key, {
          key,
          role,
          requestId: itemRid,
          text,
          final: true,
          playback: role === "tutor" ? (SETTLED.has(item.playback) ? item.playback : "pending") : null,
          closing: role === "tutor" && item.closing === true,
        });
      }
      const merged = [];
      for (const turn of base.turns) {
        const server = byKey.get(turn.key);
        if (!server) {
          merged.push(turn);
          continue;
        }
        merged.push({
          ...server,
          playback: server.role === "tutor" ? strongerPlayback(server.playback, turn.playback) : null,
          closing: server.closing || Boolean(turn.closing),
        });
        byKey.delete(turn.key);
      }
      for (const turn of byKey.values()) merged.push(turn);
      return { turns: sortTurns(merged) };
    }
    default:
      return base;
  }
}

/** Caption for the current turn only; empty until that turn has text. */
export function transcriptCaption(state, requestId) {
  return transcriptCaptionTurn(state, requestId)?.text || "";
}

export function transcriptCaptionTurn(state, requestId) {
  const turns = state?.turns || [];
  const rid = Number(requestId);
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (!rid || turns[i].requestId === rid) return turns[i];
    if (turns[i].requestId < rid) break;
  }
  return null;
}

/** One selector for UI and tests. CC visibility never controls transcript intake. */
export function learnCallCaptionView(state, { realtime = false, target, requestId, tutorName = "BEEGO AI", captionsOn = true, openingText = "" } = {}) {
  const turn = realtime
    ? (state?.turns || []).find(item => item.requestId === target?.requestId && item.role === target?.role)
    : transcriptCaptionTurn(state, requestId);
  const role = turn?.role || (realtime ? target?.role : "tutor") || "tutor";
  // An opening placeholder must never fill a reserved learner turn or a later tutor turn.
  const initialOpening = role === "tutor" && !(state?.turns || []).length && !target?.requestId ? openingText : "";
  return { text: captionsOn ? turn?.text || initialOpening : "", role, label: role === "user" ? "BẠN" : tutorName, visible: captionsOn };
}

export function transcriptLastTutor(state) {
  const turns = state?.turns || [];
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    if (turns[i].role === "tutor" && turns[i].final) return turns[i];
  }
  return null;
}

export function transcriptHasClosing(state) {
  return (state?.turns || []).some((turn) => turn.role === "tutor" && turn.closing);
}

export function transcriptMaxRequestId(state) {
  return (state?.turns || []).reduce((max, turn) => Math.max(max, turn.requestId), 0);
}

/** Server-side snapshot from the Redis memory list (newest first). */
export function learnTranscriptSnapshot(memory) {
  const chronological = [...(Array.isArray(memory) ? memory : [])].reverse();
  const out = [];
  for (const item of chronological) {
    if (item?.role !== "user" && item?.role !== "assistant") continue;
    const requestId = Number(item.requestId);
    const text = String(item.content || "").trim();
    if (!Number.isFinite(requestId) || requestId <= 0 || !text) continue;
    out.push({
      role: item.role === "user" ? "user" : "tutor",
      requestId,
      text,
      playback: item.role === "assistant" ? (SETTLED.has(item.playback) ? item.playback : "pending") : null,
      closing: item.role === "assistant" && item.closing === true,
    });
  }
  return out;
}
