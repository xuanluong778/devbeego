"use client";

import { useState } from "react";
import LearningNodeIcon from "./LearningNodeIcon";
import LearnNodeTooltip from "./LearnNodeTooltip";

export default function RewardChestNode({ node, align, onClick }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const isLocked = node.status === "locked";

  return (
    <div className={`beego-learn-node-wrap beego-learn-node-wrap--${align}`}>
      <LearnNodeTooltip node={node} open={tooltipOpen}>
        <button
          type="button"
          className={`beego-learn-node beego-learn-node--chest beego-learn-node--${node.status}`}
          onClick={() => onClick(node)}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
          onFocus={() => setTooltipOpen(true)}
          onBlur={() => setTooltipOpen(false)}
          aria-label={node.title}
        >
          <span className="beego-learn-node__circle beego-learn-node__circle--chest">
            <LearningNodeIcon node={node} size="md" />
          </span>
          {!isLocked ? <span className="beego-learn-node__title">{node.title}</span> : null}
        </button>
      </LearnNodeTooltip>
    </div>
  );
}
