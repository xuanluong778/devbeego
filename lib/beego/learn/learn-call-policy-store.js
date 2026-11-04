import { createLearnCallPolicy, planLearnCallPolicy } from './learn-call-policy.js';
import { learnCallTopicGuide } from './learn-call-topics.js';
const TTL = 3600;
export const learnCallPolicyKey = sid => `voice:learn-policy:${sid}`;
const CAS = `if (redis.call('GET',KEYS[1]) or '') ~= ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1`;
/** Persistent across transport reconnects and bounded transcript eviction. */
export async function ensureLearnCallPolicy(redis, options) {
  const key = learnCallPolicyKey(options.sessionId);
  const existing = await redis.get(key);
  if (existing) {
    const state = JSON.parse(existing);
    if (state.ownerUserId != null && String(state.ownerUserId) !== String(options.userId)) throw new Error('CALL_POLICY_FORBIDDEN');
    return state;
  }
  const guide = learnCallTopicGuide(options.topicCtx);
  const historyKey = `voice:learn-last-opening:${options.userId}:${guide.key}`;
  const previousOpeningId = await redis.get(historyKey) || '';
  const state = createLearnCallPolicy({ ...options, previousOpeningId });
  if (await redis.set(key, JSON.stringify(state), 'EX', TTL, 'NX') === 'OK') {
    // History contains only a bank variant ID, never learner facts or audio.
    await redis.set(historyKey, state.selection.id, 'EX', 30 * 86400);
    return state;
  }
  return ensureLearnCallPolicy(redis, options);
}
export async function reserveLearnCallPolicyTurn(redis, options, event) {
  await ensureLearnCallPolicy(redis, options);
  for (let n = 0; n < 12; n++) {
    const key = learnCallPolicyKey(options.sessionId);
    const before = await redis.get(key);
    if (!before) throw new Error('CALL_POLICY_EXPIRED');
    const result = planLearnCallPolicy(JSON.parse(before), event);
    if (result.duplicate) return result;
    if (await redis.eval(CAS, 1, key, before, JSON.stringify(result.state), TTL)) return result;
  }
  throw new Error('CALL_POLICY_BUSY');
}
