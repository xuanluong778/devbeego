import { getSettingSync } from "@/lib/runtime-settings/cache";

export function isEnablePhoneOtp() {
  const raw = (process.env.ENABLE_PHONE_OTP || getSettingSync("ENABLE_PHONE_OTP") || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Email OTP đăng ký cần ít nhất một kênh gửi mail. */
export function isEmailOtpDeliveryConfigured() {
  const smtpHost = getSettingSync("SMTP_HOST") || process.env.SMTP_HOST || "";
  const smtpUser = getSettingSync("SMTP_USER") || process.env.SMTP_USER || "";
  const smtpPass = getSettingSync("SMTP_PASSWORD") || process.env.SMTP_PASSWORD || "";
  const smtpFrom = getSettingSync("SMTP_FROM") || process.env.SMTP_FROM || smtpUser;
  const hasSmtp = Boolean(smtpHost && smtpUser && smtpPass && smtpFrom);

  const sgKey = getSettingSync("SENDGRID_API_KEY") || process.env.SENDGRID_API_KEY || "";
  const sgFrom = getSettingSync("SENDGRID_FROM_EMAIL") || process.env.SENDGRID_FROM_EMAIL || "";
  const hasSendgrid = Boolean(sgKey && sgFrom);

  const webhook = getSettingSync("EMAIL_OTP_WEBHOOK_URL") || process.env.EMAIL_OTP_WEBHOOK_URL || "";
  const hasWebhook = Boolean(webhook);

  return hasSmtp || hasSendgrid || hasWebhook;
}

export function smtpMissingMessage() {
  return "Chưa cấu hình gửi email OTP. Admin cần thiết lập SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM (hoặc SendGrid) trên server.";
}
