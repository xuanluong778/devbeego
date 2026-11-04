import assert from 'node:assert/strict';
import { createRealtimeTurnCoordinator, learnCallIncompleteLead } from '../lib/beego/learn/learn-call-realtime-turns.js';
import { createLearnCallPolicy, planLearnCallPolicy, learnCallPolicyResponse } from '../lib/beego/learn/learn-call-policy.js';
const topicCtx={topic:'Chào hỏi',sectionId:'p1-g1',sessionMode:'open'};
function harness({ practice = false } = {}) {
  let state=createLearnCallPolicy({sessionId:'fragment-test',topicCtx});
  state.asked=['job']; state.pending={intent:'job',targetId:'job',question:'What do you do?'};
  if(practice) state=planLearnCallPolicy(state,{eventId:'practice-invitation',text:'Help me practise'}).state;
  const requests=[],sent=[],notices=[];
  const coordinator=createRealtimeTurnCoordinator({
    requestTurn:async payload=>{
      requests.push(payload);
      const result=planLearnCallPolicy(state,{eventId:payload.itemId,itemIds:payload.itemIds,text:payload.text});
      state=result.state;
      return {decision:result.decision,event:learnCallPolicyResponse(result.decision)};
    },
    sendEvent:event=>{sent.push(event);return true;},
    onError:error=>notices.push(error.message),
  });
  coordinator.connect('fragment-test'); coordinator.configure({awaitingPracticeAttempt:practice});
  return {coordinator,requests,sent,notices,get state(){return state;},
    commit(id,now=1000){coordinator.observe({type:'user_audio_committed',itemId:id},now);},
    final(id,text,now=1100){return coordinator.observe({type:'user_transcript_final',itemId:id,text},now);}};
}
let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS ${name}`);}
check('only incomplete lead-ins wait; meaningful job and age answers are complete',()=>{
  for(const text of ['I am...','I am a','I work in','My name is']) assert.equal(learnCallIncompleteLead(text),true);
  for(const text of ['Technology','IT','I work in tech','35','thirty-five','I am a technology']) assert.equal(learnCallIncompleteLead(text),false);
});
const split=harness();
split.commit('first'); await split.final('first','I am...');
check('a VAD fragment cannot advance state or trigger audio',()=>{
  assert.equal(split.requests.length,0);assert.equal(split.sent.length,0);
  assert.equal(split.state.pending.targetId,'job');
});
split.commit('second',2400);await split.final('second','a technology.',2500);
check('recorded two-part answer creates one response after meaning is complete',()=>{
  assert.equal(split.requests.length,1);assert.equal(split.sent.length,1);
  assert.equal(split.requests[0].text,'I am a technology.');
  assert.equal(split.requests[0].itemId,'first');
  assert.deepEqual(split.requests[0].itemIds,['first','second']);
  assert.equal(split.state.pending.targetId,'job_enjoy');
  assert.equal(split.sent[0].response.metadata.beego_input_items,'first,second');
  assert.match(split.sent[0].response.instructions,/You work in tech/);
});
await split.final('first','I am...'); await split.final('second','a technology.');
check('duplicate fragment events do not create another response or target',()=>assert.equal(split.requests.length,1));
const keyword=harness();keyword.commit('keyword');await keyword.final('keyword','Technology');
check('Technology advances immediately without a fragment timer',()=>{
  assert.equal(keyword.requests.length,1);assert.equal(keyword.sent.length,1);
  assert.equal(keyword.state.pending.targetId,'job_enjoy');
});
for(const [text,expected] of [['Bỏ qua','advance'],['Could you repeat the question?','repeat_question']]){
  const h=harness();h.commit('prefix');await h.final('prefix','I am...');
  h.commit('control',1300);await h.final('control',text,1400);
  check(`control request bypasses incomplete speech (${expected})`,()=>{
    assert.equal(h.requests.length,1);assert.equal(h.requests[0].text,text);
    assert.equal(h.state.events.control.action,expected);
  });
}
const attempt=harness({practice:true});attempt.coordinator.connect('fragment-test');
attempt.coordinator.configure({awaitingPracticeAttempt:true});
attempt.commit('partial-practice');await attempt.final('partial-practice','I am...');
check('after reconnect, a partial practice attempt exhausts the one reserved retry',()=>{
  assert.equal(attempt.requests.length,1);
  assert.equal(attempt.state.retriesByTarget.job,1);
  assert.equal(attempt.state.activePractice,null);
  assert.equal(attempt.state.pending.targetId,'job_enjoy');
});
const late=harness();late.commit('old-prefix');late.commit('meaningful',2000);
await late.final('meaningful','Technology',2100);await late.final('old-prefix','I am...',2200);
late.coordinator.observe({type:'assistant_turn_done',responseId:'response'},2300);
late.commit('next-answer',2400);await late.final('next-answer','Yes, I like my team.',2500);
check('an out-of-order old prefix cannot contaminate the next learner answer',()=>{
  assert.equal(late.requests.length,2);
  assert.equal(late.requests[1].text,'Yes, I like my team.');
});
const waiting=harness();waiting.commit('prefix');await waiting.final('prefix','I am...',1100);
waiting.coordinator.tick(14000);waiting.coordinator.tick(26000);
check('waiting for meaning gives one notice, no spoken drill',()=>{
  assert.deepEqual(waiting.notices,['INCOMPLETE_UTTERANCE']);
  assert.equal(waiting.sent.length,0);assert.deepEqual(waiting.state.retriesByTarget,{});
});
waiting.commit('continued',27000);await waiting.final('continued','a technology.',28000);
check('a late continuation still advances once without changing the practice budget',()=>{
  assert.equal(waiting.requests.length,1);assert.equal(waiting.sent.length,1);
  assert.deepEqual(waiting.state.retriesByTarget,{});
});
let retryState=createLearnCallPolicy({sessionId:'retry-group',topicCtx});
retryState.pending={intent:'job',targetId:'job',question:'What do you do?'};retryState.asked=['job'];
const retryRequests=[],retryAudio=[];let loseFirst=true;
const retryCoordinator=createRealtimeTurnCoordinator({
  requestTurn:async payload=>{
    retryRequests.push(payload);
    const r=planLearnCallPolicy(retryState,{eventId:payload.itemId,itemIds:payload.itemIds,text:payload.text});retryState=r.state;
    if(loseFirst){loseFirst=false;throw new Error('SIMULATED_LOST_HTTP_RESPONSE');}
    return {decision:r.decision,event:learnCallPolicyResponse(r.decision)};
  },
  sendEvent:e=>{retryAudio.push(e);return true;},
});
retryCoordinator.connect('retry-group');
retryCoordinator.observe({type:'user_audio_committed',itemId:'group-root'});
await retryCoordinator.observe({type:'user_transcript_final',itemId:'group-root',text:'I am...'});
retryCoordinator.observe({type:'user_audio_committed',itemId:'group-tail'});
await retryCoordinator.observe({type:'user_transcript_final',itemId:'group-tail',text:'a technology'});
await retryCoordinator.observe({type:'user_transcript_final',itemId:'group-tail',text:'a technology'});
check('retry after a lost HTTP reply keeps the grouped root ID and advances state once',()=>{
  assert.equal(retryRequests.length,2);assert.equal(retryAudio.length,1);
  assert.equal(retryRequests[0].itemId,'group-root');assert.deepEqual(retryRequests[1],retryRequests[0]);
  assert.equal(Object.keys(retryState.events).length,1);assert.equal(retryState.pending.targetId,'job_enjoy');
});
console.log(`PASS ${checks} Realtime fragment checks. Provider events are simulated from the observed split.`);
