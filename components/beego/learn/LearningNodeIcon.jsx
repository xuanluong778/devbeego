"use client";

import { getNodeIconType } from "@/lib/beego/learning-node-icons";

function IconSvg({ iconType }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (iconType) {
    case "star":
      return (
        <svg {...common}>
          <polygon
            points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18.5 5.5 22 7 14.5 2 9.5 9 9"
            fill="currentColor"
            stroke="currentColor"
          />
        </svg>
      );
    case "headphone":
      return (
        <svg {...common}>
          <path d="M4 14v4a2 2 0 0 0 2 2h1" />
          <path d="M20 14v4a2 2 0 0 1-2 2h-1" />
          <path d="M4 14a8 8 0 0 1 16 0" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
          <path d="M8 21h8" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M5 4h9a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3V4z" />
          <path d="M8 4h11v17" />
        </svg>
      );
    case "story":
      return (
        <svg {...common}>
          <path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4z" />
          <path d="M6 8h11" />
          <path d="M6 12h8" />
          <path d="M19 6v14" />
        </svg>
      );
    case "review":
      return (
        <svg {...common}>
          <path d="M4 12a8 8 0 0 1 14-5" />
          <path d="M20 6v5h-5" />
          <path d="M20 12a8 8 0 0 1-14 5" />
          <path d="M4 18v-5h5" />
        </svg>
      );
    case "sentence":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 12h12" />
          <path d="M4 18h8" />
        </svg>
      );
    case "grammar":
      return (
        <svg {...common}>
          <path d="M6 4h12v16H6z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </svg>
      );
    case "chest":
      return (
        <svg {...common}>
          <rect x="3" y="10" width="18" height="10" rx="2" fill="currentColor" stroke="currentColor" />
          <path d="M7 10V8a5 5 0 0 1 10 0v2" />
          <path d="M12 10v10" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
          <path d="M8 6H5a2 2 0 0 0 2 3" />
          <path d="M16 6h3a2 2 0 0 1-2 3" />
          <path d="M12 13v3" />
          <path d="M9 20h6" />
          <path d="M10 16h4v4H10z" fill="currentColor" />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path d="M4 8h11a2 2 0 0 1 2 2v8H4V8z" fill="currentColor" stroke="currentColor" />
          <path d="M17 11l4-2v8l-4-2" fill="currentColor" stroke="currentColor" />
          <circle cx="9.5" cy="12" r="2" fill="#fff" stroke="none" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} strokeWidth="2.8">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

/**
 * @param {{ node: object, size?: 'sm'|'md'|'lg' }} props
 */
export default function LearningNodeIcon({ node, size = "md" }) {
  const iconType = getNodeIconType(node);

  return (
    <span
      className={`beego-learn-node-icon beego-learn-node-icon--${iconType} beego-learn-node-icon--${size} beego-learn-node-icon--${node.status}`}
      title={node.title}
    >
      <IconSvg iconType={iconType} />
    </span>
  );
}
