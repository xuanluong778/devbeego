/** Local video evidence + deterministic policy/caption replay. Never uploads audio. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createLearnCallPolicy, planLearnCallPolicy } from '../lib/beego/learn/learn-call-policy.js';
import { learnCallClassifyAnswer } from '../lib/beego/learn/learn-call-answer.js';
import { createRealtimeTranscriptAdapter } from '../lib/beego/learn/learn-call-realtime-transcript.js';
import { applyTranscriptEvent, createTranscript, learnCallCaptionView } from '../lib/beego/learn/learn-call-transcript.js';
import { mapRealtimeEvent } from '../lib/beego/learn/learn-call-realtime.js';
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/learn-call-video-repro.json', import.meta.url)));
const topicCtx = { topic: 'Chào hỏi', sectionId: 'p1-g1', sessionMode: 'open' };
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
function state(intent, question) {
  const s = createLearnCallPolicy({ sessionId: 'video-repro-local', topicCtx });
  s.asked = [intent]; s.pending = { intent, targetId: intent, question }; return s;
}
const video = new URL(`../${fixture.source.path}`, import.meta.url);
if (fs.existsSync(video)) check('source video fingerprint and duration match reviewed evidence', () => {
  assert.equal(createHash('sha256').update(fs.readFileSync(video)).digest('hex'), fixture.source.sha256);
  const probe = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration','-of','json',video.pathname], { encoding:'utf8' });
  assert.equal(probe.status, 0);
  assert.ok(Math.abs(Number(JSON.parse(probe.stdout).format.duration) - fixture.source.durationSeconds) < 0.01);
});
else console.log('SKIP source file check: video absent; policy replay still runs.');
for (const text of fixture.job.meaningVariants) check(`video job meaning advances (${text})`, () => {
  assert.equal(learnCallClassifyAnswer(text, { pendingQuestion: { intent:'job' }, topicCtx }).kind, 'accept');
  const result = planLearnCallPolicy(state('job',fixture.job.question), { eventId:'local-job',text });
  assert.equal(result.decision.action,'advance');
  assert.equal(result.decision.nextTargetId,'job_enjoy');
  assert.match(result.decision.spoken,/\?$/);
  assert.doesNotMatch(result.decision.spoken,/your turn|try|repeat|say|pronounc/i);
});
check('recorded model invitations cannot reopen an exhausted target', () => {
  const reserved = planLearnCallPolicy(state('job',fixture.job.question), { eventId:'local-voluntary-practice', text:'Help me practise' });
  assert.equal(reserved.state.retriesByTarget.job,1);
  for (const invitation of fixture.job.observedTutorInvitations) {
    const r = planLearnCallPolicy(JSON.parse(JSON.stringify(reserved.state)), { eventId:`local-${invitation.atSeconds}`, text:'Practise again please', question:invitation.text });
    assert.equal(r.state.retriesByTarget.job,1);
    assert.notEqual(r.decision.action,'practice_once');
  }
});
check('uncertain video age does not become a spoken value or a drill', () => {
  for (const text of [fixture.age.offlineWholeWindowCandidate, 'Unclear', '24 or 35', '40']) {
    const r = planLearnCallPolicy(state('age','How old are you?'), { eventId:'local-age-candidate',text });
    assert.equal(r.decision.retryAllowed,false);
    assert.doesNotMatch(r.decision.spoken,/\b(?:24|35|40|twenty|thirty|forty)\b|try|repeat|pronounc/i);
    assert.equal(r.decision.action,'advance');
  }
});
check('learner correction replaces either a mistaken transcript or mistaken tutor value', () => {
  for (const prior of [24,40]) {
    const first = planLearnCallPolicy(state('age','How old are you?'), { eventId:'local-initial-age',text:String(prior) });
    const correction = planLearnCallPolicy(first.state, { eventId:'local-correction',text:'No, thirty-five' });
    assert.equal(correction.state.facts.age.value,fixture.age.intendedValueReportedByUser);
    assert.doesNotMatch(correction.decision.spoken,/35|thirty|forty|try|repeat/i);
  }
});
check('commit reserves learner caption before any final transcript arrives', () => {
  const adapter = createRealtimeTranscriptAdapter(); let transcript = createTranscript();
  const feed = raw => {
    const r = adapter.handle(mapRealtimeEvent(raw));
    for (const e of r.events) transcript = applyTranscriptEvent(transcript,e);
    return r;
  };
  feed({ type:'response.created',response:{id:'local-opening'} });
  feed({ type:'response.output_audio_transcript.done',response_id:'local-opening',item_id:'local-opening-item',transcript:"Hi! I'm your new neighbor. What's your name?" });
  const input = feed({ type:'input_audio_buffer.committed',item_id:'local-input',previous_item_id:'local-opening-item' });
  const view = learnCallCaptionView(transcript,{realtime:true,target:input.caption,openingText:"Hi! I'm your new neighbor. What's your name?"});
  assert.equal(view.role,'user'); assert.equal(view.text,'');
});
check('original ASR and commit IDs stay explicitly unknown', () => {
  assert.equal(fixture.source.originalProviderItemId,null);
  assert.equal(fixture.source.originalProviderResponseId,null);
  assert.equal(fixture.age.originalFinalLearnerTranscript,null);
  assert.equal(fixture.age.offlineRecognitionIsAmbiguous,true);
});
console.log(`PASS ${checks} video-reproduction checks. Audio analyzed locally; provider replay is not claimed.`);
