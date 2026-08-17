"use client";

import { getNodeCta, getNodeType, getNodeTypeLabel, getNodeStatusLabel } from "@/lib/beego/learning-path";

export default function LearnNodeTooltip({ node, children, open = false }) {
  const cta = getNodeCta(node);
  const typeLabel = getNodeTypeLabel(node);
  const statusLabel = getNodeStatusLabel(node.status);

  return (
    <div className={`beego-learn-node-tooltip-wrap${open ? " is-open" : ""}`}>
      {children}
      <div className="beego-learn-node-tooltip" role="tooltip">
        <strong className="beego-learn-node-tooltip__title">{node.title}</strong>
        <span className="beego-learn-node-tooltip__meta">
          {typeLabel} · {statusLabel}
        </span>
        {node.subtitle ? (
          <span className="beego-learn-node-tooltip__sub">{node.subtitle}</span>
        ) : null}
        <span className={`beego-learn-node-tooltip__cta beego-learn-node-tooltip__cta--${cta.variant}`}>
          {cta.label}
        </span>
      </div>
    </div>
  );
}
