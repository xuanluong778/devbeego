"use client";

import Link from "next/link";
import { findActiveNode, getLessonHref, getNodeTypeLabel } from "@/lib/beego/learning-path";

/**
 * Sticky “Học tiếp” dock (flow 01) — always shows the next allowed lesson.
 */
export default function LearnContinueDock({ sections, loading = false }) {
  const active = findActiveNode(sections);
  if (!active?.node) return null;

  const href = getLessonHref(active.node);
  if (!href) return null;

  const typeLabel = getNodeTypeLabel(active.node) || "Bài học";
  const title = active.node.title || "Bài tiếp theo";
  const minutes = Number(active.node.duration) || 0;

  return (
    <div className="beego-learn-continue-dock" role="region" aria-label="Học tiếp">
      <div className="beego-learn-continue-dock__copy">
        <span className="beego-learn-continue-dock__eyebrow">
          {loading ? "Đang đồng bộ…" : "Bài tiếp theo"}
        </span>
        <strong className="beego-learn-continue-dock__title">{title}</strong>
        <span className="beego-learn-continue-dock__meta">
          {typeLabel}
          {minutes > 0 ? ` · ~${minutes} phút` : ""}
          {active.node.honeyReward ? ` · +${active.node.honeyReward} Honey` : ""}
        </span>
      </div>
      <Link href={href} className="beego-learn-continue-dock__cta">
        Học tiếp
      </Link>
    </div>
  );
}
