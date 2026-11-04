import { learnCallTopicGuide, learnCallSessionGoals, learnCallCoveredFacets, learnCallSelectOpening, learnCallSelectQuestion, learnCallQuestionFacet, learnCallReplyHints } from './learn-call-topics.js';
import { learnCallHelpKind, extractLearnCallPracticePhrase, learnCallTutorSelfAnswer, learnCallAsksAboutTutor } from './learn-call-tutor.js';
import { learnCallAge, learnCallName, learnCallNumbers, learnCallPersonalCorrection, learnCallPersonalTurn } from './learn-call-personal.js';

export function createLearnCallPolicy({ sessionId, userId, topicCtx = {}, difficulty = 'easy', previousOpeningId = '' } = {}) {
  const guide = learnCallTopicGuide(topicCtx);
  const selection = topicCtx.selection || learnCallSelectOpening({ guide, sessionId, difficulty, previousId: previousOpeningId });
  return { sessionId, ownerUserId: userId == null ? null : String(userId), topicCtx: { ...topicCtx, sessionId, selection }, difficulty, selection,
    goals: learnCallSessionGoals(guide, selection),
    asked: topicCtx.sessionMode === 'open' ? [] : [selection.targetId], answered: [], retriesByTarget: {},
    facts: {}, confirmations: {}, lastPersonal: '', activePractice: null, events: {},
    pending: topicCtx.sessionMode === 'open' ? null : { intent: selection.targetId, question: selection.spoken.match(/[^.!?]*\?$/)?.[0]?.trim() || selection.spoken, targetId: selection.targetId } };
}

/** Pure reducer: reserves a retry before returning any speakable invitation. Never uses Azure scores. */
export function planLearnCallPolicy(previous, { eventId, text, question = '', itemIds = [] } = {}) {
  if (!eventId) throw new Error('A stable learner turn ID is required');
  if (Object.hasOwn(previous.events, eventId)) return { state: previous, decision: previous.events[eventId], duplicate: true };
  const state = JSON.parse(JSON.stringify(previous));
  const guide = learnCallTopicGuide(state.topicCtx);
  const raw = String(text || '').trim();
  const help = learnCallHelpKind(raw);
  const intent = state.pending?.intent || learnCallQuestionFacet(question, guide) || 'general';
  // Never let a model rewording or a client-supplied phrase assign a fresh practice identity.
  const goalId = state.pending?.targetId || intent;
  let spoken = '', action = 'advance', retryAllowed = false;
  let next = null;
  const isCorrection = learnCallPersonalCorrection(raw);
  const field = learnCallPersonalTurn(raw, intent) || (isCorrection ? state.lastPersonal : '');
  if (help === 'content' && !isCorrection) {
    const extra = learnCallCoveredFacets([{ role: 'user', content: raw }], guide).answered;
    // Only explicit biographical statements imply an unsolicited fact, not a generic "I like it".
    const unprompted = extra.filter(id => id !== 'hobby' || /hobby|music|football|cooking|reading|sport/i.test(raw));
    state.answered = [...new Set([...state.answered, ...unprompted])];
  }
  const asksPractice = /\b(?:practi[cs]e|pronunciation|help me (?:say|pronounce))\b|luyện|phát âm/i.test(raw);
  function advance({ unanswered = false } = {}) {
    state.activePractice = null;
    // A skipped or still-unclear question must not lead into a follow-up that assumes its answer.
    next = learnCallSelectQuestion({ guide, sessionId: state.sessionId, difficulty: state.difficulty,
      covered: state, lastIntent: isCorrection || unanswered ? '' : intent, selection: state.selection });
    if (!next) {
      // All bank goals completed: end the mini lesson instead of repeating a known fact.
      action = 'closing';
      spoken = 'Thank you for talking with me. See you next time!';
      state.pending = null;
      return;
    }
    state.asked = [...new Set([...state.asked, next.targetId])];
    state.pending = { intent: next.targetId, targetId: next.targetId, question: next.question, hint: next.hint };
    // Ask the next question directly. A content lead is added only when it names the idea just heard.
    spoken = next.question;
  }
  if (help === 'stop') { action = 'closing'; spoken = 'Thank you for practicing. See you next time!'; }
  else if (help === 'skip') { advance({ unanswered: true }); }
  else if (help === 'repeat' || help === 'slower') {
    action = 'repeat_question'; spoken = state.pending?.question || question || 'How are you?';
  } else if (field && !asksPractice && help !== 'vietnamese' && help !== 'example') {
    state.lastPersonal = field;
    const value = field === 'age' ? learnCallAge(raw) : field === 'name' ? learnCallName(raw) : (learnCallNumbers(raw).length === 1 ? learnCallNumbers(raw)[0] : null);
    if (value !== null && !['unclear', 'stuck', 'empty'].includes(help)) {
      // A learner correction replaces the previous value, including a mistaken STT value.
      state.facts[field] = { value, status: 'reported', eventId };
      state.answered = [...new Set([...state.answered, field])];
      if (isCorrection && state.pending && state.pending.intent !== field) {
        action = "personal_corrected";
        spoken = `Thanks for clarifying. ${state.pending.question}`;
      } else {
        advance(); // Neutral acknowledgement: no age/name/number spoken back.
        if (learnCallAsksAboutTutor(raw) && next) spoken = `${learnCallTutorSelfAnswer(field, state.topicCtx.teacherName)} ${next.question}`;
      }
    } else {
      delete state.facts[field];
      const required = (state.topicCtx.requiredPersonalFacets || []).includes(field);
      if (required && !state.confirmations[field]) {
        state.confirmations[field] = 1;
        action = 'confirm_personal';
        spoken = field === 'age' ? 'Could you confirm your age?' : 'Could you confirm that detail?';
        state.pending = { intent: field, targetId: field, question: spoken };
      } else { advance(); }
    }
  } else if (asksPractice) {
    const target = extractLearnCallPracticePhrase(question) || state.pending?.model || state.pending?.hint?.en ||
      learnCallReplyHints(state.pending?.question || question, { ...state.topicCtx, difficulty: state.difficulty, pendingIntent: intent })[0]?.en;
    if (!state.retriesByTarget[goalId] && target && !/\.{2,}|…/.test(target)) {
      state.retriesByTarget[goalId] = 1;
      state.activePractice = { targetId: goalId, phrase: target };
      action = 'practice_once'; retryAllowed = true;
      spoken = `Try once: ${target}`;
    } else { advance(); }
  } else if (state.activePractice) {
    advance(); // One attempt, including a fragment, exhausts the same target.
  } else if (help === 'vietnamese' || help === 'example' || help === 'stuck' || help === 'unclear' || help === 'empty') {
    const key = `support:${goalId}`;
    if (state.confirmations[key]) { advance({ unanswered: true }); }
    else {
      state.confirmations[key] = 1;
      const hint = learnCallReplyHints(state.pending?.question || question, { ...state.topicCtx, pendingIntent: intent })[0];
      action = 'support';
      spoken = help === 'vietnamese' ? `Câu này hỏi về ${guide.facets.find(f => f.id === intent)?.labelVi || 'ý của bạn'}. ${state.pending?.question || 'How are you?'}`
        : help === 'unclear' ? `Could you say that again?`
        : `For example: ${hint?.en || "I'm fine."} ${state.pending?.question || 'How are you?'}`;
    }
  } else {
    state.answered = [...new Set([...state.answered, intent])];
    advance();
    if (intent === 'job' && /\b(?:technology|IT|tech)\b/i.test(raw) && next) spoken = `You work in tech. ${next.question}`;
    if (learnCallAsksAboutTutor(raw) && next) spoken = `${learnCallTutorSelfAnswer(intent, state.topicCtx.teacherName)} ${next.question}`;
  }
  const sourceItemIds = [...new Set([eventId, ...itemIds])].slice(0, 8);
  const decision = { eventId, sourceItemIds, action, spoken, retryAllowed, targetId: goalId,
    nextTargetId: state.pending?.targetId || '', hint: next?.hint || state.pending?.hint || null, personal: Boolean(field) };
  state.events = { ...state.events, [eventId]: decision };
  return { state, decision, duplicate: false };
}

/** Text is selected before Realtime audio generation; no transcript rewriting after playback. */
export function learnCallPolicyResponse(decision) {
  return { type: 'response.create', response: { conversation: 'none', input: [], output_modalities: ['audio'], max_output_tokens: 180,
    metadata: { beego_turn: decision.eventId, beego_action: decision.action, ...((decision.sourceItemIds || []).join(',').length <= 512 && decision.sourceItemIds?.length ? { beego_input_items: decision.sourceItemIds.join(',') } : {}), ...(decision.action === 'closing' ? { beego_closing: '1' } : {}) },
    instructions: `Speak exactly the following tutor line, then stop. Do not add a correction, repetition request, personal fact, or another question. Tutor line: ${JSON.stringify(decision.spoken)}` } };
}
