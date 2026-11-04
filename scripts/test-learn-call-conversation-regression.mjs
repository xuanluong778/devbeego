import { loadLearnCallTestEnv } from "./learn-call-test-env.mjs";
import assert from 'node:assert/strict';
import { createLearnCallPolicy, planLearnCallPolicy, learnCallPolicyResponse } from '../lib/beego/learn/learn-call-policy.js';
import { ensureLearnCallPolicy, reserveLearnCallPolicyTurn } from '../lib/beego/learn/learn-call-policy-store.js';
import { learnCallAge } from '../lib/beego/learn/learn-call-personal.js';
import { learnCallSelectOpening, learnCallSelectQuestion, learnCallTopicGuide } from '../lib/beego/learn/learn-call-topics.js';
import { learnCallClassifyAnswer, learnCallTurnPlan, buildLearnCallMessages } from '../lib/beego/learn/learn-call-tutor.js';
import { createRealtimeTurnCoordinator, learnCallTurnDetection } from '../lib/beego/learn/learn-call-realtime-turns.js';
import { createRealtimeCallLifecycle } from '../lib/beego/learn/learn-call-realtime-lifecycle.js';
import { mapRealtimeEvent, createRealtimeCall } from '../lib/beego/learn/learn-call-realtime.js';
import { learnAiCallSummary } from '../lib/beego/learn/ai-call-access.js';
const topicCtx = { topic: 'Chào hỏi', title: 'Chào hỏi', sessionMode: 'open' };
const guide = learnCallTopicGuide(topicCtx);
function setup(intent = 'job', question = 'What do you do?', ctx = {}) {
  const state = createLearnCallPolicy({ sessionId: 'seed-17', topicCtx: { ...topicCtx, ...ctx } });
  state.pending = { intent, targetId: intent, question };
  state.asked = [intent];
  return state;
}
let count = 0;
function check(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
for (const text of ['Technology', 'IT', 'I work in tech', 'I am student']) check(`communicated meaning accepted (${text})`, () => {
  const c = learnCallClassifyAnswer(text, { topicCtx, pendingQuestion: { intent: 'job' } });
  assert.equal(c.kind, 'accept');
  const { decision, state } = planLearnCallPolicy(setup(), { eventId: 'learner-1', text });
  assert.equal(decision.action, 'advance');
  assert.match(decision.spoken, /\?$/);
  assert.notEqual(state.pending.intent, 'job');
  assert.doesNotMatch(decision.spoken, /say|repeat|pronounc|try/i);
});
check('short reply advances in the legacy turn planner', () => {
  const plan = learnCallTurnPlan({ topicCtx, remainingMs: 90000, memory: [
    { role: 'assistant', requestId: 1, content: 'What do you do?' },
    { role: 'user', requestId: 2, content: 'Technology' },
  ] });
  assert.equal(plan.answerKind, 'accept');
  assert.equal(plan.nextFacet, 'job_enjoy');
});
let retry = planLearnCallPolicy(setup(), { eventId: 'practice-1', text: 'Help me practise' });
check('retry is reserved before any spoken invitation', () => {
  assert.equal(retry.state.retriesByTarget.job, 1);
  assert.equal(retry.decision.retryAllowed, true);
  assert.equal(retry.decision.action, 'practice_once');
});
check('duplicate event cannot reserve another retry', () => {
  const d = planLearnCallPolicy(retry.state, { eventId: 'practice-1', text: 'Help me practise again' });
  assert.equal(d.duplicate, true);
  assert.equal(d.state.retriesByTarget.job, 1);
  assert.deepEqual(d.decision, retry.decision);
});
check('rewording, changed model and reconnect do not reset target identity', () => {
  for (const question of ['Try saying I am a developer', 'Say software slowly', 'Tech. No. Lo. Gy.']) {
    const restored = JSON.parse(JSON.stringify(retry.state));
    const d = planLearnCallPolicy(restored, { eventId: question, text: 'Can we practise again?', question, targetId: question });
    assert.notEqual(d.decision.action, 'practice_once');
    assert.equal(d.state.retriesByTarget.job, 1);
    assert.notEqual(d.state.pending?.targetId, 'job');
  }
});
check('a prolonged failed attempt still advances', () => {
  const d = planLearnCallPolicy(retry.state, { eventId: 'bad-attempt', text: 'Te te te' });
  assert.equal(d.decision.action, 'advance');
  assert.equal(d.state.activePractice, null);
  assert.notEqual(d.state.pending?.targetId, 'job');
});
check('skip advances immediately; repeat-question stays without changing budget', () => {
  const repeat = planLearnCallPolicy(retry.state, { eventId: 'repeat-question', text: 'Could you repeat the question?' });
  assert.equal(repeat.decision.action, 'repeat_question');
  assert.equal(repeat.decision.spoken, 'What do you do?');
  assert.equal(repeat.state.retriesByTarget.job, 1);
  const skip = planLearnCallPolicy(repeat.state, { eventId: 'skip-1', text: 'Bỏ qua' });
  assert.equal(skip.decision.action, 'advance');
  assert.notEqual(skip.state.pending?.targetId, 'job');
});
const ageCases = [
  { name: 'spoken thirty-five', audioReference: 'thirty-five', transcript: 'thirty-five', expected: 35 },
  { name: 'digit 35', audioReference: 'thirty-five', transcript: '35', expected: 35 },
  { name: 'transcript error followed by correction', audioReference: 'thirty-five', transcript: '40', correction: 'No, thirty-five', expected: 35, transcriptError: true },
  { name: 'learner really says forty', audioReference: 'forty', transcript: '40', expected: 40 },
  { name: 'unverifiable', audioReference: null, transcript: '35 or 40', expected: undefined },
];
for (const c of ageCases) check(`personal data: ${c.name}`, () => {
  let result = planLearnCallPolicy(setup('age', 'How old are you?'), { eventId: 'age-1', text: c.transcript });
  const firstResponse = result.decision.spoken;
  if (c.correction) result = planLearnCallPolicy(result.state, { eventId: 'age-correction', text: c.correction });
  assert.equal(result.state.facts.age?.value, c.expected);
  assert.doesNotMatch(firstResponse + result.decision.spoken, /\b(?:35|40|thirty|forty)\b|pronounc|repeat after|try saying/i);
  const transcriptError = c.audioReference !== null && learnCallAge(c.audioReference) !== learnCallAge(c.transcript);
  const responseError = /\b(?:35|40|thirty|forty)\b/i.test(firstResponse);
  assert.equal(transcriptError, !!c.transcriptError);
  assert.equal(responseError, false);
  console.log(`  simulated input alignment: transcriptError=${transcriptError}, tutorValueError=${responseError}; real audio: NOT RUN`);
});
check('needed ambiguous age gets at most one confirmation', () => {
  let d = planLearnCallPolicy(setup('age', 'How old are you?', { requiredPersonalFacets: ['age'] }), { eventId: 'a', text: 'thirty or forty' });
  assert.equal(d.decision.action, 'confirm_personal');
  d = planLearnCallPolicy(d.state, { eventId: 'b', text: 'Not sure' });
  assert.equal(d.decision.action, 'advance');
  assert.equal(d.state.facts.age, undefined);
  assert.equal(d.state.confirmations.age, 1);
});
check('personal values omitted from model history and summary highlights', () => {
  const memory = [
    { role: 'user', requestId: 4, content: 'No, thirty-five' },
    { role: 'assistant', requestId: 3, content: 'You are 40 years old.' },
    { role: 'user', requestId: 2, content: '40' },
    { role: 'assistant', requestId: 1, content: 'How old are you?' },
  ];
  assert.doesNotMatch(JSON.stringify(buildLearnCallMessages({ system: 'tutor', memory })), /thirty-five|40/);
  const summary = learnAiCallSummary({ memory, lesson: { topic: 'Chào hỏi' } });
  assert.deepEqual(summary.highlights, []);
  assert.doesNotMatch(summary.learnerSaid + summary.practiceNote, /thirty|40/);
});
check('fixed seeds vary opening while keeping same-session choice stable', () => {
  const ids = new Set();
  for (let seed = 0; seed < 18; seed++) {
    const opts = { guide, sessionId: `fixed-seed-${seed}` };
    const a = learnCallSelectOpening(opts);
    ids.add(a.id);
    assert.deepEqual(a, learnCallSelectOpening(opts));
    assert.notEqual(learnCallSelectOpening({ ...opts, previousId: a.id }).id, a.id);
    assert.ok(a.spoken && a.targetId && a.hint.en && a.context);
  }
  assert.equal(ids.size, 3);
});
check('all bank topics retain level, hint, context and unasked target', () => {
  for (const topic of ['Chào hỏi', 'Đồ uống', 'Gia đình', 'Travel']) for (const difficulty of ['easy','medium','hard']) {
    const g = learnCallTopicGuide({ topic });
    const state = createLearnCallPolicy({ sessionId: 'fixed-5', topicCtx: { topic }, difficulty });
    const o = state.selection;
    assert.ok(o.hint.en);
    const covered = { asked: [o.targetId], answered: [o.targetId] };
    const next = learnCallSelectQuestion({ guide: g, covered, difficulty, sessionId: 'fixed-5', selection: o });
    if (next) {
      assert.ok(!covered.asked.includes(next.targetId));
      assert.equal(next.question, next.angle[difficulty] || next.angle.easy);
      assert.ok(next.hint.en);
    }
  }
});
check('unsolicited facts are excluded from subsequent questions', () => {
  const result = planLearnCallPolicy(setup('name', "What's your name?"), { eventId: 'multi-fact', text: 'My name is Mai. I live in Hanoi. I work in tech.' });
  assert.ok(result.state.answered.includes('home'));
  assert.ok(result.state.answered.includes('job'));
  assert.ok(!['name','home','job'].includes(result.decision.nextTargetId));
});
check('age parsing works beyond the reproduction values', () => {
  for (const [words, number] of [['twenty-seven',27],['sixty-two',62],['nineteen',19]]) assert.equal(learnCallAge(words), number);
});
check('ambiguous names are omitted and corrections replace reported names', () => {
  let r = planLearnCallPolicy(setup('name', "What's your name?"), { eventId: 'name-1', text: 'My name is Mai' });
  assert.equal(r.state.facts.name.value, 'Mai');
  r = planLearnCallPolicy(r.state, { eventId: 'name-fix', text: 'No, my name is Linh' });
  assert.equal(r.state.facts.name.value, 'Linh');
  assert.doesNotMatch(r.decision.spoken, /Mai|Linh/);
});
check('personal input does not become the reference for pronunciation', () => {
  const state = setup('age', 'How old are you?');
  const d = planLearnCallPolicy(state, { eventId: 'audio-ambiguous', text: 'forty or thirty-five' });
  assert.equal(d.decision.retryAllowed, false);
  assert.doesNotMatch(d.decision.spoken, /forty|thirty|35|40|try/i);
});
// Real coordinator and lifecycle, with a simulated provider and server policy endpoint.
const sent = [];
let requests = 0;
let serverState = setup();
const coordinator = createRealtimeTurnCoordinator({
  requestTurn: async payload => {
    requests++;
    const r = planLearnCallPolicy(serverState, { eventId: payload.itemId, text: payload.text });
    serverState = r.state;
    return { decision: r.decision, event: learnCallPolicyResponse(r.decision) };
  },
  sendEvent: e => { sent.push(e); return true; },
});
coordinator.connect('seed-17');
coordinator.observe(mapRealtimeEvent({ type: 'input_audio_buffer.speech_started', item_id: 'audio-item-1', audio_start_ms: 100 }));
coordinator.observe(mapRealtimeEvent({ type: 'input_audio_buffer.speech_stopped', item_id: 'audio-item-1', audio_end_ms: 1300 }));
coordinator.observe(mapRealtimeEvent({ type: 'input_audio_buffer.committed', item_id: 'audio-item-1', previous_item_id: 'opening' }));
await coordinator.observe(mapRealtimeEvent({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'audio-item-1', transcript: 'Technology' }));
check('Realtime requests approved line before audio, once per learner item ID', () => {
  assert.equal(requests, 1); assert.equal(sent.length, 1);
  assert.equal(sent[0].response.metadata.beego_action, 'advance');
  assert.equal(sent[0].response.metadata.beego_turn, 'audio-item-1');
  assert.equal(sent[0].response.metadata.beego_input_items, 'audio-item-1');
  assert.equal(sent[0].response.conversation, 'none');
  assert.match(sent[0].response.instructions, /You work in tech/);
  assert.doesNotMatch(sent[0].response.instructions, /Thanks\. /);
  assert.equal(learnCallTurnDetection('auto').create_response, false);
  assert.equal(learnCallTurnDetection('manual'), null);
  assert.doesNotMatch(JSON.stringify(coordinator.trace()), /Technology|thirty|forty/);
  assert.equal(coordinator.trace().find(e => e.type === 'user_audio_committed').itemId, 'audio-item-1');
});
await coordinator.observe({ type: 'user_transcript_final', itemId: 'audio-item-1', text: 'Technology' });
coordinator.connect('seed-17');
await coordinator.observe({ type: 'user_transcript_final', itemId: 'audio-item-1', text: 'Technology' });
check('coordinator suppresses duplicate/reconnect playback', () => { assert.equal(requests, 1); assert.equal(sent.length, 1); });
const manualSent = [];
let manualState = setup('home', 'Where do you live?');
const manualCoordinator = createRealtimeTurnCoordinator({
  requestTurn: async payload => {
    const result = planLearnCallPolicy(manualState, { eventId: payload.itemId, text: payload.text, itemIds: payload.itemIds });
    manualState = result.state;
    return { decision: result.decision, event: learnCallPolicyResponse(result.decision) };
  },
  sendEvent: event => { manualSent.push(event); return true; },
});
manualCoordinator.connect('manual-seed');
manualCoordinator.observe(mapRealtimeEvent({ type: 'input_audio_buffer.committed', item_id: 'manual-item' }));
await manualCoordinator.observe(mapRealtimeEvent({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'manual-item', transcript: 'I live in Ho Chi Minh City.' }));
check('manual commit asks the next question once and links that learner item', () => {
  assert.equal(manualSent.length, 1);
  assert.equal(manualSent[0].response.conversation, 'none');
  assert.equal(manualSent[0].response.metadata.beego_turn, 'manual-item');
  assert.equal(manualSent[0].response.metadata.beego_input_items, 'manual-item');
  assert.doesNotMatch(manualSent[0].response.instructions, /Thanks\. /);
  assert.match(manualSent[0].response.instructions, /Do you like living there\?/);
});
let delayedNotices = 0;
let delayedState = setup();
const delayedCoordinator = createRealtimeTurnCoordinator({
  requestTurn: async payload => {
    const result = planLearnCallPolicy(delayedState, { eventId: payload.itemId, text: payload.text });
    delayedState = result.state;
    return { decision: result.decision, event: learnCallPolicyResponse(result.decision) };
  },
  sendEvent: () => true,
  onError: () => { delayedNotices++; },
});
delayedCoordinator.connect('delayed');
delayedCoordinator.observe({ type: 'user_audio_committed', itemId: 'delayed-input' }, 1000);
delayedCoordinator.tick(13000); delayedCoordinator.tick(25000);
check('a missing final transcript gives one notice and invents no spoken answer', () => {
  assert.equal(delayedNotices, 1);
  assert.deepEqual(delayedState.answered, []);
});
await delayedCoordinator.observe({ type: 'user_transcript_final', itemId: 'delayed-input', text: 'Technology' }, 26000);
check('a late final transcript can still advance exactly once', () => assert.ok(delayedState.answered.includes('job')));
check('reconnect keeps opening selection and emits no greeting', () => {
  const life = createRealtimeCallLifecycle();
  life.configureOpening({ topicCtx: serverState.topicCtx, opening: serverState.selection, shouldSpeak: false });
  assert.deepEqual(life.noteReady(), []);
});
let captured;
await createRealtimeCall({ apiKey: 'test-key', sdpOffer: 'v=0', fetchFn: async (_url, opts) => {
  captured = JSON.parse(opts.body.get('session'));
  return new Response('v=0', { status: 201, headers: { location: '/v1/realtime/calls/test-only' } });
} });
check('provider call cannot bypass policy using automatic responses', () => {
  assert.equal(captured.audio.input.turn_detection.create_response, false);
  assert.equal(captured.audio.input.turn_detection.silence_duration_ms, 500, 'No unmeasured VAD change');
});
check('a complete place answer advances; a short or imperfect place answer does too', () => {
  const home = setup('home', 'Where do you live?');
  for (const text of ['I live in Ho Chi Minh City.', 'Ho Chi Minh City', 'Saigon', 'I lives in Hue']) {
    const { decision, state } = planLearnCallPolicy(structuredClone(home), { eventId: `place-${text.length}`, text });
    assert.equal(decision.action, 'advance', text);
    assert.equal(state.pending.intent, 'home_enjoy', text);
    assert.match(decision.spoken, /\?$/);
    assert.doesNotMatch(decision.spoken, /^Thanks\./);
    assert.doesNotMatch(decision.spoken, /say|repeat|your turn|slow down|listen/i, text);
  }
});
check('a second unclear turn drops the fact instead of assuming an answer', () => {
  const home = setup('home', 'Where do you live?');
  const first = planLearnCallPolicy(home, { eventId: 'noise-1', text: 'این نیبین با ما باید نیبین هاچین نیچی دید' });
  assert.equal(first.decision.action, 'support');
  const second = planLearnCallPolicy(first.state, { eventId: 'noise-2', text: 'อารยรียนของจรรมีสีบี' });
  assert.equal(second.decision.action, 'advance');
  assert.notEqual(second.state.pending?.intent, 'home_enjoy');
  assert.doesNotMatch(second.decision.spoken, /living there/i);
});
check('closing cancels a question that has not started playing', () => {
  const life = createRealtimeCallLifecycle();
  const now = 1_000_000;
  life.setClock({ startedAt: now - 100_000, deadlineAt: now + 20_000, serverNow: now }, now);
  life.observe({ type: 'assistant_turn_started', responseId: 'resp-q' }, now);
  const effects = life.tick(now + 9_000);
  assert.equal(life.closing, true);
  assert.ok(effects.some((effect) => effect.event?.type === 'response.cancel' && effect.event.response_id === 'resp-q'));
});
// Real Redis tests are isolated explicitly; never use .env.local Redis.
if (process.env.LEARN_CALL_REGRESSION_REDIS) {
  loadLearnCallTestEnv({ redisUrl: process.env.LEARN_CALL_REGRESSION_REDIS });
  const { default: Redis } = await import('ioredis');
  const redis = new Redis(process.env.LEARN_CALL_REGRESSION_REDIS);
  const prefix = `regression-${Date.now()}`;
  const options = { userId: prefix, sessionId: prefix, topicCtx, difficulty: 'easy' };
  try {
    const state = await ensureLearnCallPolicy(redis, options);
    state.pending = { intent: 'job', targetId: 'job', question: 'What do you do?' };
    state.asked = ['job'];
    await redis.set(`voice:learn-policy:${prefix}`, JSON.stringify(state), 'EX', 60);
    const results = await Promise.all(Array.from({ length: 8 }, () => reserveLearnCallPolicyTurn(redis, options, { eventId: 'duplicate-1', text: 'Can we practise?' })));
    check('real Redis CAS: concurrent duplicate events reserve only once', () => {
      assert.equal(results.filter(r => !r.duplicate).length, 1);
      assert.ok(results.every(r => r.state.retriesByTarget.job === 1));
    });
    const restored = await ensureLearnCallPolicy(redis, options);
    const again = await reserveLearnCallPolicyTurn(redis, options, { eventId: 'changed-model', text: 'Practise again' });
    check('real Redis reconnect: budget and opening are durable', () => {
      assert.deepEqual(restored.selection, state.selection);
      assert.equal(again.state.retriesByTarget.job, 1);
      assert.notEqual(again.decision.action, 'practice_once');
    });
    const second = await ensureLearnCallPolicy(redis, { ...options, sessionId: `${prefix}-next` });
    check('real Redis cross-call history avoids immediate opening repeat', () => assert.notEqual(second.selection.id, state.selection.id));
  } finally {
    const keys = await redis.keys(`voice:*${prefix}*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  }
}
console.log(`PASS ${count} conversation regression checks. Provider audio and microphone: NOT RUN.`);
