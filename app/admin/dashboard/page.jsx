"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/dashboard", { credentials: "same-origin", cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không tải được dashboard.");
      setData(json.data);
    } catch (e) {
      setErr(e.message || "Lỗi");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const defs = data?.definitions || {};

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Chỉ số học viên và Pro từ dữ liệu thật (giờ máy chủ DB, hiển thị theo giờ Việt Nam trên hồ sơ)."
    >
      {loading ? <p className="adm-msg">Đang tải…</p> : null}
      {err ? <p className="adm-err">{err}</p> : null}
      {data ? (
        <>
          {data.scope === "teacher" ? (
            <p className="adm-msg">Phạm vi: học viên được giao cho giáo viên (teacher scope).</p>
          ) : null}
          <div className="adm-stats">
            <div className="adm-stat">
              <div className="k">Tổng học viên</div>
              <div className="v">{data.students.total}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Đăng ký mới (7 ngày)</div>
              <div className="v">{data.students.registeredLast7Days}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Đăng ký mới (30 ngày)</div>
              <div className="v">{data.students.registeredLast30Days}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Hoạt động (7 ngày)</div>
              <div className="v">{data.students.activeLast7Days}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Hoạt động (30 ngày)</div>
              <div className="v">{data.students.activeLast30Days}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Pro/VIP còn hạn</div>
              <div className="v">{data.pro.activePaid}</div>
            </div>
            <div className="adm-stat">
              <div className="k">Sắp hết hạn (7 ngày)</div>
              <div className="v">{data.pro.expiringWithin7Days}</div>
            </div>
          </div>
          <details className="adm-card" style={{ marginTop: "1rem" }}>
            <summary>Định nghĩa chỉ số</summary>
            <ul className="adm-msg" style={{ margin: "0.75rem 0 0", paddingLeft: "1.2rem" }}>
              {Object.entries(defs).map(([key, text]) => (
                <li key={key}>
                  <strong>{key}</strong>: {text}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </AdminShell>
  );
}
