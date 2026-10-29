"use client";

import { forwardRef, useEffect, useRef } from "react";
import UnitBanner from "./UnitBanner";
import LessonNode from "./LessonNode";
import GateCallButton from "./GateCallButton";

/** Zig-zag lane: left → center → right → center → … */
const ZIGZAG = ["left", "center", "right", "center"];

function PathBend({ from, to }) {
  const swingRight = to === "right" || (from === "left" && to === "center");
  const d = swingRight
    ? "M18 4 C 42 32, 78 4, 102 30"
    : "M102 4 C 78 32, 42 4, 18 30";
  return (
    <svg className="beego-learn-bend" viewBox="0 0 120 36" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const LearningSection = forwardRef(function LearningSection(
  { section, onNodeClick, onGateCall, callEnabled = false, justCompletedId = "", isFirst, mounted = true, estimatedHeight = 0, onBecomeVisible },
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
          const showCall = callEnabled && i === 3;
          return (
            <div key={node.lessonId}>
              <div
                className={`beego-learn-section__step beego-learn-section__step--${align}`}
                role="listitem"
                style={{ "--zigzag-i": i }}
              >
                {i > 0 ? (
                  <PathBend from={ZIGZAG[(i - 1) % ZIGZAG.length]} to={align} />
                ) : null}
                <LessonNode
                  node={node}
                  align={align}
                  onClick={onNodeClick}
                  justCompleted={justCompletedId === node.lessonId}
                />
              </div>
              {showCall ? (
                <div className="beego-learn-section__step beego-learn-section__step--center" role="listitem">
                  <span className="beego-learn-section__connector beego-learn-section__connector--center" aria-hidden />
                  <GateCallButton section={section} onOpen={onGateCall} />
                </div>
              ) : null}
            </div>
          );
        })}
        {callEnabled && section.nodes.length < 4 ? (
          <div className="beego-learn-section__step beego-learn-section__step--center" role="listitem">
            <GateCallButton section={section} onOpen={onGateCall} />
          </div>
        ) : null}
      </div>
    </section>
  );
});

export default LearningSection;
