"use client";

import { useEffect, useRef } from "react";

/**
 * Auto-scroll to the active (current) lesson node once path is mounted.
 */
export function useScrollToActiveNode(sections, enabled = true) {
  const didScroll = useRef(false);

  useEffect(() => {
    if (!enabled || didScroll.current || !sections?.length) return;

    let cancelled = false;
    let timer = 0;

    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const el =
          document.querySelector(".beego-learn-node--current") ||
          document.querySelector('[data-node-status="active"]');
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        didScroll.current = true;
      }, 160);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (timer) window.clearTimeout(timer);
    };
  }, [sections, enabled]);
}
