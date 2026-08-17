"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const EMPTY_FORM = {
  slug: "",
  title: "",
  level: "A2",
  ttsText: "",
  keywords: "",
  questionText: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  transcript: "",
  transcriptVi: "",
  sortOrder: 0,
  isPublished: true,
  vocabularyId: "",
  audioUrl: "",
};

function clipToForm(clip) {
  if (!clip) return { ...EMPTY_FORM };
  return {
    slug: clip.id || "",
    title: clip.title || "",
    level: clip.level || "A2",
    ttsText: clip.ttsText || "",
    keywords: (clip.keywords || []).join(", "),
    questionText: clip.question?.text || "",
    options: [
      clip.question?.options?.[0] || "",
      clip.question?.options?.[1] || "",
      clip.question?.options?.[2] || "",
      clip.question?.options?.[3] || "",
    ],
    correctIndex: clip.question?.correctIndex || 0,
    explanation: clip.question?.explanation || "",
    transcript: clip.transcript || "",
    transcriptVi: clip.transcriptVi || "",
    sortOrder: clip.sortOrder || 0,
    isPublished: clip.isPublished !== false,
    vocabularyId: clip.vocabularyId ? String(clip.vocabularyId) : "",
    audioUrl: clip.audioUrl || "",
  };
}

function formToPayload(form) {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    level: form.level.trim(),
    ttsText: form.ttsText.trim(),
    keywords: form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    questionText: form.questionText.trim(),
    options: form.options.map((o) => o.trim()).filter(Boolean),
    correctIndex: Number(form.correctIndex) || 0,
    explanation: form.explanation.trim(),
    transcript: form.transcript.trim(),
    transcriptVi: form.transcriptVi.trim(),
    sortOrder: Number(form.sortOrder) || 0,
    isPublished: form.isPublished,
    vocabularyId: form.vocabularyId ? Number(form.vocabularyId) : null,
    audioUrl: form.audioUrl.trim(),
  };
}

export default function AdminListeningPage() {
  const [clips, setClips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/listening/clips", { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không tải được danh sách.");
      setClips(json.data || []);
    } catch (e) {
      setError(e.message || "Lỗi");
      setClips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditingId("new");
    setForm({ ...EMPTY_FORM, sortOrder: clips.length });
  }

  function startEdit(clip) {
    setEditingId(clip.dbId);
    setForm(clipToForm(clip));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  async function saveClip() {
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const isNew = editingId === "new";
      const res = await fetch(
        isNew ? "/api/admin/listening/clips" : `/api/admin/listening/clips/${editingId}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Lưu thất bại.");
      cancelEdit();
      await load();
    } catch (e) {
      alert(e.message || "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClip(id) {
    if (!window.confirm("Xóa bài nghe này?")) return;
    const res = await fetch(`/api/admin/listening/clips/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || !json.success) {
      alert(json.message || "Xóa thất bại.");
      return;
    }
    if (editingId === id) cancelEdit();
    await load();
  }

  async function seedHeadway() {
    if (!window.confirm(`Nạp ${57} bài luyện nghe từ Headway Elementary (docs/headway.txt)?`)) return;
    const res = await fetch("/api/admin/listening/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_headway" }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      alert(json.message || "Nạp Headway thất bại.");
      return;
    }
    alert(json.message || "Đã nạp bài Headway.");
    await load();
  }

  async function seedDefaults() {
    if (!window.confirm("Nạp lại 6 bài mẫu (không xóa audio đã upload)?")) return;
    const res = await fetch("/api/admin/listening/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed" }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      alert(json.message || "Nạp mẫu thất bại.");
      return;
    }
    await load();
  }

  async function uploadAudio(clipId, file) {
    if (!file) return;
    setUploadingId(clipId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/listening/clips/${clipId}/audio`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Upload thất bại.");
      await load();
      if (editingId === clipId && json.data) setForm(clipToForm(json.data));
    } catch (e) {
      alert(e.message || "Upload thất bại.");
    } finally {
      setUploadingId(null);
    }
  }

  async function importFromVocabulary(clipId) {
    const vocabId = window.prompt("Nhập ID từ vựng (bảng vocabulary) để lấy audio_url:");
    if (!vocabId) return;
    const res = await fetch(`/api/admin/listening/clips/${clipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "from_vocabulary", vocabularyId: Number(vocabId) }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      alert(json.message || "Gắn audio thất bại.");
      return;
    }
    alert(json.message || "Đã gắn audio.");
    await load();
    if (editingId === clipId && json.data) setForm(clipToForm(json.data));
  }

  return (
    <div className="adm-shell">
      <header className="adm-header">
        <div>
          <p>
            <Link href="/admin" className="adm-back">
              ← Quản trị
            </Link>
          </p>
          <h1>Luyện nghe — quản lý bài & audio</h1>
          <p>Upload MP3 hoặc gắn audio từ Từ vựng · File lưu tại <code>public/uploads/listening/</code></p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => void seedHeadway()}>
            Nạp bài Headway
          </button>
          <button type="button" className="adm-btn adm-btn--ghost" onClick={() => void seedDefaults()}>
            Nạp bài mẫu
          </button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={startCreate}>
            + Thêm bài
          </button>
        </div>
      </header>

      {error ? <p className="adm-err">{error}</p> : null}
      {loading ? <p className="adm-msg">Đang tải…</p> : null}

      {editingId ? (
        <section className="adm-card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>{editingId === "new" ? "Bài mới" : `Sửa bài #${editingId}`}</h2>
          <div className="adm-listen-form">
            <label>
              Slug (id duy nhất)
              <input
                className="adm-input"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="cafe-order"
              />
            </label>
            <label>
              Tiêu đề
              <input
                className="adm-input"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label>
              Cấp độ
              <select
                className="adm-select"
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              >
                {["A1", "A2", "B1", "B2", "C1"].map((lv) => (
                  <option key={lv} value={lv}>
                    {lv}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ khóa (phẩy)
              <input
                className="adm-input"
                value={form.keywords}
                onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
              />
            </label>
            <label className="adm-listen-form__wide">
              URL audio (MP3) — hoặc dùng Upload / Từ vựng
              <input
                className="adm-input"
                value={form.audioUrl}
                onChange={(e) => setForm((f) => ({ ...f, audioUrl: e.target.value }))}
                placeholder="/uploads/listening/ten-file.mp3"
              />
            </label>
            <label className="adm-listen-form__wide">
              TTS fallback (nếu chưa có MP3)
              <textarea
                className="adm-input"
                rows={3}
                value={form.ttsText}
                onChange={(e) => setForm((f) => ({ ...f, ttsText: e.target.value }))}
              />
            </label>
            <label className="adm-listen-form__wide">
              Câu hỏi
              <input
                className="adm-input"
                value={form.questionText}
                onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
              />
            </label>
            {form.options.map((opt, i) => (
              <label key={i}>
                Đáp án {String.fromCharCode(65 + i)}
                <input
                  className="adm-input"
                  value={opt}
                  onChange={(e) => {
                    const options = [...form.options];
                    options[i] = e.target.value;
                    setForm((f) => ({ ...f, options }));
                  }}
                />
              </label>
            ))}
            <label>
              Đáp án đúng
              <select
                className="adm-select"
                value={form.correctIndex}
                onChange={(e) => setForm((f) => ({ ...f, correctIndex: Number(e.target.value) }))}
              >
                {[0, 1, 2, 3].map((i) => (
                  <option key={i} value={i}>
                    {String.fromCharCode(65 + i)}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-listen-form__wide">
              Giải thích
              <textarea
                className="adm-input"
                rows={2}
                value={form.explanation}
                onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              />
            </label>
            <label className="adm-listen-form__wide">
              Transcript (EN)
              <textarea
                className="adm-input"
                rows={3}
                value={form.transcript}
                onChange={(e) => setForm((f) => ({ ...f, transcript: e.target.value }))}
              />
            </label>
            <label className="adm-listen-form__wide">
              Transcript (VI)
              <textarea
                className="adm-input"
                rows={2}
                value={form.transcriptVi}
                onChange={(e) => setForm((f) => ({ ...f, transcriptVi: e.target.value }))}
              />
            </label>
            <label>
              Thứ tự
              <input
                className="adm-input"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              />
              Hiển thị trên Luyện nghe
            </label>
          </div>
          <div className="adm-toolbar" style={{ marginTop: 12 }}>
            <button type="button" className="adm-btn adm-btn--primary" disabled={saving} onClick={() => void saveClip()}>
              {saving ? "Đang lưu…" : "Lưu bài"}
            </button>
            <button type="button" className="adm-btn adm-btn--ghost" onClick={cancelEdit}>
              Hủy
            </button>
          </div>
        </section>
      ) : null}

      <section className="adm-card">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Bài</th>
                <th>Audio</th>
                <th>Cấp</th>
                <th>TT</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {clips.map((clip) => (
                <tr key={clip.dbId}>
                  <td>{clip.sortOrder}</td>
                  <td>
                    <strong>{clip.title}</strong>
                    <br />
                    <small>{clip.id}</small>
                  </td>
                  <td>
                    {clip.audioUrl ? (
                      <a href={clip.audioUrl} target="_blank" rel="noreferrer">
                        MP3 ✓
                      </a>
                    ) : clip.vocabularyId ? (
                      <span>Từ vựng #{clip.vocabularyId}</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>TTS</span>
                    )}
                  </td>
                  <td>{clip.level}</td>
                  <td>{clip.isPublished ? "✓" : "Ẩn"}</td>
                  <td>
                    <div className="adm-listen-actions">
                      <button type="button" className="adm-btn adm-btn--ghost" onClick={() => startEdit(clip)}>
                        Sửa
                      </button>
                      <label className="adm-btn adm-btn--ghost adm-listen-upload">
                        {uploadingId === clip.dbId ? "…" : "Upload MP3"}
                        <input
                          type="file"
                          accept="audio/*,.mp3,.wav,.ogg,.m4a"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            void uploadAudio(clip.dbId, f);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="adm-btn adm-btn--ghost"
                        onClick={() => void importFromVocabulary(clip.dbId)}
                      >
                        Từ vựng
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn--ghost"
                        style={{ color: "#b91c1c" }}
                        onClick={() => void deleteClip(clip.dbId)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !clips.length ? (
          <p className="adm-msg">Chưa có bài. Bấm «Nạp bài mẫu» hoặc «Thêm bài».</p>
        ) : null}
      </section>

      <section className="adm-card adm-msg" style={{ marginTop: 16 }}>
        <strong>Hướng dẫn nhanh</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.5 }}>
          <li>
            <strong>Upload MP3:</strong> bấm «Upload MP3» → file lưu tại{" "}
            <code>/uploads/listening/tên-slug-thời-gian.mp3</code>
          </li>
          <li>
            <strong>Từ vựng:</strong> bấm «Từ vựng» → nhập ID từ (xem trong bảng vocabulary) → dùng{" "}
            <code>audio_url</code> có sẵn
          </li>
          <li>
            <strong>Thủ công:</strong> copy MP3 vào <code>public/uploads/listening/</code> rồi sửa bài, dán URL{" "}
            <code>/uploads/listening/ten-file.mp3</code> — hoặc dùng upload ở trên
          </li>
        </ul>
      </section>
    </div>
  );
}
