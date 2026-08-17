import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { shouldBypassEntitlementsForEmail } from "@/lib/auth/admin-entitlement";
import { assertAiFeatureAccess } from "@/lib/http/ai-entitlement";
import { getSettingSync } from "@/lib/runtime-settings/cache";

export const runtime = "nodejs";

/** In-memory rate limit per logged-in user (per Node process). */
const rateBuckets = new Map();

function getRateConfig() {
  return {
    windowMs: Number(getSettingSync("PRONUNCIATION_RATE_WINDOW_MS") || 600_000),
    max: Number(getSettingSync("PRONUNCIATION_RATE_LIMIT") || 40),
  };
}

function allowRateLimit(userId) {
  const { windowMs, max } = getRateConfig();
  const now = Date.now();
  const key = `u:${userId}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
  }
  if (bucket.count >= max) {
    rateBuckets.set(key, bucket);
    return false;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return true;
}

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user?.id) {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Đăng nhập để dùng chấm phát âm Azure." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const gate = await assertAiFeatureAccess(user.id, "speaking", { email: user.email });
    if (!gate.ok) {
      return NextResponse.json(
        {
          success: false,
          code: gate.code,
          message: gate.message || "Speaking practice not available for this plan.",
        },
        { status: gate.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!shouldBypassEntitlementsForEmail(user.email) && !allowRateLimit(user.id)) {
      return NextResponse.json(
        { success: false, message: "Quá nhiều yêu cầu. Thử lại sau vài phút." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    const speechKey = String(getSettingSync("AZURE_SPEECH_KEY") || "").trim();
    const speechRegion = String(getSettingSync("AZURE_SPEECH_REGION") || "").trim();

    if (!speechKey || !speechRegion) {
      return NextResponse.json(
        { success: false, message: "Azure Speech is not configured." },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const tokenRes = await fetch(
      `https://${speechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": speechKey,
          "Content-Length": "0",
        },
        cache: "no-store",
      }
    );

    if (!tokenRes.ok) {
      return NextResponse.json(
        { success: false, message: "Cannot get Azure Speech token." },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const speechToken = (await tokenRes.text()).trim();
    if (!speechToken) {
      return NextResponse.json(
        { success: false, message: "Empty Azure Speech token." },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          token: speechToken,
          region: speechRegion,
        },
      },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Token API failed.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
