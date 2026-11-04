/** Client turn coordinator. Provider VAD commits audio but cannot create a response. */
export function learnCallTurnDetection(mode = 'auto') {
  return mode === 'manual' ? null : { type: 'server_vad', threshold: 0.5,
    prefix_padding_ms: 300, silence_duration_ms: 500, create_response: false, interrupt_response: true };
}
export function learnCallTurnModeEvent(mode) {
  return { type: 'session.update', session: { type: 'realtime', audio: { input: { turn_detection: learnCallTurnDetection(mode) } } } };
}

/** A lead-in alone conveys no answer. Meaningful keywords such as IT/Technology are complete. */
export function learnCallIncompleteLead(text) {
  const words = String(text || '').toLowerCase().replace(/[.…,!?;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  return /^(?:i|i am(?: an?)?|i'm(?: an?)?|i work in|i live in|i am from|i'm from|my name is|my age is|my hobby is|i like|i want(?: an?)?|i would like(?: an?)?)$/.test(words);
}
function fragmentControl(text) {
  return /\b(?:skip|repeat|slower|example|vietnamese|stop|finish|practi[cs]e|pronunciation)\b|bỏ qua|nhắc lại|nói lại|tiếng việt|không hiểu|phát âm|luyện|^(?:no|actually|i meant)\b/i.test(text);
}

export function createRealtimeTurnCoordinator({ requestTurn, sendEvent, onDecision = () => {}, onError = () => {} }) {
  let sessionId = '', generation = 0, busy = false, speaking = false, stopped = false;
  let chain = Promise.resolve();
  let queued = [];
  let seen = new Set();
  const trace = [];
  const awaitingTranscription = new Map();
  const committed = new Set();
  const inputRanks = new Map();
  const retryPayloads = new Map();
  let nextInputRank = 0, lastSubmittedRank = 0;
  let fragment = null, practicePending = false;
  function rank(id) {
    if (!inputRanks.has(id)) inputRanks.set(id, ++nextInputRank);
    return inputRanks.get(id);
  }
  function flush() {
    if (stopped || busy || speaking || !queued.length) return;
    const result = queued.shift();
    if (sendEvent(result.event)) { busy = true; practicePending = result.decision?.action === 'practice_once'; onDecision(result.decision); }
    else queued.unshift(result);
  }
  return {
    connect(sid) {
      if (sessionId !== sid) { seen = new Set(); queued = []; trace.length = 0; awaitingTranscription.clear(); committed.clear(); inputRanks.clear(); retryPayloads.clear(); nextInputRank = 0; lastSubmittedRank = 0; practicePending = false; }
      sessionId = sid; generation++; busy = false; speaking = false; stopped = false; fragment = null;
    },
    configure({ awaitingPracticeAttempt = false } = {}) { practicePending = awaitingPracticeAttempt; },
    stop() { stopped = true; generation++; queued = []; fragment = null; },
    tick(now = Date.now()) {
      if (stopped) return;
      if (fragment && !fragment.notified && now - fragment.at >= 12000) {
        fragment.notified = true;
        onError(new Error("INCOMPLETE_UTTERANCE"));
      }
      for (const [id, committedAt] of awaitingTranscription) {
        if (now - committedAt < 12000) continue;
        awaitingTranscription.delete(id);
        onError(new Error("TRANSCRIPTION_DELAYED"));
      }
    },
    /** Metadata only, kept in memory: no audio, transcript or personal values in production logs. */
    trace() { return trace.map(e => ({ ...e })); },
    observe(event, now = Date.now()) {
      if (!event || stopped) return;
      trace.push({ at: now, type: event.type, itemId: event.itemId || '', responseId: event.responseId || '',
        ...(event.audioStartTimeMs != null ? { audioStartTimeMs: event.audioStartTimeMs } : {}),
        ...(event.audioEndTimeMs != null ? { audioEndTimeMs: event.audioEndTimeMs } : {}) });
      if (trace.length > 240) trace.shift();
      if (event.type === 'user_audio_committed' && event.itemId && !committed.has(event.itemId)) { committed.add(event.itemId); rank(event.itemId); awaitingTranscription.set(event.itemId, now); }
      if (event.type === 'transcription_error' && event.itemId) { awaitingTranscription.delete(event.itemId); onError(new Error('TRANSCRIPTION_FAILED')); }
      if (event.type === 'user_speech_started') { speaking = true; }
      if (event.type === 'user_speech_stopped') { speaking = false; flush(); }
      if (event.type === 'assistant_turn_started') busy = true;
      if (event.type === 'assistant_turn_done') { busy = false; flush(); }
      if (event.type !== 'user_transcript_final' || !event.itemId || !String(event.text || '').trim()) return;
      const id = event.itemId;
      awaitingTranscription.delete(id);
      if (seen.has(id)) return;
      seen.add(id);
      const inputRank = rank(id);
      // A delayed prefix must not become the start of the next answer after its continuation was handled.
      if (inputRank < lastSubmittedRank) return;
      const retryPayload = retryPayloads.get(id);
      let itemId = retryPayload?.itemId || id, itemIds = retryPayload?.itemIds || [id], text = retryPayload?.text || String(event.text).trim();
      const control = fragmentControl(text);
      if (!retryPayload && fragment && !control && !practicePending) {
        itemId = fragment.itemId;
        itemIds = [...fragment.itemIds, id];
        const lead = fragment.text.replace(/[.…,!?;:]+$/g, '').trim();
        if (!text.toLowerCase().startsWith(lead.toLowerCase()) && !learnCallIncompleteLead(text)) text = `${lead} ${text}`;
      }
      if (!retryPayload && !control && !practicePending && learnCallIncompleteLead(text)) {
        fragment = { itemId, itemIds, text, at: fragment?.at || now, notified: fragment?.notified || false };
        return;
      }
      fragment = null;
      lastSubmittedRank = inputRank;
      practicePending = false;
      const seq = generation;
      const sid = sessionId;
      chain = chain.then(async () => {
        if (stopped || seq !== generation) return;
        try {
          const result = await requestTurn({ sessionId: sid, itemId, itemIds, text });
          retryPayloads.delete(id);
          if (stopped || seq !== generation) return;
          queued.push(result);
          flush();
        } catch (e) { retryPayloads.set(id, { itemId, itemIds, text }); seen.delete(id); onError(e); }
      });
      return chain;
    },
    ready: flush,
  };
}
