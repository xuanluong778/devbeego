"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthMe } from "@/hooks/useAuthMe";
import styles from "./TrialCountdown.module.css";

const REFRESH_MS = 60 * 1000;

/** Whole days left until ISO end (matches server `getTrialDaysRemaining` style). */
function computeDaysRemaining(endAtIso) {
  const end = new Date(endAtIso).getTime();
  const now = Date.now();
  if (!Number.isFinite(end)) return null;
  if (end <= now) return 0;
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

/**
 * Trial countdown for logged-in users on an active trial.
 * Refreshes computed days on an interval so the number updates when the day rolls over.
 */
/**
 * @param {{ placement?: "default" | "corner" }} props
 * `corner`: hiển thị dưới nút Nâng cấp (góc phải trên).
 */
export default function TrialCountdown({ placement = "default" }) {
  const { hideBillingUi } = useAuthMe();
  const [trialEndAt, setTrialEndAt] = useState(null);
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  const loadTrial = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.success || json.data?.hide_billing_ui || !json.data?.trial?.end_at) {
        setTrialEndAt(null);
        return;
      }
      setTrialEndAt(json.data.trial.end_at);
    } catch {
      setTrialEndAt(null);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    void loadTrial();
  }, [loadTrial]);

  useEffect(() => {
    if (!mounted) return;
    const id = window.setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void loadTrial();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [mounted, loadTrial]);

  const daysLeft = useMemo(() => {
    if (!trialEndAt) return null;
    return computeDaysRemaining(trialEndAt);
  }, [trialEndAt, tick]);

  if (hideBillingUi || !mounted || daysLeft == null || daysLeft <= 0) return null;

  const urgent = daysLeft < 3;
  const dayPhrase = `${daysLeft} ngày`;

  const isCorner = placement === "corner";

  return (
    <div
      className={isCorner ? styles.wrapCorner : styles.wrap}
      role="status"
      aria-live="polite"
    >
      <div
        className={`${styles.banner} ${isCorner ? styles.bannerCorner : ""} ${urgent ? styles.warning : ""}`}
      >
        <span className={styles.icon} aria-hidden>
          {urgent ? "⚠️" : "🎁"}
        </span>
        <span>
          Dùng thử miễn phí <span className={styles.bannerStrong}>15 ngày</span>: còn{" "}
          <span className={styles.bannerStrong}>{dayPhrase}</span>
          {urgent ? " — sắp hết hạn, nâng cấp để giữ đầy đủ quyền dùng AI." : ""}
        </span>
      </div>
    </div>
  );
}
