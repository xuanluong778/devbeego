"use client";

/**
 * Lightweight Beego bee. Moods: idle | greet | encourage | complete.
 * Animation is CSS-only and paused via the parent `.is-paused` class.
 */
export default function BeegoBee({ mood = "idle" }) {
  return (
    <svg
      className={`beego-bee beego-bee--${mood}`}
      viewBox="0 0 80 72"
      width="72"
      height="64"
      aria-hidden
    >
      <ellipse className="beego-bee__wing beego-bee__wing--l" cx="22" cy="28" rx="14" ry="9" />
      <ellipse className="beego-bee__wing beego-bee__wing--r" cx="58" cy="28" rx="14" ry="9" />
      <ellipse cx="40" cy="40" rx="22" ry="18" fill="#FFC944" />
      <path d="M28 32h24M30 40h20M32 48h16" stroke="#273A37" strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="22" r="10" fill="#FFC944" stroke="#273A37" strokeWidth="2" />
      <circle cx="36" cy="21" r="1.6" fill="#273A37" />
      <circle cx="44" cy="21" r="1.6" fill="#273A37" />
      <path d="M36 25c2 2 6 2 8 0" stroke="#273A37" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M32 16c2-6 4-6 6-2" stroke="#273A37" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M48 16c-2-6-4-6-6-2" stroke="#273A37" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}
