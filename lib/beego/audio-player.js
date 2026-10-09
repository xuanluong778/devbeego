/**
 * Shared Beego audio engine — Web + Capacitor Android.
 *
 * ROOT CAUSE (vocab listen): Google Translate TTS returns 404 HTML for Android
 * WebView User-Agent. Desktop UA works. speechSynthesis fallback is often silent
 * in Capacitor. Fix: same-origin /api/tts/speak (server fetches with desktop UA).
 *
 * play() is started synchronously from the click stack (no await before play).
 */

let currentAudio = null;
let unlockDone = false;
let generation = 0;

function isBrowser() {
  return typeof window !== "undefined";
}

function isGoogleTranslateTts(url) {
  return /translate\.google\.com\/translate_tts/i.test(String(url || ""));
}

function extractQueryText(url) {
  try {
    return new URL(String(url), "https://beego.vn").searchParams.get("q") || "";
  } catch {
    return "";
  }
}

export function buildSpeakApiUrl(text, lang = "en") {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const q = new URLSearchParams({ text: t.slice(0, 180), lang: String(lang || "en") });
  return `/api/tts/speak?${q.toString()}`;
}

export function resolvePlayableAudioUrl(url, fallbackText, lang = "en") {
  const u = String(url || "").trim();
  const text = String(fallbackText || "").trim() || (u ? extractQueryText(u) : "");
  if (!u || isGoogleTranslateTts(u)) {
    return buildSpeakApiUrl(text, lang);
  }
  return u;
}

export function isBeegoAudioActive() {
  if (!isBrowser()) return false;
  if (currentAudio && !currentAudio.paused && !currentAudio.ended) return true;
  try {
    return Boolean(window.speechSynthesis && window.speechSynthesis.speaking);
  } catch {
    return false;
  }
}

export function stopBeegoAudio() {
  generation += 1;
  const a = currentAudio;
  currentAudio = null;
  if (!a) return;
  try {
    a.onended = null;
    a.onerror = null;
    a.pause();
    a.removeAttribute("src");
    a.load?.();
  } catch {
    /* ignore */
  }
  if (isBrowser() && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/** Call once on first pointerdown / in NativeBootstrap — unlocks WebView autoplay. */
export function unlockBeegoAudio() {
  if (!isBrowser() || unlockDone) return;
  unlockDone = true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      if (ctx.state === "suspended") void ctx.resume();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      setTimeout(() => {
        try {
          ctx.close();
        } catch {
          /* ignore */
        }
      }, 50);
    }
  } catch {
    /* ignore */
  }
}

function speakFallback(text, lang = "en-US", rate = 0.92) {
  if (!isBrowser() || !text || !window.speechSynthesis) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = lang.startsWith("en") ? "en-US" : lang;
    u.rate = rate;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

/**
 * Must be invoked directly from a user-gesture handler (click/touch).
 * Does NOT await before audio.play() — critical for Android WebView.
 */
export function playBeegoAudio(opts = {}) {
  if (!isBrowser()) return Promise.resolve({ ok: false, via: "ssr" });

  const text = String(opts.text || "").trim();
  const lang = String(opts.lang || "en").trim() || "en";
  const requestedRate = Number(opts.rate);
  const playbackRate =
    Number.isFinite(requestedRate) && requestedRate > 0 && requestedRate <= 2 ? requestedRate : 1;
  const src = resolvePlayableAudioUrl(opts.url, text, lang);

  stopBeegoAudio();
  unlockBeegoAudio();
  const myGen = generation;

  const fallbackRate = playbackRate === 1 ? 0.92 : playbackRate;
  if (!src) {
    const ok = speakFallback(text, lang === "en" ? "en-US" : lang, fallbackRate);
    return Promise.resolve({ ok, via: ok ? "speechSynthesis" : "none" });
  }

  const audio = new Audio();
  currentAudio = audio;
  audio.preload = "auto";
  // Same-origin /api/tts/speak — no CORS issue
  audio.src = src;
  audio.playbackRate = playbackRate;

  return new Promise((resolve) => {
    const finish = (result) => {
      if (currentAudio === audio) currentAudio = null;
      resolve(result);
    };

    audio.onended = () => finish({ ok: true, via: "audio" });
    audio.onerror = () => {
      if (myGen !== generation) return finish({ ok: false, via: "cancelled" });
      const ok = speakFallback(text, lang === "en" ? "en-US" : lang, fallbackRate);
      finish({ ok, via: ok ? "speechSynthesis" : "error", error: "media_error" });
    };

    // Synchronous play() from gesture stack
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        /* playing */
      }).catch(() => {
        if (myGen !== generation) return finish({ ok: false, via: "cancelled" });
        // Retry once immediately (still near gesture)
        unlockBeegoAudio();
        audio
          .play()
          .then(() => {})
          .catch(() => {
            if (myGen !== generation) return finish({ ok: false, via: "cancelled" });
            const ok = speakFallback(text, lang === "en" ? "en-US" : lang, fallbackRate);
            finish({ ok, via: ok ? "speechSynthesis" : "error", error: "play_rejected" });
          });
      });
    }
  });
}

/** Sync helper for existing call sites */
export function playAudioUrl(url, fallbackText) {
  return playBeegoAudio({ url, text: fallbackText, lang: "en" });
}

export function bindBeegoAudioLifecycle() {
  if (!isBrowser()) return () => {};
  const onVis = () => {
    if (document.visibilityState === "hidden") stopBeegoAudio();
  };
  const onPointer = () => unlockBeegoAudio();
  document.addEventListener("visibilitychange", onVis);
  document.addEventListener("pointerdown", onPointer, { once: true, passive: true });
  document.addEventListener("touchstart", onPointer, { once: true, passive: true });
  return () => {
    document.removeEventListener("visibilitychange", onVis);
  };
}
