"use client";

import { pickGateCallTarget } from "@/lib/beego/learn/ai-call-access";
import { getGate01CallIcon } from "@/lib/beego/learn/gate-01-icons";
import LearningNodeIcon, { LearningNodeStatusBadge } from "./LearningNodeIcon";

export default function GateCallButton({ section, onOpen }) {
  const target = pickGateCallTarget(section);
  const locked = !target;
  const label = "Gọi gia sư AI";
  const artwork = getGate01CallIcon(section);

  return (
    <div className="beego-learn-node-wrap beego-learn-node-wrap--center">
      <button
        type="button"
        className={`beego-learn-node beego-learn-gate-call${locked ? " beego-learn-node--locked" : " beego-learn-node--completed"}${artwork ? " beego-learn-node--gate-01" : ""}`}
        data-gate-call={section.sectionId}
        disabled={locked}
        aria-label={locked ? `${label} — cửa chưa mở` : `${label}. ${section.topicTitle || section.sectionTitle || ""}`}
        onClick={() => {
          if (!target) return;
          onOpen?.({
            lessonId: target.lessonId,
            lessonType: target.type || target.nodeType,
            sectionId: section.sectionId,
            topicTitle: section.topicTitle || section.sectionTitle || "",
          });
        }}
      >
        <span className="beego-learn-node__circle beego-learn-node__circle--camera">
          <LearningNodeIcon
            node={{ status: locked ? "locked" : "active", iconType: "camera" }}
            size="md"
            artwork={artwork}
          />
          {artwork && locked ? <LearningNodeStatusBadge status="locked" /> : null}
        </span>
        <span className="beego-learn-node__title">{label}</span>
      </button>
    </div>
  );
}
