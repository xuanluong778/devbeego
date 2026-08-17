"use client";

import { useState } from "react";
import LearningNodeIcon from "./LearningNodeIcon";
import LearnNodeTooltip from "./LearnNodeTooltip";

export default function BossNode({ node, align, onClick }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const isActive = node.status === "active";
  const isLocked = node.status === "locked";
  const badge = isActive ? "HỌC VƯỢT?" : null;

  return (
    <div className={`beego-learn-node-wrap beego-learn-node-wrap--${align}`}>
      <LearnNodeTooltip node={node} open={tooltipOpen}>
        <button
          type="button"
          className={`beego-learn-node beego-learn-node--boss beego-learn-node--${node.status}`}
          onClick={() => onClick(node)}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
          aria-label={node.title}
        >
          <span className="beego-learn-node__circle beego-learn-node__circle--boss">
            <LearningNodeIcon node={node} size="lg" />
          </span>
          {badge ? <span className="beego-learn-node__badge beego-learn-node__badge--boss">{badge}</span> : null}
          {!isLocked && !isActive ? (
            <span className="beego-learn-node__title">{node.title}</span>
          ) : null}
        </button>
      </LearnNodeTooltip>
    </div>
  );
}
