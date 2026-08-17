import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureVerificationSchema } from "@/lib/auth/ensure-verification-schema";
import { ensurePhoneVerifiedColumn } from "@/lib/auth/ensure-phone-verified-schema";
import { ensureGoogleAuthColumns } from "@/lib/auth/ensure-google-auth-columns";
import { hashPassword, verifyOtpCode } from "@/lib/auth";
import { setSessionOnResponse } from "@/lib/auth/create-session";
import { createInitialSubscriptionForNewUser } from "@/lib/subscriptions/subscription-service";
import { isEmailOtpDeliveryConfigured, isEnablePhoneOtp, smtpMissingMessage } from "@/lib/auth/register-config";
import { normalizePhoneE164, phoneLoginCandidates } from "@/lib/phone-vn";
import { findDuplicateRegistrationEmail, validateRegistrationEmail } from "@/lib/auth/gmail-registration";

async function findDuplicatePhone(phoneRaw) {
  const candidates = phoneLoginCandidates(phoneRaw);
  if (!candidates.length) return false;
  const marks = candidates.map(() => "?").join(", ");
  const [rows] = await pool.query(`SELECT id FROM users WHERE phone IN (${marks}) LIMIT 1`, candidates);
  return rows.length > 0;
}

async function verifyRegisterOtp({ otpToken, otpCode, contactType, contactValue }) {
  const [otpRows] = await pool.query(
    `SELECT id, code_hash, expires_at, consumed_at, attempts
     FROM verification_codes
     WHERE otp_token = ? AND contact_type = ? AND contact_value = ? AND purpose = 'register'
     LIMIT 1`,
    [otpToken, contactType, contactValue]
  );
  const otp = otpRows[0];
  if (!otp) {
    return { ok: false, status: 400, message: "OTP token không hợp lệ." };
  }
  if (otp.consumed_at) {
    return { ok: false, status: 400, message: "OTP đã được sử dụng." };
  }
  if (new Date(otp.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 400, message: "OTP đã hết hạn." };
  }
  if (Number(otp.attempts || 0) >= 5) {
    return { ok: false, status: 429, message: "OTP sai quá nhiều lần. Vui lòng yêu cầu mã mới." };
  }
  if (!verifyOtpCode(otpCode, otp.code_hash)) {
    await pool.query("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?", [otp.id]);
    return { ok: false, status: 400, message: "OTP không đúng." };
  }
  await pool.query("UPDATE verification_codes SET consumed_at = NOW() WHERE id = ?", [otp.id]);
  return { ok: true };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const passwordConfirm = typeof body.password_confirm === "string" ? body.password_confirm : "";
    const registerMethod = String(body.register_method || "").trim().toLowerCase();

    if (!name || name.length < 2) {
      return NextResponse.json({ success: false, message: "Nhập họ tên hợp lệ." }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, message: "Mật khẩu tối thiểu 6 ký tự." }, { status: 400 });
    }
    if (passwordConfirm && password !== passwordConfirm) {
      return NextResponse.json({ success: false, message: "Mật khẩu xác nhận không khớp." }, { status: 400 });
    }

    await ensureVerificationSchema(pool);
    await ensurePhoneVerifiedColumn();
    await ensureGoogleAuthColumns();

    const passwordHash = hashPassword(password);

    if (registerMethod === "phone") {
      const phoneRaw = typeof body.phone === "string" ? body.phone : "";
      const phone = normalizePhoneE164(phoneRaw);
      if (!phone) {
        return NextResponse.json({ success: false, message: "Số điện thoại không hợp lệ (VN)." }, { status: 400 });
      }

      if (await findDuplicatePhone(phoneRaw)) {
        return NextResponse.json({ success: false, message: "Số điện thoại đã được đăng ký." }, { status: 409 });
      }

      const phoneOtpEnabled = isEnablePhoneOtp();
      let phoneVerified = 0;

      if (phoneOtpEnabled) {
        const otpToken = typeof body.otp_token === "string" ? body.otp_token.trim() : "";
        const otpCode = typeof body.otp_code === "string" ? body.otp_code.trim() : "";
        if (!otpToken || !otpCode) {
          return NextResponse.json(
            { success: false, message: "Đăng ký SĐT yêu cầu xác minh OTP." },
            { status: 400 }
          );
        }
        const otpCheck = await verifyRegisterOtp({
          otpToken,
          otpCode,
          contactType: "phone",
          contactValue: phone,
        });
        if (!otpCheck.ok) {
          return NextResponse.json({ success: false, message: otpCheck.message }, { status: otpCheck.status });
        }
        phoneVerified = 1;
      }

      const [result] = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, phone_verified, auth_provider)
         VALUES (?, NULL, ?, ?, ?, 'local')`,
        [name, phone, passwordHash, phoneVerified]
      );
      const newUserId = Number(result.insertId);

      if (Number.isFinite(newUserId) && newUserId > 0) {
        try {
          await createInitialSubscriptionForNewUser(newUserId);
        } catch {
          /* non-fatal */
        }
      }

      const res = NextResponse.json(
        {
          success: true,
          message: "Đăng ký thành công! Chào mừng bạn — tài khoản đã sẵn sàng.",
          data: { id: newUserId, name, phone, register_method: "phone" },
        },
        { status: 201 }
      );
      if (Number.isFinite(newUserId) && newUserId > 0) {
        await setSessionOnResponse(res, newUserId, request);
      }
      return res;
    }

    if (registerMethod === "email") {
      if (!isEmailOtpDeliveryConfigured()) {
        return NextResponse.json({ success: false, message: smtpMissingMessage() }, { status: 503 });
      }

      const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const otpToken = typeof body.otp_token === "string" ? body.otp_token.trim() : "";
      const otpCode = typeof body.otp_code === "string" ? body.otp_code.trim() : "";

      const emailCheck = validateRegistrationEmail(emailRaw);
      if (!emailCheck.ok) {
        return NextResponse.json({ success: false, message: emailCheck.message }, { status: 400 });
      }
      const email = emailCheck.email;

      if (!otpToken || !otpCode) {
        return NextResponse.json(
          { success: false, message: "Vui lòng gửi và nhập mã OTP email trước khi đăng ký." },
          { status: 400 }
        );
      }

      const dup = await findDuplicateRegistrationEmail(pool, email);
      if (dup.duplicate) {
        return NextResponse.json({ success: false, message: "Email đã được đăng ký." }, { status: 409 });
      }

      const otpCheck = await verifyRegisterOtp({
        otpToken,
        otpCode,
        contactType: "email",
        contactValue: email,
      });
      if (!otpCheck.ok) {
        return NextResponse.json({ success: false, message: otpCheck.message }, { status: otpCheck.status });
      }

      const [result] = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, email_verified, auth_provider)
         VALUES (?, ?, NULL, ?, 1, 'local')`,
        [name, email, passwordHash]
      );
      const newUserId = Number(result.insertId);

      if (Number.isFinite(newUserId) && newUserId > 0) {
        try {
          await createInitialSubscriptionForNewUser(newUserId);
        } catch {
          /* non-fatal */
        }
      }

      const res = NextResponse.json(
        {
          success: true,
          message: "Đăng ký thành công! Chào mừng bạn — tài khoản đã sẵn sàng.",
          data: { id: newUserId, name, email, register_method: "email" },
        },
        { status: 201 }
      );
      if (Number.isFinite(newUserId) && newUserId > 0) {
        await setSessionOnResponse(res, newUserId, request);
      }
      return res;
    }

    return NextResponse.json(
      { success: false, message: "register_method phải là 'phone' hoặc 'email'." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[auth/register]", err?.message || err);
    return NextResponse.json({ success: false, message: "Failed to register user." }, { status: 500 });
  }
}
