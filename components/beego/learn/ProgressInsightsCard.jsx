"use client";

import { useCallback, useEffect, useState } from "react";
import { LEARNING_PATH_UPDATED_EVENT } from "@/lib/beego/learn/complete-lesson-client";

const TREND_LABEL = {
  improving: "Đang tiến bộ",
  stable: "Ổn định",
  declining: "Cần chú ý",
  insufficient_data: "Chưa đủ dữ liệu",
};

/**
 * Compact "Tiến độ của bạn" — Overview, skills, 7-day, strengths/weaknesses.
 */
export default function ProgressInsightsCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/learn/analytics?refresh=1", {
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
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdated = () => void refresh();
    window.addEventListener(LEARNING_PATH_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(LEARNING_PATH_UPDATED_EVENT, onUpdated);
  }, [refresh]);

  if (guest) return null;
  if (!loading && !data?.analytics) return null;

  const a = data?.analytics;
  const o = a?.overview;
  const insights = data?.insights || [];
  const maxBar = Math.max(1, ...(a?.activity7d || []).map((d) => d.lessons + (d.attempts > 0 ? 1 : 0)));

  return (
    <section className="beego-progress-insights" aria-label="Tiến độ của bạn">
      <header className="beego-progress-insights__head">
        <h2 className="beego-progress-insights__title">Tiến độ của bạn</h2>
        <p className="beego-progress-insights__sub">Tổng hợp từ lộ trình, mastery và ôn tập</p>
      </header>

      {loading || !o ? (
        <p className="beego-progress-insights__loading">Đang tải tiến độ…</p>
      ) : (
        <>
          <div className="beego-progress-insights__overview">
            <div className="beego-progress-insights__stat">
              <span className="beego-progress-insights__stat-val">{o.pathProgressPct}%</span>
              <span className="beego-progress-insights__stat-lab">Lộ trình</span>
            </div>
            <div className="beego-progress-insights__stat">
              <span className="beego-progress-insights__stat-val">
                {o.overallAccuracyPct != null ? `${o.overallAccuracyPct}%` : "—"}
              </span>
              <span className="beego-progress-insights__stat-lab">Accuracy</span>
            </div>
            <div className="beego-progress-insights__stat">
              <span className="beego-progress-insights__stat-val">{o.streak}</span>
              <span className="beego-progress-insights__stat-lab">Streak</span>
            </div>
            <div className="beego-progress-insights__stat">
              <span className="beego-progress-insights__stat-val">{o.xpTotal}</span>
              <span className="beego-progress-insights__stat-lab">XP</span>
            </div>
          </div>

          <p className="beego-progress-insights__meta">
            {o.lessonsCompleted}/{o.lessonsTotal} bài ·{" "}
            {TREND_LABEL[o.trend] || TREND_LABEL.insufficient_data}
            {o.openMistakes > 0 ? ` · ${o.openMistakes} lỗi mở` : ""}
            {o.srsDue > 0 ? ` · ${o.srsDue} từ đến hạn` : ""}
          </p>

          {insights.length > 0 ? (
            <ul className="beego-progress-insights__insights">
              {insights.slice(0, 4).map((ins) => (
                <li
                  key={ins.code + (ins.skillKey || "")}
                  className={`beego-progress-insights__insight beego-progress-insights__insight--${ins.severity}`}
                >
                  {ins.text}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="beego-progress-insights__skills">
            <h3 className="beego-progress-insights__h3">Mastery theo kỹ năng</h3>
            <ul className="beego-progress-insights__skill-list">
              {(a.skills || [])
                .filter((s) => !s.empty || s.attempts > 0)
                .slice(0, 6)
                .map((s) => (
                  <li key={s.skillKey} className="beego-progress-insights__skill">
                    <span className="beego-progress-insights__skill-name">{s.label}</span>
                    <span className="beego-progress-insights__skill-bar" aria-hidden>
                      <span
                        className="beego-progress-insights__skill-fill"
                        style={{ width: `${Math.max(2, Math.min(100, Math.round(s.masteryScore)))}%` }}
                      />
                    </span>
                    <span className="beego-progress-insights__skill-pct">
                      {Math.round(s.masteryScore)}
                    </span>
                  </li>
                ))}
              {(a.skills || []).every((s) => s.empty && !s.attempts) ? (
                <li className="beego-progress-insights__empty">Chưa có mastery — học thêm để mở.</li>
              ) : null}
            </ul>
          </div>

          <div className="beego-progress-insights__week">
            <h3 className="beego-progress-insights__h3">Hoạt động 7 ngày</h3>
            <div className="beego-progress-insights__bars" role="img" aria-label="Biểu đồ 7 ngày">
              {(a.activity7d || []).map((d) => {
                const h = d.active ? Math.max(18, Math.round(((d.lessons + (d.attempts > 0 ? 1 : 0)) / maxBar) * 40)) : 4;
                return (
                  <div key={d.date} className="beego-progress-insights__bar-col" title={`${d.date}: ${d.lessons} bài`}>
                    <span
                      className={`beego-progress-insights__bar ${d.active ? "is-active" : ""}`}
                      style={{ height: `${h}px` }}
                    />
                    <span className="beego-progress-insights__bar-day">{d.date.slice(8)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="beego-progress-insights__sw">
            <div>
              <h3 className="beego-progress-insights__h3">Điểm mạnh</h3>
              {a.strengths?.length ? (
                <ul className="beego-progress-insights__chips">
                  {a.strengths.map((s) => (
                    <li key={s.skillKey}>{s.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="beego-progress-insights__empty">Chưa đủ dữ liệu</p>
              )}
            </div>
            <div>
              <h3 className="beego-progress-insights__h3">Cần cải thiện</h3>
              {a.weaknesses?.length ? (
                <ul className="beego-progress-insights__chips beego-progress-insights__chips--weak">
                  {a.weaknesses.map((s) => (
                    <li key={s.skillKey}>{s.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="beego-progress-insights__empty">Chưa đủ dữ liệu</p>
              )}
            </div>
          </div>

          <a className="beego-progress-insights__cta" href="#beego-today-for-you">
            Xem đề xuất hôm nay →
          </a>
        </>
      )}
    </section>
  );
}
