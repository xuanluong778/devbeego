/**
 * Short original tones for the Learn player.
 * Separate from TTS: this never stops or replaces spoken audio.
 */
import { isBeegoAudioActive } from "@/lib/beego/audio-player";
import { isLessonSpeechCapturing } from "@/lib/beego/learn/adapters/lesson-speech";

const STORAGE_KEY = "beego-learn-sfx-enabled";
const CHANGE_EVENT = "beego-learn-sfx";

let active = null;

function browserWindow() {
  return typeof window === "undefined" ? null : window;
}

export function lessonSfxEnabled() {
  const win = browserWindow();
  if (!win) return true;
  try {
    return win.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setLessonSfxEnabled(enabled) {
  const win = browserWindow();
  if (!win) return;
  try {
    win.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
  try {
    win.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeLessonSfx(listener) {
  const win = browserWindow();
  if (!win) return () => {};
  const onChange = () => listener(lessonSfxEnabled());
  win.addEventListener(CHANGE_EVENT, onChange);
  return () => win.removeEventListener(CHANGE_EVENT, onChange);
}

export function stopLessonSfx() {
  const run = active;
  active = null;
  if (!run) return;
  try {
    run.nodes.forEach((node) => node.stop?.());
  } catch {
    /* ignore */
  }
  try {
    run.ctx.close();
  } catch {
    /* ignore */
  }
}

function tone(ctx, { frequency, to, start, duration, type = "sine", gain = 0.08 }) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
  return osc;
}

function pattern(kind, ctx) {
  const now = ctx.currentTime;
  if (kind === "pop") return [tone(ctx, { frequency: 520, to: 740, start: now, duration: 0.07, gain: 0.05 })];
  if (kind === "ding") return [tone(ctx, { frequency: 880, to: 1175, start: now, duration: 0.14, gain: 0.07 })];
  if (kind === "soft") {
    return [tone(ctx, { frequency: 340, to: 220, start: now, duration: 0.16, type: "triangle", gain: 0.045 })];
  }
  if (kind === "fanfare") {
    return [523, 659, 784, 1046].map((frequency, index) =>
      tone(ctx, { frequency, start: now + index * 0.11, duration: 0.12, gain: 0.06 })
    );
  }
  return [];
}

/** @param {"pop"|"ding"|"soft"|"fanfare"} kind */
export function playLessonSfx(kind) {
  const win = browserWindow();
  if (!win || !lessonSfxEnabled()) return false;
  try {
    if (isBeegoAudioActive() || isLessonSpeechCapturing()) return false;
    const Ctx = win.AudioContext || win.webkitAudioContext;
    if (!Ctx) return false;
    stopLessonSfx();
    const ctx = new Ctx();
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const nodes = pattern(kind, ctx);
    if (!nodes.length) {
      void ctx.close();
      return false;
    }
    active = { ctx, nodes };
    const last = nodes[nodes.length - 1];
    last.onended = () => {
      if (active && active.ctx === ctx) stopLessonSfx();
    };
    return true;
  } catch {
    return false;
  }
}
