/**
 * Learn effect tones stay off the TTS path and fail softly.
 * node --import ./scripts/register-alias.mjs scripts/test-lesson-sfx.mjs
 */
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const store = new Map();
let started = 0;
let ttsStopped = 0;

globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
  },
  dispatchEvent() {},
  addEventListener() {},
  removeEventListener() {},
  speechSynthesis: { speaking: false, cancel() { ttsStopped += 1; } },
  AudioContext: class {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.state = "running";
    }
    resume() {
      return Promise.resolve();
    }
    close() {}
    createOscillator() {
      return {
        type: "sine",
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() { started += 1; },
        stop() {},
        disconnect() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    }
  },
};

const { isBeegoAudioActive } = await import("../lib/beego/audio-player.js");
const { isLessonSpeechCapturing, startLessonSpeechCapture } = await import(
  "../lib/beego/learn/adapters/lesson-speech.js"
);
const { lessonSfxEnabled, playLessonSfx, setLessonSfxEnabled, stopLessonSfx } = await import(
  "../lib/beego/learn/lesson-sfx.js"
);

assert(lessonSfxEnabled() === true, "effects start enabled");
assert(playLessonSfx("pop") === true, "a pop tone can play");
assert(started === 1, "pop uses one tone");
assert(ttsStopped === 0, "an effect does not cancel speech");
playLessonSfx("ding");
assert(started === 2, "a new effect replaces the previous one");
setLessonSfxEnabled(false);
assert(playLessonSfx("fanfare") === false, "muted effects stay silent");
assert(started === 2, "mute does not start oscillators");
setLessonSfxEnabled(true);
window.speechSynthesis.speaking = true;
assert(isBeegoAudioActive() === true, "speaking TTS counts as active audio");
assert(playLessonSfx("ding") === false, "effects wait while TTS is speaking");
window.speechSynthesis.speaking = false;
window.AudioContext = class {
  constructor() {
    throw new Error("audio blocked");
  }
};
assert(playLessonSfx("soft") === false, "an audio failure does not throw");
stopLessonSfx();

const capture = startLessonSpeechCapture({ onResult() {}, onError() {} });
assert(capture && typeof capture.stop === "function", "capture still returns a stop handle");
assert(isLessonSpeechCapturing() === false, "an unsupported browser does not stay in capture");

console.log("PASS lesson sfx");
