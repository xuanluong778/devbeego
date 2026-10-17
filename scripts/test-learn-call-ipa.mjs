/**
 * Learn Call IPA helpers. No OpenAI, Redis, or production network.
 */
import assert from "node:assert/strict";
import {
  LEARN_CALL_IPA_ACCENT,
  LEARN_CALL_IPA_ACCENT_LABEL,
  learnCallCleanIpa,
  learnCallIpaCacheKey,
  learnCallShapeIpaPayload,
  learnCallSplitSentences,
} from "../lib/beego/learn/learn-call-ipa.js";

assert.deepEqual(learnCallSplitSentences("Hello! What's your name?"), ["Hello!", "What's your name?"]);
assert.deepEqual(learnCallSplitSentences("  One line  "), ["One line"]);
assert.deepEqual(learnCallSplitSentences(""), []);

assert.equal(learnCallCleanIpa("/həˈloʊ/"), "/həˈloʊ/");
assert.equal(learnCallCleanIpa("həˈloʊ wʌts jʊr neɪm"), "/həˈloʊ wʌts jʊr neɪm/");
assert.equal(learnCallCleanIpa("xin chào"), "", "Vietnamese respelling rejected");
assert.equal(learnCallCleanIpa("hello there"), "", "plain Latin rejected");

const shaped = learnCallShapeIpaPayload("Hello! What's your name?", [
  { text: "Hello!", ipa: "/həˈloʊ/" },
  { text: "What's your name?", ipa: "/wʌts jʊr neɪm/" },
]);
assert.equal(shaped.accent, LEARN_CALL_IPA_ACCENT);
assert.equal(shaped.accentLabel, LEARN_CALL_IPA_ACCENT_LABEL);
assert.equal(shaped.sentences.length, 2);
assert.equal(shaped.sentences[0].ipa, "/həˈloʊ/");
assert.equal(shaped.sentences[1].text, "What's your name?");

const incomplete = learnCallShapeIpaPayload("Hello! Bye.", [{ text: "Hello!", ipa: "/həˈloʊ/" }]);
assert.equal(incomplete.sentences[0].ipa, "/həˈloʊ/");
assert.equal(incomplete.sentences[1].ipa, "", "missing IPA stays empty for the caller to reject");

assert.ok(learnCallIpaCacheKey("Hello!").startsWith("voice:learn-call-ipa:us:"));
assert.equal(learnCallIpaCacheKey("Hello!"), learnCallIpaCacheKey("Hello!"));
assert.notEqual(learnCallIpaCacheKey("Hello!"), learnCallIpaCacheKey("Hello."));

console.log(
  JSON.stringify({
    accent: LEARN_CALL_IPA_ACCENT,
    split: learnCallSplitSentences("Nice to meet you, Lan! Do you like tea?").length,
    cacheKeyLen: learnCallIpaCacheKey("x").length,
  })
);
