"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getLessonPlayerPath } from "@/lib/beego/lesson-player";

/**
 * Compact placement CTA + modal for new users (no Learn homepage redesign).
 */
export default function PlacementBanner({ onApplied }) {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle|testing|result
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/learn/placement", { cache: "no-store", credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) setStatus(json.data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/learn/placement", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.message || "Không bắt đầu được bài kiểm tra.");
        return;
      }
      setSession(json.data);
      setAnswer(null);
      setFeedback(null);
      setResult(null);
      setPhase("testing");
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!session || answer == null || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/learn/placement", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          session_id: session.sessionId,
          answer_key: session.answerKey,
          guest_token: session.guestToken,
          answer,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.message || "Không gửi được đáp án.");
        return;
      }
      const data = json.data;
      if (data.duplicate) return;
      setFeedback(data.isCorrect ? "correct" : "wrong");
      await new Promise((r) => setTimeout(r, 450));
      if (data.done) {
        setResult(data.result);
        setPhase("result");
        setFeedback(null);
        void refreshStatus();
      } else {
        setSession((prev) => ({
          ...prev,
          question: data.question,
          answerKey: data.answerKey,
          questionIndex: data.questionIndex,
        }));
        setAnswer(null);
        setFeedback(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const choose = async (choice) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/learn/placement", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "choose_start", choice }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        if (status?.guest) {
          setOpen(false);
          setPhase("idle");
          return;
        }
        setError(json.message || "Không lưu được lựa chọn.");
        return;
      }
      setOpen(false);
      setPhase("idle");
      void refreshStatus();
      onApplied?.(json.data);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (status?.guest) {
      setOpen(false);
      try {
        sessionStorage.setItem("beego:placement-skipped", "1");
      } catch {
        /* ignore */
      }
      void refreshStatus();
      return;
    }
    await choose("skipped");
  };

  if (!status) return null;

  let guestSkipped = false;
  try {
    guestSkipped = sessionStorage.getItem("beego:placement-skipped") === "1";
  } catch {
    guestSkipped = false;
  }
  if (status.guest && guestSkipped) return null;

  const needsBanner =
    status.needed === true ||
    (status.completed === true && !status.result?.startChoice);
  if (!needsBanner) return null;

  const q = session?.question;

  return (
    <>
      <div className="beego-placement-banner" role="region" aria-label="Kiểm tra đầu vào">
        <div className="beego-placement-banner__text">
          <strong>Kiểm tra đầu vào</strong>
          <span>Làm bài ngắn để Beego đề xuất bài bắt đầu phù hợp (không cộng XP).</span>
        </div>
        <div className="beego-placement-banner__actions">
          <button type="button" className="beego-placement-banner__cta" onClick={start} disabled={busy}>
            {status.completed && !status.result?.startChoice ? "Chọn điểm bắt đầu" : "Bắt đầu"}
          </button>
          <button type="button" className="beego-placement-banner__skip" onClick={skip} disabled={busy}>
            Bỏ qua
          </button>
        </div>
      </div>

      {open ? (
        <div className="beego-placement-modal" role="dialog" aria-modal="true">
          <div className="beego-placement-modal__card">
            {phase === "testing" && q ? (
              <>
                <p className="beego-placement-modal__meta">
                  Câu {session.questionIndex}/{session.maxQuestions} · {q.skillKey}
                </p>
                <h2 className="beego-placement-modal__prompt">{q.prompt}</h2>
                {q.options?.length ? (
                  <div className="beego-placement-modal__options">
                    {q.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`beego-placement-modal__opt${answer === opt.id ? " is-selected" : ""}`}
                        onClick={() => setAnswer(opt.id)}
                        disabled={!!feedback || busy}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                ) : null}
                {q.type === "word_order" && Array.isArray(q.wordBank) ? (
                  <p className="beego-placement-modal__hint">Dạng sắp xếp từ — chọn đáp án gần đúng nhất nếu có.</p>
                ) : null}
                {feedback ? (
                  <p className={`beego-placement-modal__fb beego-placement-modal__fb--${feedback}`}>
                    {feedback === "correct" ? "Đúng!" : "Chưa đúng — tiếp tục."}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="beego-placement-banner__cta"
                  onClick={submit}
                  disabled={busy || answer == null || !!feedback}
                >
                  Kiểm tra
                </button>
              </>
            ) : null}

            {phase === "result" && result ? (
              <>
                <h2>Kết quả Placement</h2>
                <ul className="beego-placement-modal__result">
                  <li>Điểm: <strong>{result.placementScore}</strong></li>
                  <li>Trình độ ước tính: <strong>{result.estimatedLevel}</strong></li>
                  <li>Độ tin cậy: <strong>{Math.round((result.confidence || 0) * 100)}%</strong></li>
                  <li>
                    Điểm mạnh: {(result.strengths || []).join(", ") || "—"}
                  </li>
                  <li>
                    Cần luyện: {(result.weakSkills || []).join(", ") || "—"}
                  </li>
                  <li>
                    Bài đề xuất: <code>{result.recommendedLessonId}</code>
                  </li>
                </ul>
                <p className="beego-placement-modal__hint">Không cộng XP / Honey / Streak.</p>
                <div className="beego-placement-modal__choices">
                  <Link
                    className="beego-placement-banner__cta"
                    href={getLessonPlayerPath(result.recommendedLessonId)}
                    onClick={() => choose("recommended")}
                  >
                    Bắt đầu bài đề xuất
                  </Link>
                  <button type="button" className="beego-placement-banner__skip" onClick={() => choose("from_start")} disabled={busy}>
                    Học từ đầu
                  </button>
                </div>
              </>
            ) : null}

            {error ? <p className="beego-placement-modal__error">{error}</p> : null}
            <button type="button" className="beego-placement-modal__close" onClick={() => setOpen(false)}>
              Đóng
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
