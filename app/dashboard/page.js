"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BeegoDashboardPersonal from "@/components/beego/BeegoDashboardPersonal";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/me", { cache: "no-store", credentials: "same-origin" });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          if (!cancelled) setErr(json?.message || "Không tải được dashboard.");
          return;
        }
        if (!cancelled) setData(json.data);
      } catch {
        if (!cancelled) setErr("Lỗi kết nối.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const p = data?.progress || {};
  const today = data?.today || {};
  const sub = data?.subscription || {};
  const ctas = data?.ctas || {};

  return (
    <main className="dash">
      <section className="card">
        <div className="topRow">
          <div>
            <h1>Xin chào{data?.user?.name ? `, ${data.user.name}` : ""}!</h1>
            <p className="sub">Hôm nay học gì? — Lộ trình cá nhân Beego</p>
          </div>
          <div className="stats">
            <div className="pill" aria-label="Level">
              <span className="k">Lv</span>
              <span className="v">{p.level ?? 1}</span>
            </div>
            <div className="pill pillToday" aria-label="XP hôm nay">
              <span className="k">+XP</span>
              <span className="v">{p.xp_today ?? 0}</span>
            </div>
            <div className="pill pillStreak" aria-label="Streak">
              <span className="k">🔥</span>
              <span className="v">{p.streak ?? 0}</span>
            </div>
          </div>
        </div>

        {loading ? <p className="msg">Đang tải…</p> : null}
        {!loading && err ? <p className="err">{err}</p> : null}

        {!loading && !err && data ? (
          <>
            <BeegoDashboardPersonal />

            <div className="plan">
              <div className="planRow">
                <div className="planTitle">Kế hoạch hôm nay</div>
                <div className="planPct">{today.daily_progress ?? 0}%</div>
              </div>
              <div
                className="bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={today.daily_progress ?? 0}
              >
                <div
                  className="barFill"
                  style={{ width: `${Math.max(0, Math.min(100, today.daily_progress ?? 0))}%` }}
                />
              </div>
              <p className="planHint">{today.suggestion}</p>
              <p className="planHint">
                Ôn: <strong>{today.review_count ?? 0}</strong> · Từ mới: <strong>{today.new_words_count ?? 0}</strong> ·
                Đã học: <strong>{p.words_learned ?? 0}</strong> từ
              </p>
            </div>

            <div className="ctaGrid">
              <Link className="cta" href={ctas.continue_learning || "/quiz"}>
                Tiếp tục học
              </Link>
              <Link className="cta ctaAlt" href={ctas.ai_call || "/luyen-noi"}>
                Gọi AI
              </Link>
              <Link className="cta ctaAlt" href={ctas.review_vocab || "/vocabulary"}>
                Ôn từ vựng
              </Link>
              <Link className="cta ctaWarn" href={ctas.practice_errors || "/pronunciation"}>
                Luyện lỗi sai
              </Link>
            </div>

            <div className="grid">
              {!data.user?.hide_billing_ui ? (
                <div className="box">
                  <h2>Gói hiện tại</h2>
                  <p className="count">
                    <strong>{sub.plan_state ?? "—"}</strong> ({sub.plan ?? "free"})
                  </p>
                  <p className="hint">
                    Quota hôm nay: {sub.usage_today ?? 0}/{sub.daily_limit ?? 0} · Còn {sub.quota_remaining ?? 0}
                  </p>
                </div>
              ) : null}
              <div className="box">
                <h2>Phát âm</h2>
                <p className="count">
                  {data.pronunciation?.avg_score != null ? (
                    <>
                      Trung bình <strong>{data.pronunciation.avg_score}</strong>/100
                    </>
                  ) : (
                    "Chưa có dữ liệu"
                  )}
                </p>
                <p className="hint">{data.pronunciation?.sessions ?? 0} buổi luyện</p>
              </div>
            </div>

            {data.weak_words?.length ? (
              <div className="insightsBox">
                <h2>Lỗi cần luyện lại</h2>
                <div className="chips">
                  {data.weak_words.map((w) => (
                    <span key={w.word} className="chip">
                      {w.word} · {w.correct_rate}%
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {data.ai_calls?.length ? (
              <div className="insightsBox">
                <h2>AI Call gần đây</h2>
                <ul className="aiList">
                  {data.ai_calls.map((c) => (
                    <li key={c.id}>
                      {new Date(c.created_at).toLocaleDateString("vi-VN")} — {c.source || "call"}
                      {c.pronunciation_score != null ? ` (${c.pronunciation_score} PA)` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <style jsx>{`
        .dash {
          min-height: 100vh;
          padding: 1rem;
          background: linear-gradient(180deg, #dbeafe 0%, #eff6ff 45%, #f0fdf4 100%);
          font-family: Roboto, system-ui, sans-serif;
        }
        .card {
          width: min(1100px, 96vw);
          margin: 0 auto;
          background: #fff;
          border-radius: 22px;
          border: 1px solid #bfdbfe;
          padding: 1rem;
          box-shadow: 0 8px 32px rgba(37, 99, 235, 0.08);
        }
        .topRow {
          display: flex;
          gap: 0.8rem;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        h1 {
          margin: 0;
          color: #1d4ed8;
          font-weight: 800;
          font-size: 1.35rem;
        }
        .sub {
          margin: 0.15rem 0 0;
          color: #64748b;
          font-weight: 600;
        }
        .stats {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.6rem;
          border-radius: 999px;
          border: 1px solid #93c5fd;
          background: #eff6ff;
          color: #1e40af;
          font-weight: 800;
          font-size: 0.9rem;
        }
        .pillStreak {
          background: #fff7ed;
          border-color: #fdba74;
          color: #9a3412;
        }
        .pillToday {
          background: #eef2ff;
          border-color: #a5b4fc;
        }
        .plan {
          margin-top: 0.9rem;
          border: 1px solid #bfdbfe;
          border-radius: 18px;
          padding: 0.85rem;
          background: #f8fafc;
        }
        .planRow {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }
        .planTitle {
          font-weight: 800;
          color: #1d4ed8;
        }
        .planPct {
          font-weight: 800;
          color: #2563eb;
        }
        .bar {
          margin-top: 0.55rem;
          height: 12px;
          border-radius: 999px;
          background: #e2e8f0;
          overflow: hidden;
        }
        .barFill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #6366f1);
        }
        .planHint {
          margin-top: 0.45rem;
          color: #64748b;
          font-weight: 600;
          font-size: 0.92rem;
        }
        .ctaGrid {
          margin-top: 0.85rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }
        .cta {
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border-radius: 14px;
          padding: 0.75rem;
          background: #2563eb;
          color: #fff;
          font-weight: 800;
          text-align: center;
        }
        .ctaAlt {
          background: #0ea5e9;
        }
        .ctaWarn {
          background: #f59e0b;
        }
        .grid {
          margin-top: 0.85rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }
        .box {
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          padding: 0.85rem;
          background: #f8fafc;
        }
        .box h2 {
          margin: 0;
          color: #1d4ed8;
          font-size: 1.05rem;
        }
        .count {
          margin: 0.35rem 0;
          color: #334155;
          font-weight: 700;
        }
        .hint {
          margin: 0;
          color: #64748b;
          font-size: 0.88rem;
        }
        .insightsBox {
          margin-top: 0.85rem;
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          padding: 0.85rem;
        }
        .insightsBox h2 {
          margin: 0 0 0.5rem;
          color: #1d4ed8;
          font-size: 1.05rem;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }
        .chip {
          padding: 0.25rem 0.55rem;
          border-radius: 999px;
          background: #fef3c7;
          color: #92400e;
          font-weight: 700;
          font-size: 0.85rem;
        }
        .aiList {
          margin: 0;
          padding-left: 1.1rem;
          color: #475569;
          font-weight: 600;
        }
        .msg {
          text-align: center;
          font-weight: 700;
          color: #64748b;
        }
        .err {
          color: #b91c1c;
          font-weight: 700;
          background: #fef2f2;
          padding: 0.5rem;
          border-radius: 10px;
        }
        @media (max-width: 640px) {
          .ctaGrid,
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
