"use client";

export function isSpeechRecognitionSupported() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

/**
 * Web Speech API: continuous + interim + hết silence thì stop;
 * utteranceMode: một lượt ngắn (có interim + chờ no-speech).
 *
 * Chrome often ends continuous sessions mid-phrase — we restart until
 * silence / max duration / explicit stop.
 *
 * @param {{ utteranceMode?: boolean, lang?: string, silenceMs?: number, maxMs?: number, noSpeechGraceMs?: number, onDone?: (t: string) => void, onError?: (code: string) => void, onInterim?: (t: string) => void }} opts
 * @returns {{ stop: () => void, abort: () => void } | null}
 */
export function startPatientSpeechRecognition({
  lang = "en-US",
  silenceMs = 2800,
  maxMs = 28000,
  noSpeechGraceMs = 3200,
  utteranceMode = false,
  onDone,
  onError,
  onInterim,
} = {}) {
  if (!isSpeechRecognitionSupported()) {
    onError?.("unsupported");
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.lang = lang;
  rec.maxAlternatives = 1;
  rec.interimResults = true;
  rec.continuous = !utteranceMode;

  let silenceTimer = null;
  let maxTimer = null;
  let aborted = false;
  let finished = false;
  let intentionalStop = false;
  let lastFullTranscript = "";
  let lastInterim = "";
  let startedAt = Date.now();
  let noSpeechRetries = 0;

  const clearTimers = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
    if (maxTimer) clearTimeout(maxTimer);
    maxTimer = null;
  };

  const combinedTranscript = () => {
    const finalPart = String(lastFullTranscript || "").trim();
    const interimPart = String(lastInterim || "").trim();
    if (!interimPart) return finalPart;
    if (!finalPart) return interimPart;
    if (finalPart.toLowerCase().includes(interimPart.toLowerCase())) return finalPart;
    return `${finalPart} ${interimPart}`.trim();
  };

  const done = (text) => {
    if (finished || aborted) return;
    finished = true;
    clearTimers();
    onDone(text);
  };

  const requestStop = () => {
    intentionalStop = true;
    try {
      rec.stop();
    } catch (_) {
      /* ignore */
    }
  };

  const armSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(requestStop, silenceMs);
  };

  const tryRestart = () => {
    if (aborted || finished || intentionalStop) return false;
    if (Date.now() - startedAt >= maxMs) return false;
    try {
      rec.start();
      return true;
    } catch (_) {
      return false;
    }
  };

  rec.onresult = (event) => {
    let interimTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        lastFullTranscript = `${lastFullTranscript} ${piece}`.trim();
        lastInterim = "";
      } else {
        interimTranscript += piece;
      }
    }
    if (interimTranscript) lastInterim = interimTranscript;
    onInterim?.(combinedTranscript());
    armSilence();
  };

  maxTimer = setTimeout(requestStop, maxMs);

  rec.onend = () => {
    if (aborted || finished) return;

    // Continuous (and early browser stop): keep listening until silence/max.
    if (!intentionalStop && Date.now() - startedAt < maxMs) {
      if (tryRestart()) return;
    }

    clearTimers();
    done(combinedTranscript());
  };

  rec.onerror = (e) => {
    const err = e.error;
    if (err === "aborted") {
      aborted = true;
      finished = true;
      clearTimers();
      return;
    }
    if (err === "no-speech") {
      // Let onend restart within grace; only finish after grace exhausted.
      const elapsed = Date.now() - startedAt;
      if (elapsed < noSpeechGraceMs && noSpeechRetries < 3) {
        noSpeechRetries += 1;
        // onend will tryRestart; do not finish here.
        return;
      }
      intentionalStop = true;
      return;
    }
    if (err === "network") {
      // Transient — onend may restart.
      return;
    }
    aborted = true;
    finished = true;
    clearTimers();
    onError?.(String(err || "error"));
  };

  const stop = () => {
    if (finished || aborted) return;
    intentionalStop = true;
    clearTimers();
    try {
      rec.stop();
    } catch (_) {
      /* ignore */
    }
  };

  const abort = () => {
    if (finished || aborted) return;
    aborted = true;
    finished = true;
    intentionalStop = true;
    clearTimers();
    try {
      rec.abort();
    } catch (_) {
      /* ignore */
    }
  };

  try {
    rec.start();
  } catch (_e) {
    aborted = true;
    finished = true;
    clearTimers();
    onError?.("start-failed");
    return null;
  }

  return { stop, abort };
}
