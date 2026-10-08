"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTH_EVENT, notifyAuthChanged } from "@/hooks/useAuthMe";
import { authFetch } from "@/lib/beego/native-bridge";

export { notifyAuthChanged };

/**
 * null = đang kiểm tra; false = khách; true = đã đăng nhập.
 */
export function useAuthLoggedIn() {
  const [loggedIn, setLoggedIn] = useState(null);

  const recheck = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      setLoggedIn(res.ok && json.success && Boolean(json.data?.id));
    } catch {
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  useEffect(() => {
    const onAuth = () => void recheck();
    window.addEventListener(AUTH_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_EVENT, onAuth);
  }, [recheck]);

  return { loggedIn, recheck };
}
