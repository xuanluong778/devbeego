"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const TABS = [
  { id: "overview", label: "Tổng quan" },
  { id: "users", label: "Người dùng" },
  { id: "plans", label: "Gói học" },
  { id: "payments", label: "Thanh toán" },
  { id: "progress", label: "Tiến độ học" },
  { id: "errors", label: "Lỗi cần ôn" },
  { id: "settings", label: "Cài đặt" },
];

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "new", label: "User mới" },
  { id: "activated", label: "Đã kích hoạt" },
  { id: "not_activated", label: "Chưa kích hoạt" },
  { id: "trial", label: "Trial" },
  { id: "paid", label: "Trả phí" },
  { id: "expired", label: "Hết hạn" },
  { id: "inactive_7d", label: "Không học 7 ngày" },
];

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

function PlanBadge({ state }) {
  const cls =
    state === "trial"
      ? "adm-badge--trial"
      : state === "pro" || state === "vip"
      ? "adm-badge--paid"
      : "adm-badge--expired";
  return <span className={`adm-badge ${cls}`}>{state}</span>;
}

export default function AdminDashboard() {
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersMeta, setUsersMeta] = useState({ total: 0, page: 1, total_pages: 1 });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Lỗi tải tổng quan");
      setOverview(json.data);
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const sp = new URLSearchParams({ page: String(page), limit: "20", filter, q });
      const res = await fetch(`/api/admin/users?${sp}`, { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Lỗi tải users");
      setUsers(json.data.items || []);
      setUsersMeta(json.data);
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setLoading(false);
    }
  }, [filter, page, q]);

  useEffect(() => {
    if (tab === "overview") void loadOverview();
    if (tab === "users" || tab === "progress" || tab === "errors") void loadUsers();
  }, [tab, loadOverview, loadUsers]);

  return (
    <div className="adm-shell">
      <header className="adm-header">
        <div>
          <h1>Beego Admin</h1>
          <p>Quản trị người dùng, gói học và tiến độ</p>
        </div>
        <Link href="/" className="adm-back">
          ← Về trang học
        </Link>
      </header>

      <nav className="adm-tabs" aria-label="Admin tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`adm-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {err ? <p className="adm-err">{err}</p> : null}
      {loading ? <p className="adm-msg">Đang tải…</p> : null}

      {tab === "overview" && overview ? (
        <section className="adm-card">
          <div className="adm-stats">
            <div className="adm-stat">
              <div className="k">Tổng user</div>
              <div className="v">{overview.total_users}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Đăng ký hôm nay</div>
              <div className="v">{overview.registered_today}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Online</div>
              <div className="v">{overview.active_sessions}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Trial</div>
              <div className="v">{overview.trial_users}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Trả phí</div>
              <div className="v">{overview.paid_users}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Hết hạn</div>
              <div className="v">{overview.expired_users}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Không học 7 ngày</div>
              <div className="v">{overview.inactive_7d}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Thanh toán chờ</div>
              <div className="v">{overview.pending_payments}</div>
            </div>
          </div>
        </section>
      ) : null}

      {(tab === "users" || tab === "progress" || tab === "errors") && (
        <section className="adm-card">
          <div className="adm-toolbar">
            <input
              className="adm-input"
              placeholder="Tìm tên, email, SĐT…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadUsers()}
            />
            <select className="adm-select" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
              {FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <button type="button" className="adm-btn adm-btn--primary" onClick={() => loadUsers()}>
              Lọc
            </button>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Email / SĐT</th>
                  <th>Role</th>
                  <th>Trạng thái</th>
                  <th>Gói</th>
                  <th>Kích hoạt</th>
                  <th>Đăng ký</th>
                  <th>Học cuối</th>
                  <th>Streak</th>
                  <th>Tiến độ</th>
                  <th>AI Call</th>
                  <th>Từ đã học</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/users/${u.id}`} className="adm-link">
                        {u.name}
                      </Link>
                    </td>
                    <td>
                      {u.email || "—"}
                      <br />
                      <small>{u.phone || ""}</small>
                    </td>
                    <td>
                      <span className={`adm-badge adm-badge--${u.role === "admin" ? "admin" : "user"}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className={`adm-badge adm-badge--${u.status === "active" ? "active" : "blocked"}`}>
                        {u.status === "active" ? "Hoạt động" : "Khóa"}
                      </span>
                    </td>
                    <td>
                      <PlanBadge state={u.plan_state} />
                    </td>
                    <td>{u.activated ? "✓" : "—"}</td>
                    <td>{fmtDate(u.created_at)}</td>
                    <td>{fmtDate(u.last_study_at || u.last_login_at)}</td>
                    <td>{u.streak}</td>
                    <td>{u.progress_pct}%</td>
                    <td>{u.ai_call_sessions}</td>
                    <td>{u.words_learned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adm-toolbar" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Trước
            </button>
            <span className="adm-msg">
              Trang {usersMeta.page}/{usersMeta.total_pages} · {usersMeta.total} user
            </span>
            <button
              type="button"
              className="adm-btn adm-btn--ghost"
              disabled={page >= usersMeta.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Sau →
            </button>
          </div>
        </section>
      )}

      {tab === "plans" && (
        <section className="adm-card adm-msg">
          Quản lý gói học: chọn user trong tab <strong>Người dùng</strong> → chi tiết → kích hoạt / gia hạn / tặng gói.
        </section>
      )}

      {tab === "payments" && (
        <section className="adm-card">
          <div className="adm-links-grid">
            <Link href="/admin/payments" className="adm-link-card">
              Thanh toán chuyển khoản
              <small>Xác nhận Pro / VIP</small>
            </Link>
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="adm-card">
          <div className="adm-links-grid">
            <Link href="/admin/options" className="adm-link-card">
              Cài đặt hệ thống
              <small>API keys, tham số app</small>
            </Link>
            <Link href="/admin/vocabulary-images" className="adm-link-card">
              Ảnh từ vựng
              <small>Duyệt & tạo lại ảnh</small>
            </Link>
            <Link href="/admin/listening" className="adm-link-card">
              Luyện nghe 5 phút
              <small>Upload MP3 & quản lý bài nghe</small>
            </Link>
            <Link href="/teacher" className="adm-link-card">
              Teacher Portal
              <small>Trung tâm, lớp, bộ từ, giao bài</small>
            </Link>
            <Link href="/admin/students" className="adm-link-card">
              Quản lý học viên
              <small>Danh sách, hồ sơ, ghi chú, nhật ký</small>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
