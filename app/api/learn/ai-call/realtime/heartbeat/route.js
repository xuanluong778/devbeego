import { NextResponse } from "next/server";
import { realtimeCallClock } from "@/lib/beego/learn/learn-call-realtime-lifecycle";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { getVoiceRedis } from "@/lib/voice/redis";
import {
  isRealtimeEnabled,
  realtimeSessionKey,
  touchRealtimeLiveness,
} from "@/lib/beego/learn/learn-call-realtime";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, code: "AUTH_REQUIRED" }, { status: 401 });
    }

    if (!isRealtimeEnabled()) {
      return NextResponse.json({ success: false, code: "REALTIME_DISABLED" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "");
    if (!sessionId) {
      return NextResponse.json({ success: false, code: "MISSING_SESSION_ID" }, { status: 400 });
    }

    const redis = getVoiceRedis();
    let callClock = null;
    if (redis) {
      const raw = await redis.get(realtimeSessionKey(sessionId));
      if (!raw) {
        return NextResponse.json({ success: false, code: "SESSION_EXPIRED" }, { status: 404 });
      }
      try {
        const sessionData = JSON.parse(raw);
        if (String(sessionData.userId) !== String(userId)) {
          return NextResponse.json({ success: false, code: "FORBIDDEN", message: "Không sở hữu phiên gọi này." }, { status: 403 });
        }
        // Heartbeat cannot revive terminated sessions or convert hangup_pending/failed to active
        if (
          sessionData.status === "terminated" ||
          sessionData.status === "hangup_pending" ||
          sessionData.status === "hangup_failed_reconciliation_needed" ||
          sessionData.settled === true
        ) {
          return NextResponse.json(
            { success: false, code: "SESSION_NOT_ACTIVE", message: "Phiên gọi đã kết thúc hoặc đang chờ đóng." },
            { status: 410 }
          );
        }
        if (Date.now() >= Number(sessionData.deadlineAt)) {
          return NextResponse.json({ success: false, code: "DEADLINE_EXCEEDED", message: "Đã hết thời gian phiên gọi." }, { status: 410 });
        }
        callClock = realtimeCallClock(sessionData);
      } catch {
        /* ignore parse error */
      }
      await touchRealtimeLiveness(redis, sessionId);
    }

    return NextResponse.json({ success: true, timestamp: Date.now(), callClock }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ success: false, code: "SERVER_ERROR", message: err?.message }, { status: 500 });
  }
}

