"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isOrdinaryLessonCall, learnCallEntryFromResponse } from "@/lib/beego/learn/ai-call-access";

function formatServerDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "";
  const total = Math.max(0, Math.round(n / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds} giây`;
  return `${minutes} phút ${seconds} giây`;
}
import LearnCallRoom from "./LearnCallRoom";

export default function LearnLessonCall({
  lessonId,
  lessonType,
  sectionId = "",
  autoCheck = false,
  onDismiss,
  returnLabel = "Quay lại bài",
}) {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [resolvedLessonId, setResolvedLessonId] = useState(lessonId);
  const [view, setView] = useState(autoCheck ? "checking" : "closed");
  const [message, setMessage] = useState("");
  const [offer, setOffer] = useState(null);
  const [call, setCall] = useState(null);
  const [busy, setBusy] = useState(false);
  const autoCheckedRef = useRef(false);

  useEffect(() => {
    let cancel = false;
    fetch("/api/learn/ai-call/status", { cache: "no-store", credentials: "same-origin" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancel) setEnabled(Boolean(json?.data?.enabled));
      })
      .catch(() => {
        if (!cancel) setEnabled(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const closePanel = () => {
    setCall(null);
    setView("closed");
    onDismiss?.();
  };

  const releaseSession = async (sessionId) => {
    if (!sessionId) return;
    try {
      await fetch("/api/learn/ai-call/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      /* the open marker expires on its own */
    }
  };

  const checkAccess = async () => {
    setBusy(true);
    setMessage("");
    try {
      const query = new URLSearchParams({ lessonId: resolvedLessonId || lessonId });
      if (sectionId) query.set("sectionId", sectionId);
      const res = await fetch(`/api/learn/ai-call/access?${query.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      const next = learnCallEntryFromResponse(res.status, json);
      setMessage(json?.message || "");
      if (json?.data?.lesson?.lessonId) setResolvedLessonId(json.data.lesson.lessonId);
      setOffer(json?.data?.lesson || null);
      setView(next.view === "hidden" ? "closed" : next.view);
      if (next.view === "hidden") {
        setEnabled(false);
        onDismiss?.();
      }
    } catch {
      setView("retry");
      setMessage("Không kiểm tra được quyền gọi. Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoCheck || !enabled || autoCheckedRef.current) return;
    autoCheckedRef.current = true;
    void checkAccess();
  }, [autoCheck, enabled]);

  const start = async () => {
    if (busy || call) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/learn/ai-call/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId: resolvedLessonId || lessonId, sectionId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        const next = learnCallEntryFromResponse(res.status, json);
        setMessage(json?.message || "");
        setView(next.view === "prepare" ? "retry" : next.view);
        return;
      }
      setOffer((current) => ({
        ...(current || {}),
        limits: json.data?.limits || current?.limits,
        hints: json.data?.hints || current?.hints,
      }));
      const wsUrl = String(json.data?.wsUrl || "");
      const token = String(json.data?.token || "");
      const nextSessionId = String(json.data?.sessionId || "");
      if (!wsUrl || !token || !nextSessionId) {
        setView("notready");
        setMessage(
          "Phiên gọi đã được cấp, nhưng kết nối thoại theo bài học chưa hoàn thiện. Cuộc gọi chưa bắt đầu và không được tính là đã hoàn thành."
        );
        return;
      }
      setCall({ token, sessionId: nextSessionId, wsUrl });
      setView("live");
      setMessage("");
    } catch {
      setView("retry");
      setMessage("Không mở được phiên gọi. Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const loginHref = `/auth?next=${encodeURIComponent(pathname || "/")}`;

  if (!isOrdinaryLessonCall(lessonType) || !enabled) return null;

  return (
    <div className="beego-lesson-call">
      {view === "closed" ? (
        <button type="button" className="beego-lesson-call__open" onClick={checkAccess} disabled={busy}>
          {busy ? "Đang kiểm tra…" : "Gọi AI — thực hành bài vừa học"}
        </button>
      ) : null}

      {view === "login" ? (
        <div className="beego-lesson-call__panel" role="status">
          <p>Đăng nhập để gọi AI sau bài học.</p>
          <Link href={loginHref}>Đăng nhập</Link>
          <button type="button" onClick={closePanel}>
            {returnLabel}
          </button>
        </div>
      ) : null}

      {view === "checking" ? (
        <p className="beego-lesson-call__panel" role="status">Đang kiểm tra quyền gọi…</p>
      ) : null}

      {view === "quota" ? (
        <div className="beego-lesson-call__panel" role="status">
          <p>{message || "Đã hết hạn mức gọi của gói thử nghiệm trong hôm nay."}</p>
          <button type="button" onClick={closePanel}>
            {returnLabel}
          </button>
        </div>
      ) : null}

      {view === "upgrade" ? (
        <div className="beego-lesson-call__panel" role="status">
          <p>{message || "Gói hiện tại chưa có cuộc gọi AI."}</p>
          <Link href="/account">Xem gói học</Link>
          <button type="button" onClick={closePanel}>
            {returnLabel}
          </button>
        </div>
      ) : null}

      {view === "retry" || view === "unavailable" ? (
        <div className="beego-lesson-call__panel" role="status">
          <p>{message || "Không kiểm tra được quyền gọi. Hãy thử lại."}</p>
          {view === "retry" ? (
            <button type="button" onClick={checkAccess} disabled={busy}>
              Thử lại
            </button>
          ) : null}
          <button type="button" onClick={closePanel}>
            {returnLabel}
          </button>
        </div>
      ) : null}

      {view === "prepare" ? (
        <div className="beego-lesson-call__panel" role="region" aria-label="Chuẩn bị gọi AI">
          <p>
            <strong>Chủ đề:</strong> {offer?.title || "Bài học"}
          </p>
          <p>
            <strong>Mục tiêu:</strong> {offer?.objective || "Ôn nội dung bài vừa học."}
          </p>
          <p>
            <strong>{offer?.limits?.levelLabel || "Mức 1 — Làm quen"}</strong>
            {" · "}tối đa {offer?.limits?.maxMinutes ?? 2} phút mỗi phiên
            {offer?.limits?.targetTurns ? ` · ${offer.limits.targetTurns}` : ""}
          </p>
          {Number.isFinite(offer?.limits?.packageRemainingMs) ? (
            <p>
              {offer.limits.packageLabel || "Hạn mức gói"}: còn {formatServerDuration(offer.limits.packageRemainingMs)} theo server.
            </p>
          ) : null}
          <button type="button" onClick={start} disabled={busy}>
            {busy ? "Đang mở phiên…" : "Bắt đầu"}
          </button>
          <button type="button" onClick={closePanel} disabled={busy}>
            {returnLabel}
          </button>
        </div>
      ) : null}

      {view === "live" && call ? (
        <LearnCallRoom
          token={call.token}
          sessionId={call.sessionId}
          wsUrl={call.wsUrl}
          offer={offer}
          returnLabel={returnLabel}
          onClose={() => {
            const sessionId = call?.sessionId;
            void releaseSession(sessionId);
            closePanel();
          }}
        />
      ) : null}
      {view === "notready" ? (
        <div className="beego-lesson-call__panel" role="status">
          <p>{message}</p>
          <button type="button" onClick={closePanel}>
            {returnLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
