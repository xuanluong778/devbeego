import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureVerificationSchema } from "@/lib/auth/ensure-verification-schema";
import { hashPassword, verifyOtpCode } from "@/lib/auth";
import { findUserByEmail, findUserByPhone } from "@/lib/auth/find-user-by-identifier";
import { authRateLimitResponse } from "@/lib/security/auth-rate-limit";

async function verifyResetOtpByToken({ otpToken, otpCode }) {
  const [otpRows] = await pool.query(
    `SELECT id, contact_type, contact_value, code_hash, expires_at, consumed_at, attempts
     FROM verification_codes
     WHERE otp_token = ? AND purpose = 'reset_password'
     LIMIT 1`,
    [otpToken]
  );
  const otp = otpRows[0];
  if (!otp) {
    return { ok: false, status: 400, message: "Mã OTP không hợp lệ. Yêu cầu mã mới." };
  }
  if (otp.consumed_at) {
    return { ok: false, status: 400, message: "Mã OTP đã được sử dụng." };
  }
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 400, message: "Mã OTP đã hết hạn." };
  }
  if (Number(otp.attempts || 0) >= 5) {
    return { ok: false, status: 429, message: "Nhập sai quá nhiều lần. Yêu cầu mã mới." };
  }
  if (!verifyOtpCode(otpCode, otp.code_hash)) {
    await pool.query("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?", [otp.id]);
    return { ok: false, status: 400, message: "Mã OTP không đúng." };
  }
  await pool.query("UPDATE verification_codes SET consumed_at = NOW() WHERE id = ?", [otp.id]);
  return { ok: true, contactType: otp.contact_type, contactValue: otp.contact_value };
}

export async function POST(request) {
  const limited = await authRateLimitResponse(request, "auth_otp_verify", 20);
  if (limited) return limited;
  try {
    const body = await request.json();
    const otpToken = typeof body.otp_token === "string" ? body.otp_token.trim() : "";
    const otpCode = typeof body.otp_code === "string" ? body.otp_code.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const passwordConfirm =
      typeof body.password_confirm === "string" ? body.password_confirm : "";

    if (!otpToken || !otpCode) {
      return NextResponse.json(
        { success: false, message: "Thiếu mã OTP." },
        { status: 400 }
      );
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu mới tối thiểu 6 ký tự." },
        { status: 400 }
      );
    }
    if (passwordConfirm && password !== passwordConfirm) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu xác nhận không khớp." },
        { status: 400 }
      );
    }

    await ensureVerificationSchema(pool);

    const otpCheck = await verifyResetOtpByToken({ otpToken, otpCode });
    if (!otpCheck.ok) {
      return NextResponse.json(
        { success: false, message: otpCheck.message },
        { status: otpCheck.status || 400 }
      );
    }

    const user =
      otpCheck.contactType === "email"
        ? await findUserByEmail(pool, otpCheck.contactValue)
        : await findUserByPhone(pool, otpCheck.contactValue);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy tài khoản." },
        { status: 404 }
      );
    }

    const passwordHash = hashPassword(password);
    await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
    await pool.query("DELETE FROM user_sessions WHERE user_id = ?", [user.id]);

    return NextResponse.json({
      success: true,
      message: "Đã đặt lại mật khẩu. Bạn có thể đăng nhập ngay.",
    });
  } catch (err) {
    console.error("[reset-password]", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Không đặt lại được mật khẩu." },
      { status: 500 }
    );
  }
}
