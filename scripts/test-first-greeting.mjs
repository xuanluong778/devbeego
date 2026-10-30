/**
 * Speaking coach and the first-greeting lesson shape.
 * node --import ./scripts/register-alias.mjs scripts/test-first-greeting.mjs
 */
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const { scoreText } = await import("../lib/client-pronunciation-eval.js");
const { scoreSpeakingAttempt, checkAnswer } = await import("../lib/beego/learn/exercise-check.js");
const { buildCurriculum50Lesson } = await import("../lib/beego/learn/curriculum-50/builder.js");

const target = "Hello, let me introduce myself to my new classmate.";
const exercise = {
  type: "speaking",
  speakTarget: target,
  minScore: 65,
  extensions: {
    gradingMode: "word_match",
    focusWords: ["hello", "introduce", "classmate"],
    practiceChunks: ["Hello.", "introduce myself", "new classmate"],
    reviewVariants: [
      {
        id: "g01l01-intro-review",
        text: "Hello. Let me introduce myself to a classmate.",
      },
    ],
    minScore: 65,
  },
};

const missed = "Hello, let me interview myself to my new classmate.";
const oldScore = scoreText(missed, target);
const missedResult = scoreSpeakingAttempt(exercise, missed);
assert(oldScore >= 65, `setup: character overlap of the missed focus word should be high, got ${oldScore}`);
assert(missedResult.passed === false, "a wrong focus word must not pass");
assert(missedResult.focusMissing.includes("introduce"), "introduce is the word to practice");
assert(!/phát âm sai|Tốt/i.test(missedResult.feedbackVi), "feedback must not call this good pronunciation");
assert(missedResult.notPronunciationAssessment === true, "score is text match, not pronunciation");

const exact = scoreSpeakingAttempt(exercise, target);
assert(exact.passed === true, "the full sentence passes");
assert(exact.focusMissing.length === 0, "no missing focus words");

const unsure = scoreSpeakingAttempt(exercise, "uh");
assert(unsure.passed === false && unsure.uncertain === true, "a tiny recognition is uncertain");
assert(/chưa phải kết luận bạn phát âm sai/i.test(unsure.feedbackVi), "uncertain recognition is not a pronunciation verdict");

const chunk = scoreSpeakingAttempt(exercise, "introduce myself", { practiceChunk: "introduce myself" });
assert(chunk.passed === true, "an allowed short chunk can pass after repeated misses");
assert(scoreSpeakingAttempt(exercise, "goodbye", { practiceChunk: "not-a-real-chunk" }).passed === false, "unknown chunks are ignored");

const review = scoreSpeakingAttempt(exercise, "Hello. Let me introduce myself to a classmate.", {
  variantId: "g01l01-intro-review",
});
assert(review.passed === true, "a saved review sentence is accepted");
assert(
  scoreSpeakingAttempt(exercise, "goodbye friend", { variantId: "nope" }).passed === false,
  "an unknown review id cannot pass an unrelated line"
);

const hello = {
  type: "speaking",
  speakTarget: "Hello. I'm Linh.",
  extensions: { gradingMode: "word_match", focusWords: ["hello"], minScore: 65 },
};
assert(scoreSpeakingAttempt(hello, "Hello. I am Linh.").passed === true, "I am and I'm are the same line");

const writing = {
  type: "translation",
  extensions: { productionKind: "greeting" },
};
assert(checkAnswer(writing, "Hello. I'm Mai."), "another name is a valid greeting");
assert(checkAnswer(writing, "Hi, my name is An."), "my name is is a valid greeting");
assert(checkAnswer(writing, "Hello, let me introduce myself.") === true, "introduce myself is valid");
assert(checkAnswer(writing, "What's your name?") === false, "a question is not a self-introduction");
assert(checkAnswer(writing, "Hello classmate") === false, "hello plus a noun is not enough");

const lesson = buildCurriculum50Lesson("g01l01");
const ids = lesson.questions.map((item) => item.id);
assert(ids.includes("g01l01-say-hello"), "short hello comes first");
assert(ids.includes("g01l01-ask-name"), "name question is in the lesson");
assert(ids.includes("g01l01-nice-meet"), "nice to meet you is in the lesson");
assert(ids.indexOf("g01l01-say-hello") < ids.indexOf("g01l01-part04-q01"), "short lines come before the long sentence");
assert(ids.includes("g01l01-part02-q01") && ids.includes("g01l01-part03-q01"), "meaning choices stay");
assert(ids.includes("g01l01-part08-q01"), "word order stays");
assert(ids.includes("g01l01-write-hello"), "free greeting writing is present");
assert(ids.includes("g01l01-passage") && ids.indexOf("g01l01-passage-check") > ids.indexOf("g01l01-passage"), "reading question follows the passage");
assert(lesson.questions.length <= 12, "the lesson stays within the existing question budget");

const listen = lesson.questions.find((item) => item.type === "listening_choice");
assert(listen, "listening stays");
const listenVisible = `${listen.prompt} ${(listen.options || []).map((opt) => opt.text).join(" ")}`;
assert(!/let me introduce/i.test(listenVisible), "the English script is not shown as the listening question");

const other = buildCurriculum50Lesson("g01l02");
assert(!other.questions.some((item) => String(item.id).startsWith("g01l01-")), "the next lesson does not copy the greeting lines");
const otherIds = other.questions.map((item) => item.id);
assert(otherIds.includes("g01l02-chunk-01"), "the next lesson starts its own short phrase");
assert(otherIds.indexOf("g01l02-chunk-01") < otherIds.indexOf("g01l02-part04-q01"), "short phrases come before that lesson's sentence");
assert(otherIds.includes("g01l02-write-focus"), "the next lesson has its own writing task");
assert(otherIds.indexOf("g01l02-passage-check") > otherIds.indexOf("g01l02-passage"), "the next lesson asks about its own passage");

console.log("first greeting ok", ids.join(" > "));
