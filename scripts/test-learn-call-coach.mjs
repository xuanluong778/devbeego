/**
 * Azure word/phoneme coaching. No live Azure, microphone, or production Redis.
 */
import assert from "node:assert/strict";
import {
  learnCallAzureWordScores,
  learnCallCoachItems,
  learnCallCoachMessage,
  learnCallPhonemeHint,
  learnCallPronunciationKind,
} from "../lib/beego/learn/learn-call-coach.js";
import { normalizePronunciationResult } from "../lib/beego/learn/learn-call-pronunciation.js";
import { LEARN_CALL_EMPTY_LISTEN } from "../lib/beego/learn/learn-call-talk.js";
import { learnAiCallSummary } from "../lib/beego/learn/ai-call-access.js";

assert.ok(learnCallPhonemeHint("θ").includes("Lè lưỡi"));
assert.ok(learnCallPhonemeHint("th").includes("Lè lưỡi"));
assert.ok(learnCallPhonemeHint("æ").includes("Miệng mở rộng"));
assert.equal(learnCallPhonemeHint("zzz"), "");
assert.notEqual(learnCallPhonemeHint("θ"), learnCallPhonemeHint("r"));

const azureJson = {
  NBest: [
    {
      Words: [
        {
          Word: "think",
          PronunciationAssessment: { AccuracyScore: 41, ErrorType: "Mispronunciation" },
          Phonemes: [
            { Phoneme: "θ", PronunciationAssessment: { AccuracyScore: 28 } },
            { Phoneme: "ɪ", PronunciationAssessment: { AccuracyScore: 80 } },
          ],
        },
        {
          Word: "name",
          PronunciationAssessment: { AccuracyScore: 96, ErrorType: "None" },
          Phonemes: [{ Phoneme: "n", PronunciationAssessment: { AccuracyScore: 94 } }],
        },
      ],
    },
  ],
};
const words = learnCallAzureWordScores(azureJson);
assert.equal(words.length, 2);
assert.equal(learnCallPronunciationKind(words[0]), "pronunciation");
assert.equal(learnCallPronunciationKind(words[1]), "");
const items = learnCallCoachItems(words);
assert.equal(items.length, 1);
assert.equal(items[0].word, "think");
assert.equal(items[0].phoneme, "θ");
assert.ok(items[0].hintVi.includes("Lè lưỡi"));
assert.equal(items[0].evidence, "azure_phoneme");

const omitted = learnCallAzureWordScores({
  Words: [{ Word: "is", PronunciationAssessment: { AccuracyScore: 20, ErrorType: "Omission" } }],
});
assert.equal(learnCallPronunciationKind(omitted[0]), "recognition");
assert.equal(learnCallCoachItems(omitted).length, 0);
const recognition = learnCallCoachMessage(omitted);
assert.equal(recognition.reason, "recognition");
assert.equal(recognition.notice, LEARN_CALL_EMPTY_LISTEN);

assert.equal(learnCallCoachItems([]).length, 0);
assert.equal(learnCallCoachMessage([]).reason, "insufficient");

const noPhonemes = learnCallAzureWordScores({
  Words: [{ Word: "hello", PronunciationAssessment: { AccuracyScore: 40, ErrorType: "Mispronunciation" } }],
});
assert.equal(learnCallPronunciationKind(noPhonemes[0]), "insufficient");
assert.equal(learnCallCoachItems(noPhonemes).length, 0);

const fromTranscriptOnly = learnCallCoachItems([{ word: "hello", accuracyScore: null, errorType: "none", phonemes: [] }]);
assert.equal(fromTranscriptOnly.length, 0);

const normalized = normalizePronunciationResult({
  pronunciationScore: 70,
  accuracyScore: 65,
  fluencyScore: 80,
  completenessScore: 90,
  words,
});
assert.equal(normalized.coachItems.length, 1);
assert.equal(normalized.source, "azure");

const summary = learnAiCallSummary({
  startedAt: 1_000,
  endedAt: 4_000,
  lesson: { title: "Chào hỏi" },
  memory: [
    {
      role: "user",
      content: "I think so.",
      requestId: 2,
      pronunciationScore: 70,
      accuracyScore: 65,
      coachItems: items,
    },
    { role: "assistant", content: "How are you?", requestId: 1, playback: "complete" },
  ],
});
assert.equal(summary.score, 70);
assert.ok(summary.practicePoints[0].includes("think"));
assert.deepEqual(summary.replayPhrases, ["think"]);
assert.match(summary.grammarNote, /Chưa có dữ liệu ngữ pháp/);
assert.match(summary.communicationNote, /đã trả lời/);

const empty = learnAiCallSummary({ memory: [{ role: "assistant", content: "Hi?", requestId: 1, playback: "complete" }], startedAt: 1, endedAt: 2 });
assert.equal(empty.score, null);
assert.deepEqual(empty.practicePoints, []);
assert.match(empty.communicationNote, /Chưa đủ câu/);

console.log(JSON.stringify({ coachWord: items[0].word, phoneme: items[0].phoneme, skipOmission: true }));
