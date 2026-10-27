import { NextResponse, type NextRequest } from "next/server";
import { sendAuthOtp, type SendOtpBody } from "@/lib/otp/service";
import { authRateLimitResponse } from "@/lib/security/auth-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limited = await authRateLimitResponse(request, "auth_otp_send", 8);
  if (limited) return limited;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    }

    const result = await sendAuthOtp(body as SendOtpBody);
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auth/otp/send]", err);
    return NextResponse.json({ success: false, message: "Failed to send OTP." }, { status: 500 });
  }
}
