"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ServicePackagesModal from "@/components/billing/ServicePackagesModal";
import { useAuthMe } from "@/hooks/useAuthMe";
import styles from "./UpgradeMenu.module.css";

export default function UpgradeMenu() {
  const { hideBillingUi } = useAuthMe();
  const [open, setOpen] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [planState, setPlanState] = useState(null);

  const loadPlan = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setPlanState(null);
        return;
      }
      setPlanState(json.data?.plan || "expired");
    } catch {
      setPlanState(null);
    }
  }, []);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (hideBillingUi) return null;

  return (
    <div className={styles.wrap}>
      <button
        ref={btnRef}
        type="button"
        className={styles.button}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className={styles.label}>Nâng cấp tài khoản</span>
        <span className={styles.caret} aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div ref={menuRef} className={styles.menu} role="menu">
          <button
            type="button"
            className={styles.item}
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setPackagesOpen(true);
              void loadPlan();
            }}
          >
            Xem gói Pro / VIP (tháng · năm)
          </button>
        </div>
      )}

      <ServicePackagesModal
        open={packagesOpen}
        onClose={() => setPackagesOpen(false)}
        userPlan={planState || "expired"}
        source="header_upgrade_menu"
      />
    </div>
  );
}
