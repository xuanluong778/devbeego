import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { learnAiCallEmailAllowed, learnAiCallEnabled, learnAiCallGateOpen } from "@/lib/beego/learn/ai-call-access";
import { shouldBypassEntitlementsForEmail } from "@/lib/auth/admin-entitlement";
import { getVoiceRedis } from "@/lib/voice/redis";

export const dynamic = "force-dynamic";

export async function GET(request) {
  let enabled = false;
  if (learnAiCallEnabled()) {
    try {
      const redis = getVoiceRedis();
      const gateOpen = await learnAiCallGateOpen(redis);
      if (gateOpen) {
        const userId = await getSessionUserIdFromRequest(request);
        if (userId) {
          const [users] = await pool.query(`SELECT email FROM users WHERE id = ? LIMIT 1`, [userId]);
          const email = users?.[0]?.email;
          enabled = learnAiCallEmailAllowed(email) || shouldBypassEntitlementsForEmail(email);
        } else {
          // Khi chưa đăng nhập (khách vãng lai), trạng thái tính năng vẫn bật
          // để UI trên Tab Học và Tab Luyện nói hiển thị đầy đủ cho người dùng trải nghiệm
          enabled = true;
        }
      }
    } catch {
      enabled = false;
    }
  }
  return NextResponse.json(
    { success: true, data: { enabled } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
