import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { getVoiceRedis } from "@/lib/voice/redis";
import {
  LEARN_CALL_IPA_ACCENT,
  LEARN_CALL_IPA_CACHE_TTL_SECONDS,
  LEARN_CALL_IPA_MAX_CHARS,
  learnCallGenerateIpa,
  learnCallIpaCacheKey,
  learnCallShapeIpaPayload,
} from "@/lib/beego/learn/learn-call-ipa";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Đăng nhập để xem phiên âm." },
        { status: 401, headers: NO_STORE }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const text = String(body?.text || "").replace(/\s+/g, " ").trim();
    if (!text) {
      return NextResponse.json(
        { success: false, code: "EMPTY_TEXT", message: "Chưa có câu để phiên âm." },
        { status: 400, headers: NO_STORE }
      );
    }
    if (text.length > LEARN_CALL_IPA_MAX_CHARS) {
      return NextResponse.json(
        { success: false, code: "TEXT_TOO_LONG", message: "Câu quá dài để phiên âm." },
        { status: 400, headers: NO_STORE }
      );
    }

    const accent = LEARN_CALL_IPA_ACCENT;
    const cacheKey = learnCallIpaCacheKey(text, accent);
    const redis = getVoiceRedis();
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const shaped = learnCallShapeIpaPayload(text, parsed?.sentences);
        if (shaped.sentences.length && shaped.sentences.every((s) => s.ipa)) {
          return NextResponse.json(
            { success: true, data: { ...shaped, cached: true } },
            { headers: NO_STORE }
          );
        }
      }
    } catch {
      // Cache miss or Redis hiccup: still generate.
    }

    let payload;
    try {
      payload = await learnCallGenerateIpa(text, { accent });
    } catch (err) {
      const code = err?.code || "IPA_FAILED";
      const status = code === "MISSING_API_KEY" ? 503 : 502;
      const message =
        code === "MISSING_API_KEY"
          ? "Chưa cấu hình dịch vụ phiên âm."
          : "Không tạo được phiên âm. Thử lại sau.";
      return NextResponse.json({ success: false, code, message }, { status, headers: NO_STORE });
    }

    try {
      await redis.set(cacheKey, JSON.stringify(payload), "EX", LEARN_CALL_IPA_CACHE_TTL_SECONDS);
    } catch {
      // Serving the payload matters more than caching it.
    }

    return NextResponse.json(
      { success: true, data: { ...payload, cached: false } },
      { headers: NO_STORE }
    );
  } catch {
    return NextResponse.json(
      { success: false, code: "IPA_FAILED", message: "Không tạo được phiên âm. Thử lại sau." },
      { status: 500, headers: NO_STORE }
    );
  }
}
