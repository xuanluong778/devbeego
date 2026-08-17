"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import ServicePackagesModal from "@/components/billing/ServicePackagesModal";
import AccountModal from "@/components/account/AccountModal";
import { useAuthMe } from "@/hooks/useAuthMe";
import styles from "./BottomAccountDock.module.css";

function IconAccount() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h4a2 2 0 012 2v4M9 3H5a2 2 0 00-2 2v4M15 21h4a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4" />
      <path d="M12 8l4 4-4 4M8 12h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPackage() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mũi tên nhỏ hướng lên — gợi ý menu mở phía trên */
function IconMenuHint({ open }) {
  return (
    <span className={`${styles.barChevron} ${open ? styles.barChevronOpen : ""}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </span>
  );
}

export default function BottomAccountDock() {
  const router = useRouter();
  const { user, hideBillingUi, recheck } = useAuthMe();
  const avatarInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => {
      void recheck();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [open, recheck]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    setOpen(false);
    setAccountOpen(false);
    setPackagesOpen(false);
    router.refresh();
    window.location.href = "/auth";
  }

  const loggedIn = Boolean(user?.id);
  const displayName = loggedIn
    ? String(user.name || user.email || "Học viên").toLowerCase()
    : "Đăng nhập";

  const userPlan = user?.plan || "expired";

  const onAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !loggedIn) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/auth/profile/avatar", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        window.alert(json.message || "Không tải được ảnh. Thử ảnh nhỏ hơn (tối đa 2MB).");
        return;
      }
      if (json.data?.avatar_url) {
        await recheck();
      }
      router.refresh();
    } catch {
      window.alert("Không tải được ảnh. Kiểm tra mạng và thử lại.");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className={styles.dock} data-app-bottom-dock>
      {open && (
        <div
          className={styles.backdrop}
          role="presentation"
          onMouseDown={() => setOpen(false)}
        />
      )}

      {open && (
        <div className={styles.popover} role="menu" onMouseDown={(e) => e.stopPropagation()}>
          <span className={styles.caret} aria-hidden />
          {loggedIn ? (
            <>
              <button
                type="button"
                className={styles.menuBtn}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setAccountOpen(true);
                }}
              >
                <IconAccount />
                Tài khoản
              </button>
              <button
                type="button"
                className={styles.menuBtn}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  router.push("/dashboard#lich-su");
                }}
              >
                <IconAccount />
                Lịch sử
                <span className={styles.menuBtnChevron}>›</span>
              </button>
              {!hideBillingUi ? (
                <button
                  type="button"
                  className={`${styles.menuBtn} ${styles.menuBtnHighlight}`}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setPackagesOpen(true);
                    void recheck();
                  }}
                >
                  <IconPackage />
                  Gói dịch vụ
                  <span className={styles.menuBtnChevron}>›</span>
                </button>
              ) : null}
              <button type="button" className={`${styles.menuBtn} ${styles.logout}`} onClick={() => void logout()}>
                <IconAccount />
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={styles.menuBtn}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  router.push("/auth");
                }}
              >
                <IconAccount />
                Đăng nhập
              </button>
              {!hideBillingUi ? (
                <button
                  type="button"
                  className={`${styles.menuBtn} ${styles.menuBtnHighlight}`}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setPackagesOpen(true);
                  }}
                >
                  <IconPackage />
                  Gói dịch vụ
                  <span className={styles.menuBtnChevron}>›</span>
                </button>
              ) : null}
            </>
          )}
        </div>
      )}

      <div className={styles.barRow}>
        {loggedIn ? (
          <div className={styles.bar}>
            <input
              ref={avatarInputRef}
              type="file"
              className={styles.avatarFileInput}
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-hidden
              tabIndex={-1}
              onChange={onAvatarFile}
            />
            <button
              type="button"
              className={styles.avatarUploadBtn}
              title="Đổi ảnh đại diện"
              aria-label="Đổi ảnh đại diện"
              disabled={avatarUploading}
              onClick={() => avatarInputRef.current?.click()}
            >
              <span className={`${styles.avatar} ${avatarUploading ? styles.avatarUploading : ""}`}>
                {user?.avatar_url ? (
                  <img src={String(user.avatar_url)} alt="" width={36} height={36} />
                ) : (
                  (String(user?.name || user?.email || "?").trim()[0] || "?").toUpperCase()
                )}
              </span>
            </button>
            <button
              type="button"
              className={styles.barToggle}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
            >
              <span className={styles.barName}>{displayName}</span>
              <IconMenuHint open={open} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.bar}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            <span className={styles.avatar}>
              {(String(user?.name || user?.email || "?").trim()[0] || "?").toUpperCase()}
            </span>
            <span className={styles.barHint}>{displayName}</span>
            <IconMenuHint open={open} />
          </button>
        )}
      </div>

      {mounted
        ? createPortal(
            <>
              <AccountModal
                open={accountOpen}
                onClose={() => setAccountOpen(false)}
                user={user}
              />
              {!hideBillingUi ? (
                <ServicePackagesModal
                  open={packagesOpen}
                  onClose={() => setPackagesOpen(false)}
                  userPlan={userPlan}
                  source="bottom_dock_service_packages"
                />
              ) : null}
            </>,
            document.body
          )
        : null}
    </div>
  );
}
