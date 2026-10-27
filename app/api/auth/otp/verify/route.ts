import { NextResponse, type NextRequest } from "next/server";
import {
  verifyAuthOtp,
  ensureSubscriptionAfterOtpRegister,
  type VerifyOtpBody,
} from "@/lib/otp/service";
import { loadUserPayload, setSessionOnResponse } from "@/lib/auth/create-session";
import { authRateLimitResponse } from "@/lib/security/auth-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await authRateLimitResponse(request, "auth_otp_verify", 20);
  if (limited) return limited;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    }

    const result = await verifyAuthOtp(body as VerifyOtpBody);
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    await ensureSubscriptionAfterOtpRegister(result.userId, result.isNewUser);

    const user = await loadUserPayload(result.userId);
    if (!user) {
      return NextResponse.json({ success: false, message: "Could not load user." }, { status: 500 });
    }

    const res = NextResponse.json({ success: true, user });
    await setSessionOnResponse(res, result.userId, request);
    return res;
  } catch (err) {
    console.error("[auth/otp/verify]", err);
    return NextResponse.json({ success: false, message: "Failed to verify OTP." }, { status: 500 });
  }
}
