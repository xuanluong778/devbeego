"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const NODE_STEP_PX = 96;
const BANNER_PX = 120;
const BUFFER = 2;

/**
 * Windowed section mount: keep sections near the active index (or viewport)
 * mounted; others render as height placeholders to keep scroll stable.
 * @param {Array<{ sectionId: string, nodes?: unknown[] }>} sections
 * @param {string} activeSectionId
 */
export function useVirtualLearnSections(sections, activeSectionId) {
  const activeIndex = useMemo(() => {
    const i = sections.findIndex((s) => s.sectionId === activeSectionId);
    return i >= 0 ? i : 0;
  }, [sections, activeSectionId]);

  const [windowCenter, setWindowCenter] = useState(activeIndex);

  useEffect(() => {
    setWindowCenter(activeIndex);
  }, [activeIndex]);

  const estimateHeight = useCallback((section) => {
    const n = section?.nodes?.length || 16;
    return BANNER_PX + n * NODE_STEP_PX + 40;
  }, []);

  const visible = useMemo(() => {
    const start = Math.max(0, windowCenter - BUFFER);
    const end = Math.min(sections.length - 1, windowCenter + BUFFER);
    return { start, end };
  }, [windowCenter, sections.length]);

  const onPlaceholderEnter = useCallback((index) => {
    setWindowCenter(index);
  }, []);

  return { visible, estimateHeight, onPlaceholderEnter, windowCenter };
}
