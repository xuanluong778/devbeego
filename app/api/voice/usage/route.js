import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getVoiceRedis } from "@/lib/voice/redis";
import { ensureSubscriptionRow, fetchSubscriptionRow, getUserPlan } from "@/lib/subscriptions/subscription-service";
import { resolveEffectivePlanForEmail } from "@/lib/auth/admin-entitlement";
import { getVoiceQuotaConfigFromDb } from "@/lib/voice/quota-config";

export const runtime = "nodejs";

async function requireAuthenticatedUser(request) {
  const token = request.cookies.get("session_token")?.value;
  if (!token) return null;
  const [rows] = await pool.query(
    `SELECT u.id, u.email
     FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

function utcYmd() {
  const t = new Date();
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
function utcYm() {
  const t = new Date();
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

export async function GET(request) {
  const user = await requireAuthenticatedUser(request);
  if (!user?.id) {
    return NextResponse.json({ success: false, code: "AUTH_REQUIRED", message: "Sign in." }, { status: 401 });
  }

  let plan = "expired";
  try {
    await ensureSubscriptionRow(user.id);
    const sub = await fetchSubscriptionRow(user.id);
    plan = resolveEffectivePlanForEmail(user.email, getUserPlan(sub));
  } catch {
    /* ignore */
  }

  const { config, updatedAt } = await getVoiceQuotaConfigFromDb();
  const limits = config?.[plan] || config?.expired;

  const r = getVoiceRedis();
  const ymd = utcYmd();
  const ym = utcYm();

  const readHash = async (key) => {
    if (!r) return {};
    try {
      return await r.hgetall(key);
    } catch {
      return {};
    }
  };
  const num = (o, k) => {
    const v = Number(o?.[k] || 0);
    return Number.isFinite(v) ? v : 0;
  };

  const daily = await readHash(`voice:usage:daily:${user.id}:${ymd}`);
  const monthly = await readHash(`voice:usage:month:${user.id}:${ym}`);

  return NextResponse.json({
    success: true,
    data: {
      plan,
      limits,
      config_updated_at: updatedAt,
      usage: {
        day: {
          ymd,
          stt_audio_ms: num(daily, "stt_audio_ms"),
          llm_tokens_in: num(daily, "llm_tokens_in"),
          llm_tokens_out: num(daily, "llm_tokens_out"),
          tts_bytes: num(daily, "tts_bytes"),
        },
        month: {
          ym,
          stt_audio_ms: num(monthly, "stt_audio_ms"),
          llm_tokens_in: num(monthly, "llm_tokens_in"),
          llm_tokens_out: num(monthly, "llm_tokens_out"),
          tts_bytes: num(monthly, "tts_bytes"),
        },
      },
    },
  });
}

