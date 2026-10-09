"use client";

import { useCallback } from "react";
import LearningSection from "./LearningSection";
import { useVirtualLearnSections } from "./useVirtualLearnSections";

export default function BeegoLearningPath({
  sections,
  onNodeClick,
  onGateCall,
  callEnabled = false,
  justCompletedId = "",
  onSectionRef,
  activeSectionId,
}) {
  const { visible, estimateHeight, onPlaceholderEnter } = useVirtualLearnSections(
    sections,
    activeSectionId
  );

  const setSectionRef = useCallback(
    (sectionId) => (el) => {
      onSectionRef?.(sectionId, el);
    },
    [onSectionRef]
  );

  return (
    <div className="beego-learn-path">
      {sections.map((section, i) => {
        const mounted = i >= visible.start && i <= visible.end;
        return (
          <LearningSection
            key={section.sectionId}
            ref={setSectionRef(section.sectionId)}
            section={section}
            onNodeClick={onNodeClick}
            onGateCall={onGateCall}
            callEnabled={callEnabled}
            justCompletedId={justCompletedId}
            isFirst={i === 0}
            mounted={mounted}
            estimatedHeight={estimateHeight(section)}
            onBecomeVisible={mounted ? undefined : () => onPlaceholderEnter(i)}
          />
        );
      })}
    </div>
  );
}
