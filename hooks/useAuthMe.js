"use client";

import { useCallback, useEffect, useState } from "react";
import { isAdminSessionUser, shouldHideBillingUi } from "@/lib/auth/admin-user-client";

export const AUTH_EVENT = "apptienganh-auth";

export function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT));
  }
}

/**
 * Current user from /api/auth/me.
 * @returns {{ user: object|null, loading: boolean, isAdmin: boolean, hideBillingUi: boolean, recheck: Function }}
 */
export function useAuthMe() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const recheck = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        setUser(json.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
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

  const isAdmin = isAdminSessionUser(user);
  const hideBillingUi = shouldHideBillingUi(user);

  return { user, loading, isAdmin, hideBillingUi, recheck };
}
