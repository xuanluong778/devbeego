"use client";

import { useEffect, useRef, useState } from "react";
import BeegoBee from "./BeegoBee";

export default function BeegoMascotBubble({ message, mood = "idle" }) {
  const rootRef = useRef(null);
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const obs = new IntersectionObserver(
      (entries) => setOnScreen(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "40px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const paused = !onScreen || !pageVisible;

  return (
    <div
      ref={rootRef}
      className={`beego-learn-mascot beego-learn-mascot--${mood}${paused ? " is-paused" : ""}`}
    >
      <div className="beego-learn-mascot__bubble">
        <p>{message}</p>
      </div>
      <BeegoBee mood={mood} />
    </div>
  );
}
