"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "../../teacher.css";

export default function AssignmentReportPage({ params }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/org/assignments/${params.id}/report`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || "Không tải được báo cáo.");
        } else {
          setData(json.data);
        }
      } catch {
        setError("Lỗi kết nối.");
      }
      setLoading(false);
    }
    void load();
  }, [params.id]);

  if (loading) return <main className="teacher-portal"><p>Đang tải báo cáo…</p></main>;
  if (error) return <main className="teacher-portal"><p className="teacher-error">{error}</p></main>;
  if (!data) return null;

  const { assignment, students, weak_words, summary } = data;

  return (
    <main className="teacher-portal">
      <header className="teacher-portal__head">
        <div>
          <Link href="/teacher" className="teacher-portal__link">
            ← Teacher Portal
          </Link>
          <h1>{assignment.title}</h1>
          <p>
            {assignment.classroom_name} · {assignment.set_title} · {assignment.word_count} từ
          </p>
        </div>
      </header>

      <div className="teacher-report-summary">
        <div>
          <strong>{summary.student_count}</strong>
          <span>Học viên</span>
        </div>
        <div>
          <strong>{summary.studied_count}</strong>
          <span>Đã học</span>
        </div>
        <div>
          <strong>{summary.completed_count}</strong>
          <span>Hoàn thành</span>
        </div>
      </div>

      <section className="teacher-card teacher-card--wide">
        <h2>Tiến độ học viên</h2>
        <div className="teacher-table-wrap">
          <table className="teacher-table">
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Đã học</th>
                <th>Đúng</th>
                <th>Sai</th>
                <th>Phút học</th>
              </tr>
            </thead>
            <tbody>
              {(students || []).map((s) => (
                <tr key={s.user_id}>
                  <td>
                    {s.name}
                    <small>{s.email}</small>
                  </td>
                  <td>
                    {s.words_studied}/{assignment.word_count}
                  </td>
                  <td>{s.correct_count}</td>
                  <td>{s.wrong_count}</td>
                  <td>{Math.round(Number(s.study_seconds || 0) / 60)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="teacher-card teacher-card--wide">
        <h2>Từ yếu (hay sai)</h2>
        <ul className="teacher-list">
          {(weak_words || []).slice(0, 30).map((w, i) => (
            <li key={`${w.user_id}-${w.word}-${i}`}>
              <strong>{w.student_name}</strong> · {w.word} — {w.meaning_vi}
              <span> ({w.wrong_count} lần sai)</span>
            </li>
          ))}
          {!weak_words?.length ? <li>Chưa có dữ liệu từ yếu.</li> : null}
        </ul>
      </section>
    </main>
  );
}
