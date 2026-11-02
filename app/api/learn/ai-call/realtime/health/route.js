import { NextResponse } from "next/server";
import { getVoiceRedis } from "@/lib/voice/redis";
import {
  isRealtimeEnabled,
  getRealtimeConfig,
  REALTIME_ACTIVE_CALLS_SET,
} from "@/lib/beego/learn/learn-call-realtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getRealtimeConfig();
  const redis = getVoiceRedis();

  let redisOk = false;
  let activeCallsCount = 0;

  if (redis) {
    try {
      const ping = await redis.ping();
      redisOk = ping === "PONG";
      activeCallsCount = Number(await redis.zcard(REALTIME_ACTIVE_CALLS_SET).catch(() => 0)) || 0;
    } catch {
      redisOk = false;
    }
  }

  const allowlistSet = Boolean(String(process.env.LEARN_AI_CALL_REALTIME_ALLOWLIST || "").trim());

  return NextResponse.json(
    {
      ok: true,
      service: "learn-call-realtime",
      realtimeEnabled: config.enabled,
      model: config.model,
      voice: config.voice,
      allowlistConfigured: allowlistSet,
      redisConnected: redisOk,
      activeCallsCount,
      timestamp: Date.now(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, private" },
    }
  );
}

