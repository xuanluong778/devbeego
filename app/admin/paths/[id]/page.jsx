"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

export default function AdminPathTemplateEditPage() {
  const params = useParams();
  const id = params?.id;
  const [tpl, setTpl] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [tRes, cRes] = await Promise.all([
        fetch(`/api/admin/path-templates/${id}`, { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/path-catalog", { credentials: "same-origin", cache: "no-store" }),
      ]);
      const tJson = await tRes.json();
      const cJson = await cRes.json();
      if (!tRes.ok || !tJson.success) throw new Error(tJson.message || "Không tải lộ trình");
      if (!cRes.ok || !cJson.success) throw new Error(cJson.message || "Không tải danh mục");
      setTpl(tJson.data);
      setCatalog(cJson.data);
      setSelectedChapter(cJson.data.chapters[0]?.gateNumber || 1);
    } catch (e) {
      setErr(e.message || "Lỗi");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const chapter = useMemo(
    () => catalog?.chapters?.find((c) => c.gateNumber === selectedChapter),
    [catalog, selectedChapter]
  );

  const itemIds = useMemo(() => new Set((tpl?.items || []).map((i) => i.lessonId)), [tpl]);

  function addLesson(lessonId) {
    if (!tpl || itemIds.has(lessonId)) return;
    const next = [...(tpl.items || []), { lessonId, sortIndex: (tpl.items?.length || 0) + 1, required: true }];
    setTpl({ ...tpl, items: next });
  }

  function removeLesson(lessonId) {
    if (!tpl) return;
    setTpl({ ...tpl, items: tpl.items.filter((i) => i.lessonId !== lessonId) });
  }

  async function saveDraft() {
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`/api/admin/path-templates/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tpl.title,
          description: tpl.description,
          items: (tpl.items || []).map((i, idx) => ({ lessonId: i.lessonId, sortIndex: idx + 1, required: i.required !== false })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không lưu được");
      setTpl(json.data);
      setMsg(json.message || "Đã lưu nháp.");
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  async function publish() {
    setMsg("");
    setErr("");
    try {
      await saveDraft();
      const res = await fetch(`/api/admin/path-templates/${id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không xuất bản được");
      setTpl(json.data);
      setMsg(json.message || "Đã xuất bản.");
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  if (loading) return <AdminShell title="Lộ trình mẫu"><p className="adm-msg">Đang tải…</p></AdminShell>;
  if (err && !tpl) return <AdminShell title="Lộ trình mẫu"><p className="adm-err">{err}</p></AdminShell>;
  if (!tpl) return null;

  return (
    <AdminShell title={tpl.title} subtitle={`Trạng thái: ${tpl.status === "published" ? "Đã xuất bản" : "Nháp"} · v${tpl.version}`}>
      <p className="adm-breadcrumb"><Link href="/admin/paths">Lộ trình mẫu</Link> / {tpl.title}</p>
      {msg ? <p className="adm-success">{msg}</p> : null}
      {err ? <p className="adm-err">{err}</p> : null}

      <section className="adm-card">
        <div className="adm-toolbar">
          <button type="button" className="adm-btn adm-btn--ghost" onClick={saveDraft}>Lưu nháp</button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={publish}>Xuất bản</button>
        </div>
        <p className="adm-msg">Sửa mẫu không đổi lộ trình đã giao — dùng «Áp dụng cập nhật mẫu» trên hồ sơ học viên.</p>
      </section>

      <div className="adm-path-editor">
        <section className="adm-card adm-path-editor__catalog">
          <h2>Thêm bài từ curriculum</h2>
          <select className="adm-select adm-input--block" value={selectedChapter} onChange={(e) => setSelectedChapter(Number(e.target.value))}>
            {catalog?.chapters?.map((c) => (
              <option key={c.gateNumber} value={c.gateNumber}>Cửa {c.gateNumber}: {c.chapterTitle}</option>
            ))}
          </select>
          <ul className="adm-catalog-list">
            {chapter?.lessons?.map((lesson) => (
              <li key={lesson.lessonId}>
                <span>{lesson.title} <small>({lesson.lessonId})</small></span>
                <button type="button" className="adm-btn adm-btn--ghost" disabled={itemIds.has(lesson.lessonId)} onClick={() => addLesson(lesson.lessonId)}>
                  {itemIds.has(lesson.lessonId) ? "Đã thêm" : "Thêm"}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="adm-card adm-path-editor__items">
          <h2>Thứ tự lộ trình ({tpl.items?.length || 0} bài)</h2>
          {!tpl.items?.length ? <p className="adm-empty">Chưa có bài nào trong lộ trình.</p> : null}
          <ol className="adm-path-items">
            {tpl.items?.map((item, idx) => (
              <li key={item.lessonId}>
                <span>{idx + 1}. [{item.gateNumber || "—"}] {item.title || item.lessonId}</span>
                <button type="button" className="adm-btn adm-btn--ghost" onClick={() => removeLesson(item.lessonId)}>Xóa</button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AdminShell>
  );
}
