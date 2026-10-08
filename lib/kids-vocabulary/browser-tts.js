/**
 * Đọc tiếng Anh trên trình duyệt — ổn định hơn URL Google TTS (hay bị chặn CORS / hotlink).
 * Gọi sau tương tác người dùng (bấm nút) để tránh bị chặn autoplay.
 */

function waitForVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const existing = window.speechSynthesis.getVoices();
  if (existing && existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const onVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices() || []);
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices() || []);
    }, 1500);
  });
}

export function speakEnglish(text, opts = {}) {
  const t = String(text || "").trim();
  if (!t) return Promise.resolve(false);
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    (async () => {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) {}

      const voices = await waitForVoices();
      const preferred =
        voices.find((v) => String(v.lang || "").toLowerCase().startsWith("en-us")) ||
        voices.find((v) => String(v.lang || "").toLowerCase().startsWith("en")) ||
        null;

      const u = new SpeechSynthesisUtterance(t);
      u.lang = opts.lang || "en-US";
      if (preferred) u.voice = preferred;
      u.rate = typeof opts.rate === "number" ? opts.rate : 0.88;
      u.pitch = typeof opts.pitch === "number" ? opts.pitch : 1.05;
      u.volume = typeof opts.volume === "number" ? opts.volume : 1;

      const done = (ok) => {
        try {
          u.onend = null;
          u.onerror = null;
        } catch (_e2) {}
        resolve(ok);
      };

      u.onend = () => done(true);
      u.onerror = () => done(false);

      try {
        window.speechSynthesis.speak(u);
      } catch (_e) {
        done(false);
      }
    })();
  });
}

let sequenceToken = 0;
/** Gọi ngay để kết thúc Promise utterance đang chờ (tránh bấm Dừng mà vẫn đọc hết câu). */
let activeSpeechFinish = null;
/** Hủy vòng lặp đọc truyện (speakEnglishStoryByWords). */
let activeStoryLoopAbort = null;

function releaseActiveSpeechFinish() {
  activeSpeechFinish = null;
}

function forceFinishActiveSpeech() {
  const finish = activeSpeechFinish;
  activeSpeechFinish = null;
  if (typeof finish === "function") finish(false);
}

function forceAbortStoryLoop() {
  const abort = activeStoryLoopAbort;
  activeStoryLoopAbort = null;
  if (typeof abort === "function") abort();
}

function flushSpeechSynthesis() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const syn = window.speechSynthesis;
    syn.cancel();
    if (syn.paused) syn.resume();
  } catch (_e) {}
}

/** Xóa hàng đợi TTS khi bắt đầu đọc mới — không tăng sequenceToken (tránh hủy utterance vừa speak). */
export function clearSpeechQueue() {
  flushSpeechSynthesis();
}

/** Trình duyệt đang phát / chờ phát giọng đọc (dùng khi state React lệch với TTS). */
export function isSpeechActive() {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  const syn = window.speechSynthesis;
  return Boolean(syn.speaking || syn.pending);
}

/** Dừng mọi lời đọc đang phát (một câu hoặc cả truyện). */
export function stopSpeaking() {
  sequenceToken += 1;
  forceFinishActiveSpeech();
  forceAbortStoryLoop();
  flushSpeechSynthesis();
}

function cancellableDelay(ms, isCancelled) {
  const wait = Math.max(0, Number(ms) || 0);
  if (!wait) return Promise.resolve();
  return new Promise((resolve) => {
    if (isCancelled()) return resolve();
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      resolve();
    };
    const timer = setTimeout(done, wait);
    const poll = setInterval(() => {
      if (isCancelled()) done();
    }, 40);
  });
}

/**
 * Đọc lần lượt nhiều câu (truyện). Gọi stopSpeaking() để hủy giữa chừng.
 * @param {string[]} lines
 * @param {{ pauseMs?: number, onLineStart?: (index: number) => void, rate?: number }} [opts]
 */
export async function speakEnglishSequence(lines, opts = {}) {
  const items = (Array.isArray(lines) ? lines : [lines])
    .map((t) => String(t || "").trim())
    .filter(Boolean);
  if (!items.length) {
    opts.onLineStart?.(-1);
    return { ok: false, cancelled: false };
  }

  const token = (sequenceToken += 1);
  const pauseMs = typeof opts.pauseMs === "number" ? opts.pauseMs : 450;

  for (let i = 0; i < items.length; i += 1) {
    if (token !== sequenceToken) {
      opts.onLineStart?.(-1);
      return { ok: false, cancelled: true };
    }
    opts.onLineStart?.(i);
    const ok = await speakEnglish(items[i], opts);
    if (token !== sequenceToken) {
      opts.onLineStart?.(-1);
      return { ok: false, cancelled: true };
    }
    if (!ok) {
      opts.onLineStart?.(-1);
      return { ok: false, cancelled: false, failedAt: i };
    }
    if (i < items.length - 1 && pauseMs > 0) {
      await cancellableDelay(pauseMs, () => token !== sequenceToken);
      if (token !== sequenceToken) {
        opts.onLineStart?.(-1);
        return { ok: false, cancelled: true };
      }
    }
  }

  if (token === sequenceToken) opts.onLineStart?.(-1);
  return { ok: true, cancelled: false };
}

/** Chỉ số từ chứa charIndex (boundary thường ở đầu từ; cuối câu ở cuối chuỗi). */
function wordIndexAtChar(text, charIndex) {
  const s = String(text || "");
  const ci = Math.max(0, Math.min(Number(charIndex) || 0, s.length));
  const words = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    words.push({ start: m.index, end: m.index + m[0].length });
  }
  if (!words.length) return 0;
  for (let i = 0; i < words.length; i += 1) {
    const { start, end } = words[i];
    if (ci < start) return Math.max(0, i - 1);
    if (ci >= start && ci <= end) return i;
  }
  return words.length - 1;
}

/**
 * Đọc một câu và báo chỉ số từ đang đọc (SpeechSynthesis boundary).
 * @param {string} text
 * @param {{ onWord?: (localWordIdx: number) => void, lang?: string, rate?: number, pitch?: number, volume?: number, sequenceToken?: number }} opts
 */
export function speakEnglishWithWords(text, opts = {}) {
  const t = String(text || "").trim();
  if (!t) return Promise.resolve(false);
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve(false);
  }

  const myToken = opts.sequenceToken;

  return new Promise((resolve) => {
    let settled = false;
    let tickTimer = null;
    let boundaryHit = false;
    let lastWord = -1;
    let utterance = null;

    const cancelled = () => typeof myToken === "number" && myToken !== sequenceToken;

    const clearTick = () => {
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
    };

    const detachUtterance = () => {
      try {
        if (!utterance) return;
        utterance.onend = null;
        utterance.onerror = null;
        utterance.onboundary = null;
        utterance.onstart = null;
      } catch (_e) {}
    };

    const done = (ok) => {
      if (settled) return;
      settled = true;
      releaseActiveSpeechFinish();
      clearTick();
      detachUtterance();
      if (cancelled()) flushSpeechSynthesis();
      resolve(cancelled() ? false : ok);
    };

    activeSpeechFinish = () => done(false);

    if (cancelled()) {
      done(false);
      return;
    }

    (async () => {
      const voices = await waitForVoices();
      if (cancelled()) {
        done(false);
        return;
      }

      const preferred =
        voices.find((v) => String(v.lang || "").toLowerCase().startsWith("en-us")) ||
        voices.find((v) => String(v.lang || "").toLowerCase().startsWith("en")) ||
        null;

      utterance = new SpeechSynthesisUtterance(t);
      utterance.lang = opts.lang || "en-US";
      if (preferred) utterance.voice = preferred;
      utterance.rate = typeof opts.rate === "number" ? opts.rate : 0.88;
      utterance.pitch = typeof opts.pitch === "number" ? opts.pitch : 1.05;
      utterance.volume = typeof opts.volume === "number" ? opts.volume : 1;

      const wordCount = t.split(/\s+/).filter(Boolean).length;

      const emitWord = (idx, force = false) => {
        if (cancelled()) return;
        const w = Math.max(0, Math.min(idx, wordCount - 1));
        if (!force && w === lastWord) return;
        lastWord = w;
        opts.onWord?.(w);
      };

      const startTimedFallback = () => {
        if (boundaryHit || wordCount <= 1 || cancelled()) return;
        const rate = typeof opts.rate === "number" ? opts.rate : 0.88;
        const msPerWord = Math.max(200, Math.round(400 / rate));
        let wi = 0;
        emitWord(0);
        tickTimer = setInterval(() => {
          if (cancelled()) {
            done(false);
            return;
          }
          wi += 1;
          if (wi >= wordCount) {
            emitWord(wordCount - 1, true);
            clearTick();
            return;
          }
          emitWord(wi);
        }, msPerWord);
      };

      utterance.onstart = () => {
        if (cancelled()) {
          done(false);
          return;
        }
        emitWord(0);
        startTimedFallback();
      };
      utterance.onboundary = (ev) => {
        if (cancelled()) return;
        boundaryHit = true;
        clearTick();
        const name = String(ev?.name || "").toLowerCase();
        if (name === "word" || name === "sentence" || name === "") {
          const ci = ev.charIndex ?? 0;
          const len = typeof ev.charLength === "number" ? ev.charLength : 0;
          const atEnd = ci + len >= t.length - 1;
          const idx = atEnd && wordCount > 0 ? wordCount - 1 : wordIndexAtChar(t, ci);
          emitWord(idx);
        }
      };
      utterance.onend = () => {
        if (cancelled()) {
          done(false);
          return;
        }
        clearTick();
        if (wordCount > 0) emitWord(wordCount - 1, true);
        done(true);
      };
      utterance.onerror = () => {
        done(false);
      };

      if (cancelled()) {
        done(false);
        return;
      }

      try {
        window.speechSynthesis.speak(utterance);
      } catch (_e) {
        done(false);
      }
    })();
  });
}

/** Kế hoạch từ theo từng câu — dùng thanh tiến trình / tua. */
export function getStoryWordPlan(lines) {
  const items = (Array.isArray(lines) ? lines : [lines])
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  const lineWordCounts = items.map((line) => line.split(/\s+/).filter(Boolean).length);
  const lineStarts = [];
  let totalWords = 0;
  for (let i = 0; i < items.length; i += 1) {
    lineStarts.push(totalWords);
    totalWords += lineWordCounts[i];
  }
  return { items, lineWordCounts, lineStarts, totalWords };
}

function lineFromLocalWord(line, localWordIdx) {
  const words = String(line || "")
    .split(/\s+/)
    .filter(Boolean);
  if (localWordIdx <= 0) return words.join(" ");
  return words.slice(localWordIdx).join(" ");
}

function resolveStartPosition(plan, startWordIndex) {
  const total = plan.totalWords;
  if (total <= 0) return { lineIdx: 0, localStart: 0, globalOffset: 0 };
  const g = Math.max(0, Math.min(Number(startWordIndex) || 0, total - 1));
  for (let i = 0; i < plan.items.length; i += 1) {
    const end = plan.lineStarts[i] + plan.lineWordCounts[i];
    if (g < end || i === plan.items.length - 1) {
      return { lineIdx: i, localStart: g - plan.lineStarts[i], globalOffset: g };
    }
  }
  return { lineIdx: 0, localStart: 0, globalOffset: 0 };
}

/**
 * Đọc nhiều câu — highlight theo chỉ số từ toàn truyện (onWordGlobal).
 * @param {string[]} lines
 * @param {{ pauseMs?: number, onWordGlobal?: (globalWordIdx: number) => void, rate?: number, startWordIndex?: number }} [opts]
 */
export async function speakEnglishStoryByWords(lines, opts = {}) {
  const plan = getStoryWordPlan(lines);
  if (!plan.items.length || plan.totalWords <= 0) {
    opts.onWordGlobal?.(-1);
    return { ok: false, cancelled: false };
  }

  const token = (sequenceToken += 1);
  let storyAborted = false;
  activeStoryLoopAbort = () => {
    storyAborted = true;
  };
  const isStopped = () => storyAborted || token !== sequenceToken;

  const pauseMs = typeof opts.pauseMs === "number" ? opts.pauseMs : 400;
  const { lineIdx: startLine, localStart } = resolveStartPosition(plan, opts.startWordIndex ?? 0);
  let wordEvents = 0;

  try {
  for (let i = startLine; i < plan.items.length; i += 1) {
    if (isStopped()) {
      opts.onWordGlobal?.(-1);
      return { ok: false, cancelled: true };
    }

    const localStartIdx = i === startLine ? localStart : 0;
    const line = lineFromLocalWord(plan.items[i], localStartIdx);
    const spokenWordCount = line.split(/\s+/).filter(Boolean).length;
    if (!line) continue;

    let lineGlobalBase = plan.lineStarts[i] + localStartIdx;

    const ok = await speakEnglishWithWords(line, {
      ...opts,
      sequenceToken: token,
      onWord: (localIdx) => {
        if (isStopped()) return;
        wordEvents += 1;
        opts.onWordGlobal?.(lineGlobalBase + localIdx);
      },
    });

    if (isStopped()) {
      opts.onWordGlobal?.(-1);
      return { ok: false, cancelled: true };
    }
    if (!ok) {
      opts.onWordGlobal?.(-1);
      return { ok: false, cancelled: isStopped(), failedAt: i };
    }

    if (i < plan.items.length - 1 && pauseMs > 0) {
      await cancellableDelay(pauseMs, isStopped);
      if (isStopped()) {
        opts.onWordGlobal?.(-1);
        return { ok: false, cancelled: true };
      }
    }
  }

  if (!isStopped()) opts.onWordGlobal?.(-1);
  return { ok: true, cancelled: false, usedBoundary: wordEvents > 0, endedAt: plan.totalWords };
  } finally {
    if (activeStoryLoopAbort) activeStoryLoopAbort = null;
  }
}

/** Thử Audio URL (nếu có), lỗi / chậm thì đọc bằng synthesis. */
export async function playKidWordAudio({ word, audioUrl }) {
  const w = String(word || "").trim();
  try {
    const { playBeegoAudio } = await import("@/lib/beego/audio-player");
    const result = await playBeegoAudio({ url: audioUrl, text: w, lang: "en" });
    if (result?.ok) return true;
  } catch (_e) {}
  return speakEnglish(w);
}
