/** Opt-in: real WebRTC/provider audio with synthetic PCM or explicitly approved video clips; isolated Redis, mocked auth/lesson/DB. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { register } from 'node:module';
import { createServer } from 'node:http';
import WebSocket from 'ws';
import Redis from 'ioredis';
import { loadLearnCallTestEnv } from './learn-call-test-env.mjs';
import { ensureLearnCallPolicy, learnCallPolicyKey } from '../lib/beego/learn/learn-call-policy-store.js';
import { learnAiCallGateKey } from '../lib/beego/learn/ai-call-access.js';
import { mapRealtimeEvent, terminateRealtimeSession } from '../lib/beego/learn/learn-call-realtime.js';
import { learnCallIncompleteLead } from '../lib/beego/learn/learn-call-realtime-turns.js';
import { learnCallAge, learnCallNumbers } from '../lib/beego/learn/learn-call-personal.js';
if (process.env.LEARN_CALL_LIVE_WEBRTC !== '1') { console.log('SKIP real WebRTC: set LEARN_CALL_LIVE_WEBRTC=1 and isolated REDIS_URL'); process.exit(0); }
const env = loadLearnCallTestEnv();
const approvedVideo = process.env.LEARN_CALL_VIDEO_AUDIO_APPROVED === '1';
const videoEvidence = approvedVideo ? JSON.parse(fs.readFileSync(new URL('./fixtures/learn-call-video-repro.json', import.meta.url))) : null;
const fixtureDir = approvedVideo ? '/tmp/beego-video-repro/approved-clips' : '/tmp/learn-call-it-clips';
const reportPath = approvedVideo ? '/tmp/beego-video-repro/approved-webrtc-report.json' : '/tmp/beego-webrtc-audio-report.json';
const fixtures = approvedVideo ? [
  { id: 'video-age', file: 'age.pcm16k', intent: 'age', expected: videoEvidence.age.intendedValueReportedByUser, sourceRangeSeconds: [14.35,16.65] },
  { id: 'video-technology', file: 'technology.pcm16k', intent: 'job', sourceRangeSeconds: [26.5,30.5] },
] : [
  { id:'thirty-five', file:'I_am_thirty_five_years_old_.pcm16k', intent:'age', expected:35 },
  { id:'forty', file:'I_am_forty_years_old_.pcm16k', intent:'age', expected:40 },
  { id:'technology', file:'Technology_.pcm16k', intent:'job' },
  { id:'correction', file:'No_thirty_five_.pcm16k', intent:'age', expected:35, priorAge:40 },
];
process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
process.env.LEARN_AI_CALL_REALTIME_ENABLED = '1';
process.env.LEARN_AI_CALL_REALTIME_ALLOWLIST = '*';
const redis = new Redis(env.REDIS_URL);
globalThis.__learnCallRouteRedis = redis;
register(new URL('./learn-call-route-test-loader.mjs', import.meta.url));
const sessionRoute = await import('../app/api/learn/ai-call/realtime/session/route.js');
const turnRoute = await import('../app/api/learn/ai-call/realtime/turn/route.js');
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<html><body>Isolated WebRTC regression</body></html>'); return; }
    if (req.url === '/turns.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(new URL('../lib/beego/learn/learn-call-realtime-turns.js', import.meta.url))); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const request = new Request(`http://127.0.0.1${req.url}`, { method: req.method, headers: req.headers, body });
    const route = req.url === '/turn' ? turnRoute : sessionRoute;
    const response = await route[req.method](request);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
  } catch { res.writeHead(500); res.end('{"success":false}'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = `/tmp/beego-webrtc-regression-${process.pid}`;
const port = 21389;
const chromeLog = fs.openSync('/tmp/beego-webrtc-browser.log', 'w');
const chrome = spawn('/snap/chromium/current/usr/lib/chromium-browser/chrome', ['--no-sandbox','--disable-gpu','--headless=new','--autoplay-policy=no-user-gesture-required',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,base], { stdio: ['ignore', chromeLog, chromeLog], detached: true });
const pause = ms => new Promise(r => setTimeout(r, ms));
let ws, serial = 0;
const pending = new Map();
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
}
const uid = `webrtc-audio-${Date.now()}`;
const sessions = [];
const report = [];
async function browserRun(params) {
  const { createRealtimeTurnCoordinator, learnCallTurnModeEvent } = await import('/turns.js');
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const ctx = new AudioContext({ sampleRate: 48000, sinkId: { type: "none" } });
  await Promise.race([ctx.resume(), new Promise((_, reject) => setTimeout(() => reject(new Error("AUDIO_CONTEXT_TIMEOUT")), 3000))]);
  const output = ctx.createMediaStreamDestination();
  pc.addTrack(output.stream.getAudioTracks()[0], output.stream);
  // Keep RTP flowing after the fixture ends, as a live microphone does during silence.
  const silence = ctx.createConstantSource(); const zero = ctx.createGain(); zero.gain.value = 0;
  silence.connect(zero).connect(output); silence.start();
  const audio = document.createElement('audio'); audio.autoplay = true; document.body.append(audio);
  pc.ontrack = e => { audio.srcObject = e.streams[0]; audio.play().catch(() => {}); };
  const dc = pc.createDataChannel('oai-events');
  const records = [];
  let error = null;
  let lastDecision = null;
  const notices = [];
  const coordinate = createRealtimeTurnCoordinator({
    requestTurn: async payload => {
      const r = await fetch('/turn', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-user': params.uid }, body: JSON.stringify(payload) });
      const j = await r.json(); if (!j.success) throw new Error(j.code); return j.data;
    },
    sendEvent: event => { dc.send(JSON.stringify(event)); return true; },
    onDecision: d => { lastDecision = d; },
    onError: e => { if (['TRANSCRIPTION_DELAYED','INCOMPLETE_UTTERANCE'].includes(e.message)) notices.push(e.message); else error = String(e.message); },
  });
  coordinate.connect(params.sid);
  const noticeTimer = setInterval(() => coordinate.tick(), 250);
  const mapper = new Function(`return (${params.mapper})`)();
  dc.onmessage = e => {
    const raw = JSON.parse(e.data); const event = mapper(raw);
    records.push({ ...raw, receivedAt: performance.now() });
    if (raw.type === 'error') error = raw.error?.code || 'PROVIDER_ERROR';
    if (event) coordinate.observe(event);
  };
  try {
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    const r = await fetch('/session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-user': params.uid }, body: JSON.stringify({ sessionId: params.sid, sdpOffer: offer.sdp, lessonId: 'g01l01', sectionId: 'p1-g1', difficulty: 'easy', sessionMode: 'open', talkMode: params.mode }) });
    const session = await r.json(); if (!session.success) throw new Error(session.code);
    coordinate.configure({ awaitingPracticeAttempt: session.data.awaitingPracticeAttempt === true });
    await pc.setRemoteDescription({ type: 'answer', sdp: session.data.sdpAnswer });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DATA_CHANNEL_TIMEOUT')), 20000);
      dc.onopen = () => { clearTimeout(timer); dc.send(JSON.stringify(learnCallTurnModeEvent(params.mode))); resolve(); };
    });
    await new Promise(r => setTimeout(r, 600));
    if (params.mode === 'manual') dc.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    const bytes = Uint8Array.from(atob(params.pcm), c => c.charCodeAt(0));
    const samples = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, samples.length, 16000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;
    const source = ctx.createBufferSource(); source.buffer = buffer; source.connect(output);
    const inputStartedAt = performance.now();
    await new Promise(resolve => { source.onended = resolve; source.start(); });
    const inputEndedAt = performance.now();
    if (params.mode === 'manual') dc.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    const until = performance.now() + 45000;
    while (!error && !records.some(e => e.type === 'output_audio_buffer.stopped') && performance.now() < until) await new Promise(r => setTimeout(r, 50));
    const failure = error || (!records.some(e => e.type === 'response.done') ? 'RESPONSE_TIMEOUT' : null);
    if (failure && !params.approvedVideo) throw new Error(failure);
    const stats = await pc.getStats(); let inboundBytes = 0;
    stats.forEach(s => { if (s.type === 'inbound-rtp' && s.kind === 'audio') inboundBytes += s.bytesReceived || 0; });
    const user = records.filter(e => e.type === 'conversation.item.input_audio_transcription.completed');
    const tutor = records.filter(e => ['response.output_audio_transcript.done','response.audio_transcript.done'].includes(e.type));
    return { failure, user: user.map(e => ({ id: e.item_id, text: e.transcript, at: e.receivedAt })), tutor: tutor.map(e => ({ id: e.response_id, text: e.transcript, at: e.receivedAt })),
      commits: records.filter(e => e.type === 'input_audio_buffer.committed').map(e => ({ id: e.item_id, at: e.receivedAt })),
      vad: records.filter(e => /input_audio_buffer.speech_/.test(e.type)).map(e => ({ type: e.type, id: e.item_id, start: e.audio_start_ms, end: e.audio_end_ms })),
      responses: records.filter(e => e.type === 'response.created').map(e => ({ id: e.response.id, metadata: e.response.metadata, at: e.receivedAt })),
      inputStartedAt, inputEndedAt, inboundBytes, notices, decision: lastDecision };
  } finally { clearInterval(noticeTimer); coordinate.stop(); pc.close(); await ctx.close(); audio.remove(); }
}
try {
  let tabs;
  for (let n = 0; n < 80; n++) {
    try { tabs = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json()); if (tabs.some(t => t.type === 'page')) break; } catch {}
    await pause(100);
  }
  assert.ok(tabs, 'Browser must start');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { ws.once('open',resolve); ws.once('error',reject); });
  ws.on('message', data => { const j=JSON.parse(String(data)); const p=pending.get(j.id); if(p) { pending.delete(j.id); j.error?p.reject(new Error(j.error.message)):p.resolve(j.result); } });
  await cdp('Page.enable'); await cdp('Page.navigate',{url:base}); await pause(500);
  await redis.set(learnAiCallGateKey(),'1','EX',600);
  for (const mode of (process.env.LEARN_CALL_WEBRTC_MODE ? [process.env.LEARN_CALL_WEBRTC_MODE] : ['manual','auto'])) for (const fixture of fixtures) {
    if (process.env.LEARN_CALL_WEBRTC_FIXTURE && process.env.LEARN_CALL_WEBRTC_FIXTURE !== fixture.id) continue;
    const sid=`${uid}-${mode}-${fixture.id}`; sessions.push(sid);
    const policy=await ensureLearnCallPolicy(redis,{sessionId:sid,userId:uid,topicCtx:{topic:'Chào hỏi',sectionId:'p1-g1',sessionMode:'open'},difficulty:'easy'});
    policy.pending={intent:fixture.intent,targetId:fixture.intent,question:fixture.intent==='age'?'How old are you?':'What do you do?'}; policy.asked=[fixture.intent];
    if (fixture.priorAge) { policy.facts.age={value:fixture.priorAge,status:'reported'}; policy.lastPersonal='age'; }
    await redis.set(learnCallPolicyKey(sid),JSON.stringify(policy),'EX',600);
    const pcm=fs.readFileSync(`${fixtureDir}/${fixture.file}`).toString('base64');
    const params={uid,sid,mode,pcm,approvedVideo,mapper:mapRealtimeEvent.toString()};
    const evaluation=await cdp('Runtime.evaluate',{expression:`(${browserRun.toString()})(${JSON.stringify(params)})`,awaitPromise:true,returnByValue:true});
    if(evaluation.exceptionDetails) throw new Error(evaluation.exceptionDetails.exception?.description || 'BROWSER_EVALUATION_FAILED');
    const result=evaluation.result.value;
    const text=result.user.map(e=>e.text).join(' ');
    const transcriptError=fixture.expected ? learnCallAge(text)!==fixture.expected : !/tech/i.test(text);
    const tutorText=result.tutor.map(e=>e.text).join(' ');
    const tutorValueError=fixture.intent === 'age' && learnCallNumbers(tutorText).length > 0;
    const updatedPolicy = JSON.parse(await redis.get(learnCallPolicyKey(sid)));
    report.push({mode,fixture:fixture.id,sourceRangeSeconds:fixture.sourceRangeSeconds || null,...result,
      transcriptError,tutorValueError,reportedAge:updatedPolicy.facts?.age?.value ?? null,
      transcriptReferenceSource: approvedVideo ? 'user-reported intention; not independently verified ground truth' : 'synthetic fixture'});
    if (result.failure && approvedVideo) {
      console.log(`FAIL real WebRTC ${mode}/${fixture.id}: ${result.failure}; commits=${result.commits.length}; finals=${result.user.length}`);
      process.exitCode = 1;
      await terminateRealtimeSession(redis,{sessionId:sid,userId:uid,apiKey:env.OPENAI_API_KEY,reason:'regression_failed'});
      continue;
    }
    if (!approvedVideo) assert.equal(transcriptError,false,`${mode}/${fixture.id}: input transcript mismatch`);
    assert.equal(tutorValueError,false,`${mode}/${fixture.id}: echoed personal value`);
    if (!approvedVideo) assert.equal(result.commits.length,1,`${mode}/${fixture.id}: split turn`);
    if (approvedVideo) {
      const sourceIds = result.decision?.sourceItemIds || [];
      const rootFinalAt = result.user.find(u => u.id === result.decision.eventId)?.at || 0;
      assert.ok(result.user.filter(u => u.text.trim()).every(u => sourceIds.includes(u.id) || (learnCallIncompleteLead(u.text) && u.at > rootFinalAt)), 'Meaningful input segments must belong to the response; only a late stale prefix may be ignored');
      assert.ok(sourceIds.every(id => result.commits.some(c => c.id === id)), 'Grouped IDs must come from committed audio');
    }
    assert.equal(result.responses.length,1,`${mode}/${fixture.id}: automatic/duplicate response`);
    assert.equal(result.responses[0].metadata.beego_turn,result.user[0]?.id, 'Response must reference the final learner item');
    assert.ok(result.commits.some(c => c.id === result.user[0]?.id), 'Final transcript must join the committed audio item');
    assert.ok(result.inboundBytes>0,`${mode}/${fixture.id}: missing remote audio`);
    assert.ok(tutorText.includes('?'),`${mode}/${fixture.id}: no new question`);
    const words = text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    assert.equal(words(tutorText), words(result.decision.spoken), `${mode}/${fixture.id}: provider must speak the approved line`);
    console.log(`PASS ${approvedVideo ? "response safety (original voice)" : "real WebRTC"} ${mode}/${fixture.id}: transcriptError=${transcriptError}, tutorValueError=${tutorValueError}, commits=${result.commits.length}, audioBytes=${result.inboundBytes}`);
    await terminateRealtimeSession(redis,{sessionId:sid,userId:uid,apiKey:env.OPENAI_API_KEY,reason:'regression_complete'});
  }
} finally {
  // Approved learner clips use a private local report; never production logs or repo artifacts.
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2),{mode:0o600});
  if (approvedVideo) fs.chmodSync(reportPath,0o600);
  for(const sid of sessions) await terminateRealtimeSession(redis,{sessionId:sid,userId:uid,apiKey:env.OPENAI_API_KEY,reason:'regression_cleanup'}).catch(()=>{});
  ws?.close();
  try { process.kill(-chrome.pid, 'SIGTERM'); } catch { chrome.kill('SIGTERM'); }
  await new Promise(resolve => (chrome.exitCode !== null || chrome.signalCode !== null) ? resolve() : chrome.once('exit', resolve));
  fs.closeSync(chromeLog);
  await new Promise(resolve=>server.close(resolve)); await redis.quit();
  try { fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100}); } catch (error) { if (error.code !== "ENOTEMPTY") throw error; }
}
