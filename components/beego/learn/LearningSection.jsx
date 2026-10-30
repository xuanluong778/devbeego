"use client";

import { forwardRef, useEffect, useRef } from "react";
import UnitBanner from "./UnitBanner";
import LessonNode from "./LessonNode";
import GateCallButton from "./GateCallButton";

/** A round S, eight lessons per loop, like the Duolingo path. */
function laneX(index) {
  const turn = (index % 8) / 8;
  return Math.round(50 + Math.sin(turn * Math.PI * 2) * 32);
}

function PathBend({ from, to }) {
  const start = Number(from);
  const end = Number(to);
  const dots = [0.28, 0.5, 0.72].map((t) => {
    const x = start + (end - start) * t;
    const y = 8 + Math.sin(t * Math.PI) * 7;
    return (
      <span
        key={t}
        className="beego-learn-bend__dot"
        style={{ left: `${x}%`, top: `${y}px` }}
      />
    );
  });
  return (
    <div className="beego-learn-bend" aria-hidden>
      {dots}
    </div>
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
          const x = laneX(i);
          const showCall = callEnabled && i === 3;
          const callX = laneX(i + 0.5);
          return (
            <div key={node.lessonId}>
              <div
                className="beego-learn-section__step"
                role="listitem"
                style={{ "--s-x": `${x}%` }}
              >
                {i > 0 ? <PathBend from={laneX(i - 1)} to={x} /> : null}
                <LessonNode
                  node={node}
                  align="s"
                  onClick={onNodeClick}
                  justCompleted={justCompletedId === node.lessonId}
                />
              </div>
              {showCall ? (
                <div className="beego-learn-section__step" role="listitem" style={{ "--s-x": `${callX}%` }}>
                  <PathBend from={x} to={callX} />
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
