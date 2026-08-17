"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./teacher.css";

function useOrgApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(path, { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Không tải được dữ liệu.");
        setData(null);
      } else {
        setData(json.data);
      }
    } catch {
      setError("Lỗi kết nối.");
      setData(null);
    }
    setLoading(false);
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload, ...deps]);

  return { data, loading, error, reload };
}

export default function TeacherPortalPage() {
  const orgs = useOrgApi("/api/org/organizations");
  const sets = useOrgApi("/api/org/vocabulary-sets");
  const classes = useOrgApi("/api/org/classrooms");
  const assignments = useOrgApi("/api/org/assignments");

  const [toast, setToast] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    org_name: "",
    set_title: "",
    class_name: "",
    assign_title: "",
    classroom_id: "",
    set_id: "",
  });

  async function createOrg(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/org/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: form.org_name }),
      });
      const json = await res.json();
      setToast(json.success ? "Đã tạo trung tâm." : json.message || "Lỗi.");
      if (json.success) {
        setForm((f) => ({ ...f, org_name: "" }));
        orgs.reload();
      }
    } catch {
      setToast("Lỗi kết nối.");
    }
    setCreating(false);
  }

  async function createSet(e) {
    e.preventDefault();
    const org = orgs.data?.[0];
    if (!org?.id) {
      setToast("Cần có trung tâm trước.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/org/vocabulary-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ organization_id: org.id, title: form.set_title }),
      });
      const json = await res.json();
      setToast(json.success ? "Đã tạo bộ từ." : json.message || "Lỗi.");
      if (json.success) {
        setForm((f) => ({ ...f, set_title: "" }));
        sets.reload();
      }
    } catch {
      setToast("Lỗi kết nối.");
    }
    setCreating(false);
  }

  async function createClass(e) {
    e.preventDefault();
    const org = orgs.data?.[0];
    if (!org?.id) {
      setToast("Cần có trung tâm trước.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/org/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ organization_id: org.id, name: form.class_name }),
      });
      const json = await res.json();
      setToast(json.success ? "Đã tạo lớp." : json.message || "Lỗi.");
      if (json.success) {
        setForm((f) => ({ ...f, class_name: "" }));
        classes.reload();
      }
    } catch {
      setToast("Lỗi kết nối.");
    }
    setCreating(false);
  }

  async function createAssignment(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/org/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          classroom_id: Number(form.classroom_id),
          set_id: Number(form.set_id),
          title: form.assign_title,
        }),
      });
      const json = await res.json();
      setToast(json.success ? "Đã giao bài." : json.message || "Lỗi.");
      if (json.success) {
        setForm((f) => ({ ...f, assign_title: "" }));
        assignments.reload();
      }
    } catch {
      setToast("Lỗi kết nối.");
    }
    setCreating(false);
  }

  async function importCsv(setId, file) {
    if (!setId || !file) return;
    const fd = new FormData();
    fd.append("file", file);
    setCreating(true);
    try {
      const res = await fetch(`/api/org/vocabulary-sets/${setId}/import`, {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const json = await res.json();
      setToast(json.success ? `Import ${json.data?.imported || 0} từ.` : json.message || "Lỗi import.");
      if (json.success) sets.reload();
    } catch {
      setToast("Lỗi import.");
    }
    setCreating(false);
  }

  return (
    <main className="teacher-portal">
      <header className="teacher-portal__head">
        <div>
          <p className="teacher-portal__eyebrow">Vocabulary SaaS</p>
          <h1>Teacher Portal</h1>
          <p>Quản lý trung tâm, bộ từ, lớp học và giao bài — API-first.</p>
        </div>
        <Link href="/vocabulary" className="teacher-portal__link">
          ← Thư viện từ
        </Link>
      </header>

      {toast ? (
        <p className="teacher-portal__toast" role="status">
          {toast}
        </p>
      ) : null}

      <div className="teacher-portal__grid">
        <section className="teacher-card">
          <h2>Trung tâm</h2>
          {orgs.loading ? <p>Đang tải…</p> : null}
          {orgs.error ? <p className="teacher-error">{orgs.error}</p> : null}
          <ul className="teacher-list">
            {(orgs.data || []).map((o) => (
              <li key={o.id}>
                <strong>{o.name}</strong>
                {o.my_role ? <span> · {o.my_role}</span> : null}
              </li>
            ))}
          </ul>
          <form className="teacher-form" onSubmit={createOrg}>
            <input
              placeholder="Tên trung tâm mới (admin)"
              value={form.org_name}
              onChange={(e) => setForm({ ...form, org_name: e.target.value })}
            />
            <button type="submit" disabled={creating}>
              Tạo trung tâm
            </button>
          </form>
        </section>

        <section className="teacher-card">
          <h2>Bộ từ vựng</h2>
          <ul className="teacher-list">
            {(sets.data || []).map((s) => (
              <li key={s.id}>
                <strong>{s.title}</strong>
                <span> · {s.word_count} từ</span>
                <label className="teacher-import">
                  Import CSV/Excel
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => importCsv(s.id, e.target.files?.[0])}
                  />
                </label>
              </li>
            ))}
          </ul>
          <form className="teacher-form" onSubmit={createSet}>
            <input
              placeholder="Tên bộ từ mới"
              value={form.set_title}
              onChange={(e) => setForm({ ...form, set_title: e.target.value })}
            />
            <button type="submit" disabled={creating}>
              Tạo bộ từ
            </button>
          </form>
        </section>

        <section className="teacher-card">
          <h2>Lớp học</h2>
          <ul className="teacher-list">
            {(classes.data || []).map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span> · {c.student_count || 0} HV</span>
              </li>
            ))}
          </ul>
          <form className="teacher-form" onSubmit={createClass}>
            <input
              placeholder="Tên lớp mới"
              value={form.class_name}
              onChange={(e) => setForm({ ...form, class_name: e.target.value })}
            />
            <button type="submit" disabled={creating}>
              Tạo lớp
            </button>
          </form>
        </section>

        <section className="teacher-card teacher-card--wide">
          <h2>Giao bài & báo cáo</h2>
          <form className="teacher-form teacher-form--row" onSubmit={createAssignment}>
            <select
              value={form.classroom_id}
              onChange={(e) => setForm({ ...form, classroom_id: e.target.value })}
            >
              <option value="">Chọn lớp</option>
              {(classes.data || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={form.set_id}
              onChange={(e) => setForm({ ...form, set_id: e.target.value })}
            >
              <option value="">Chọn bộ từ</option>
              {(sets.data || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <input
              placeholder="Tiêu đề bài giao"
              value={form.assign_title}
              onChange={(e) => setForm({ ...form, assign_title: e.target.value })}
            />
            <button type="submit" disabled={creating}>
              Giao bài
            </button>
          </form>

          <ul className="teacher-list teacher-list--assign">
            {(assignments.data || []).map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <span>
                    {" "}
                    · {a.classroom_name} · {a.set_title}
                  </span>
                </div>
                <a
                  href={`/teacher/assignments/${a.id}`}
                  className="teacher-report-link"
                >
                  Xem báo cáo →
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
