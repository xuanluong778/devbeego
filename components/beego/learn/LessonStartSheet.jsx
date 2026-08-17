"use client";

import { useEffect } from "react";
import Link from "next/link";
import { getNodeCta, getNodeType } from "@/lib/beego/learning-path";
import { isTestNode, isReviewNode } from "@/lib/beego/learning-path-build";
import LearningNodeIcon from "./LearningNodeIcon";

function SheetMeta({ node }) {
  return (
    <ul className="beego-learn-sheet__meta">
      {node.nodeIndex ? <li>#{node.nodeIndex}/16</li> : null}
      {node.duration ? <li>⏱ {node.duration} phút</li> : null}
      {node.honeyReward ? <li>🍯 +{node.honeyReward} Honey</li> : null}
      {node.xpReward ? <li>⭐ +{node.xpReward} XP</li> : null}
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
      {node.goal ? <p className="beego-learn-sheet__goal">{node.goal}</p> : null}
      <SheetMeta node={node} />
      {node.status === "completed" ? (
        <p className="beego-learn-sheet__done">✓ Bài đã hoàn thành</p>
      ) : null}
    </>
  );
}

export default function LessonStartSheet({ open, node, sheetKind, onClose }) {
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

  return (
    <div className="beego-learn-sheet-root" role="presentation">
      <button type="button" className="beego-learn-sheet-backdrop" aria-label="Đóng" onClick={onClose} />
      <div className="beego-learn-sheet" role="dialog" aria-modal="true" aria-labelledby="learn-sheet-title">
        <div className="beego-learn-sheet__handle" aria-hidden />
        <button type="button" className="beego-learn-sheet__close" onClick={onClose} aria-label="Đóng">
          ×
        </button>
        <div className="beego-learn-sheet__scroll">
          <SheetBody node={node} sheetKind={sheetKind} />
        </div>
        <div className="beego-learn-sheet__footer">
          <SheetCta node={node} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
