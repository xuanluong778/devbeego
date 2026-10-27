import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureVerificationSchema } from "@/lib/auth/ensure-verification-schema";
import { generateOtpCode, generateOtpToken, hashOtpCode } from "@/lib/auth";
import { sendOtp } from "@/lib/otp-delivery";
import { authRateLimitResponse } from "@/lib/security/auth-rate-limit";
import { getSettingSync } from "@/lib/runtime-settings/cache";
import { normalizePhoneE164 } from "@/lib/phone-vn";
import { isEmailOtpDeliveryConfigured, smtpMissingMessage } from "@/lib/auth/register-config";
import { findDuplicateRegistrationEmail, validateRegistrationEmail } from "@/lib/auth/gmail-registration";

function normalizeContact(type, value) {
  const t = String(type || "").toLowerCase();
  if (t === "email") {
    const check = validateRegistrationEmail(value);
    if (!check.ok) {
      return { contactType: "email", contactValue: "", emailError: check.message };
    }
    return { contactType: "email", contactValue: check.email, emailError: null };
  }
  if (t === "phone") {
    const phoneStored = normalizePhoneE164(value) || String(value || "").replace(/[^\d+]/g, "").trim();
    return { contactType: "phone", contactValue: phoneStored };
  }
  return { contactType: "", contactValue: "" };
}

export async function POST(request) {
  const limited = await authRateLimitResponse(request, "auth_otp_send", 8);
  if (limited) return limited;
  try {
    const body = await request.json();
    const normalized = normalizeContact(body.contact_type, body.contact_value);
    const { contactType, contactValue, emailError } = normalized;

    if (emailError) {
      return NextResponse.json({ success: false, message: emailError }, { status: 400 });
    }

    if (!contactType || !contactValue) {
      return NextResponse.json(
        { success: false, message: "contact_type and contact_value are required." },
        { status: 400 }
      );
    }

    if (contactType === "email" && !isEmailOtpDeliveryConfigured()) {
      return NextResponse.json({ success: false, message: smtpMissingMessage() }, { status: 503 });
    }
    if (contactType === "phone" && contactValue.replace(/\D/g, "").length < 9) {
      return NextResponse.json({ success: false, message: "Invalid phone number." }, { status: 400 });
    }

    await ensureVerificationSchema(pool);

    if (contactType === "email") {
      const dup = await findDuplicateRegistrationEmail(pool, contactValue);
      if (dup.duplicate) {
        return NextResponse.json({ success: false, message: "Email đã tồn tại." }, { status: 409 });
      }
    } else {
      const [existing] = await pool.query("SELECT id FROM users WHERE phone = ? LIMIT 1", [contactValue]);
      if (existing.length > 0) {
        return NextResponse.json(
          { success: false, message: "Số điện thoại đã tồn tại." },
          { status: 409 }
        );
      }
    }

    const [recent] = await pool.query(
      `SELECT id, created_at
       FROM verification_codes
       WHERE contact_type = ? AND contact_value = ? AND purpose = 'register'
       ORDER BY id DESC
       LIMIT 1`,
      [contactType, contactValue]
    );
    const createdAt = recent[0]?.created_at ? new Date(recent[0].created_at).getTime() : 0;
    if (createdAt && Date.now() - createdAt < 45000) {
      return NextResponse.json(
        { success: false, message: "Vui lòng chờ 45 giây trước khi gửi lại OTP." },
        { status: 429 }
      );
    }

    const otpCode = generateOtpCode();
    const otpToken = generateOtpToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO verification_codes
        (otp_token, contact_type, contact_value, code_hash, purpose, expires_at)
       VALUES (?, ?, ?, ?, 'register', ?)`,
      [otpToken, contactType, contactValue, hashOtpCode(otpCode), expiresAt]
    );

    let queued = false;
    if (contactType === "email") {
      const { tryEnqueueRegisterOtpEmail } = await import("@/lib/otp-queue/otp-register-mail");
      queued = await tryEnqueueRegisterOtpEmail(contactValue, otpCode);
    }
    if (!queued) {
      try {
        await sendOtp({ contactType, contactValue, otpCode });
      } catch (deliveryErr) {
        await pool.query(`DELETE FROM verification_codes WHERE otp_token = ? LIMIT 1`, [otpToken]);
        const isMail =
          deliveryErr?.code === "REGISTER_EMAIL_OTP_FAILED" ||
          String(deliveryErr?.message || "").includes("REGISTER_EMAIL_OTP_FAILED");
        return NextResponse.json(
          {
            success: false,
            message: isMail
              ? "Không gửi được email OTP. Kiểm tra SENDGRID_* hoặc SMTP_* trong .env (và REDIS_URL nếu dùng hàng đợi)."
              : "Không gửi được OTP.",
          },
          { status: 503 }
        );
      }
    }

    const allowDebugOtp =
      process.env.NODE_ENV !== "production" && getSettingSync("AUTH_SHOW_DEBUG_OTP") === "true";

    const message =
      contactType === "email" && queued
        ? "Đã tiếp nhận. Mã OTP đang được gửi đến email (thường trong vài giây)."
        : `Đã gửi OTP đến ${contactType === "email" ? "email" : "số điện thoại"}.`;

    return NextResponse.json({
      success: true,
      message,
      data: {
        otp_token: otpToken,
        debug_otp: allowDebugOtp ? otpCode : undefined,
        email_delivery: contactType === "email" ? (queued ? "queued" : "sync") : undefined,
      },
    });
  } catch (err) {
    console.error("[request-otp]", err?.message || err);
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to send OTP." },
      { status: 500 }
    );
  }
}
