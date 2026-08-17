"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthMe } from "@/hooks/useAuthMe";
import styles from "./HeaderProfile.module.css";

function planBadgeClass(plan) {
  if (plan === "vip") return styles.planBadgeVip;
  if (plan === "pro") return styles.planBadgePro;
  if (plan === "trial") return styles.planBadgeTrial;
  return styles.planBadgeFree;
}

function planLabelVi(plan) {
  if (plan === "vip") return "VIP";
  if (plan === "pro") return "Pro";
  if (plan === "trial") return "Dùng thử";
  return "Free";
}

export default function HeaderProfile() {
  const router = useRouter();
  const { user, hideBillingUi, recheck, loading } = useAuthMe();
  const fileRef = useRef(null);
  const [dob, setDob] = useState("");
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) {
      setDob("");
      return;
    }
    if (user.date_of_birth) {
      const raw = user.date_of_birth;
      const s = typeof raw === "string" ? raw.slice(0, 10) : "";
      setDob(s);
    } else {
      setDob("");
    }
  }, [user]);

  async function saveDob() {
    if (!user) return;
    setMsg("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ date_of_birth: dob || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setMsg(json.message || "Không lưu được.");
        return;
      }
      setMsg("Đã lưu ngày sinh.");
      await recheck();
      router.refresh();
    } catch {
      setMsg("Lỗi mạng.");
    }
  }

  async function onAvatar(ev) {
    const f = ev.target?.files?.[0];
    if (!f || !user) return;
    setUploading(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/auth/profile/avatar", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setMsg(json.message || "Không tải được ảnh.");
        return;
      }
      await recheck();
      setMsg("Đã cập nhật ảnh.");
      router.refresh();
    } catch {
      setMsg("Lỗi mạng.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    router.refresh();
    window.location.href = "/auth";
  }

  if (loading) {
    return (
      <div className={styles.wrap} aria-busy="true">
        <span className={styles.email}>…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.wrap}>
        <Link href="/auth" className={styles.loginLink}>
          Đăng nhập
        </Link>
      </div>
    );
  }

  const plan = user.plan || "expired";
  const avatarSrc = user.avatar_url ? String(user.avatar_url) : "";

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div>
          <button
            type="button"
            className={styles.avatarBtn}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Đổi ảnh đại diện"
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt="" width={48} height={48} />
            ) : (
              <span className={styles.avatarHint}>Ảnh</span>
            )}
          </button>
          <input
            ref={fileRef}
            className={styles.hiddenFile}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onAvatar}
          />
        </div>
        <div className={styles.meta}>
          <p className={styles.name}>{user.name || "Học viên"}</p>
          <p className={styles.email}>{user.email || user.phone || ""}</p>
          {!hideBillingUi ? (
            <div className={styles.planRow}>
              <span className={`${styles.planBadge} ${planBadgeClass(plan)}`}>
                Gói: {planLabelVi(plan)}
              </span>
            </div>
          ) : (
            <div className={styles.planRow}>
              <span className={`${styles.planBadge} ${styles.planBadgeVip}`}>Admin</span>
            </div>
          )}
          <div className={styles.dobRow}>
            <span className={styles.dobLabel}>Sinh:</span>
            <input
              className={styles.dobInput}
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
            <button type="button" className={styles.saveDob} onClick={() => void saveDob()}>
              Lưu
            </button>
          </div>
          <button type="button" className={styles.logout} onClick={() => void logout()}>
            Đăng xuất
          </button>
          {msg ? (
            <p className={`${styles.msg} ${msg.includes("Không") || msg.includes("Lỗi") ? styles.err : ""}`}>
              {msg}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
