"use client";

import { forwardRef, useEffect, useRef } from "react";
import UnitBanner from "./UnitBanner";
import LessonNode from "./LessonNode";

/** Zig-zag lane: left → center → right → center → … (Duolingo-like) */
const ZIGZAG = ["left", "center", "right", "center"];

const LearningSection = forwardRef(function LearningSection(
  { section, onNodeClick, isFirst, mounted = true, estimatedHeight = 0, onBecomeVisible },
  ref
) {
  const localRef = useRef(null);

  useEffect(() => {
    if (mounted || !onBecomeVisible) return;
    const el = localRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onBecomeVisible();
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mounted, onBecomeVisible]);

  const setRefs = (node) => {
    localRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  if (!mounted) {
    return (
      <section
        ref={setRefs}
        className="beego-learn-section beego-learn-section--placeholder"
        data-section-id={section.sectionId}
        style={{ minHeight: estimatedHeight || undefined }}
        aria-hidden
      />
    );
  }

  return (
    <section
      ref={setRefs}
      className="beego-learn-section"
      data-section-id={section.sectionId}
      aria-labelledby={`learn-section-${section.sectionId}`}
    >
      {!isFirst ? <div className="beego-learn-section__divider" aria-hidden /> : null}

      <UnitBanner section={section} />

      <div className="beego-learn-section__path" role="list">
        {section.nodes.map((node, i) => {
          const align = ZIGZAG[i % ZIGZAG.length];
          return (
            <div
              key={node.lessonId}
              className={`beego-learn-section__step beego-learn-section__step--${align}`}
              role="listitem"
              style={{ "--zigzag-i": i }}
            >
              {i > 0 ? (
                <span
                  className={`beego-learn-section__connector beego-learn-section__connector--${align}`}
                  aria-hidden
                />
              ) : null}
              <LessonNode node={node} align={align} onClick={onNodeClick} />
            </div>
          );
        })}
      </div>
    </section>
  );
});

export default LearningSection;
