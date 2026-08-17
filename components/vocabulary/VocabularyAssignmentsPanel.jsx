"use client";

import { useEffect, useState } from "react";

function formatDue(due) {
  if (!due) return "Không hạn";
  try {
    return new Date(due).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(due);
  }
}

function formatMinutes(seconds) {
  const m = Math.round(Number(seconds || 0) / 60);
  return m > 0 ? `${m} phút` : "—";
}

export default function VocabularyAssignmentsPanel() {
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/vocabulary/assignments", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setAuthenticated(Boolean(json.data?.authenticated));
          setAssignments(json.data?.assignments || []);
        }
      } catch {
        setAssignments([]);
      }
      setLoading(false);
    }
    void load();
  }, []);

  if (loading || !authenticated || !assignments.length) return null;

  return (
    <section className="vocab-assignments" aria-label="Bài tập được giao">
      <div className="vocab-assignments__head">
        <div>
          <p className="vocab-assignments__eyebrow">Lớp học</p>
          <h2 className="vocab-assignments__title">Bài được giao</h2>
        </div>
        <span className="vocab-assignments__count">{assignments.length} bài</span>
      </div>
      <div className="vocab-assignments__list">
        {assignments.map((a) => {
          const studied = Number(a.words_studied || 0);
          const total = Number(a.word_count || 0);
          const pct = total > 0 ? Math.min(100, Math.round((studied / total) * 100)) : 0;
          return (
            <article key={a.id} className="vocab-assignments__card">
              <div className="vocab-assignments__cardTop">
                <strong>{a.title}</strong>
                <span className="vocab-assignments__due">Hạn: {formatDue(a.due_at)}</span>
              </div>
              <p className="vocab-assignments__meta">
                {a.classroom_name} · {a.set_title} · {total} từ
              </p>
              <div className="vocab-assignments__progress">
                <div className="vocab-assignments__bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <span className="vocab-assignments__pct">
                  {studied}/{total} từ · {formatMinutes(a.study_seconds)}
                </span>
              </div>
              {a.instructions ? (
                <p className="vocab-assignments__instr">{a.instructions}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
