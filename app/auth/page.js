"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { notifyAuthChanged } from "@/hooks/useAuthLoggedIn";
import "./auth.css";

function safeNextDestination(raw) {
  if (!raw || typeof raw !== "string") return "/";
  const p = raw.trim();
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  if (p.includes("..") || p.includes("\\")) return "/";
  if (p === "/auth" || p.startsWith("/auth?") || p.startsWith("/auth/")) return "/";
  return p;
}

const NOTICES = {
  google_off: "Đăng nhập Google chưa bật (thiếu GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trên server).",
  google_denied: "Bạn đã hủy đăng nhập Google.",
  google_state: "Phiên đăng nhập Google không hợp lệ. Thử lại.",
  google_token: "Không lấy được token từ Google.",
  google_email: "Google không cung cấp email hợp lệ.",
  google_email_unverified: "Email Google chưa được xác minh. Vui lòng xác minh email trên tài khoản Google.",
  google_profile: "Không lấy được thông tin tài khoản Google.",
  google_user: "Không tạo được tài khoản. Thử lại sau.",
  google_gmail_invalid:
    "Gmail có dấu chấm (.) hoặc alias (+) không được dùng đăng ký. Hãy dùng địa chỉ Gmail gốc.",
};

function validateClientRegistrationEmail(email) {
  const raw = String(email || "")
    .trim()
    .toLowerCase();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, message: "Nhập email hợp lệ." };
  }
  const at = raw.lastIndexOf("@");
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    if (local.includes(".")) {
      return {
        ok: false,
        message:
          "Gmail có dấu chấm không được dùng đăng ký. Dùng địa chỉ gốc, ví dụ: tenban@gmail.com.",
      };
    }
    if (local.includes("+")) {
      return { ok: false, message: "Gmail alias (+) không được dùng đăng ký." };
    }
  }
  return { ok: true };
}

function validateClientLoginEmail(email) {
  const raw = String(email || "")
    .trim()
    .toLowerCase();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, message: "Nhập email hợp lệ." };
  }
  return { ok: true, email: raw };
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const [panel, setPanel] = useState("login");
  const [nextDest, setNextDest] = useState("/");

  const [loginMethod, setLoginMethod] = useState("phone");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPwLogin, setShowPwLogin] = useState(false);
  const [loginSubview, setLoginSubview] = useState("login");

  const [forgotMethod, setForgotMethod] = useState("phone");
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtpToken, setForgotOtpToken] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState("");
  const [forgotStep, setForgotStep] = useState(1);
  const [showPwForgot, setShowPwForgot] = useState(false);
  const [showPwForgotConfirm, setShowPwForgotConfirm] = useState(false);

  const [regMethod, setRegMethod] = useState("phone");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regOtp, setRegOtp] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPasswordConfirm, setRegPasswordConfirm] = useState("");
  const [regOtpToken, setRegOtpToken] = useState("");
  const [showPwReg, setShowPwReg] = useState(false);
  const [showPwRegConfirm, setShowPwRegConfirm] = useState(false);
  const [regConfig, setRegConfig] = useState({ smtp_configured: true, enable_phone_otp: false });

  const [busy, setBusy] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [alert, setAlert] = useState({ type: "", text: "" });
  const [fieldError, setFieldError] = useState("");

  const showAlert = useCallback((type, text) => {
    setAlert(type && text ? { type, text } : { type: "", text: "" });
  }, []);

  const fetchMe = async () => {
    const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
    const result = await response.json();
    return response.ok && result.success ? result.data : null;
  };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const dest = safeNextDestination(sp.get("next")) || "/";
    setNextDest(dest);
    const notice = sp.get("notice");
    if (notice && NOTICES[notice]) {
      showAlert("err", NOTICES[notice]);
    }

    let cancelled = false;
    (async () => {
      const u = await fetchMe();
      if (!cancelled && u) {
        router.replace(dest);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, showAlert]);

  useEffect(() => {
    if (panel !== "register") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/register-config", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && json.success) {
          setRegConfig(json.data || {});
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panel]);

  function resetRegisterOtp() {
    setRegOtpToken("");
    setRegOtp("");
  }

  function switchRegMethod(method) {
    setRegMethod(method);
    setFieldError("");
    resetRegisterOtp();
    setRegPassword("");
    setRegPasswordConfirm("");
  }

  function resetForgotForm() {
    setForgotOtpToken("");
    setForgotOtp("");
    setForgotPassword("");
    setForgotPasswordConfirm("");
    setForgotStep(1);
  }

  function switchLoginMethod(method) {
    setLoginMethod(method);
    setFieldError("");
  }

  function openForgotPassword() {
    setForgotMethod(loginMethod);
    setForgotPhone(loginPhone);
    setForgotEmail(loginEmail);
    resetForgotForm();
    setLoginSubview("forgot");
    setFieldError("");
    showAlert("", "");
  }

  function backToLogin() {
    setLoginSubview("login");
    resetForgotForm();
    setFieldError("");
    showAlert("", "");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setFieldError("");
    showAlert("", "");
    let identifier = "";
    if (loginMethod === "email") {
      const emailCheck = validateClientLoginEmail(loginEmail);
      if (!emailCheck.ok) {
        setFieldError(emailCheck.message);
        return;
      }
      identifier = emailCheck.email;
    } else {
      const digits = loginPhone.replace(/[^\d+]/g, "").trim();
      if (digits.replace(/\D/g, "").length < 9) {
        setFieldError("Nhập số điện thoại hợp lệ.");
        return;
      }
      identifier = digits;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password: loginPassword }),
      });
      const result = await response.json();
      if (!response.ok) {
        showAlert("err", result.message || "Đăng nhập thất bại.");
        return;
      }
      setLoginPhone("");
      setLoginEmail("");
      setLoginPassword("");
      notifyAuthChanged();
      router.replace(nextDest);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotSendOtp(e) {
    e.preventDefault();
    setFieldError("");
    showAlert("", "");
    let contactValue = "";
    if (forgotMethod === "email") {
      const emailCheck = validateClientLoginEmail(forgotEmail);
      if (!emailCheck.ok) {
        setFieldError(emailCheck.message);
        return;
      }
      contactValue = emailCheck.email;
    } else {
      const digits = forgotPhone.replace(/[^\d+]/g, "").trim();
      if (digits.replace(/\D/g, "").length < 9) {
        setFieldError("Nhập số điện thoại hợp lệ.");
        return;
      }
      contactValue = digits;
    }
    setOtpSending(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_type: forgotMethod, contact_value: contactValue }),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldError(result.message || "Không gửi được mã OTP.");
        return;
      }
      if (result.data?.otp_token) {
        setForgotOtpToken(result.data.otp_token);
        setForgotStep(2);
        setForgotOtp("");
      }
      showAlert("ok", result.message || "Đã gửi mã OTP.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleForgotReset(e) {
    e.preventDefault();
    setFieldError("");
    showAlert("", "");
    if (!forgotOtpToken) {
      setFieldError("Vui lòng gửi mã OTP trước.");
      return;
    }
    if (!forgotOtp.trim()) {
      setFieldError("Nhập mã OTP.");
      return;
    }
    if (!forgotPassword || forgotPassword.length < 6) {
      setFieldError("Mật khẩu mới tối thiểu 6 ký tự.");
      return;
    }
    if (forgotPassword !== forgotPasswordConfirm) {
      setFieldError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otp_token: forgotOtpToken,
          otp_code: forgotOtp.trim(),
          password: forgotPassword,
          password_confirm: forgotPasswordConfirm,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldError(result.message || "Không đặt lại được mật khẩu.");
        return;
      }
      showAlert("ok", result.message || "Đã đặt lại mật khẩu.");
      setLoginPassword("");
      backToLogin();
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp() {
    setFieldError("");
    showAlert("", "");
    const name = regName.trim();
    const email = regEmail.trim().toLowerCase();
    if (!name) {
      setFieldError("Nhập họ tên.");
      return;
    }
    const emailCheck = validateClientRegistrationEmail(email);
    if (!emailCheck.ok) {
      setFieldError(emailCheck.message);
      return;
    }
    if (!regConfig.smtp_configured) {
      setFieldError(
        "Chưa cấu hình SMTP trên server. Không thể gửi OTP email — liên hệ admin."
      );
      return;
    }
    setOtpSending(true);
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_type: "email", contact_value: email }),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldError(result.message || "Không gửi được OTP.");
        return;
      }
      setRegOtpToken(result.data?.otp_token || "");
      setRegOtp("");
      showAlert("ok", result.message || "Đã gửi mã OTP đến email.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setFieldError("");
    showAlert("", "");

    const name = regName.trim();
    if (!name) {
      setFieldError("Nhập họ tên.");
      return;
    }
    if (regPassword.length < 6) {
      setFieldError("Mật khẩu tối thiểu 6 ký tự.");
      return;
    }

    setBusy(true);
    try {
      if (regMethod === "phone") {
        if (regPassword !== regPasswordConfirm) {
          setFieldError("Mật khẩu xác nhận không khớp.");
          return;
        }
        const phoneDigits = regPhone.replace(/[^\d+]/g, "").trim();
        if (phoneDigits.replace(/\D/g, "").length < 9) {
          setFieldError("Nhập số điện thoại Việt Nam hợp lệ.");
          return;
        }
        const response = await fetch("/api/auth/register", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            register_method: "phone",
            name,
            phone: phoneDigits,
            password: regPassword,
            password_confirm: regPasswordConfirm,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          setFieldError(result.message || "Đăng ký thất bại.");
          return;
        }
        showAlert("ok", result.message || "Đăng ký thành công!");
        notifyAuthChanged();
        window.setTimeout(() => router.replace(nextDest), 800);
        return;
      }

      if (!regConfig.smtp_configured) {
        setFieldError("Chưa cấu hình SMTP — không thể đăng ký bằng email.");
        return;
      }
      if (!regOtpToken) {
        setFieldError("Vui lòng gửi mã OTP đến email trước khi hoàn tất đăng ký.");
        return;
      }
      const email = regEmail.trim().toLowerCase();
      const emailCheck = validateClientRegistrationEmail(email);
      if (!emailCheck.ok) {
        setFieldError(emailCheck.message);
        return;
      }
      if (!regOtp.trim()) {
        setFieldError("Nhập mã OTP từ email.");
        return;
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          register_method: "email",
          name,
          email,
          password: regPassword,
          otp_token: regOtpToken,
          otp_code: regOtp.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setFieldError(result.message || "Đăng ký thất bại.");
        return;
      }
      showAlert("ok", result.message || "Đăng ký thành công!");
      notifyAuthChanged();
      window.setTimeout(() => router.replace(nextDest), 800);
    } finally {
      setBusy(false);
    }
  }

  const googleHref = `/api/auth/google?next=${encodeURIComponent(nextDest)}`;

  return (
    <main className="auth-route">
      <div className="auth-glass">
        <div className="auth-forms">
          {panel === "login" ? (
          <div className="auth-panel" aria-hidden={false}>
            {loginSubview === "login" ? (
              <>
            <h1 className="auth-title">Chào mừng bạn trở lại Beego</h1>
            <p className="auth-subtitle">Đăng nhập beego.vn — học tiếng Anh bằng AI</p>

            {alert.text ? (
              <div className={alert.type === "ok" ? "auth-alert auth-alert--ok" : "auth-alert"}>{alert.text}</div>
            ) : null}

            <div className="auth-method-tabs" role="tablist" aria-label="Phương thức đăng nhập">
              <button
                type="button"
                role="tab"
                aria-selected={loginMethod === "phone"}
                className={`auth-method-tab ${loginMethod === "phone" ? "is-active" : ""}`}
                onClick={() => switchLoginMethod("phone")}
              >
                Số điện thoại
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={loginMethod === "email"}
                className={`auth-method-tab ${loginMethod === "email" ? "is-active" : ""}`}
                onClick={() => switchLoginMethod("email")}
              >
                Email / Gmail
              </button>
            </div>

            <form onSubmit={handleLogin}>
              {loginMethod === "phone" ? (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="login-phone">
                    Số điện thoại
                  </label>
                  <div className="auth-input-wrap">
                    <input
                      id="login-phone"
                      className={`auth-input ${fieldError && panel === "login" && loginSubview === "login" ? "auth-input--error" : ""}`}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0xxxxxxxxx"
                      value={loginPhone}
                      onChange={(e) => {
                        setLoginPhone(e.target.value);
                        setFieldError("");
                      }}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="login-email">
                    Email / Gmail
                  </label>
                  <div className="auth-input-wrap">
                    <input
                      id="login-email"
                      className={`auth-input ${fieldError && panel === "login" && loginSubview === "login" ? "auth-input--error" : ""}`}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="tenban@gmail.com"
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        setFieldError("");
                      }}
                      required
                    />
                  </div>
                </div>
              )}
              <div className="auth-field">
                <label className="auth-label" htmlFor="login-pw">
                  Mật khẩu
                </label>
                <div className="auth-input-wrap">
                  <input
                    id="login-pw"
                    className="auth-input"
                    type={showPwLogin ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pw"
                    onClick={() => setShowPwLogin((v) => !v)}
                    aria-label={showPwLogin ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPwLogin ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </div>
              {fieldError && panel === "login" && loginSubview === "login" ? (
                <p className="auth-hint">{fieldError}</p>
              ) : null}

              <button type="submit" className="auth-btn-primary" disabled={busy}>
                Đăng nhập
              </button>

              <p className="auth-forgot-row">
                <button type="button" className="auth-link" onClick={openForgotPassword}>
                  Quên mật khẩu?
                </button>
              </p>
            </form>

            <div className="auth-divider">hoặc</div>
            <a href={googleHref} className="auth-social" style={{ textDecoration: "none" }}>
              <GoogleIcon />
              Tiếp tục với Google
            </a>

            <p className="auth-footer">
              Chưa có tài khoản?{" "}
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setPanel("register");
                  setFieldError("");
                  showAlert("", "");
                }}
              >
                Đăng ký
              </button>
            </p>
              </>
            ) : (
              <>
            <h1 className="auth-title">Quên mật khẩu</h1>
            <p className="auth-subtitle">Nhận mã OTP để đặt lại mật khẩu</p>

            {alert.text ? (
              <div className={alert.type === "ok" ? "auth-alert auth-alert--ok" : "auth-alert"}>{alert.text}</div>
            ) : null}

            <div className="auth-method-tabs" role="tablist" aria-label="Xác minh tài khoản">
              <button
                type="button"
                role="tab"
                aria-selected={forgotMethod === "phone"}
                className={`auth-method-tab ${forgotMethod === "phone" ? "is-active" : ""}`}
                onClick={() => {
                  setForgotMethod("phone");
                  setFieldError("");
                  resetForgotForm();
                }}
                disabled={forgotStep === 2}
              >
                Số điện thoại
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={forgotMethod === "email"}
                className={`auth-method-tab ${forgotMethod === "email" ? "is-active" : ""}`}
                onClick={() => {
                  setForgotMethod("email");
                  setFieldError("");
                  resetForgotForm();
                }}
                disabled={forgotStep === 2}
              >
                Email / Gmail
              </button>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotSendOtp}>
                {forgotMethod === "phone" ? (
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="forgot-phone">
                      Số điện thoại đã đăng ký
                    </label>
                    <input
                      id="forgot-phone"
                      className="auth-input"
                      style={{ paddingRight: "0.85rem" }}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0xxxxxxxxx"
                      value={forgotPhone}
                      onChange={(e) => {
                        setForgotPhone(e.target.value);
                        setFieldError("");
                      }}
                      required
                    />
                  </div>
                ) : (
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="forgot-email">
                      Email đã đăng ký
                    </label>
                    <input
                      id="forgot-email"
                      className="auth-input"
                      style={{ paddingRight: "0.85rem" }}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="tenban@gmail.com"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setFieldError("");
                      }}
                      required
                    />
                  </div>
                )}
                {fieldError && panel === "login" && loginSubview === "forgot" ? (
                  <p className="auth-hint">{fieldError}</p>
                ) : null}
                <button type="submit" className="auth-btn-primary" disabled={otpSending}>
                  {otpSending ? "Đang gửi…" : "Gửi mã OTP"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotReset}>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="forgot-otp">
                    Mã OTP
                  </label>
                  <input
                    id="forgot-otp"
                    className="auth-input"
                    style={{ paddingRight: "0.85rem" }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6 chữ số"
                    value={forgotOtp}
                    onChange={(e) => {
                      setForgotOtp(e.target.value);
                      setFieldError("");
                    }}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="forgot-pw">
                    Mật khẩu mới
                  </label>
                  <div className="auth-input-wrap">
                    <input
                      id="forgot-pw"
                      className="auth-input"
                      type={showPwForgot ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Tối thiểu 6 ký tự"
                      value={forgotPassword}
                      onChange={(e) => setForgotPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="auth-toggle-pw"
                      onClick={() => setShowPwForgot((v) => !v)}
                      aria-label={showPwForgot ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPwForgot ? "Ẩn" : "Hiện"}
                    </button>
                  </div>
                </div>
                <div className="auth-field">
                  <label className="auth-label" htmlFor="forgot-pw-confirm">
                    Xác nhận mật khẩu
                  </label>
                  <div className="auth-input-wrap">
                    <input
                      id="forgot-pw-confirm"
                      className="auth-input"
                      type={showPwForgotConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu"
                      value={forgotPasswordConfirm}
                      onChange={(e) => setForgotPasswordConfirm(e.target.value)}
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      className="auth-toggle-pw"
                      onClick={() => setShowPwForgotConfirm((v) => !v)}
                      aria-label={showPwForgotConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPwForgotConfirm ? "Ẩn" : "Hiện"}
                    </button>
                  </div>
                </div>
                {fieldError && panel === "login" && loginSubview === "forgot" ? (
                  <p className="auth-hint">{fieldError}</p>
                ) : null}
                <button type="submit" className="auth-btn-primary" disabled={busy}>
                  Đặt lại mật khẩu
                </button>
                <p className="auth-forgot-row">
                  <button
                    type="button"
                    className="auth-link"
                    onClick={() => {
                      resetForgotForm();
                      setFieldError("");
                      showAlert("", "");
                    }}
                  >
                    Gửi lại mã OTP
                  </button>
                </p>
              </form>
            )}

            <p className="auth-footer">
              <button type="button" className="auth-link" onClick={backToLogin}>
                ← Quay lại đăng nhập
              </button>
            </p>
              </>
            )}
          </div>
          ) : (
          <div className="auth-panel" aria-hidden={false}>
            <h1 className="auth-title">Tham gia Beego</h1>
            <p className="auth-subtitle">Chọn cách đăng ký phù hợp với bạn</p>

            {alert.text ? (
              <div className={alert.type === "ok" ? "auth-alert auth-alert--ok" : "auth-alert"}>{alert.text}</div>
            ) : null}

            <div className="auth-method-tabs" role="tablist" aria-label="Phương thức đăng ký">
              <button
                type="button"
                role="tab"
                aria-selected={regMethod === "phone"}
                className={`auth-method-tab ${regMethod === "phone" ? "is-active" : ""}`}
                onClick={() => switchRegMethod("phone")}
              >
                Số điện thoại
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={regMethod === "email"}
                className={`auth-method-tab ${regMethod === "email" ? "is-active" : ""}`}
                onClick={() => switchRegMethod("email")}
              >
                Email / Gmail
              </button>
            </div>

            <form onSubmit={handleRegister}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="reg-name">
                  Họ tên <span style={{ color: "#fda4af" }}>*</span>
                </label>
                <input
                  id="reg-name"
                  className="auth-input"
                  style={{ paddingRight: "0.85rem" }}
                  type="text"
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                />
              </div>

              {regMethod === "phone" ? (
                <>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-phone">
                      Số điện thoại <span style={{ color: "#fda4af" }}>*</span>
                    </label>
                    <input
                      id="reg-phone"
                      className="auth-input"
                      style={{ paddingRight: "0.85rem" }}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0xxxxxxxxx hoặc +84xxxxxxxxx"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-pw-phone">
                      Mật khẩu
                    </label>
                    <div className="auth-input-wrap">
                      <input
                        id="reg-pw-phone"
                        className="auth-input"
                        type={showPwReg ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Tối thiểu 6 ký tự"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pw"
                        onClick={() => setShowPwReg((v) => !v)}
                        aria-label={showPwReg ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPwReg ? "Ẩn" : "Hiện"}
                      </button>
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-pw-confirm">
                      Xác nhận mật khẩu
                    </label>
                    <div className="auth-input-wrap">
                      <input
                        id="reg-pw-confirm"
                        className="auth-input"
                        type={showPwRegConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Nhập lại mật khẩu"
                        value={regPasswordConfirm}
                        onChange={(e) => setRegPasswordConfirm(e.target.value)}
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pw"
                        onClick={() => setShowPwRegConfirm((v) => !v)}
                        aria-label={showPwRegConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPwRegConfirm ? "Ẩn" : "Hiện"}
                      </button>
                    </div>
                  </div>
                  <p className="auth-hint">SĐT sẽ được lưu dạng +84. Không cần OTP email.</p>
                </>
              ) : (
                <>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-email">
                      Email <span style={{ color: "#fda4af" }}>*</span>
                    </label>
                    <input
                      id="reg-email"
                      className="auth-input"
                      style={{ paddingRight: "0.85rem" }}
                      type="email"
                      autoComplete="email"
                      placeholder="you@email.com"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        resetRegisterOtp();
                      }}
                      required
                    />
                  </div>

                  {!regConfig.smtp_configured ? (
                    <p className="auth-hint" style={{ color: "#fda4af" }}>
                      Chưa cấu hình SMTP trên server — không thể gửi OTP email. Liên hệ admin.
                    </p>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="auth-btn-otp"
                        onClick={handleSendOtp}
                        disabled={busy || otpSending}
                        aria-busy={otpSending}
                      >
                        <span className="auth-btn-otp-inner">
                          {otpSending ? <span className="auth-spinner" aria-hidden /> : null}
                          {otpSending ? "Đang gửi…" : "Gửi mã OTP đến email"}
                        </span>
                      </button>

                      {regOtpToken ? (
                        <p className="auth-hint">Đã gửi OTP. Kiểm tra hộp thư rồi nhập mã bên dưới.</p>
                      ) : (
                        <p className="auth-hint">Bấm nút trên để nhận mã OTP trước khi đặt mật khẩu.</p>
                      )}

                      <div className="auth-field">
                        <label className="auth-label" htmlFor="reg-otp">
                          Mã OTP
                        </label>
                        <input
                          id="reg-otp"
                          className="auth-input"
                          style={{ paddingRight: "0.85rem" }}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={8}
                          placeholder="6 chữ số"
                          value={regOtp}
                          onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ""))}
                          disabled={!regOtpToken}
                        />
                      </div>
                    </>
                  )}

                  <div className="auth-field">
                    <label className="auth-label" htmlFor="reg-pw-email">
                      Mật khẩu
                    </label>
                    <div className="auth-input-wrap">
                      <input
                        id="reg-pw-email"
                        className="auth-input"
                        type={showPwReg ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Tối thiểu 6 ký tự"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        minLength={6}
                        disabled={regMethod === "email" && !regConfig.smtp_configured}
                        required
                      />
                      <button
                        type="button"
                        className="auth-toggle-pw"
                        onClick={() => setShowPwReg((v) => !v)}
                        disabled={regMethod === "email" && !regConfig.smtp_configured}
                        aria-label={showPwReg ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        {showPwReg ? "Ẩn" : "Hiện"}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {fieldError ? <p className="auth-hint">{fieldError}</p> : null}

              <button
                type="submit"
                className="auth-btn-primary"
                disabled={
                  busy ||
                  otpSending ||
                  (regMethod === "email" && (!regConfig.smtp_configured || !regOtpToken))
                }
              >
                Hoàn tất đăng ký
              </button>
            </form>

            <div className="auth-divider">hoặc</div>
            <a href={googleHref} className="auth-social" style={{ textDecoration: "none" }}>
              <GoogleIcon />
              Tiếp tục với Google
            </a>

            <p className="auth-footer">
              Đã có tài khoản?{" "}
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setPanel("login");
                  setFieldError("");
                  showAlert("", "");
                }}
              >
                Đăng nhập
              </button>
            </p>
          </div>
          )}
        </div>
      </div>
    </main>
  );
}
