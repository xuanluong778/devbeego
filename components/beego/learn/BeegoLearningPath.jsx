"use client";

import { useCallback } from "react";
import LearningSection from "./LearningSection";

export default function BeegoLearningPath({ sections, onNodeClick, onSectionRef }) {
  const setSectionRef = useCallback(
    (sectionId) => (el) => {
      onSectionRef?.(sectionId, el);
    },
    [onSectionRef]
  );

  return (
    <div className="beego-learn-path">
      {sections.map((section, i) => (
        <LearningSection
          key={section.sectionId}
          ref={setSectionRef(section.sectionId)}
          section={section}
          onNodeClick={onNodeClick}
          isFirst={i === 0}
        />
      ))}
    </div>
  );
}
