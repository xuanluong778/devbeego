"use client";

import { useEffect, useState } from "react";

/**
 * Track which learning path section is most visible via IntersectionObserver.
 * @param {Array<{ sectionId: string }>} sections
 * @param {React.MutableRefObject<Map<string, HTMLElement>>} sectionRefs
 */
export function useActiveLearnSection(sections, sectionRefs, preferredSectionId = "") {
  const fallbackId = preferredSectionId || sections[0]?.sectionId || "";
  const [activeSectionId, setActiveSectionId] = useState(fallbackId);

  useEffect(() => {
    setActiveSectionId(fallbackId);
  }, [fallbackId]);

  useEffect(() => {
    if (!sections.length) return;

    const ratios = new Map();
    let observer = null;

    const pickActive = () => {
      let bestId = fallbackId;
      let bestRatio = -1;
      ratios.forEach((ratio, id) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      });
      setActiveSectionId((prev) => (bestId !== prev ? bestId : prev));
    };

    const frame = requestAnimationFrame(() => {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const id = entry.target.getAttribute("data-section-id");
            if (!id) continue;
            ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
          pickActive();
        },
        {
          root: null,
          rootMargin: "-110px 0px -48% 0px",
          threshold: [0, 0.12, 0.3, 0.5, 0.7, 1],
        }
      );

      sectionRefs.current.forEach((el) => {
        if (el) observer.observe(el);
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [sections, sectionRefs, fallbackId]);

  return activeSectionId;
}
