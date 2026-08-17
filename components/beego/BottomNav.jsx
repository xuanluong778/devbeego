"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BEEGO_BOTTOM_NAV_ITEMS, isMoreMenuActive, isNavActive } from "@/lib/beego/nav";
import MoreMenuSheet from "@/components/beego/MoreMenuSheet";

export default function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMoreMenuActive(pathname) || moreOpen;

  return (
    <>
      <nav className="beego-bottom-nav beego-shell-nav" aria-label="Menu chính">
        {BEEGO_BOTTOM_NAV_ITEMS.map((item) => {
          if (item.action === "more") {
            return (
              <button
                key={item.id}
                type="button"
                className={`beego-bottom-nav-item${moreActive ? " beego-bottom-nav-item--active" : ""}`}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                onClick={() => setMoreOpen(true)}
              >
                <span className="beego-bottom-nav-icon" aria-hidden>
                  {item.icon}
                </span>
                <span className="beego-bottom-nav-label">{item.label}</span>
              </button>
            );
          }

          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`beego-bottom-nav-item ${active ? "beego-bottom-nav-item--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="beego-bottom-nav-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="beego-bottom-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <MoreMenuSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
