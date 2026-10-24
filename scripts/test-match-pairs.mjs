#!/usr/bin/env node
/**
 * Match pairs, plus listening-picture and meaning-choice regression.
 * node --import ./scripts/register-alias.mjs scripts/test-match-pairs.mjs
 */
import { generateLessonQuestions } from "../lib/beego/learn/lesson-content-generate.js";
import { buildLessonMixFromContent } from "../lib/beego/learn/lesson-mix-engine.js";
import { checkAnswer } from "../lib/beego/learn/exercise-check.js";
import {
  applyMatchSelection,
  afterAudioCue,
  audioCueLabel,
  audioSelectLabel,
  buildLessonAudioMatchPairs,
  columnOrder,
  gradeMatchAnswer,
  initialMatchState,
  leftItemId,
  pronunciationDistance,
  rightItemId,
} from "../lib/beego/learn/match-pairs.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function lesson(nodeType, id, part = 1) {
  return generateLessonQuestions({
    lessonId: id,
    nodeType,
    gate: { topicTitle: "topic", grammarPoint: "grammar" },
    part: { partNumber: part },
    blueprint: { listenSlot: 1 },
  });
}

const vocab = lesson("vocabulary", "p1-g1-n01");
const match = vocab.find((q) => q.type === "matching_pairs");
assert(match, "vocabulary lesson has a match exercise");
assert(match.pairs.length >= 4 && match.pairs.length <= 6, "4–6 pairs");
const ens = match.pairs.map((p) => p.en.toLowerCase());
const vis = match.pairs.map((p) => p.vi.toLowerCase());
assert(new Set(ens).size === ens.length && new Set(vis).size === vis.length, "no duplicate labels");
assert(new Set(match.pairs.map((p) => p.pairId)).size === match.pairs.length, "stable pair ids");

const orderA = columnOrder(match.pairs, match.id);
const orderB = columnOrder(match.pairs, match.id);
assert(JSON.stringify(orderA) === JSON.stringify(orderB), "shuffle is stable");
assert(JSON.stringify(orderA.left) !== JSON.stringify(orderA.right), "columns shuffle independently");
assert(
  orderA.left.every((item, idx) => pairIdFromItemId(item) !== pairIdFromItemId(orderA.right[idx])),
  "derangement: no matching pair is aligned in the same row"
);

let state = initialMatchState();
const first = match.pairs[0];
const other = match.pairs[1];
state = applyMatchSelection(state, match.pairs, "left", leftItemId(first.pairId));
state = applyMatchSelection(state, match.pairs, "left", leftItemId(other.pairId));
assert(state.leftId === leftItemId(other.pairId), "unmatched choice can change");
state = applyMatchSelection(state, match.pairs, "right", rightItemId(first.pairId));
assert(state.mistakes === 1 && state.message.includes("Chưa đúng"), "wrong pair is explained");
assert(state.leftId == null && state.rightId == null, "wrong pair clears the selection");
assert(!state.locked.includes(first.pairId), "wrong pair is not locked");
state = applyMatchSelection(state, match.pairs, "left", leftItemId(first.pairId));
state = applyMatchSelection(state, match.pairs, "right", rightItemId(first.pairId));
assert(state.locked.includes(first.pairId) && state.mistakes === 1, "correct pair locks after a miss");
const again = applyMatchSelection(state, match.pairs, "left", leftItemId(first.pairId));
assert(again === state, "locked pair cannot be selected again");

const matches = match.pairs.map((pair) => ({
  pairId: pair.pairId,
  leftItemId: leftItemId(pair.pairId),
  rightItemId: rightItemId(pair.pairId),
}));
const perfect = { completed: true, mistakeCount: 0, matches };
const missed = { completed: true, mistakeCount: 1, matches };
assert(gradeMatchAnswer(match, perfect).complete && gradeMatchAnswer(match, perfect).accurate, "finished and accurate are separate");
assert(gradeMatchAnswer(match, missed).complete && !gradeMatchAnswer(match, missed).accurate, "finishing after a miss is not perfect");
assert(checkAnswer(match, perfect) === true, "perfect answer grades true");
assert(checkAnswer(match, missed) === false, "a completed miss is not marked correct");
assert(checkAnswer(match, { completed: true, mistakeCount: 0, matches: [{ leftItemId: "hello", rightItemId: "xin chào" }] }) === false, "labels are not the key");

const mixed = buildLessonMixFromContent({ lessonId: "p1-g1-n01", type: "vocabulary", questions: vocab }, {});
assert(mixed.questions.some((q) => q.type === "matching_pairs"), "mix keeps the match exercise");
assert(mixed.questions.some((q) => q.extensions?.meaningChoice), "meaning choice remains in the mix");
assert(mixed.questions.some((q) => q.extensions?.choicePresentation === "picture"), "the vocabulary lesson now includes picture listening");

const listening = lesson("listening", "p2-g1-n04", 2);
assert(listening.some((q) => q.extensions?.choicePresentation === "picture"), "picture listening unchanged");
assert(listening.some((q) => q.type === "matching_pairs"), "a listening node now includes matching");

const textMatch = vocab.find((q) => q.type === "matching_pairs" && !q.extensions?.audioMatch);
const audioMatch = vocab.find((q) => q.extensions?.audioMatch);
assert(textMatch?.prompt === "Ghép từ tiếng Anh với nghĩa tiếng Việt.", "English–Vietnamese matching stays the same");
assert(audioMatch && audioMatch.type === "matching_pairs", "audio match reuses matching_pairs");
assert(audioMatch.pairs.length >= 4 && audioMatch.pairs.length <= 6, "audio match has 4–6 items");
const audioKeys = audioMatch.pairs.map((pair) => pair.en.toLowerCase().replace(/[^a-z]/g, ""));
assert(new Set(audioKeys.map((word) => word[0])).size === audioKeys.length, "beginner sounds start differently");
assert(new Set(audioKeys.map((word) => word.slice(-2))).size === audioKeys.length, "beginner endings differ");
for (const pair of audioMatch.pairs) {
  assert(!audioCueLabel().includes(pair.en), "listen label hides the word");
  assert(!audioSelectLabel(false, false).includes(pair.en), "select label hides the word");
  assert(!audioSelectLabel(true, false).includes(pair.en) && !audioSelectLabel(false, true).includes(pair.en), "selection state hides the word");
}
const shuffled = columnOrder(audioMatch.pairs, audioMatch.id);
assert(shuffled.left.every((id) => id.startsWith("L:sound-")), "audio items keep pair ids after shuffle");
const audioPerfect = {
  completed: true,
  mistakeCount: 0,
  matches: audioMatch.pairs.map((pair) => ({
    pairId: pair.pairId,
    leftItemId: leftItemId(pair.pairId),
    rightItemId: rightItemId(pair.pairId),
  })),
};
assert(checkAnswer(audioMatch, audioPerfect) === true, "shuffled audio match still grades by id");
const replay = initialMatchState();
const heard = afterAudioCue(replay, { ok: true, via: "audio" });
const failed = afterAudioCue(replay, { ok: false, via: "error" });
const replaced = afterAudioCue({ ...replay, mistakes: 1 }, { ok: false, via: "cancelled" });
assert(heard.attempt === false && heard.heart === false && heard.state === replay, "replay does not create an attempt");
assert(failed.heart === false && failed.state.mistakes === 0 && failed.hearError.includes("thử lại"), "playback failure offers retry");
assert(replaced.hearError === "" && replaced.state.mistakes === 1, "stopping the previous clip is not an error");
assert(checkAnswer(audioMatch, { completed: false, mistakeCount: 0, matches: [] }) === false, "an unfinished audio match is not correct");

const near = buildLessonAudioMatchPairs(
  [
    { en: "ship", vi: "tàu" },
    { en: "sheep", vi: "cừu" },
    { en: "chip", vi: "miếng" },
    { en: "cheap", vi: "rẻ" },
    { en: "sun", vi: "mặt trời" },
    { en: "book", vi: "sách" },
  ],
  3,
  { advanced: true, count: 4 }
);
assert(near && near.map((pair) => pair.en).sort().join() === "cheap,chip,sheep,ship", "advanced round uses near pronunciations");
assert(pronunciationDistance("claim", "conclusion") > 1, "shared first letter is not a near sound");
const letterGroup = buildLessonAudioMatchPairs(
  [
    { en: "claim", vi: "khẳng định" },
    { en: "counter", vi: "phản bác" },
    { en: "clear", vi: "rõ" },
    { en: "conclusion", vi: "kết luận" },
    { en: "sun", vi: "mặt trời" },
    { en: "book", vi: "sách" },
    { en: "map", vi: "bản đồ" },
    { en: "hotel", vi: "khách sạn" },
  ],
  9,
  { advanced: true, count: 4 }
);
assert(letterGroup && new Set(letterGroup.map((pair) => pair.en[0].toLowerCase())).size > 1, "advanced round does not group by first letter");

const mixedAudio = buildLessonMixFromContent({ lessonId: "p1-g1-n01", type: "vocabulary", questions: vocab }, {});
assert(mixedAudio.questions.some((q) => q.extensions?.audioMatch), "mix keeps audio matching");
assert(mixedAudio.questions.some((q) => q.type === "matching_pairs" && !q.extensions?.audioMatch), "mix keeps English–Vietnamese matching");

class FakeAudio {
  constructor() {
    this.paused = true;
    FakeAudio.all.push(this);
  }
  set onended(fn) {
    this.ended = fn;
  }
  set onerror(fn) {
    this.errored = fn;
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute() {}
}
FakeAudio.all = [];
globalThis.window = {
  speechSynthesis: { cancel() {}, speak() {} },
  AudioContext: class {
    constructor() {
      this.state = "running";
    }
    createBuffer() {
      return {};
    }
    createBufferSource() {
      return { connect() {}, start() {} };
    }
    close() {}
  },
};
globalThis.Audio = FakeAudio;
const { playBeegoAudio } = await import("../lib/beego/audio-player.js");
playBeegoAudio({ text: "ship", lang: "en" });
const previous = FakeAudio.all[0];
playBeegoAudio({ text: "sheep", lang: "en" });
assert(previous.paused === true && FakeAudio.all.length === 2, "a new clip stops the previous clip");
FakeAudio.prototype.play = function play() {
  return Promise.reject(new Error("tts down"));
};
globalThis.window.speechSynthesis = null;
const broken = await playBeegoAudio({ text: "chip", lang: "en" });
const brokenCue = afterAudioCue(initialMatchState(), broken);
assert(broken.ok === false && brokenCue.heart === false && brokenCue.attempt === false, "a TTS failure does not cost a heart");

console.log("PASS match pairs");
