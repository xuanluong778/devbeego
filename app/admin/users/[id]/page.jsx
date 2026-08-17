"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không tải được user");
      setData(json.data);
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(path, body) {
    setMsg("");
    setErr("");
    try {
      const res = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Thất bại");
      setMsg(json.message || "OK");
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  if (loading) return <div className="adm-shell adm-msg">Đang tải…</div>;
  if (err && !data) return <div className="adm-shell adm-err">{err}</div>;
  if (!data) return null;

  const { user, subscription, stats, weak_words, ai_sessions, study_history } = data;
  const base = `/api/admin/users/${user.id}`;

  return (
    <div className="adm-shell">
      <header className="adm-header">
        <div>
          <Link href="/admin" className="adm-back">
            ← Admin
          </Link>
          <h1>{user.name}</h1>
          <p>
            {user.email || "—"} · {user.phone || "—"} · {user.role}
          </p>
        </div>
      </header>

      {msg ? <p className="adm-msg" style={{ color: "#166534", fontWeight: 700 }}>{msg}</p> : null}
      {err ? <p className="adm-err">{err}</p> : null}

      <div style={{ display: "grid", gap: "0.75rem" }}>
        <section className="adm-card">
          <h2 style={{ margin: "0 0 0.5rem", color: "#1d4ed8" }}>Tài khoản</h2>
          <p>
            Trạng thái: <strong>{user.status}</strong> · Đăng ký: {fmtDate(user.created_at)} · Login cuối:{" "}
            {fmtDate(user.last_login_at)}
          </p>
          <div className="adm-toolbar">
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => action(`${base}/activate-plan`, { plan: "pro" })}>
              Kích hoạt Pro 30 ngày
            </button>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => action(`${base}/activate-plan`, { plan: "vip" })}>
              Kích hoạt VIP 30 ngày
            </button>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => action(`${base}/extend-plan`, { days: 30 })}>
              Gia hạn +30 ngày
            </button>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={() => action(`${base}/extend-plan`, { days: 90, plan: "pro" })}>
              Tặng Pro 90 ngày
            </button>
            {user.status === "active" ? (
              <button type="button" className="adm-btn adm-btn--danger" onClick={() => action(`${base}/block`, { block: true })}>
                Khóa tài khoản
              </button>
            ) : (
              <button type="button" className="adm-btn adm-btn--primary" onClick={() => action(`${base}/block`, { block: false })}>
                Mở khóa
              </button>
            )}
          </div>
        </section>

        <section className="adm-card">
          <h2 style={{ margin: "0 0 0.5rem", color: "#1d4ed8" }}>Gói học</h2>
          <p>
            Gói: <strong>{subscription.plan_state}</strong> ({subscription.plan}) · Hết hạn: {fmtDate(subscription.expires_at)} ·
            Trial đến: {fmtDate(subscription.trial_end_at)}
          </p>
        </section>

        <section className="adm-card">
          <h2 style={{ margin: "0 0 0.5rem", color: "#1d4ed8" }}>Tiến độ</h2>
          <div className="adm-stats">
            <div className="adm-stat">
              <div className="k">XP</div>
              <div className="v">{stats.xp_total}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Streak</div>
              <div className="v">{stats.streak}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Từ đã học</div>
              <div className="v">{stats.words_learned}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Cần ôn</div>
              <div className="v">{stats.review_due}</div>
            </div>
          </div>
        </section>

        <section className="adm-card">
          <h2 style={{ margin: "0 0 0.5rem", color: "#1d4ed8" }}>Lỗi cần ôn</h2>
          {weak_words?.length ? (
            <ul>
              {weak_words.map((w) => (
                <li key={w.word}>
                  <strong>{w.word}</strong> — {w.correct_rate}% đúng ({w.attempts} lần)
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-msg">Chưa có dữ liệu lỗi.</p>
          )}
        </section>

        <section className="adm-card">
          <h2 style={{ margin: "0 0 0.5rem", color: "#1d4ed8" }}>AI Call gần đây</h2>
          {ai_sessions?.length ? (
            <ul>
              {ai_sessions.map((s) => (
                <li key={s.id}>
                  {fmtDate(s.created_at)} — {s.source || "call"}
                  {s.pronunciation_score != null ? ` · PA ${s.pronunciation_score}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-msg">Chưa có buổi AI Call.</p>
          )}
        </section>

        <section className="adm-card">
          <h2 style={{ margin: "0 0 0.5rem", color: "#1d4ed8" }}>Lịch sử học 14 ngày</h2>
          {study_history?.length ? (
            <ul>
              {study_history.map((d) => (
                <li key={String(d.day)}>
                  {String(d.day)} — {d.sessions} phiên · {d.xp} XP
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-msg">Chưa có lịch sử.</p>
          )}
        </section>
      </div>
    </div>
  );
}
