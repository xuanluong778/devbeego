"use client";

import { useCallback, useEffect, useState } from "react";
import { LEARNING_PATH_UPDATED_EVENT } from "@/lib/beego/learn/complete-lesson-client";

/**
 * Compact "Thành tích" — unlocked badges + near-progress. No heavy redesign.
 */
export default function AchievementsCard({ onToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/learn/achievements?refresh=1", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setData(null);
        return;
      }
      setGuest(Boolean(json.data?.guest));
      setData(json.data);
      if (json.data?.newlyUnlocked?.length && typeof onToast === "function") {
        onToast(json.data.newlyUnlocked);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdated = (ev) => {
      const unlocked = ev?.detail?.achievements_unlocked;
      if (Array.isArray(unlocked) && unlocked.length && typeof onToast === "function") {
        onToast(unlocked);
      }
      void refresh();
    };
    window.addEventListener(LEARNING_PATH_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(LEARNING_PATH_UPDATED_EVENT, onUpdated);
  }, [refresh, onToast]);

  if (guest) return null;
  if (!loading && !data) return null;

  const unlocked = data?.unlocked || [];
  const inProgress = data?.inProgress || [];

  return (
    <section className="beego-achievements" id="beego-achievements" aria-label="Thành tích">
      <header className="beego-achievements__head">
        <h2 className="beego-achievements__title">Thành tích</h2>
        <p className="beego-achievements__sub">
          {loading
            ? "Đang tải…"
            : `${data?.unlockedCount || 0}/${data?.total || 0} đã mở`}
        </p>
      </header>

      {!loading ? (
        <>
          {unlocked.length > 0 ? (
            <ul className="beego-achievements__badges">
              {unlocked.slice(0, 8).map((b) => (
                <li key={b.key} className="beego-achievements__badge is-unlocked" title={b.description}>
                  <span className="beego-achievements__icon" aria-hidden>
                    {b.icon}
                  </span>
                  <span className="beego-achievements__badge-title">{b.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="beego-achievements__empty">Chưa có huy hiệu — học bài đầu tiên để mở!</p>
          )}

          {inProgress.length > 0 ? (
            <div className="beego-achievements__progress-block">
              <h3 className="beego-achievements__h3">Đang tiến tới</h3>
              <ul className="beego-achievements__progress-list">
                {inProgress.slice(0, 4).map((b) => (
                  <li key={b.key} className="beego-achievements__progress-item">
                    <div className="beego-achievements__progress-meta">
                      <span>
                        {b.icon} {b.title}
                      </span>
                      <span className="beego-achievements__progress-nums">
                        {b.progress}/{b.target}
                      </span>
                    </div>
                    <span className="beego-achievements__bar" aria-hidden>
                      <span
                        className="beego-achievements__bar-fill"
                        style={{ width: `${b.progressPct}%` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
