"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", match: (p) => p.startsWith("/admin/dashboard") },
  { href: "/admin/students", label: "Học viên", match: (p) => p.startsWith("/admin/students") },
  { href: "/admin/paths", label: "Lộ trình mẫu", match: (p) => p.startsWith("/admin/paths") },
  { href: "/admin/tong-quan", label: "Tổng quan", match: (p) => p === "/admin/tong-quan" },
  { href: "/admin/payments", label: "Thanh toán", match: (p) => p.startsWith("/admin/payments") },
  { href: "/admin/options", label: "Cài đặt", match: (p) => p.startsWith("/admin/options") },
];

export default function AdminShell({ children, title, subtitle }) {
  const pathname = usePathname();
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/staff/me", { credentials: "same-origin", cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok && json.success) setStaff(json.data);
      } catch {
        /* optional banner */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="adm-layout">
      <aside className="adm-sidebar" aria-label="Menu quản trị">
        <div className="adm-sidebar__brand">
          <Link href="/admin/students">Beego Admin</Link>
          <p>Quản trị học viên</p>
        </div>
        <nav className="adm-sidebar__nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`adm-sidebar__link ${item.match(pathname || "") ? "is-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {staff ? (
          <div className="adm-sidebar__staff">
            <strong>{staff.name}</strong>
            <span>{staff.staff_role_label}</span>
          </div>
        ) : null}
        <Link href="/" className="adm-sidebar__back">
          ← Về trang học
        </Link>
      </aside>
      <div className="adm-main">
        {(title || subtitle) && (
          <header className="adm-main__head">
            {title ? <h1>{title}</h1> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
