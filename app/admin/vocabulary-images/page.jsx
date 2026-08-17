"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const STATUS_TABS = ["pending", "approved", "rejected", "hidden"];
const STYLE_OPTIONS = ["auto", "cartoon", "real_photo", "none"];

const STATUS_LABELS = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  hidden: "Đã ẩn",
};

const STYLE_LABELS = {
  auto: "Tự động",
  cartoon: "Cartoon / 3D",
  real_photo: "Ảnh thật",
  none: "Không ảnh",
};

export default function AdminVocabularyImagesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/vocabulary/images?status=${encodeURIComponent(status)}&page=${page}&limit=${limit}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Không tải được danh sách ảnh.");
        setItems([]);
        setTotal(0);
      } else {
        setItems(json.data || []);
        setTotal(Number(json.pagination?.total || 0));
      }
    } catch {
      setError("Lỗi kết nối.");
      setItems([]);
      setTotal(0);
    }
    setLoading(false);
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action, ids, extra = {}) {
    const res = await fetch("/api/admin/vocabulary/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids, ...extra }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      alert(json.message || "Thao tác thất bại.");
      return;
    }
    void load();
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main style={{ minHeight: "100vh", padding: "1rem", background: "#f8fafc" }}>
      <section style={{ maxWidth: 1200, margin: "0 auto" }}>
        <p>
          <Link href="/admin">← Quản trị</Link>
        </p>
        <h1 style={{ margin: "0 0 0.5rem" }}>Duyệt ảnh từ vựng</h1>
        <p style={{ color: "#475569", marginBottom: "1rem" }}>
          Prompt theo word + nghĩa VI + loại từ + topic + câu ví dụ · Không dùng Google Images
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 999,
                border: status === s ? "2px solid #2563eb" : "1px solid #e2e8f0",
                background: status === s ? "#eff6ff" : "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>

        {loading ? <p>Đang tải…</p> : null}
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {items.map((item) => (
            <article
              key={item.id}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: 160,
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 8,
                }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.word}
                    style={{ maxWidth: "100%", maxHeight: 144, objectFit: "contain" }}
                  />
                ) : (
                  <span style={{ fontSize: "2rem", opacity: 0.4 }}>📚</span>
                )}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{item.word}</strong>
                  <span style={{ fontSize: 11, color: "#64748b" }}>#{item.id}</span>
                </div>
                <p style={{ margin: "4px 0", fontSize: 13, color: "#475569" }}>
                  {item.vietnamese_meaning}
                </p>
                <p style={{ margin: "4px 0", fontSize: 11, color: "#64748b" }}>
                  Style: <strong>{item.image_style || "auto"}</strong>
                  {item.image_source ? (
                    <>
                      {" "}
                      · Nguồn: <strong>{item.image_source}</strong>
                    </>
                  ) : null}
                </p>
                {item.semantic_hint ? (
                  <p style={{ margin: "4px 0", fontSize: 11, color: "#64748b" }}>
                    Hint: {item.semantic_hint.slice(0, 100)}
                    {item.semantic_hint.length > 100 ? "…" : ""}
                  </p>
                ) : null}
                {item.image_prompt ? (
                  <details style={{ marginTop: 6, fontSize: 11, color: "#475569" }}>
                    <summary style={{ cursor: "pointer" }}>Xem prompt</summary>
                    <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{item.image_prompt}</p>
                  </details>
                ) : null}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                  <select
                    defaultValue={item.image_style || "auto"}
                    onChange={(e) => runAction("set_style", [item.id], { image_style: e.target.value })}
                    style={{ fontSize: 12, padding: "4px 6px", borderRadius: 6 }}
                  >
                    {STYLE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STYLE_LABELS[s] || s}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => runAction("approve", [item.id])}>
                    Duyệt
                  </button>
                  <button type="button" onClick={() => runAction("reject", [item.id])}>
                    Từ chối
                  </button>
                  <button type="button" onClick={() => runAction("regenerate", [item.id])}>
                    Tạo lại
                  </button>
                  <button type="button" onClick={() => runAction("hide", [item.id])}>
                    Ẩn ảnh
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {!loading && !items.length ? (
          <p style={{ color: "#64748b", textAlign: "center", marginTop: 24 }}>Không có mục nào.</p>
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Trước
          </button>
          <span>
            {page}/{totalPages} ({total} mục)
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Sau
          </button>
        </div>
      </section>
    </main>
  );
}
