"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

const PLAN_FILTERS = [
  { id: "all", label: "Tất cả gói" },
  { id: "trial", label: "Trial" },
  { id: "paid", label: "Trả phí (Pro/VIP)" },
  { id: "expired", label: "Hết hạn" },
  { id: "not_activated", label: "Chưa kích hoạt" },
  { id: "new", label: "Mới 7 ngày" },
];

const STATUS_FILTERS = [
  { id: "all", label: "Mọi trạng thái TK" },
  { id: "active", label: "Hoạt động" },
  { id: "blocked", label: "Đã khóa" },
];

function fmtDate(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

export default function AdminStudentsPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, total_pages: 1, total: 0 });
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [accountStatus, setAccountStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    setSuccess("");
    try {
      const sp = new URLSearchParams({
        page: String(page),
        limit: "20",
        filter,
        account_status: accountStatus,
      });
      if (q.trim()) sp.set("q", q.trim());
      const res = await fetch(`/api/admin/students?${sp}`, { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Không tải được danh sách học viên.");
      }
      setItems(json.data.items || []);
      setMeta(json.data);
    } catch (e) {
      setErr(e.message || "Lỗi kết nối.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [accountStatus, filter, page, q]);

  useEffect(() => {
    void load();
  }, [load]);

  function submitSearch(e) {
    e.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  }

  return (
    <AdminShell title="Quản lý học viên" subtitle="Danh sách, tìm kiếm và hồ sơ học viên trên dev.beego.vn">
      <section className="adm-card">
        <form className="adm-toolbar adm-toolbar--stack" onSubmit={submitSearch}>
          <input
            className="adm-input adm-input--grow"
            type="search"
            placeholder="Tìm theo mã, tên, email hoặc SĐT…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
          <select className="adm-select" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
            {PLAN_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <select
            className="adm-select"
            value={accountStatus}
            onChange={(e) => { setAccountStatus(e.target.value); setPage(1); }}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          <button type="submit" className="adm-btn adm-btn--primary">Tìm kiếm</button>
        </form>

        {success ? <p className="adm-success">{success}</p> : null}
        {err ? <p className="adm-err">{err}</p> : null}
        {loading ? <p className="adm-msg">Đang tải danh sách…</p> : null}

        {!loading && !err && items.length === 0 ? (
          <p className="adm-empty">Chưa có học viên khớp bộ lọc.</p>
        ) : null}

        {!loading && items.length > 0 ? (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>SĐT</th>
                    <th>Đăng nhập</th>
                    <th>Xác minh</th>
                    <th>Ngày ĐK</th>
                    <th>Gói</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Link href={`/admin/students/${u.id}`} className="adm-link">
                          {u.code}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/admin/students/${u.id}`} className="adm-link">
                          {u.name}
                        </Link>
                      </td>
                      <td>{u.email || "—"}</td>
                      <td>{u.phone || "—"}</td>
                      <td>{u.login_method_label}</td>
                      <td>{u.verification_label}</td>
                      <td>{fmtDate(u.created_at)}</td>
                      <td>
                        <span className={`adm-badge adm-badge--${u.plan_state === "expired" ? "expired" : "paid"}`}>
                          {u.plan_state}
                        </span>
                      </td>
                      <td>
                        <span className={`adm-badge adm-badge--${u.account_status === "active" ? "active" : "blocked"}`}>
                          {u.account_status_label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-toolbar adm-toolbar--between">
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Trang trước
              </button>
              <span className="adm-msg">
                Trang {meta.page}/{meta.total_pages} · {meta.total} học viên
              </span>
              <button
                type="button"
                className="adm-btn adm-btn--ghost"
                disabled={page >= meta.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau →
              </button>
            </div>
          </>
        ) : null}
      </section>
    </AdminShell>
  );
}
