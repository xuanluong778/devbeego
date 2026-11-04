import { loadLearnCallTestEnv } from "./learn-call-test-env.mjs";
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createServer } from 'node:http';
import Redis from 'ioredis';
import { learnCallPolicyKey } from '../lib/beego/learn/learn-call-policy-store.js';
import { learnAiCallGateKey } from '../lib/beego/learn/ai-call-access.js';
import { realtimeSessionKey } from '../lib/beego/learn/learn-call-realtime.js';
const url = process.env.LEARN_CALL_REGRESSION_REDIS;
if (!url) throw new Error('LEARN_CALL_REGRESSION_REDIS must point at isolated test Redis');
loadLearnCallTestEnv({ redisUrl: url });
const redis = new Redis(url);
globalThis.__learnCallRouteRedis = redis;
process.env.LEARN_AI_CALL_REALTIME_ENABLED = '1';
process.env.LEARN_AI_CALL_REALTIME_ALLOWLIST = '*';
process.env.LEARN_AI_CALL_ENABLED = '1';
process.env.OPENAI_API_KEY = 'test-only-never-sent';
register(new URL('./learn-call-route-test-loader.mjs', import.meta.url));
const sessionRoute = await import('../app/api/learn/ai-call/session/route.js');
const realtimeRoute = await import('../app/api/learn/ai-call/realtime/session/route.js');
const turnRoute = await import('../app/api/learn/ai-call/realtime/turn/route.js');
const actualFetch = globalThis.fetch;
let providerCalls = [];
globalThis.fetch = async (input, options) => {
  if (String(input).startsWith('https://api.openai.com/v1/realtime/calls')) {
    providerCalls.push(JSON.parse(options.body.get('session')));
    return new Response('v=0\r\ns=test-only\r\n', { status: 201, headers: { location: `/v1/realtime/calls/test-${providerCalls.length}` } });
  }
  throw new Error('Unexpected external request');
};
const routes = { '/session': sessionRoute, '/realtime/session': realtimeRoute, '/realtime/turn': turnRoute };
const server = createServer(async (req, res) => {
  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const response = await routes[req.url].POST(new Request(`http://localhost${req.url}`, { method: 'POST', headers: req.headers, body }));
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
  } catch { res.writeHead(500); res.end('{}'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const uid = `route-${Date.now()}`;
async function post(route, body, user = uid) {
  const r = await actualFetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
let count = 0;
function ok(name, assertion) { assertion(); count++; console.log(`PASS ${name}`); }
let sid;
try {
  await redis.set(learnAiCallGateKey(), '1', 'EX', 90);
  const start = await post('/session', { lessonId: 'g01l01', sectionId: 'p1-g1', difficulty: 'medium' });
  ok('production session POST entry returns Realtime offer', () => { assert.equal(start.status, 200, JSON.stringify(start.body)); assert.equal(start.body.data.realtime.enabled, true); });
  sid = start.body.data.sessionId;
  let policy = JSON.parse(await redis.get(learnCallPolicyKey(sid)));
  const variant = policy.selection;
  const rt = await post('/realtime/session', { sessionId: sid, lessonId: 'g01l01', sectionId: 'p1-g1', difficulty: 'medium', sdpOffer: 'v=0', talkMode: 'manual' });
  ok('production SDP route uses same selected opening, difficulty and manual commit mode', () => {
    assert.equal(rt.status, 200, JSON.stringify(rt.body));
    assert.equal(rt.body.data.opening.spoken, variant.spoken);
    assert.match(providerCalls[0].instructions, /Difficulty: Medium/);
    assert.equal(providerCalls[0].audio.input.turn_detection, null);
    assert.equal(rt.body.data.turnControl, 'server_policy');
  });
  const reconnect = await post('/realtime/session', { sessionId: sid, lessonId: 'g01l01', sectionId: 'p1-g1', difficulty: 'medium', sdpOffer: 'v=0' });
  ok('reconnect entry keeps variant and emits no second greeting', () => {
    assert.equal(reconnect.status, 200);
    assert.equal(reconnect.body.data.opening.spoken, variant.spoken);
    assert.equal(reconnect.body.data.opening.shouldSpeak, false);
    assert.equal(providerCalls[1].audio.input.turn_detection.create_response, false);
  });
  policy = JSON.parse(await redis.get(learnCallPolicyKey(sid)));
  policy.pending = { intent: 'job', targetId: 'job', question: 'What do you do?' }; policy.asked = ['job'];
  await redis.set(learnCallPolicyKey(sid), JSON.stringify(policy), 'EX', 90);
  const technology = await post('/realtime/turn', { sessionId: sid, itemId: 'input-technology', text: 'Technology' });
  ok('HTTP turn entry returns new question before response.create/audio', () => {
    assert.equal(technology.status, 200, JSON.stringify(technology.body));
    assert.equal(technology.body.data.decision.action, 'advance');
    assert.equal(technology.body.data.decision.nextTargetId, 'job_enjoy');
    assert.match(technology.body.data.event.response.instructions, /What do you like about your job/);
  });
  const duplicate = await post('/realtime/turn', { sessionId: sid, itemId: 'input-technology', text: 'Technology' });
  ok('HTTP duplicate item ID returns same decision without advancing state', () => {
    assert.equal(duplicate.body.data.duplicate, true);
    assert.deepEqual(duplicate.body.data.decision, technology.body.data.decision);
  });
  const practice = await post('/realtime/turn', { sessionId: sid, itemId: 'voluntary-practice', text: 'Help me practise' });
  ok('practice model matches the chosen follow-up hint', () => {
    assert.equal(practice.status, 200);
    assert.equal(practice.body.data.decision.action, 'practice_once');
    assert.match(practice.body.data.decision.spoken, /I like my team/);
  });
  const resumePractice = await post('/realtime/session', { sessionId: sid, lessonId: 'g01l01', sectionId: 'p1-g1', difficulty: 'medium', sdpOffer: 'v=0' });
  ok('reconnect exposes the reserved practice attempt without greeting again', () => {
    assert.equal(resumePractice.status, 200);
    assert.equal(resumePractice.body.data.awaitingPracticeAttempt, true);
    assert.equal(resumePractice.body.data.opening.shouldSpeak, false);
  });
  const attempted = await post('/realtime/turn', { sessionId: sid, itemId: 'practice-fragment', text: 'I am...' });
  ok('partial practice attempt advances and cannot receive another retry', () => {
    assert.equal(attempted.status, 200);
    assert.equal(attempted.body.data.decision.action, 'advance');
    assert.equal(attempted.body.data.decision.retryAllowed, false);
  });
  const grouped = await post('/realtime/turn', { sessionId: sid, itemId: 'joined-lead', itemIds: ['joined-lead','joined-tail'], text: 'Technology' });
  ok('HTTP grouped input retains both source IDs in the approved audio response', () => {
    assert.equal(grouped.status, 200);
    assert.deepEqual(grouped.body.data.decision.sourceItemIds, ['joined-lead','joined-tail']);
    assert.equal(grouped.body.data.event.response.metadata.beego_turn, 'joined-lead');
    assert.equal(grouped.body.data.event.response.metadata.beego_input_items, 'joined-lead,joined-tail');
  });
  const forbidden = await post('/realtime/turn', { sessionId: sid, itemId: 'x', text: 'Hi' }, 'another-user');
  const anonymous = await post('/realtime/turn', { sessionId: sid, itemId: 'x', text: 'Hi' }, null);
  ok('turn entry enforces authentication and session ownership', () => { assert.equal(forbidden.status, 403); assert.equal(anonymous.status, 401); });
  const live = JSON.parse(await redis.get(realtimeSessionKey(sid))); live.deadlineAt = Date.now() - 1;
  await redis.set(realtimeSessionKey(sid), JSON.stringify(live), 'EX', 90);
  const expired = await post('/realtime/turn', { sessionId: sid, itemId: 'x', text: 'Hi' });
  ok('turn entry fails closed after deadline', () => assert.equal(expired.status, 410));
} finally {
  globalThis.fetch = actualFetch;
  await new Promise(resolve => server.close(resolve));
  if (sid) {
    const keys = await redis.keys(`voice:*${sid}*`);
    if (keys.length) await redis.del(...keys);
  }
  await redis.quit();
}
console.log(`PASS ${count} HTTP entry checks. Auth/lesson/DB/provider mocked; policy and Redis real; WebRTC audio NOT RUN.`);
