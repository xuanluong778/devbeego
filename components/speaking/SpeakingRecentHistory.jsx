"use client";

import { useMemo } from "react";

export default function SpeakingRecentHistory({ messages = [] }) {
  const items = useMemo(
    () =>
      messages
        .filter((m) => m.role === "user")
        .slice(-4)
        .reverse(),
    [messages]
  );

  if (!items.length) return null;

  return (
    <section className="speaking-recent-history" aria-label="Lịch sử nói gần đây">
      <h3 className="speaking-recent-history__title">Lịch sử gần đây</h3>
      <ul className="speaking-recent-history__list">
        {items.map((m) => (
          <li key={m.id} className="speaking-recent-history__item">
            {m.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
