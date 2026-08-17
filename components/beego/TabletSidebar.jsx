"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BEEGO_BRAND } from "@/lib/beego/brand";
import { BEEGO_SIDEBAR_ITEMS, isNavActive } from "@/lib/beego/nav";

export default function TabletSidebar() {
  const pathname = usePathname();

  return (
    <aside className="beego-sidebar beego-shell-nav" aria-label="Menu Beego">
      <Link href="/" className="beego-sidebar-brand">
        <span className="beego-mascot" aria-hidden>
          🐝
        </span>
        <span>
          <strong style={{ display: "block", fontFamily: "var(--font-heading), Oswald, sans-serif" }}>
            {BEEGO_BRAND.name}
          </strong>
          <small style={{ color: "var(--beego-mint)", fontWeight: 700, letterSpacing: "0.05em" }}>
            {BEEGO_BRAND.domain}
          </small>
        </span>
      </Link>

      {BEEGO_SIDEBAR_ITEMS.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`beego-sidebar-link ${active ? "beego-sidebar-link--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="beego-sidebar-link-icon" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}

      <div className="beego-sidebar-kids">
        <Link href="/kids" className="beego-sidebar-link">
          <span className="beego-sidebar-link-icon" aria-hidden>
            🎈
          </span>
          Beego Kids
        </Link>
      </div>
    </aside>
  );
}
