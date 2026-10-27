"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

export default function AdminPathTemplatesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/path-templates", { credentials: "same-origin", cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Lỗi tải");
      setItems(json.data || []);
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTemplate(e) {
    e.preventDefault();
    setErr("");
    try {
      const res = await fetch("/api/admin/path-templates", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không tạo được");
      window.location.href = `/admin/paths/${json.data.id}`;
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  return (
    <AdminShell title="Lộ trình mẫu" subtitle="Tạo nháp, sắp xếp bài theo cửa/chương curriculum-50, xuất bản rồi gán cho học viên.">
      <section className="adm-card">
        <form className="adm-toolbar" onSubmit={createTemplate}>
          <input
            className="adm-input adm-input--grow"
            placeholder="Tên lộ trình mẫu mới…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="submit" className="adm-btn adm-btn--primary">Tạo bản nháp</button>
        </form>
        {err ? <p className="adm-err">{err}</p> : null}
        {loading ? <p className="adm-msg">Đang tải…</p> : null}
        {!loading && items.length === 0 ? <p className="adm-empty">Chưa có lộ trình mẫu.</p> : null}
        {!loading && items.length > 0 ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Trạng thái</th>
                  <th>Phiên bản</th>
                  <th>Số bài</th>
                  <th>Cập nhật</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/paths/${row.id}`} className="adm-link">{row.title}</Link>
                    </td>
                    <td>{row.status === "published" ? "Đã xuất bản" : "Nháp"}</td>
                    <td>v{row.version}</td>
                    <td>{row.itemCount}</td>
                    <td>{row.updatedAt ? new Date(row.updatedAt).toLocaleString("vi-VN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
