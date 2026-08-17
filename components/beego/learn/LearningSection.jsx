"use client";

import { forwardRef } from "react";
import LessonNode from "./LessonNode";

const ALIGNS = ["left", "center", "right"];

const LearningSection = forwardRef(function LearningSection(
  { section, onNodeClick, isFirst },
  ref
) {
  return (
    <section
      ref={ref}
      className="beego-learn-section"
      data-section-id={section.sectionId}
      aria-labelledby={`learn-section-${section.sectionId}`}
    >
      {!isFirst ? <div className="beego-learn-section__divider" aria-hidden /> : null}
      <div className="beego-learn-section__head">
        <div className="beego-learn-section__head-row">
          <h2 id={`learn-section-${section.sectionId}`} className="beego-learn-section__title">
            {section.topicTitle}
          </h2>
          {section.level ? (
            <span className="beego-learn-section__level">{section.level}</span>
          ) : null}
        </div>
        <p className="beego-learn-section__desc">{section.sectionTitle}</p>
        {!isFirst ? (
          <span className="beego-learn-section__gate">
            {`Phần ${section.partNumber} · Cửa ${section.gateNumber}`}
          </span>
        ) : null}
      </div>

      <div className="beego-learn-section__path">
        {section.nodes.map((node, i) => (
          <div key={node.lessonId} className="beego-learn-section__step">
            {i > 0 ? <span className="beego-learn-section__connector" aria-hidden /> : null}
            <LessonNode
              node={node}
              align={ALIGNS[i % ALIGNS.length]}
              onClick={onNodeClick}
            />
          </div>
        ))}
      </div>
    </section>
  );
});

export default LearningSection;
