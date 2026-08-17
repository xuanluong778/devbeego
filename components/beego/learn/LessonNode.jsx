"use client";

import { useState } from "react";
import { getActiveNodeBadge, getNodeType } from "@/lib/beego/learning-path";
import { isTestNode } from "@/lib/beego/learning-path-build";
import LearningNodeIcon from "./LearningNodeIcon";
import LearnNodeTooltip from "./LearnNodeTooltip";

export default function LessonNode({ node, align, onClick }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const nodeType = getNodeType(node);
  const isActive = node.status === "active";
  const isLocked = node.status === "locked";
  const isCompleted = node.status === "completed";
  const isTest = isTestNode(node);
  const badge = getActiveNodeBadge(node);
  const showTitle = isActive || isCompleted || (!isLocked && !isActive);

  return (
    <div className={`beego-learn-node-wrap beego-learn-node-wrap--${align}`}>
      <LearnNodeTooltip node={node} open={tooltipOpen}>
        <button
          type="button"
          className={[
            "beego-learn-node",
            `beego-learn-node--${nodeType}`,
            `beego-learn-node--${node.status}`,
            isTest ? "beego-learn-node--test" : "",
            isActive ? "beego-learn-node--current" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onClick(node)}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
          aria-label={`${node.title}${isLocked ? " — đã khóa" : ""}`}
          aria-current={isActive ? "step" : undefined}
        >
          <span
            className={`beego-learn-node__circle${isTest ? " beego-learn-node__circle--test" : ""}`}
          >
            <LearningNodeIcon node={node} size={isTest ? "lg" : isActive ? "md" : "md"} />
          </span>
          {badge ? (
            <span className={`beego-learn-node__badge${isTest ? " beego-learn-node__badge--test" : ""}`}>
              {badge}
            </span>
          ) : null}
          {showTitle ? (
            <span
              className={`beego-learn-node__title${isActive ? " beego-learn-node__title--active" : ""}${isCompleted ? " beego-learn-node__title--done" : ""}`}
            >
              {node.title}
            </span>
          ) : null}
        </button>
      </LearnNodeTooltip>
    </div>
  );
}
