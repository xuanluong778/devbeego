import { NextResponse } from 'next/server';
import { getSessionUserIdFromRequest } from '@/lib/http/ai-entitlement';
import { getVoiceRedis } from '@/lib/voice/redis';
import { isRealtimeEnabled, realtimeSessionKey } from '@/lib/beego/learn/learn-call-realtime';
import { learnCallPolicyKey, reserveLearnCallPolicyTurn } from '@/lib/beego/learn/learn-call-policy-store';
import { learnCallPolicyResponse } from '@/lib/beego/learn/learn-call-policy';
export const dynamic = 'force-dynamic';
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } });
export async function POST(request) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) return reply({ success: false, code: 'AUTH_REQUIRED' }, 401);
    if (!isRealtimeEnabled()) return reply({ success: false, code: 'REALTIME_DISABLED' }, 403);
    const body = await request.json();
    const sessionId = String(body.sessionId || '').slice(0, 160);
    const eventId = String(body.itemId || '').slice(0, 160);
    const text = String(body.text || '').trim().slice(0, 1200);
    const itemIds = (Array.isArray(body.itemIds) ? body.itemIds : []).filter(id => typeof id === 'string').slice(0, 8).map(id => id.slice(0, 160));
    if (!sessionId || !eventId || !text) return reply({ success: false, code: 'INVALID_TURN' }, 400);
    const redis = getVoiceRedis();
    if (!redis) return reply({ success: false, code: 'SERVICE_UNAVAILABLE' }, 503);
    const raw = await redis.get(realtimeSessionKey(sessionId));
    if (!raw) return reply({ success: false, code: 'SESSION_EXPIRED' }, 404);
    const session = JSON.parse(raw);
    if (String(session.userId) !== String(userId)) return reply({ success: false, code: 'FORBIDDEN' }, 403);
    if (session.status !== 'active' || session.settled || Date.now() >= session.deadlineAt) return reply({ success: false, code: 'SESSION_NOT_ACTIVE' }, 410);
    const policyRaw = await redis.get(learnCallPolicyKey(sessionId));
    if (!policyRaw) return reply({ success: false, code: 'CALL_POLICY_EXPIRED' }, 410);
    const policy = JSON.parse(policyRaw);
    const result = await reserveLearnCallPolicyTurn(redis, { sessionId, userId, topicCtx: policy.topicCtx, difficulty: policy.difficulty }, { eventId, text, itemIds });
    return reply({ success: true, data: { decision: result.decision, event: learnCallPolicyResponse(result.decision), duplicate: result.duplicate } });
  } catch {
    // Never log raw transcript, audio, personal values, or provider payloads.
    return reply({ success: false, code: 'TURN_POLICY_UNAVAILABLE' }, 503);
  }
}
