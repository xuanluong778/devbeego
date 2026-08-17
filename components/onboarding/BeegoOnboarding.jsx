"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BEEGO_BRAND } from "@/lib/beego/brand";
import Stepper from "@/components/beego/ui/Stepper";
import BigCTAButton from "@/components/beego/ui/BigCTAButton";
import {
  BEEGO_PURPOSES,
  BEEGO_LEVELS,
  BEEGO_DAILY_MINUTES,
  saveOnboardingProfile,
} from "@/lib/beego/onboarding-storage";

export default function BeegoOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState("communicate");
  const [level, setLevel] = useState("medium");
  const [dailyMinutes, setDailyMinutes] = useState(10);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    document.body.classList.add("page-onboarding");
    return () => document.body.classList.remove("page-onboarding");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json.success && json.data?.id) {
          setUserId(json.data.id);
        }
      } catch {
        /* guest ok */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = () => {
    saveOnboardingProfile({ purpose, level, dailyMinutes, userId });
    router.push("/");
  };

  const next = () => {
    if (step < 2) setStep((s) => s + 1);
    else finish();
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="beego-onboarding" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="beego-page" style={{ maxWidth: 640, width: "100%" }}>
        <div style={{ background: "var(--beego-surface)", borderRadius: 24, padding: "clamp(20px,4vw,32px)", border: "1px solid var(--beego-border)", boxShadow: "var(--beego-shadow)" }}>
          <div className="beego-onboarding-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="beego-mascot" aria-hidden>
                🐝
              </span>
              <div>
                <strong style={{ fontFamily: "var(--font-heading), Oswald, sans-serif", fontSize: "1.1rem" }}>
                  {BEEGO_BRAND.name}
                </strong>
                <div style={{ fontSize: "0.75rem", color: "var(--beego-muted)", fontWeight: 700 }}>{BEEGO_BRAND.domain}</div>
              </div>
            </div>
            <Link href="/" className="beego-onboarding-home-link" aria-label="Về trang chủ">
              <span aria-hidden>🏠</span>
              Trang chủ
            </Link>
          </div>

          <Stepper total={3} current={step} />

          {step === 0 ? (
            <>
              <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading), Oswald, sans-serif", fontSize: "clamp(1.3rem,3vw,1.7rem)" }}>
                Mục tiêu học của bạn?
              </h1>
              <p style={{ margin: "0 0 20px", color: "var(--beego-ink-soft)", fontWeight: 600 }}>
                Chọn một mục tiêu — Beego sẽ gợi ý bài học phù hợp.
              </p>
              <div className="beego-pick-grid beego-pick-grid--2">
                {BEEGO_PURPOSES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`beego-pick-card ${purpose === p.id ? "beego-pick-card--selected" : ""}`}
                    onClick={() => setPurpose(p.id)}
                    aria-pressed={purpose === p.id}
                  >
                    <span className="beego-pick-card-icon" aria-hidden>
                      {p.icon}
                    </span>
                    <span>
                      <strong>{p.label}</strong>
                      <span>{p.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading), Oswald, sans-serif", fontSize: "clamp(1.3rem,3vw,1.7rem)" }}>
                Trình độ hiện tại?
              </h1>
              <p style={{ margin: "0 0 20px", color: "var(--beego-ink-soft)", fontWeight: 600 }}>
                Không lo sai — bạn có thể đổi sau trong Tài khoản.
              </p>
              <div className="beego-pick-grid">
                {BEEGO_LEVELS.map((lv) => (
                  <button
                    key={lv.id}
                    type="button"
                    className={`beego-pick-card ${level === lv.id ? "beego-pick-card--selected" : ""}`}
                    onClick={() => setLevel(lv.id)}
                    aria-pressed={level === lv.id}
                  >
                    <span>
                      <strong>{lv.label}</strong>
                      <span>{lv.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading), Oswald, sans-serif", fontSize: "clamp(1.3rem,3vw,1.7rem)" }}>
                Học mỗi ngày bao lâu?
              </h1>
              <p style={{ margin: "0 0 20px", color: "var(--beego-ink-soft)", fontWeight: 600 }}>
                Beego nhắc nhẹ nhàng — ít phút mỗi ngày vẫn tiến bộ.
              </p>
              <div className="beego-pick-grid beego-pick-grid--2">
                {BEEGO_DAILY_MINUTES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`beego-pick-card ${dailyMinutes === m.id ? "beego-pick-card--selected" : ""}`}
                    onClick={() => setDailyMinutes(m.id)}
                    aria-pressed={dailyMinutes === m.id}
                  >
                    <span>
                      <strong>{m.label}</strong>
                      <span>{m.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
            {step > 0 ? (
              <BigCTAButton variant="secondary" onClick={back}>
                Quay lại
              </BigCTAButton>
            ) : (
              <BigCTAButton variant="secondary" href="/">
                Bỏ qua
              </BigCTAButton>
            )}
            <BigCTAButton onClick={next} ariaLabel={step < 2 ? "Tiếp tục" : "Bắt đầu học"}>
              {step < 2 ? "Tiếp tục" : "Bắt đầu học"}
            </BigCTAButton>
          </div>
        </div>
      </div>
    </div>
  );
}
