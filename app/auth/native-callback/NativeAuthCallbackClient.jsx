"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { saveAppTokens, isNativeApp } from "@/lib/beego/native-bridge";
import { notifyAuthChanged } from "@/hooks/useAuthMe";

/**
 * Android App Link landing after Google OAuth.
 * Exchanges one-time ?code= for Bearer tokens, stores securely, then goes home.
 */
export default function NativeAuthCallbackPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Đang hoàn tất đăng nhập…");

  useEffect(() => {
    const code = params.get("code");
    const err = params.get("notice") || params.get("error");
    if (err) {
      setStatus("Đăng nhập Google thất bại. Quay lại…");
      const t = setTimeout(() => router.replace(`/auth?notice=${encodeURIComponent(err)}`), 1200);
      return () => clearTimeout(t);
    }
    if (!code) {
      setStatus("Thiếu mã đăng nhập.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/native-exchange", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) {
          throw new Error(json.message || "exchange_failed");
        }
        await saveAppTokens(json.data.access_token, json.data.refresh_token);
        notifyAuthChanged();
        if (!cancelled) {
          setStatus("Đăng nhập thành công!");
          const next = params.get("next") || "/";
          const dest = next.startsWith("/") && !next.startsWith("/auth") ? next : "/";
          setTimeout(() => {
            if (isNativeApp()) {
              window.location.replace(dest);
            } else {
              router.replace(dest);
            }
          }, 400);
        }
      } catch {
        if (!cancelled) {
          setStatus("Không thể hoàn tất đăng nhập.");
          setTimeout(() => router.replace("/auth?notice=google_token"), 1500);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, router]);

  return (
    <main style={{ padding: "48px 24px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Beego</h1>
      <p>{status}</p>
    </main>
  );
}
