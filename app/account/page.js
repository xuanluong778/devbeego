"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AccountModal from "@/components/account/AccountModal";
import ServicePackagesModal from "@/components/billing/ServicePackagesModal";
import BigCTAButton from "@/components/beego/ui/BigCTAButton";
import LearningCard from "@/components/beego/ui/LearningCard";
import { readOnboardingProfile, BEEGO_PURPOSES, BEEGO_LEVELS, BEEGO_DAILY_MINUTES } from "@/lib/beego/onboarding-storage";
import { useAuthMe } from "@/hooks/useAuthMe";

export default function AccountPage() {
  const router = useRouter();
  const { user, hideBillingUi, loading } = useAuthMe();
  const avatarInputRef = useRef(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    setProfile(readOnboardingProfile());
    const onOb = () => setProfile(readOnboardingProfile());
    window.addEventListener("beego:onboarding", onOb);
    return () => window.removeEventListener("beego:onboarding", onOb);
  }, []);

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* ignore */
    }
    router.push("/auth");
  }

  const purposeLabel = BEEGO_PURPOSES.find((p) => p.id === profile?.purpose)?.label;
  const levelLabel = BEEGO_LEVELS.find((l) => l.id === profile?.level)?.label;
  const minutesLabel = BEEGO_DAILY_MINUTES.find((m) => m.id === profile?.dailyMinutes)?.label;

  if (loading) {
    return (
      <div className="beego-page">
        <p style={{ fontWeight: 700 }}>Đang tải…</p>
      </div>
    );
  }

  return (
    <div className="beego-page">
      <section className="beego-page-hero" style={{ textAlign: "left", padding: "8px 0 20px" }}>
        <h1 style={{ textAlign: "left" }}>Tài khoản</h1>
        <p style={{ textAlign: "left" }}>Quản lý hồ sơ, gói học và mục tiêu — đơn giản, một chạm.</p>
      </section>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 20,
          borderRadius: 24,
          background: "var(--beego-surface)",
          border: "1px solid var(--beego-border)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: "var(--beego-honey-soft)",
            display: "grid",
            placeItems: "center",
            fontSize: "1.8rem",
            fontWeight: 900,
            color: "var(--beego-ink)",
            overflow: "hidden",
          }}
        >
          {user?.avatar_url ? (
            <img src={String(user.avatar_url)} alt="" width={64} height={64} style={{ objectFit: "cover" }} />
          ) : (
            (String(user?.name || user?.email || "?").trim()[0] || "?").toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: "1.1rem" }}>
            {user?.name || user?.email || "Khách"}
          </strong>
          <span style={{ color: "var(--beego-ink-soft)", fontWeight: 600, fontSize: "0.9rem" }}>
            {user
              ? hideBillingUi
                ? "Tài khoản quản trị"
                : `Gói: ${user.plan || "free"}`
              : "Chưa đăng nhập"}
          </span>
        </div>
      </div>

      {profile ? (
        <div style={{ padding: 16, borderRadius: 20, background: "var(--beego-blue-soft)", marginBottom: 16, fontWeight: 600, color: "var(--beego-ink-soft)" }}>
          Mục tiêu: <strong style={{ color: "var(--beego-ink)" }}>{purposeLabel}</strong>
          {levelLabel ? ` · ${levelLabel}` : ""}
          {minutesLabel ? ` · ${minutesLabel}/ngày` : ""}
        </div>
      ) : null}

      <div className="beego-grid-2">
        {user ? (
          <BigCTAButton variant="secondary" onClick={() => setAccountOpen(true)}>
            Sửa hồ sơ
          </BigCTAButton>
        ) : (
          <BigCTAButton href="/auth">Đăng nhập</BigCTAButton>
        )}
        {!hideBillingUi ? (
          <BigCTAButton variant="secondary" onClick={() => setPackagesOpen(true)}>
            Nâng cấp gói
          </BigCTAButton>
        ) : null}
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {user ? (
          <LearningCard href="/dashboard" icon="📊" title="Dashboard của tôi" description="Lộ trình hôm nay, streak, gói học" />
        ) : null}
        {user?.role === "admin" || user?.is_admin ? (
          <LearningCard href="/admin" icon="⚙️" title="Admin Dashboard" description="Quản trị người dùng, gói học, thanh toán" />
        ) : null}
        <LearningCard href="/onboarding" icon="🎯" title="Đổi mục tiêu học" description="Chọn lại mục tiêu, trình độ, thời gian" />
        <LearningCard href="/kids" icon="🐝" title="Beego Kids" description="Chuyển sang học cho trẻ em" />
      </div>

      {user ? (
        <div style={{ marginTop: 20 }}>
          <BigCTAButton variant="secondary" onClick={() => void logout()}>
            Đăng xuất
          </BigCTAButton>
        </div>
      ) : null}

      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} user={user} />
      {!hideBillingUi ? (
        <ServicePackagesModal
          open={packagesOpen}
          onClose={() => setPackagesOpen(false)}
          userPlan={user?.plan || "expired"}
          source="account_page"
        />
      ) : null}
      <input ref={avatarInputRef} type="file" hidden aria-hidden tabIndex={-1} />
    </div>
  );
}
