"use client";

import { useEffect, useRef } from "react";

const BEE_SRC = "/uploads/mascots/beego-ong-doc-sach-di-bo.html?embed=1";

/**
 * One silent bee in the open side of the path.
 * Scrolling moves it to whichever side has more room beside the lesson icons.
 */
export default function LearnPathWalker() {
  const boxRef = useRef(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    let frame = 0;
    let lastSide = "";
    let placed = false;

    const tellSide = (side) => {
      const frameEl = box.querySelector("iframe");
      frameEl?.contentWindow?.postMessage(
        { target: "beego-bee-guide", type: "side", side },
        window.location.origin
      );
    };

    const place = () => {
      frame = 0;
      const path = document.querySelector(".beego-learn-path");
      if (!path) return;
      const pathRect = path.getBoundingClientRect();
      if (pathRect.width < 80) return;
      const header = document.querySelector(".beego-learn-header");
      const topLimit = Math.max(72, (header?.getBoundingClientRect().bottom || 64) + 12);
      const bottomLimit = window.innerHeight - 112;
      const band = bottomLimit - topLimit;
      if (band < 96) return;

      const nodes = [...document.querySelectorAll(".beego-learn-node")]
        .map((el) => el.getBoundingClientRect())
        .filter((rect) => rect.width > 8 && rect.bottom > topLimit && rect.top < bottomLimit);
      const midX = pathRect.left + pathRect.width / 2;
      let leftOcc = 0;
      let rightOcc = 0;
      for (const rect of nodes) {
        const top = Math.max(rect.top, topLimit);
        const bottom = Math.min(rect.bottom, bottomLimit);
        const height = Math.max(0, bottom - top);
        leftOcc += Math.max(0, Math.min(rect.right, midX) - Math.max(rect.left, pathRect.left)) * height;
        rightOcc += Math.max(0, Math.min(rect.right, pathRect.right) - Math.max(rect.left, midX)) * height;
      }
      const halfArea = (pathRect.width / 2) * band;
      let side = leftOcc <= rightOcc ? "left" : "right";
      if (lastSide && Math.abs(leftOcc - rightOcc) < halfArea * 0.08) side = lastSide;

      const height = Math.round(Math.min(188, Math.max(132, band * 0.4)));
      const roomAt = (candidate, y) => {
        const span = nodes.filter((rect) => rect.bottom > y + 8 && rect.top < y + height - 8);
        if (candidate === "left") {
          const blocking = span.filter((rect) => rect.left < midX + 28);
          const edge = blocking.length ? Math.min(...blocking.map((rect) => rect.left)) : midX;
          return edge - pathRect.left;
        }
        const blocking = span.filter((rect) => rect.right > midX - 28);
        const edge = blocking.length ? Math.max(...blocking.map((rect) => rect.right)) : midX;
        return pathRect.right - edge;
      };
      const bestSlot = (candidate) => {
        let best = null;
        for (let step = 0; step <= 8; step += 1) {
          const y = topLimit + ((band - height) * step) / 8;
          const room = roomAt(candidate, y);
          const centerDistance = Math.abs(y + height / 2 - (topLimit + band / 2));
          const score = room - centerDistance * 0.45;
          if (!best || score > best.score) best = { y, room, score };
        }
        return best;
      };

      let slot = bestSlot(side);
      const other = side === "left" ? "right" : "left";
      const otherSlot = bestSlot(other);
      if (slot.room < 150 && otherSlot.room > slot.room + 24) {
        side = other;
        slot = otherSlot;
      }
      lastSide = side;

      const width = Math.round(Math.min(300, Math.max(156, slot.room - 16)));
      const x = side === "left"
        ? pathRect.left + 8
        : pathRect.right - width - 8;
      const y = slot.y;

      if (!placed) box.style.transition = "none";
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
      box.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
      box.classList.toggle("beego-learn-path-bee--right", side === "right");
      box.classList.add("is-ready");
      tellSide(side);
      if (!placed) {
        placed = true;
        requestAnimationFrame(() => {
          box.style.transition = "";
        });
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(place);
    };
    place();
    const frameEl = box.querySelector("iframe");
    frameEl?.addEventListener("load", () => tellSide(lastSide || "left"));
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    const path = document.querySelector(".beego-learn-path");
    const observer = new ResizeObserver(onScroll);
    if (path) observer.observe(path);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={boxRef} className="beego-learn-path-bee">
      <div className="beego-learn-path-bee__pace">
        <iframe
          title="Ong đọc sách đi cùng lộ trình"
          src={BEE_SRC}
          className="beego-learn-path-bee__frame"
        />
      </div>
    </div>
  );
}
