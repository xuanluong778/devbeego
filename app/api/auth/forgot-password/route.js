import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureVerificationSchema } from "@/lib/auth/ensure-verification-schema";
import { generateOtpCode, generateOtpToken, hashOtpCode } from "@/lib/auth";
import { sendOtp } from "@/lib/otp-delivery";
import { isEmailOtpDeliveryConfigured, smtpMissingMessage } from "@/lib/auth/register-config";
import { findUserByEmail, findUserByPhone } from "@/lib/auth/find-user-by-identifier";
import { normalizePhoneE164 } from "@/lib/phone-vn";

const GENERIC_OK =
  "Nếu tài khoản tồn tại, mã OTP sẽ được gửi đến email hoặc số điện thoại đã đăng ký.";

function normalizeForgotContact(method, value) {
  const m = String(method || "").toLowerCase();
  if (m === "email") {
    const email = String(value || "")
      .trim()
      .toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, message: "Nhập email hợp lệ." };
    }
    return { ok: true, contactType: "email", contactValue: email };
  }
  if (m === "phone") {
    const phone = normalizePhoneE164(value);
    if (!phone) {
      return { ok: false, message: "Số điện thoại không hợp lệ (VN)." };
    }
    return { ok: true, contactType: "phone", contactValue: phone };
  }
  return { ok: false, message: "Chọn phương thức hợp lệ." };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = normalizeForgotContact(body.contact_type, body.contact_value);
    if (!parsed.ok) {
      return NextResponse.json({ success: false, message: parsed.message }, { status: 400 });
    }

    const { contactType, contactValue } = parsed;

    if (contactType === "email" && !isEmailOtpDeliveryConfigured()) {
      return NextResponse.json({ success: false, message: smtpMissingMessage() }, { status: 503 });
    }

    await ensureVerificationSchema(pool);

    const user =
      contactType === "email"
        ? await findUserByEmail(pool, contactValue)
        : await findUserByPhone(pool, contactValue);

    if (!user) {
      return NextResponse.json({ success: true, message: GENERIC_OK });
    }

    const sendTo =
      contactType === "email"
        ? contactValue
        : user.email && isEmailOtpDeliveryConfigured()
        ? String(user.email).trim().toLowerCase()
        : contactValue;

    const sendType = sendTo.includes("@") ? "email" : "phone";

    if (sendType === "email" && !isEmailOtpDeliveryConfigured()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Tài khoản này không có email. Liên hệ admin hoặc thử đăng nhập bằng Google nếu đã liên kết.",
        },
        { status: 400 }
      );
    }

    const [recent] = await pool.query(
      `SELECT id, created_at
       FROM verification_codes
       WHERE contact_type = ? AND contact_value = ? AND purpose = 'reset_password'
       ORDER BY id DESC
       LIMIT 1`,
      [sendType, sendTo]
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
       VALUES (?, ?, ?, ?, 'reset_password', ?)`,
      [otpToken, sendType, sendTo, hashOtpCode(otpCode), expiresAt]
    );

    try {
      await sendOtp({ contactType: sendType, contactValue: sendTo, otpCode });
    } catch (deliveryErr) {
      await pool.query(`DELETE FROM verification_codes WHERE otp_token = ? LIMIT 1`, [otpToken]);
      const isMail =
        deliveryErr?.code === "REGISTER_EMAIL_OTP_FAILED" ||
        String(deliveryErr?.message || "").includes("REGISTER_EMAIL_OTP_FAILED");
      return NextResponse.json(
        {
          success: false,
          message: isMail
            ? "Không gửi được email OTP. Kiểm tra cấu hình SMTP/SendGrid trên server."
            : "Không gửi được OTP. Thử lại sau hoặc liên hệ admin.",
        },
        { status: 503 }
      );
    }

    const channel =
      sendType === "email" ? "email" : "số điện thoại";

    return NextResponse.json({
      success: true,
      message: `Đã gửi mã OTP đến ${channel} của bạn.`,
      data: {
        otp_token: otpToken,
        delivery_type: sendType,
        delivery_target: sendType === "email" ? sendTo : sendTo.replace(/^\+84/, "0"),
      },
    });
  } catch (err) {
    console.error("[forgot-password]", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Không gửi được mã đặt lại mật khẩu." },
      { status: 500 }
    );
  }
}
