/**
 * Every curriculum-50 lesson uses the first-greeting coaching shape
 * with its own phrases. Chào lần đầu stays on its hand-built lines.
 * node --import ./scripts/register-alias.mjs scripts/test-all-gates-coach.mjs
 */
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const { scoreText, tokenizeWords } = await import("../lib/client-pronunciation-eval.js");
const { phraseHit } = await import("../lib/beego/learn/speech-coach.js");
const { scoreSpeakingAttempt, checkAnswer } = await import("../lib/beego/learn/exercise-check.js");
const { buildCurriculum50Lesson } = await import("../lib/beego/learn/curriculum-50/builder.js");
const { listCurriculum50LessonIdsFromSlim } = await import("../lib/beego/learn/curriculum-50/loader.js");

function loose(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ids = listCurriculum50LessonIdsFromSlim().filter((id) => !/exam$/i.test(id));
let lessons = 0;
let speaks = 0;
for (const id of ids) {
  const lesson = buildCurriculum50Lesson(id);
  assert(lesson, `missing ${id}`);
  if (lesson.type === "test") continue;
  lessons += 1;
  const questions = lesson.questions || [];
  assert(questions.length <= 12, `${id} has ${questions.length} questions`);
  assert(!questions.some((item) => String(item.id).startsWith("g01l01-") && id !== "g01l01"), `${id} copied greeting ids`);

  if (id === "g01l01") continue;

  const chunks = questions.filter((item) => String(item.id).includes("-chunk-"));
  const long = questions.find((item) => item.type === "speaking" && !String(item.id).includes("-chunk-"));
  assert(chunks.length >= 1, `${id} has no short phrase`);
  assert(long, `${id} has no lesson sentence`);
  assert(questions.indexOf(chunks[0]) < questions.indexOf(long), `${id} short phrase is after the long sentence`);
  const phrases = long.extensions?.focusWords || [];
  assert(phrases.length >= 1, `${id} sentence has no focus phrases`);
  assert((long.extensions?.practiceChunks || []).length === phrases.length, `${id} chunks do not match focus phrases`);
  const variant = (long.extensions?.reviewVariants || [])[0];
  assert(variant?.text, `${id} has no review sentence`);
  assert(loose(variant.text) !== loose(long.speakTarget), `${id} review repeats the original sentence`);
  assert(scoreText(variant.text, long.speakTarget) < 65, `${id} review is too close to the original`);
  const reviewScore = scoreSpeakingAttempt(long, variant.text, { variantId: variant.id });
  assert(reviewScore.passed === true, `${id} review sentence does not pass: ${variant.text}`);
  const repeat = scoreSpeakingAttempt(long, long.speakTarget, { variantId: variant.id });
  assert(repeat.passed === false, `${id} repeating the original passes the review`);

  const exact = scoreSpeakingAttempt(long, long.speakTarget);
  assert(exact.passed === true, `${id} exact sentence fails`);
  const dropped = phrases[phrases.length - 1];
  const without = long.speakTarget.replace(new RegExp(dropped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  if (loose(without) !== loose(long.speakTarget)) {
    const missed = scoreSpeakingAttempt(long, without);
    assert(missed.passed === false, `${id} passes without ${dropped}`);
    assert(
      (missed.focusMissing || []).some((word) => word.toLowerCase() === dropped.toLowerCase()),
      `${id} does not name the missing phrase ${dropped}`
    );
  }
  const unsure = scoreSpeakingAttempt(long, "uh");
  assert(unsure.uncertain === true, `${id} treats "uh" as a pronunciation error`);
  const chunk = scoreSpeakingAttempt(long, phrases[0], { practiceChunk: phrases[0] });
  assert(chunk.passed === true, `${id} short chunk ${phrases[0]} does not pass`);
  assert(
    scoreSpeakingAttempt(long, "goodbye friend", { practiceChunk: "not-a-real-chunk" }).passed === false,
    `${id} accepts an unknown chunk`
  );

  const writing = questions.find((item) => item.extensions?.productionKind === "focus_phrases");
  assert(writing, `${id} has no free writing task`);
  const own = `I can use ${phrases.join(", ")} today.`;
  assert(checkAnswer(writing, own) === true, `${id} rejects another sentence with the same phrases`);
  const modelHasPhrases = phrases.every((phrase) => phraseHit(tokenizeWords(long.speakTarget), phrase));
  if (modelHasPhrases) {
    assert(checkAnswer(writing, long.speakTarget) === true, `${id} rejects its own sentence as writing`);
  }
  assert(checkAnswer(writing, "Hello there friend") === false, `${id} accepts writing without the focus phrases`);

  const listen = questions.find((item) => item.type === "listening_choice");
  if (listen) {
    const visible = loose(`${listen.prompt} ${(listen.options || []).map((opt) => opt.text).join(" ")}`);
    const needle = loose(long.speakTarget);
    if (needle.split(" ").length >= 4) {
      assert(!visible.includes(needle), `${id} shows the English sentence before listening`);
    }
  }
  const passageAt = questions.findIndex((item) => item.type === "passage_read");
  const checkAt = questions.findIndex((item) => item.id === `${id}-passage-check`);
  if (passageAt >= 0) assert(checkAt > passageAt, `${id} reading question is not after the passage`);
  speaks += 1;
}

const desk = buildCurriculum50Lesson("g05l03");
const deskSpeak = desk.questions.find((item) => item.id === "g05l03-part04-q01");
assert(scoreSpeakingAttempt(deskSpeak, "This is my desk, and that is the teacher's desk over there.").passed === true, "this/that sentence passes");
assert(
  scoreSpeakingAttempt(deskSpeak, "The desk is over there.").passed === false,
  "missing this and that must fail"
);

const name = buildCurriculum50Lesson("g01l02");
const nameSpeak = name.questions.find((item) => item.id === "g01l02-part04-q01");
assert(
  scoreSpeakingAttempt(nameSpeak, "My name is Linh Tran and my surname is Tran.").passed === false,
  "name alone is not the phrase full name"
);

console.log(`all gates coach ok: ${lessons} lessons, ${speaks} coached`);
