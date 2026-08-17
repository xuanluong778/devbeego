/** Bottom nav + sidebar — flat, no nested menus on mobile bottom bar */

import { LISTENING_PATH, SPEAKING_PATH } from "@/lib/beego/routes";

/** Mobile bottom nav: MUST stay 5 items */
export const BEEGO_BOTTOM_NAV_ITEMS = [
  { id: "learn", href: "/", label: "Học", icon: "📘" },
  { id: "speaking", href: SPEAKING_PATH, label: "Luyện nói", icon: "🎙️" },
  { id: "vocab", href: "/vocabulary", label: "Từ vựng", icon: "📚" },
  { id: "progress", href: "/progress", label: "Tiến độ", icon: "📊" },
  { id: "more", action: "more", label: "Thêm", icon: "⊞" },
];

/** Grouped links inside mobile “Thêm” sheet */
export const BEEGO_MORE_MENU_GROUPS = [
  {
    id: "learn",
    title: "Học tập",
    items: [
      { id: "listening", href: LISTENING_PATH, label: "Luyện nghe 5 phút", icon: "🎧" },
      { id: "pronunciation", href: "/pronunciation", label: "Luyện phát âm", icon: "🎯" },
      { id: "quiz", href: "/quiz", label: "Quiz & Game", icon: "🧠" },
      { id: "stories", href: "/kids-fun-stories", label: "Câu chuyện", icon: "📖" },
      { id: "dictionary", href: "/dictionary", label: "Từ điển", icon: "📕" },
    ],
  },
  {
    id: "kids",
    title: "Kids",
    items: [
      { id: "kids", href: "/kids", label: "Beego Kids", icon: "🐝" },
      { id: "kids-games", href: "/kids/games", label: "Kids Games", icon: "🎮" },
      { id: "kids-ai", href: "/kids/ai-teacher", label: "AI Teacher Kids", icon: "🤖" },
    ],
  },
  {
    id: "account",
    title: "Tài khoản",
    items: [
      { id: "account", href: "/account", label: "Tài khoản", icon: "👤" },
      { id: "billing", href: "/account", label: "Gói học / Thanh toán", icon: "💳" },
      { id: "settings", href: "/onboarding", label: "Cài đặt", icon: "⚙️" },
    ],
  },
];

const MORE_MENU_HREFS = BEEGO_MORE_MENU_GROUPS.flatMap((g) => g.items.map((i) => i.href));

/** App sidebar (tablet landscape + desktop): main navigation only */
export const BEEGO_SIDEBAR_ITEMS = [
  { id: "learn", href: "/", label: "Học", icon: "📘" },
  { id: "speaking", href: SPEAKING_PATH, label: "Luyện nói", icon: "🎙️" },
  { id: "vocab", href: "/vocabulary", label: "Từ vựng", icon: "📚" },
  { id: "stories", href: "/kids-fun-stories", label: "Câu truyện", icon: "📖" },
  { id: "pronunciation", href: "/pronunciation", label: "Luyện phát âm", icon: "🎯" },
  { id: "grammar", href: SPEAKING_PATH, label: "Ngữ pháp", icon: "🧩" },
  { id: "listening", href: LISTENING_PATH, label: "Luyện nghe", icon: "🎧" },
  { id: "quiz", href: "/quiz", label: "Quiz & Game", icon: "🧠" },
  { id: "progress", href: "/progress", label: "Tiến độ", icon: "📊" },
  { id: "account", href: "/account", label: "Tài khoản", icon: "👤" },
];

export function isNavActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMoreMenuActive(pathname) {
  if (!pathname) return false;
  return MORE_MENU_HREFS.some((href) => isNavActive(pathname, href));
}

export const SHELL_HIDE_PREFIXES = [
  "/auth",
  "/admin",
  "/billing",
  "/onboarding",
  "/kids",
  "/kids-learn-vocabulary",
  "/tracks",
  "/learn/lesson",
];

export function shouldHideAppShell(pathname) {
  if (!pathname) return false;
  return SHELL_HIDE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
