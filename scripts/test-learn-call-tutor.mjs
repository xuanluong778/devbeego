/**
 * Learn Call level 1 tutor and summary rules. No OpenAI, gateway, or production Redis.
 */
import assert from "node:assert/strict";
import { learnAiCallLevelOneLimits, learnAiCallLevelOnePrompt, learnAiCallSummary } from "../lib/beego/learn/ai-call-access.js";
import {
  LEARN_CALL_CLOSING_LEAD_MS,
  LEARN_CALL_DEFAULT_DIFFICULTY,
  LEARN_CALL_DIFFICULTIES,
  LEARN_CALL_DIFFICULTY_KEYS,
  LEARN_CALL_MAX_REPLY_TOKENS,
  LEARN_CALL_MEMORY_MAX_ENTRIES,
  LEARN_CALL_MIN_REPLY_MS,
  LEARN_CALL_NO_CALL_HISTORY,
  buildLearnCallMessages,
  learnCallContextFromLesson,
  learnCallDifficulty,
  learnCallHasClosing,
  learnCallLearningNotes,
  learnCallLessonFocus,
  learnCallMaxReplyTokens,
  learnCallShapeReply,
  learnCallLearnerIsStuck,
  learnCallSpokenText,
  learnCallTurnDirective,
  learnCallTurnPlan,
  learnCallTutorPrompt,
} from "../lib/beego/learn/learn-call-tutor.js";
import { learnTranscriptSnapshot } from "../lib/beego/learn/learn-call-transcript.js";

const lesson = {
  lessonId: "p1-g1-n02",
  title: "Hỏi tên một người",
  topicTitle: "Chào hỏi",
  objective: "Hỏi tên một người. Bài luyện nghe, nghĩa, ghép, câu, dịch hai chiều.",
  grammarPoint: "Đại từ nhân xưng I / You / He / She",
  questions: [
    { speakTarget: "What is your name?", ttsText: "My name is Beego. Hello!" },
    { type: "vocabulary_choice", correctAnswer: "b", options: [{ id: "a", text: "tạm biệt" }, { id: "b", text: "name" }] },
    { wordBank: ["My", "name", "is", "Mai", "xin chào"] },
    { extensions: { gradingTarget: "Good morning, Mai" } },
  ],
};

const focus = learnCallLessonFocus(lesson);
assert.deepEqual(focus.patterns, ["What is your name", "My name is Beego", "Good morning"]);
assert.ok(focus.words.includes("name") && focus.words.includes("hello") && focus.words.includes("mai"));
assert.ok(!focus.words.includes("is") && !focus.words.some((w) => /[^a-z']/.test(w)), "no stop words or Vietnamese");

const ctx = { userId: "1", title: "Chào hỏi", ...learnCallContextFromLesson(lesson, { topicTitle: "Chào hỏi" }) };
assert.equal(ctx.objective, "Hỏi tên một người");
const prompt = learnCallTutorPrompt(ctx);
for (const part of ["Chào hỏi", "Hỏi tên một người", "What is your name", "name", "CONTEXT FROM THE SYSTEM", "- Level: Easy", "Difficulty: Easy", "one short, simple question", "two simple choices", "Never ask the learner to read aloud", "EACH TURN", "answer it briefly first", "WHEN THE LEARNER IS STUCK", "explain briefly in Vietnamese", "do not move to a new question", "can be misheard", "CORRECTING MISTAKES", "An orange juice, sure!", "no audio analysis is provided", "ENCOURAGEMENT", "Do not claim progress or mastery", "one concrete everyday communication task", "Do not ask again for something already clear", "do not pretend to remember earlier sessions", "Output only the words you will say aloud", LEARN_CALL_NO_CALL_HISTORY]) {
  assert.ok(prompt.includes(part), `prompt has ${part}`);
}
assert.equal(learnAiCallLevelOnePrompt(ctx), prompt, "gateway prompt is the tutor prompt");
assert.ok(!/score|grade/i.test(prompt.replace("Do not give scores", "")), "no grading in prompt");

assert.deepEqual([...LEARN_CALL_DIFFICULTY_KEYS], ["easy", "medium", "hard"]);
assert.equal(LEARN_CALL_DEFAULT_DIFFICULTY, "easy");
assert.deepEqual(LEARN_CALL_DIFFICULTY_KEYS.map((k) => LEARN_CALL_DIFFICULTIES[k].label), ["Dễ", "Vừa", "Khó"]);
for (const bad of [undefined, null, "", "Easy", "EASY", "expert", "toString", "__proto__", "constructor", 1, {}, ["easy"]]) {
  assert.equal(learnCallDifficulty(bad), null, `rejects ${String(bad)}`);
}
for (const key of LEARN_CALL_DIFFICULTY_KEYS) assert.equal(learnCallDifficulty(key), key);
assert.equal(learnCallTutorPrompt({ ...ctx, difficulty: "easy" }), prompt, "easy is the default prompt");
assert.equal(learnCallTutorPrompt({ ...ctx, difficulty: "bogus" }), prompt, "unknown difficulty falls back to easy");
const levelPrompts = Object.fromEntries(LEARN_CALL_DIFFICULTY_KEYS.map((k) => [k, learnCallTutorPrompt({ ...ctx, difficulty: k })]));
const levelMarkers = {
  easy: ["Difficulty: Easy", "basic, familiar words", "usually under 25 words"],
  medium: ["Difficulty: Medium", "open question", "draw out one more detail", "usually under 40 words"],
  hard: ["Difficulty: Hard", "a small change in the situation", "usually under 50 words"],
};
for (const key of LEARN_CALL_DIFFICULTY_KEYS) {
  const p = levelPrompts[key];
  for (const part of ["Chào hỏi", "Hỏi tên một người", "What is your name", "CONTEXT FROM THE SYSTEM", "Stay on the goal", "Never ask the learner to read aloud", "Output only the words you will say aloud", "even at Hard", "two simple choices", "Never make the learner match a fixed answer"]) {
    assert.ok(p.includes(part), `${key} prompt keeps ${part}`);
  }
  for (const part of levelMarkers[key]) assert.ok(p.includes(part), `${key} prompt has ${part}`);
  for (const other of LEARN_CALL_DIFFICULTY_KEYS.filter((k) => k !== key)) {
    assert.ok(!p.includes(levelMarkers[other][0]), `${key} prompt has no ${other} rules`);
  }
  assert.ok(!/score|grade/i.test(p.replace("Do not give scores", "")), `${key}: no grading`);
}
assert.ok(levelPrompts.hard.includes("make your English and your questions simpler, even at Hard") && !levelPrompts.hard.includes("Do not offer answer choices"), "a stuck learner gets help at Hard too");

const path = {
  sections: [
    { sectionId: "p1-g0", topicTitle: "Bảng chữ cái", nodes: [{ status: "skipped" }, { status: "completed" }] },
    { sectionId: "p1-g1", topicTitle: "Chào hỏi", nodes: [{ status: "completed" }, { status: "active" }, { status: "locked" }] },
    { sectionId: "p1-g2", topicTitle: "Gia đình", nodes: [{ status: "completed" }, { status: "completed" }] },
    { sectionId: "p1-g3", topicTitle: "Đồ uống", nodes: [{ status: "locked" }] },
  ],
};
const notes = learnCallLearningNotes(path, { sectionId: "p1-g1" });
assert.deepEqual(notes, [
  "Topics the learner has completed: Gia đình.",
  "In this topic the learner has completed 1 of 3 lessons.",
  LEARN_CALL_NO_CALL_HISTORY,
], "only fully completed topics count; placement-skipped lessons do not");
assert.deepEqual(learnCallLearningNotes(null), [LEARN_CALL_NO_CALL_HISTORY]);
const notedPrompt = learnCallTutorPrompt({ ...ctx, learningNotes: notes });
assert.ok(notedPrompt.includes("- Confirmed learning notes: Topics the learner has completed: Gia đình."));
assert.ok(notedPrompt.includes("1 of 3 lessons"));

for (const [raw, spoken] of [
  ["**Hello!** Nice to meet you 😊. What is your name?", "Hello! Nice to meet you. What is your name?"],
  ["Beego: Hi Lan! *smiles* How are you?", "Hi Lan! How are you?"],
  ["Tutor: Great! (laughs) Do you like coffee?", "Great! Do you like coffee?"],
  ["- Hello!\n- What do you drink?", "Hello! What do you drink?"],
  ["[pause] Okay. What is your name?", "Okay. What is your name?"],
  ["Do you want tea (or coffee)?", "Do you want tea (or coffee)?"],
  ["I *really* like it. Do you?", "I really like it. Do you?"],
]) {
  assert.equal(learnCallSpokenText(raw), spoken, `spoken text of ${JSON.stringify(raw)}`);
}
assert.equal(learnCallShapeReply("Teacher: **Great!** 👍 Do you like tea? Or coffee?"), "Great! Do you like tea?");

assert.ok(learnCallTurnDirective({ mode: "ask", learnerTurns: 1 }, "medium").includes("one open question that follows on from it"));
assert.ok(learnCallTurnDirective({ mode: "ask", learnerTurns: 1 }, "hard").includes("a reason, an example, a comparison, or a small change"));
assert.ok(learnCallTurnDirective({ mode: "ask", learnerTurns: 1 }, "hard").includes("give a short hint or two simple choices"), "hard helps a stuck learner");
assert.ok(learnCallTurnDirective({ mode: "greet" }, "hard").includes("more than a one-word answer"));
for (const key of LEARN_CALL_DIFFICULTY_KEYS) {
  assert.ok(learnCallTurnDirective({ mode: "closing" }, key).includes("Do not ask any question"), `${key} closing has no question`);
  assert.ok(learnCallTurnDirective({ mode: "ask", learnerTurns: 1 }, key).includes("Do not give them a word or sentence to say, try or repeat"), `${key} ask bans repeat-after-me`);
  for (const part of ["answer it briefly first", "say your last question again", "give one short example", "explain briefly in Vietnamese", "gently check what they meant"]) {
    assert.ok(learnCallTurnDirective({ mode: "ask", learnerTurns: 1 }, key).includes(part), `${key} ask covers ${part}`);
  }
  assert.ok(learnCallTurnDirective({ mode: "closing" }, key).includes("Do not claim progress"), `${key} closing praise is grounded`);
}

assert.deepEqual(LEARN_CALL_DIFFICULTY_KEYS.map((k) => LEARN_CALL_DIFFICULTIES[k].maxReplyTokens), [LEARN_CALL_MAX_REPLY_TOKENS, 160, 200]);
assert.equal(learnCallMaxReplyTokens(undefined), LEARN_CALL_MAX_REPLY_TOKENS);
assert.equal(learnCallMaxReplyTokens("abc"), LEARN_CALL_MAX_REPLY_TOKENS);
assert.equal(learnCallMaxReplyTokens(160), 160);
assert.equal(learnCallMaxReplyTokens(5000), 200, "job data cannot raise tokens past hard");
assert.equal(learnCallMaxReplyTokens(1), 60);
const longReply = "That is a really interesting answer about greeting people at school and at home with your family every single day. ".repeat(4).trim();
assert.ok(learnCallShapeReply(longReply).length <= LEARN_CALL_DIFFICULTIES.easy.maxReplyChars);
assert.ok(learnCallShapeReply(longReply, { difficulty: "hard" }).length > LEARN_CALL_DIFFICULTIES.easy.maxReplyChars);
assert.ok(learnCallShapeReply(longReply, { difficulty: "hard" }).length <= LEARN_CALL_DIFFICULTIES.hard.maxReplyChars);
assert.equal(
  learnCallShapeReply("Good point. Why do you think so? And what else?", { difficulty: "hard" }),
  "Good point. Why do you think so?",
  "hard still asks one question per turn",
);

for (const key of LEARN_CALL_DIFFICULTY_KEYS) {
  const limits = learnAiCallLevelOneLimits(key);
  assert.equal(limits.difficulty, key);
  assert.equal(limits.maxMinutes, 2, `${key} keeps the 2 minute limit`);
  assert.equal(limits.difficultyLabel, LEARN_CALL_DIFFICULTIES[key].label);
}
assert.equal(learnAiCallLevelOneLimits().difficulty, "easy");

const greetPlan = learnCallTurnPlan({ memory: [], remainingMs: 118_000 });
assert.equal(greetPlan.mode, "greet");
const user = (rid, text) => ({ role: "user", content: text, requestId: rid });
const tutor = (rid, text, playback = "complete", extra = {}) => ({ role: "assistant", content: text, requestId: rid, playback, ...extra });
const twoTurns = [tutor(3, "Nice! Do you like tea?"), user(3, "Yes."), tutor(2, "Hi Lan. How are you?"), user(2, "Lan."), tutor(1, "Hello! What is your name?")];
assert.equal(learnCallTurnPlan({ memory: twoTurns, remainingMs: 80_000 }).mode, "ask");
const fourTurns = [user(5, "Bye."), tutor(4, "Q4?"), user(4, "Fine."), ...twoTurns];
assert.equal(learnCallTurnPlan({ memory: fourTurns, remainingMs: 70_000 }).mode, "closing", "four answers close the call");
const threeTurns = [user(4, "Fine."), ...twoTurns];
assert.equal(learnCallTurnPlan({ memory: threeTurns, remainingMs: 90_000 }).mode, "ask", "three answers with time left keep going");
assert.equal(learnCallTurnPlan({ memory: threeTurns, remainingMs: 45_000 }).mode, "closing", "three answers near the end close");
assert.equal(learnCallTurnPlan({ memory: twoTurns, remainingMs: LEARN_CALL_CLOSING_LEAD_MS }).mode, "closing", "near deadline closes");
assert.equal(learnCallTurnPlan({ memory: twoTurns, remainingMs: LEARN_CALL_MIN_REPLY_MS - 1 }).mode, "none", "no reply that cannot finish before the deadline");
assert.equal(learnCallTurnPlan({ memory: [tutor(5, "Bye!", "pending", { closing: true }), ...fourTurns], remainingMs: 60_000 }).mode, "closed");
assert.ok(learnCallTurnDirective({ mode: "closing" }).includes("Do not ask any question"));
assert.ok(learnCallTurnDirective({ mode: "ask", learnerTurns: 2 }).includes("one simple question that follows on from it"));

const messages = buildLearnCallMessages({
  system: prompt,
  memory: [user(2, "My name is Lan."), tutor(1, "Hello! What is your name?")],
  directive: learnCallTurnDirective({ mode: "ask", learnerTurns: 1 }),
});
assert.deepEqual(messages.map((m) => m.role), ["system", "assistant", "user", "system"]);
assert.equal(messages[0].content, prompt, "only the Learn prompt, no generic tutor prompt");
assert.equal(messages.filter((m) => m.content === "My name is Lan.").length, 1, "learner line is not duplicated");
assert.ok(messages.every((m) => Object.keys(m).sort().join() === "content,role"), "no extra fields sent to the model");
const greetMessages = buildLearnCallMessages({ system: prompt, memory: [], directive: learnCallTurnDirective(greetPlan) });
assert.deepEqual(greetMessages.map((m) => m.role), ["system", "user", "system"]);

assert.equal(learnCallShapeReply("Nice to meet you, Lan! Do you like tea? Or coffee? I like both."), "Nice to meet you, Lan! Do you like tea?");
assert.equal(
  learnCallShapeReply("Great! Let's practise ordering a drink at a café. I'll be the staff. Hi, what would you like?"),
  "Let's practise ordering a drink at a café. I'll be the staff. Hi, what would you like?",
);
assert.ok(learnCallShapeReply(`${"That is a really lovely and interesting answer about your family. ".repeat(4)}Who do you live with?`).endsWith("Who do you live with?"));
assert.equal(
  learnCallShapeReply("Câu này hỏi bạn thường uống gì sau giờ học. Bạn thích uống gì? What do you usually drink after school?"),
  "Câu này hỏi bạn thường uống gì sau giờ học. Bạn thích uống gì? What do you usually drink after school?",
  "after a Vietnamese explanation the English question is kept",
);
assert.equal(learnCallShapeReply("Bạn thích uống gì?"), "Bạn thích uống gì?");
assert.equal(learnCallShapeReply("Would you like to sit in the café? Or take it away?"), "Would you like to sit in the café?");

for (const text of ["Sorry, I don't know.", "Hmm... I don't understand.", "Hmm.", "I don't understand the question.", "Uh, sorry teacher, I don't know what to say.", "I'm not sure."]) {
  assert.ok(learnCallLearnerIsStuck(text), `stuck: ${text}`);
}
for (const text of ["Tea.", "Sorry, tea.", "I don't know, maybe tea.", "I don't like coffee.", "My name is Lan.", "", "Can you say that again?"]) {
  assert.ok(!learnCallLearnerIsStuck(text), `not stuck: ${text}`);
}
const stuckMemory = [
  { role: "user", content: "Sorry, I don't know.", requestId: 3 },
  { role: "assistant", content: "What drink do you like?", requestId: 2 },
  { role: "user", content: "Hmm... I don't understand.", requestId: 2 },
  { role: "assistant", content: "Why do people choose cold drinks?", requestId: 1 },
];
assert.equal(learnCallTurnPlan({ memory: stuckMemory, remainingMs: 100_000 }).stuckTurns, 2);
assert.equal(learnCallTurnPlan({ memory: [{ role: "user", content: "Tea, please.", requestId: 4 }, ...stuckMemory], remainingMs: 100_000 }).stuckTurns, 0, "a real answer resets the stuck count");
assert.equal(learnCallTurnPlan({ memory: [{ role: "user", content: "Milk tea.", requestId: 2 }, stuckMemory[3]], remainingMs: 100_000 }).stuckTurns, 0);
assert.ok(learnCallTurnDirective({ mode: "ask", learnerTurns: 2, stuckTurns: 2 }, "hard").includes("two choices"), "hard: stuck twice gets choices");
const planFor = (content) => learnCallTurnPlan({ memory: [{ role: "user", content, requestId: 2 }, stuckMemory[3]], remainingMs: 100_000 });
for (const ask of ["Can you explain in Vietnamese?", "Giải thích bằng tiếng Việt được không?", "Vietnamese please", "In Vietnamese?", "Tiếng Việt?"]) {
  assert.ok(planFor(ask).wantsVietnamese, `Vietnamese request: ${ask}`);
  assert.ok(learnCallTurnDirective(planFor(ask), "hard").includes("one short Vietnamese sentence"));
}
for (const answer of ["I like Vietnamese coffee.", "My friend is Vietnamese.", "Milk tea."]) {
  assert.ok(!planFor(answer).wantsVietnamese, `not a Vietnamese request: ${answer}`);
}
assert.ok(
  !learnCallTurnPlan({ memory: [{ role: "user", content: "Milk tea.", requestId: 3 }, { role: "user", content: "Explain in Vietnamese", requestId: 2 }], remainingMs: 100_000 }).wantsVietnamese,
  "only the latest answer counts",
);
assert.ok(learnCallTurnDirective({ mode: "ask", learnerTurns: 1, stuckTurns: 1 }, "medium").includes("simpler words"));
assert.ok(!learnCallTurnDirective({ mode: "ask", learnerTurns: 1, stuckTurns: 0 }, "easy").includes("stuck 0"));
assert.equal(learnCallShapeReply("Great job, Lan. See you soon! Do you want more?", { closing: true }), "Great job, Lan. See you soon!");
assert.equal(learnCallShapeReply("Any questions?", { closing: true }), "Great job today. Goodbye!");

const fullSession = [
  tutor(6, "Thank you, Lan. Great job today. Goodbye!", "complete", { closing: true }),
  user(6, "Tea."),
  tutor(5, "Is it tea or coffee?", "interrupted"),
  user(5, "Hmm."),
  tutor(4, "What do you drink in the morning?", "cancelled"),
  user(4, "Eh."),
  tutor(3, "Do you like tea?", "pending"),
  user(3, "Fine."),
  tutor(2, "How are you, Lan?", "complete"),
  user(2, "My name is Lan."),
  tutor(1, "Hello! What is your name?", "complete"),
];
assert.ok(LEARN_CALL_MEMORY_MAX_ENTRIES >= fullSession.length + 10, "a level 1 session fits in the memory limit");
assert.ok(learnCallHasClosing(fullSession));
const snapshot = learnTranscriptSnapshot(fullSession);
assert.equal(snapshot.length, fullSession.length, "greeting, re-ask and closing are all restored");
assert.equal(snapshot[0].text, "Hello! What is your name?");
assert.equal(snapshot.at(-1).closing, true);
assert.deepEqual(snapshot.filter((t) => t.role === "tutor").map((t) => t.playback), ["complete", "complete", "pending", "cancelled", "interrupted", "complete"]);

const summary = learnAiCallSummary({ memory: fullSession, startedAt: 1_000, endedAt: 200_000, deadlineAt: 121_000, lesson: { title: "Chào hỏi" } });
assert.equal(summary.durationSeconds, 120, "duration is clamped to the server deadline");
assert.equal(summary.learnerTurns, 5);
assert.deepEqual(summary.tutorPlayback, { complete: 3, interrupted: 1, cancelled: 1, unconfirmed: 1 });
assert.equal(summary.closed, true);
assert.equal(summary.transcript.length, fullSession.length);
assert.equal(summary.pronunciation, "Chưa đánh giá");
assert.equal(summary.score, null);
assert.equal(summary.practiced, true);
const silent = learnAiCallSummary({ memory: [tutor(1, "Hello! What is your name?", "complete")], startedAt: 0, endedAt: 30_000, deadlineAt: 120_000 });
assert.equal(silent.practiced, false, "no learner line is not a practice success");
assert.equal(silent.learnerTurns, 0);
assert.equal(silent.durationSeconds, 30);

console.log(JSON.stringify({
  patterns: focus.patterns.length,
  plan: ["greet", "ask", "closing@4", "closing@deadline", "none<8s"].join(","),
  messages: messages.map((m) => m.role).join(">"),
  restored: snapshot.length,
  tutorPlayback: summary.tutorPlayback,
  silentPracticed: silent.practiced,
}));
