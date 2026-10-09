"use client";

import { pickGateCallTarget } from "@/lib/beego/learn/ai-call-access";
import LearningNodeIcon from "./LearningNodeIcon";

export default function GateCallButton({ section, onOpen }) {
  const target = pickGateCallTarget(section);
  const locked = !target;
  const label = "Gọi gia sư AI";

  return (
    <div className="beego-learn-node-wrap beego-learn-node-wrap--center">
      <button
        type="button"
        className={`beego-learn-node beego-learn-gate-call${locked ? " beego-learn-node--locked" : " beego-learn-node--completed"}`}
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
          />
        </span>
        <span className="beego-learn-node__title">{label}</span>
      </button>
    </div>
  );
}
