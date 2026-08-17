"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BottomNav from "@/components/beego/BottomNav";
import TabletSidebar from "@/components/beego/TabletSidebar";
import { isSpeakingPath, isListeningPath } from "@/lib/beego/routes";
import { BEEGO_BRAND } from "@/lib/beego/brand";
import { BEEGO_SIDEBAR_ITEMS, shouldHideAppShell } from "@/lib/beego/nav";

function pageTitle(pathname) {
  if (pathname === "/") return "Lộ trình học";
  const item = BEEGO_SIDEBAR_ITEMS.find((n) => n.href === pathname || (n.href !== "/" && pathname.startsWith(n.href)));
  if (isSpeakingPath(pathname)) return "Beego Speaking AI";
  if (isListeningPath(pathname)) return "Luyện nghe 5 phút";
  if (item) return item.label;
  if (pathname === "/quiz") return "Ôn tập thông minh";
  if (pathname.startsWith("/kids-fun-stories")) return "Câu truyện";
  if (pathname === "/pronunciation") return "Điểm phát âm";
  if (pathname === "/dictionary") return "Từ điển";
  return BEEGO_BRAND.name;
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const hidden = shouldHideAppShell(pathname);
  const isLearnPath = pathname === "/";
  const isLessonPlayer = pathname?.startsWith("/learn/lesson");

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (hidden) {
      html.classList.remove("beego-shell-active");
      body.classList.remove("page-learn-path");
      body.classList.remove("page-lesson-player");
      body.classList.add("page-no-shell");
      return () => body.classList.remove("page-no-shell");
    }
    html.classList.add("beego-shell-active");
    body.classList.remove("page-no-shell");
    if (isLearnPath) body.classList.add("page-learn-path");
    else body.classList.remove("page-learn-path");
    if (isLessonPlayer) body.classList.add("page-lesson-player");
    else body.classList.remove("page-lesson-player");
    return () => {
      html.classList.remove("beego-shell-active");
      body.classList.remove("page-learn-path");
      body.classList.remove("page-lesson-player");
    };
  }, [hidden, isLearnPath, isLessonPlayer]);

  if (hidden) {
    return <>{children}</>;
  }

  return (
    <div className={`beego-shell${isLearnPath ? " beego-shell--learn" : ""}`}>
      <header
        className={`beego-shell-topbar${isLearnPath ? " beego-shell-topbar--hidden" : ""}`}
        aria-label="Thanh tiêu đề"
      >
        <span className="beego-mascot beego-mascot--sm" aria-hidden>
          🐝
        </span>
        <h1 className="beego-shell-topbar-title">{pageTitle(pathname)}</h1>
        <Link href="/account" className="beego-shell-topbar-avatar" aria-label="Tài khoản">
          <span aria-hidden>👤</span>
        </Link>
      </header>

      <div className="beego-shell-body">
        <TabletSidebar />
        <main className="beego-shell-main" id="beego-main-content">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
