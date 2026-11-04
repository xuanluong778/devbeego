/**
 * Session-local Realtime -> Learn Call transcript contract.
 * requestIds belong to input item/content or response output item/content, never
 * to a delta or to the WebSocket talk controller. Reserve input identity before
 * async transcription completes. Provider item links determine history order.
 */
export function createRealtimeTranscriptAdapter() {
  let nextId = 0;
  let focus = null;
  let caption = { requestId: 0, role: "tutor" };
  const nodes = [];
  const users = new Map();
  const responses = new Map();
  const itemOwners = new Map();
  const seen = new Set();

  function nodeFor(map, key, role, activate = false) {
    if (!key) return null; // Never guess ownership from the current turn.
    let node = map.get(key);
    if (!node) {
      node = { key, role, entries: [], terminal: false, started: false, playback: "pending" };
      map.set(key, node);
      nodes.push(node);
    }
    if (activate && nodes.indexOf(node) >= nodes.indexOf(focus)) {
      focus = node;
      caption = { requestId: node.entries.at(-1)?.requestId || 0, role };
    }
    return node;
  }

  function input(event, activate = false) {
    const node = nodeFor(users, event.itemId, "user", activate);
    if (node) {
      itemOwners.set(event.itemId, node);
      if (Object.hasOwn(event, "previousItemId")) node.previousItemId = event.previousItemId;
    }
    return node;
  }

  function entryFor(node, event) {
    if (!node) return null;
    const index = event.outputIndex ?? 0;
    const contentIndex = event.contentIndex ?? 0;
    let entry = node.entries.find(part => part.contentIndex === contentIndex &&
      (event.itemId && part.itemId ? part.itemId === event.itemId : part.outputIndex === index));
    if (!entry) {
      entry = { requestId: ++nextId, itemId: event.itemId || "", responseId: event.responseId || "", outputIndex: index, contentIndex, text: "", final: false };
      node.entries.push(entry);
      node.entries.sort((a, b) => a.outputIndex - b.outputIndex || a.contentIndex - b.contentIndex);
    }
    if (event.itemId) {
      entry.itemId = event.itemId;
      itemOwners.set(event.itemId, node);
    }
    if (event.outputIndex != null) {
      entry.outputIndex = event.outputIndex;
      node.entries.sort((a, b) => a.outputIndex - b.outputIndex || a.contentIndex - b.contentIndex);
    }
    return entry;
  }

  function select(node, entry) {
    if (node !== focus || !entry) return;
    const current = node.entries.find(part => part.requestId === caption.requestId);
    if (!current || node.entries.indexOf(entry) >= node.entries.indexOf(current)) {
      caption = { requestId: entry.requestId, role: node.role };
    }
  }

  function placeAfter(node, anchor) {
    if (!node || !anchor || node === anchor) return;
    const from = nodes.indexOf(node);
    if (from < 0) return;
    nodes.splice(from, 1);
    nodes.splice(nodes.indexOf(anchor) + 1, 0, node);
  }

  function anchorResponse(node) {
    const ids = Array.isArray(node?.inputItemIds) ? node.inputItemIds : [];
    const anchors = ids.map((id) => itemOwners.get(id)).filter((owner) => owner && owner !== node && owner.role === "user");
    if (anchors.length) placeAfter(node, anchors.at(-1));
  }

  function order() {
    // Provider previous_item_id repairs a late item. It is not the tutor link:
    // conversation:none chains learner items and would otherwise stack them together.
    for (let pass = 0; pass < nodes.length; pass += 1) {
      let changed = false;
      for (const node of [...nodes]) {
        if (!Object.hasOwn(node, "previousItemId")) continue;
        const parent = itemOwners.get(node.previousItemId);
        if (parent === node || (node.previousItemId != null && !parent)) continue;
        const index = nodes.indexOf(node);
        const target = parent ? nodes.indexOf(parent) + 1 : 0;
        if (index === target) continue;
        nodes.splice(index, 1);
        nodes.splice(parent ? nodes.indexOf(parent) + 1 : 0, 0, node);
        changed = true;
      }
      if (!changed) break;
    }
    for (const node of [...nodes]) {
      if (node.role === "tutor") anchorResponse(node);
    }
    return nodes.flatMap(node => node.entries.map(entry => entry.requestId));
  }

  return {
    handle(event) {
      const events = [];
      let notice = "";
      let status = "";
      if (!event || (event.eventId && seen.has(event.eventId))) return { events, caption };
      if (event.eventId) seen.add(event.eventId);

      const emit = (type, entry, extra = {}) => events.push({ type, requestId: entry.requestId,
        itemId: entry.itemId, responseId: entry.responseId, contentIndex: entry.contentIndex,
        outputIndex: entry.outputIndex, eventId: event.eventId, ...extra });
      const finalize = (node, entry, text) => {
        entry.text = String(text || "").trim() || entry.text.trim();
        entry.final = true;
        if (entry.text) emit(node.role === "user" ? "final_transcript" : "ai_done", entry, { text: entry.text, closing: node.closing === true });
      };
      const settlePlayback = (node, playback) => {
        if (!node || ["complete", "interrupted", "cancelled"].includes(node.playback)) return;
        node.playback = playback;
        if (playback !== "complete") node.terminal = true;
        for (const entry of node.entries) {
          if (playback !== "complete") finalize(node, entry, entry.text);
          emit("playback", entry, { kind: "turn", playback });
        }
      };

      if (event.type === "user_speech_started") {
        if (focus?.role === "tutor") settlePlayback(focus, focus.started ? "interrupted" : "cancelled");
        const node = input(event, true);
        select(node, entryFor(node, event));
        status = "listening";
      } else if (["user_audio_committed", "user_item_committed", "user_speech_stopped"].includes(event.type)) {
        const node = input(event, event.type !== "user_speech_stopped");
        select(node, entryFor(node, event));
      } else if (event.type === "conversation_item") {
        if (event.role === "user") entryFor(input(event), event);
        else {
          const node = itemOwners.get(event.itemId);
          if (node && Object.hasOwn(event, "previousItemId")) node.previousItemId = event.previousItemId;
        }
      } else if (["assistant_turn_started", "assistant_item_added"].includes(event.type)) {
        const node = nodeFor(responses, event.responseId, "tutor", event.type === "assistant_turn_started");
        if (node && event.closing) node.closing = true;
        if (node && event.inputItemIds?.length) node.inputItemIds = event.inputItemIds;
        if (event.itemId && node) itemOwners.set(event.itemId, node);
        if (node === focus && !node?.terminal) status = "speaking";
      } else if (["user_transcript_delta", "user_transcript_final", "assistant_transcript_delta", "assistant_transcript_final"].includes(event.type)) {
        const user = event.type.startsWith("user_");
        const node = user ? input(event, !focus) : nodeFor(responses, event.responseId, "tutor", !focus);
        const entry = entryFor(node, event);
        if (!entry) notice = "Không thể ghép phụ đề vì thiếu định danh lượt nói.";
        else if (event.type.endsWith("_final")) {
          finalize(node, entry, event.text);
          if (entry.text) select(node, entry);
          if (node.playback !== "pending") emit("playback", entry, { kind: "turn", playback: node.playback });
        } else if (!entry.final && !node.terminal && event.delta) {
          entry.text += event.delta;
          emit(user ? "partial_transcript" : "ai_stream", entry, user ? { text: entry.text } : { token: event.delta });
          select(node, entry);
        }
      } else if (event.type === "assistant_turn_done") {
        const node = nodeFor(responses, event.responseId, "tutor");
        if (node && event.inputItemIds?.length) node.inputItemIds = event.inputItemIds;
        if (node) {
          for (const part of event.transcripts || []) {
            const entry = entryFor(node, part);
            finalize(node, entry, part.text);
            if (entry.text) select(node, entry);
          }
          for (const entry of node.entries) {
            finalize(node, entry, entry.text);
            if (node.playback !== "pending") emit("playback", entry, { kind: "turn", playback: node.playback });
          }
          node.terminal = true;
          node.generationStatus = event.status;
          if (event.status === "cancelled") settlePlayback(node, node.started ? "interrupted" : "cancelled");
          if (event.status === "failed") {
            settlePlayback(node, node.started ? "interrupted" : "cancelled");
            notice = `Gia sư không tạo được câu trả lời: ${event.error?.message || "Lỗi từ nhà cung cấp."}`;
            if (node === focus) status = "connected";
          }
          // Generation completion says nothing about whether remote audio drained.
        }
      } else if (event.type.startsWith("assistant_audio_")) {
        const node = responses.get(event.responseId);
        if (node && event.type === "assistant_audio_started") {
          node.started = true;
          if (node === focus && node.playback === "pending") status = "speaking";
        } else if (node) {
          settlePlayback(node, event.type === "assistant_audio_stopped" ? "complete" : node.started ? "interrupted" : "cancelled");
          if (node === focus) status = "connected";
        }
      } else if (event.type === "transcription_error") {
        notice = `Không nhận dạng được lời bạn nói. Hãy thử nói lại. ${event.error?.message || ""}`.trim();
      } else if (event.type === "provider_error") {
        notice = `Lỗi gia sư AI: ${event.error?.message || event.error?.code || "Không nhận được phản hồi."}`;
      }
      events.push({ type: "realtime_order", requestIds: order() });
      return { events, caption: { ...caption }, notice, status };
    },
  };
}

/** Shared by the hook and regression tests: preserve metadata through callbacks. */
export function dispatchRealtimeTranscriptEvent(adapter, event, callbacks = {}) {
  const result = adapter.handle(event);
  for (const transcriptEvent of result.events) callbacks.onTranscriptEvent?.(transcriptEvent);
  if (result.caption) callbacks.onCaptionChange?.(result.caption);
  if (result.notice) callbacks.onNotice?.(result.notice);
  return result;
}
