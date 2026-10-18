"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getNodeCta, getNodeType } from "@/lib/beego/learning-path";
import { isTestNode, isReviewNode } from "@/lib/beego/learning-path-build";
import { isLessonSuitableForAiPractice } from "@/lib/beego/learn/learn-ai-practice-eligibility";
import aiStyles from "@/components/beego/lesson-player/LessonAiConversation.module.css";
import LearningNodeIcon from "./LearningNodeIcon";

function SheetMeta({ node }) {
  return (
    <ul className="beego-learn-sheet__meta">
      {node.nodeIndex ? <li>#{node.nodeIndex}/16</li> : null}
      {node.duration ? <li>{node.duration} phút</li> : null}
      {node.honeyReward ? (
        <li className="beego-learn-sheet__honey-bump">+{node.honeyReward} Honey</li>
      ) : null}
      {node.xpReward ? <li>+{node.xpReward} XP</li> : null}
    </ul>
  );
}

function SheetCta({ node, onClose }) {
  const cta = getNodeCta(node);
  const className = `beego-learn-sheet__btn beego-learn-sheet__btn--${cta.variant}`;

  if (cta.disabled || !cta.href) {
    return (
      <button type="button" className={className} onClick={onClose} disabled={cta.disabled}>
        {cta.label}
      </button>
    );
  }

  return (
    <Link href={cta.href} className={className}>
      {cta.label}
    </Link>
  );
}

const INTEGRATED_SKILL_CHIPS = [
  "Nghe chọn hình",
  "Chọn nghĩa",
  "Ghép từ",
  "Sắp xếp câu",
  "Nghe điền",
  "Dịch",
  "Hội thoại",
  "Đọc thành tiếng",
];

const TYPE_SKILL_CHIPS = {
  vocabulary: ["Từ vựng", "Chọn nghĩa"],
  grammar: ["Ngữ pháp", "Điền ngữ cảnh"],
  sentence_patterns: ["Mẫu câu", "Sắp xếp câu"],
  listening: ["Nghe hiểu", "Nghe điền"],
  speaking: ["Phát âm", "Đọc thành tiếng"],
  story: ["Đọc hiểu", "Từ trong chuyện"],
  review: ["Ôn tập", "Củng cố"],
  test: ["Kiểm tra", "Tổng hợp"],
};

function SheetSkillChips({ node }) {
  const chips = node.integratedLesson
    ? INTEGRATED_SKILL_CHIPS
    : TYPE_SKILL_CHIPS[getNodeType(node)] || ["Bài học"];

  return (
    <ul className="beego-learn-sheet__chips" aria-label="Kỹ năng trong bài">
      {chips.map((label) => (
        <li key={label} className="beego-learn-sheet__chip">
          {label}
        </li>
      ))}
    </ul>
  );
}

function SheetBody({ node, sheetKind }) {
  if (!node) return null;

  if (sheetKind === "locked") {
    return (
      <>
        <div className="beego-learn-sheet__icon beego-learn-sheet__icon--locked" aria-hidden>
          🔒
        </div>
        <h3 id="learn-sheet-title" className="beego-learn-sheet__title">
          {node.title}
        </h3>
        <p className="beego-learn-sheet__msg">
          {node.unlockHint || "Hoàn thành bài trước để mở khóa."}
        </p>
      </>
    );
  }

  const nodeType = getNodeType(node);
  const iconClass = [
    "beego-learn-sheet__icon",
    "beego-learn-sheet__icon--node",
    isTestNode(node) ? "beego-learn-sheet__icon--test" : "",
    isReviewNode(node) ? "beego-learn-sheet__icon--review" : "",
    nodeType === "story" ? "beego-learn-sheet__icon--story" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={iconClass}>
        <LearningNodeIcon node={node} size="lg" />
      </div>
      <h3 id="learn-sheet-title" className="beego-learn-sheet__title">
        {node.title}
      </h3>
      {node.subtitle ? <p className="beego-learn-sheet__sub">{node.subtitle}</p> : null}
      <SheetSkillChips node={node} />
      {node.goal ? <p className="beego-learn-sheet__goal">{node.goal}</p> : null}
      <SheetMeta node={node} />
      {node.status === "completed" ? (
        <p className="beego-learn-sheet__done">Bài đã hoàn thành. Học lại không cộng thêm Honey hay XP.</p>
      ) : null}
    </>
  );
}

export default function LessonStartSheet({ open, node, sheetKind, anchor, onClose, onResumeAi }) {
  const [desktop, setDesktop] = useState(false);
  const [aiResume, setAiResume] = useState(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open || !node?.lessonId || !onResumeAi || !isLessonSuitableForAiPractice(node)) {
      setAiResume(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const statusRes = await fetch("/api/learn/chat/status", { cache: "no-store" });
        const statusJson = await statusRes.json().catch(() => ({}));
        if (!statusRes.ok || !statusJson?.data?.enabled) {
          if (!cancelled) setAiResume(null);
          return;
        }
        const res = await fetch(
          `/api/learn/chat/session?lesson_id=${encodeURIComponent(node.lessonId)}`,
          { credentials: "same-origin", cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json.success && json.data?.session?.session_id) {
          setAiResume({
            status: json.data.session.status || "active",
          });
        } else {
          setAiResume(null);
        }
      } catch {
        if (!cancelled) setAiResume(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, node, onResumeAi]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !node) return null;

  const isDesktopFloat = desktop;
  let floatStyle;
  if (isDesktopFloat && typeof window !== "undefined") {
    const margin = 16;
    const maxHeight = Math.min(560, Math.max(160, window.innerHeight - margin * 2));
    const preferredTop = anchor ? anchor.top - 24 : margin;
    const top = Math.min(
      Math.max(preferredTop, margin),
      Math.max(margin, window.innerHeight - maxHeight - margin)
    );
    floatStyle = {
      position: "fixed",
      top,
      left: "50%",
      transform: "translateX(-50%)",
      maxHeight,
      width: "min(420px, calc(100vw - 32px))",
    };
  }

  return (
    <div
      className={`beego-learn-sheet-root${isDesktopFloat ? " beego-learn-sheet-root--desktop" : ""}`}
      role="presentation"
    >
      <button type="button" className="beego-learn-sheet-backdrop" aria-label="Đóng" onClick={onClose} />
      <div
        className={`beego-learn-sheet${isDesktopFloat ? " beego-learn-sheet--float" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="learn-sheet-title"
        style={floatStyle}
      >
        <div className="beego-learn-sheet__handle" aria-hidden />
        <button type="button" className="beego-learn-sheet__close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
        <div className="beego-learn-sheet__scroll">
          <SheetBody node={node} sheetKind={sheetKind} />
        </div>
        <div className="beego-learn-sheet__footer">
          <SheetCta node={node} onClose={onClose} />
          {aiResume && onResumeAi ? (
            <button
              type="button"
              className={aiStyles.secondaryCta}
              onClick={() => onResumeAi(node.lessonId)}
            >
              {aiResume.status === "closed" ? "Xem góp ý với AI" : "Tiếp tục thực hành với AI"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
