"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getLessonPlayerPath } from "@/lib/beego/lesson-player";
import { LEARNING_PATH_UPDATED_EVENT } from "@/lib/beego/learn/complete-lesson-client";
import { readOnboardingProfile } from "@/lib/beego/onboarding-storage";

const SLOT_ICONS = ["①", "②", "③"];

/**
 * Compact "Dành cho bạn hôm nay" card — max 3 CTAs reusing lesson player hrefs.
 */
export default function TodayForYouCard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const profile = readOnboardingProfile() || {};
      const params = new URLSearchParams();
      if (profile.purpose) params.set("purpose", String(profile.purpose));
      if (profile.focus || profile.skillFocus) {
        params.set("focus", String(profile.focus || profile.skillFocus));
      }
      const mins = profile.dailyMinutes || profile.timePerDay || profile.daily_minutes;
      if (mins) params.set("dailyMinutes", String(mins));
      params.set("refresh", "1");

      const qs = params.toString();
      const res = await fetch(`/api/learn/recommendations${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setItems([]);
        return;
      }
      setGuest(Boolean(json.data?.guest));
      setItems(Array.isArray(json.data?.recommendations) ? json.data.recommendations.slice(0, 3) : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdated = () => {
      void refresh();
    };
    window.addEventListener(LEARNING_PATH_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(LEARNING_PATH_UPDATED_EVENT, onUpdated);
  }, [refresh]);

  if (guest || (!loading && items.length === 0)) return null;

  return (
    <section className="beego-today-for-you" id="beego-today-for-you" aria-label="Đề xuất hôm nay">
      <header className="beego-today-for-you__head">
        <h2 className="beego-today-for-you__title">Dành cho bạn hôm nay</h2>
        <p className="beego-today-for-you__sub">Đề xuất dựa trên tiến độ, mastery và ôn tập</p>
      </header>

      {loading ? (
        <p className="beego-today-for-you__loading">Đang tải đề xuất…</p>
      ) : (
        <ul className="beego-today-for-you__list">
          {items.map((rec, idx) => {
            const href =
              rec.href || (rec.lessonId ? getLessonPlayerPath(rec.lessonId) : null);
            if (!href) return null;
            return (
              <li key={`${rec.type}-${rec.lessonId || href}-${idx}`} className="beego-today-for-you__item">
                <div className="beego-today-for-you__meta">
                  <span className="beego-today-for-you__slot">
                    {SLOT_ICONS[idx] || `${idx + 1}`} {rec.slotLabel || ""}
                  </span>
                  <strong className="beego-today-for-you__name">{rec.title || rec.type}</strong>
                  <span className="beego-today-for-you__reason">{rec.reasonText}</span>
                  <span className="beego-today-for-you__mins">~{rec.estimatedMinutes} phút</span>
                </div>
                <Link className="beego-today-for-you__cta" href={href}>
                  {idx === 0 ? "Học ngay" : idx === 2 ? "Thử thách" : "Luyện ngay"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
