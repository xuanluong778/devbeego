import { learnCallTopicGuide, learnCallSessionGoals, learnCallCoveredFacets, learnCallSelectOpening, learnCallSelectQuestion, learnCallQuestionFacet, learnCallQuestionMeaning, learnCallReplyHints } from './learn-call-topics.js';
import { learnCallHelpKind, extractLearnCallPracticePhrase, learnCallTutorSelfAnswer, learnCallAsksAboutTutor, learnCallLearnerAsksTutor, learnCallGoalMet, learnCallMeaningLine, learnCallRecognitionNoise } from './learn-call-tutor.js';
import { learnCallAge, learnCallName, learnCallNumbers, learnCallPersonalCorrection, learnCallPersonalTurn } from './learn-call-personal.js';

export function createLearnCallPolicy({ sessionId, userId, topicCtx = {}, difficulty = 'easy', previousOpeningId = '' } = {}) {
  const guide = learnCallTopicGuide(topicCtx);
  const selection = topicCtx.selection || learnCallSelectOpening({ guide, sessionId, difficulty, previousId: previousOpeningId });
  return { sessionId, ownerUserId: userId == null ? null : String(userId), topicCtx: { ...topicCtx, sessionId, selection }, difficulty, selection,
    goals: learnCallSessionGoals(guide, selection),
    asked: topicCtx.sessionMode === 'open' ? [] : [selection.targetId], answered: [],
    askedMeanings: topicCtx.sessionMode === 'open' ? [] : [learnCallQuestionMeaning(selection.spoken, selection.targetId)],
    retriesByTarget: {},
    facts: {}, confirmations: {}, lastPersonal: '', activePractice: null, events: {},
    pending: topicCtx.sessionMode === 'open' ? null : { intent: selection.targetId, question: selection.spoken.match(/[^.!?]*\?$/)?.[0]?.trim() || selection.spoken, targetId: selection.targetId } };
}

/** Pure reducer: reserves a retry before returning any speakable invitation. Never uses Azure scores. */
export function planLearnCallPolicy(previous, { eventId, text, question = '', itemIds = [] } = {}) {
  if (!eventId) throw new Error('A stable learner turn ID is required');
  if (Object.hasOwn(previous.events, eventId)) return { state: previous, decision: previous.events[eventId], duplicate: true };
  if (!previous.pending && Object.values(previous.events || {}).some((event) => event.action === 'closing')) {
    const state = JSON.parse(JSON.stringify(previous));
    const decision = { eventId, sourceItemIds: [eventId], action: 'ignore', spoken: '', retryAllowed: false, targetId: '', nextTargetId: '', hint: null, personal: false };
    state.events = { ...state.events, [eventId]: decision };
    return { state, decision, duplicate: false };
  }
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
  const askedMeaning = (targetId, question) => learnCallQuestionMeaning(question, targetId);
  function rememberMeaning(targetId, question) {
    const meaning = askedMeaning(targetId, question);
    if (!meaning) return;
    state.askedMeanings = [...new Set([...(state.askedMeanings || []), meaning])];
  }
  function advance({ unanswered = false, heard = '' } = {}) {
    state.activePractice = null;
    // Four questions is a conversation, not a checklist. After that, say goodbye.
    if ((state.asked || []).length >= 4) {
      action = 'closing';
      spoken = 'Thank you for talking with me. See you next time!';
      state.pending = null;
      return;
    }
    // A skipped or still-unclear question must not lead into a follow-up that assumes its answer.
    const follow = isCorrection || (unanswered && !heard) ? '' : (heard || intent);
    next = learnCallSelectQuestion({ guide, sessionId: state.sessionId, difficulty: state.difficulty,
      covered: { answered: state.answered, asked: state.asked, meanings: state.askedMeanings || [] },
      lastIntent: follow, selection: state.selection });
    if (!next) {
      // All bank goals completed: end the mini lesson instead of repeating a known fact.
      action = 'closing';
      spoken = 'Thank you for talking with me. See you next time!';
      state.pending = null;
      return;
    }
    state.asked = [...new Set([...state.asked, next.targetId])];
    rememberMeaning(next.targetId, next.question);
    state.pending = { intent: next.targetId, targetId: next.targetId, question: next.question, hint: next.hint };
    // Ask the next question directly. A content lead is added only when it names the idea just heard.
    spoken = next.question;
  }
  function explainOnce() {
    const key = `support:${goalId}`;
    if (state.confirmations[key]) { advance({ unanswered: true }); return; }
    state.confirmations[key] = 1;
    action = 'support';
    const line = learnCallMeaningLine(intent, guide);
    spoken = `${line}. ${state.pending?.question || question || 'How are you?'}`;
  }
  const scene = state.selection?.context || state.topicCtx?.selection?.context || '';
  const tutorFacet = learnCallLearnerAsksTutor(raw);
  function answerTutor(facet) {
    const self = learnCallTutorSelfAnswer(facet === 'reciprocal' || facet === 'you' ? intent : facet, state.topicCtx.teacherName, scene);
    const key = `reask:${goalId}`;
    if (!state.confirmations[key] && state.pending?.question && !learnCallGoalMet(raw, intent, state.pending.question)) {
      state.confirmations[key] = 1;
      action = 'answer_then_continue';
      spoken = `${self} ${state.pending.question}`;
      return;
    }
    advance({ unanswered: !learnCallGoalMet(raw, intent, state.pending?.question || question) });
    if (next) spoken = `${self} ${next.question}`;
    else if (!spoken) spoken = self;
  }
  const leaving = /^(?:bye(?:\s+(?:guys|everyone|all|you))?|goodbye|good\s*bye|see\s+you(?:\s+(?:later|soon))?|see\s+ya|good\s+night|tạm biệt|tam biet)[\s!.]*$/i.test(raw);
  const askingFarewell = /\b(?:goodbye|bye|tạm biệt|tam biet)\b/i.test(state.pending?.question || question || '');
  if (help === 'stop' || (leaving && !askingFarewell)) { action = 'closing'; spoken = 'Thank you for talking with me. See you next time!'; state.pending = null; }
  else if (help === 'skip') { advance({ unanswered: true }); }
  else if (help === 'repeat' || help === 'slower') {
    action = 'repeat_question'; spoken = state.pending?.question || question || 'How are you?';
  } else if (help === 'meaning' || help === 'vietnamese') {
    explainOnce();
  } else if (tutorFacet && tutorFacet !== 'reciprocal') {
    answerTutor(tutorFacet);
  } else if (field && !asksPractice && help !== 'example') {
    state.lastPersonal = field;
    const value = field === 'age' ? learnCallAge(raw) : field === 'name' ? learnCallName(raw) : (learnCallNumbers(raw).length === 1 ? learnCallNumbers(raw)[0] : null);
    if (value !== null && !['unclear', 'stuck', 'empty', 'meaning'].includes(help)) {
      // A learner correction replaces the previous value, including a mistaken STT value.
      state.facts[field] = { value, status: 'reported', eventId };
      state.answered = [...new Set([...state.answered, field])];
      rememberMeaning(field, state.pending?.question || question);
      if (isCorrection && state.pending && state.pending.intent !== field) {
        action = "personal_corrected";
        spoken = `Thanks for clarifying. ${state.pending.question}`;
      } else {
        advance(); // Neutral acknowledgement: no age/name/number spoken back.
        if (learnCallAsksAboutTutor(raw) && next) spoken = `${learnCallTutorSelfAnswer(field, state.topicCtx.teacherName, scene)} ${next.question}`;
      }
    } else {
      delete state.facts[field];
      const required = (state.topicCtx.requiredPersonalFacets || []).includes(field);
      const noise = field === 'age' && learnCallRecognitionNoise(raw);
      const uncertain = /\bor\b|maybe|perhaps|not sure|không chắc|khong chac|^unclear$/i.test(raw);
      if ((required || noise) && !state.confirmations[field]) {
        state.confirmations[field] = 1;
        action = 'confirm_personal';
        spoken = field === 'age' ? 'Could you confirm your age?' : 'Could you confirm that detail?';
        state.pending = { intent: field, targetId: field, question: spoken };
        rememberMeaning(field, spoken);
      } else if (uncertain) {
        advance({ unanswered: true });
      } else {
        const key = `support:${goalId}`;
        if (state.confirmations[key] || state.confirmations[field]) advance({ unanswered: true });
        else {
          state.confirmations[key] = 1;
          action = 'support';
          spoken = state.pending?.question || (field === 'age' ? 'How old are you?' : "What's your name?");
        }
      }
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
      spoken = help === 'unclear' ? `Could you say that again?`
        : `For example: ${hint?.en || "I'm fine."} ${state.pending?.question || 'How are you?'}`;
    }
  } else if (learnCallGoalMet(raw, intent, state.pending?.question || question)) {
    state.answered = [...new Set([...state.answered, intent])];
    advance();
    if (intent === 'job' && /\b(?:technology|IT|tech)\b/i.test(raw) && next) spoken = `You work in tech. ${next.question}`;
    if (learnCallAsksAboutTutor(raw) && next) spoken = `${learnCallTutorSelfAnswer(intent, state.topicCtx.teacherName, scene)} ${next.question}`;
  } else {
    const heard = (learnCallCoveredFacets([{ role: 'user', content: raw }], guide).answered || []).find((id) => id !== intent) || '';
    const key = `support:${goalId}`;
    if (heard) advance({ unanswered: true, heard });
    else if (state.confirmations[key]) advance({ unanswered: true });
    else {
      state.confirmations[key] = 1;
      action = 'support';
      spoken = state.pending?.question || question || 'How are you?';
    }
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
