import { NextResponse } from "next/server";
import { isEmailOtpDeliveryConfigured, isEnablePhoneOtp } from "@/lib/auth/register-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      enable_phone_otp: isEnablePhoneOtp(),
      smtp_configured: isEmailOtpDeliveryConfigured(),
    },
  });
}
