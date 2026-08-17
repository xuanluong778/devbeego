"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthLoggedIn } from "@/hooks/useAuthLoggedIn";
import { useGuestGate } from "@/components/GuestGateProvider";
import { BEEGO_BRAND, BEEGO_TRACKS } from "@/lib/beego/brand";
import { SPEAKING_PATH } from "@/lib/beego/routes";

const GUEST_ALLOWED = new Set([
  "/",
  "/onboarding",
  "/quiz",
  "/pronunciation",
  "/vocabulary",
  "/dictionary",
  "/kids",
  "/kids-learn-vocabulary",
  "/kids-fun-stories",
  ...BEEGO_TRACKS.map((t) => `/tracks/${t.slug}`),
]);

const CORE_LINKS = [
  { href: SPEAKING_PATH, label: "Học AI", icon: "🤖" },
  { href: "/vocabulary", label: "Từ vựng", icon: "📚" },
  { href: "/quiz", label: "Quiz", icon: "🧠" },
  { href: "/pronunciation", label: "Luyện phát âm", icon: "🎙️" },
];

export default function BeegoMainNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { loggedIn } = useAuthLoggedIn();
  const { showLoginRequired } = useGuestGate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onNavClick = useCallback(
    (e, href) => {
      if (loggedIn !== false) return;
      if (GUEST_ALLOWED.has(href) || href.startsWith("/tracks/")) return;
      e.preventDefault();
      showLoginRequired();
    },
    [loggedIn, showLoginRequired]
  );

  const goBack = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  const isActive = (href) =>
    pathname === href || (href !== "/" && href !== "/dashboard" && pathname.startsWith(href));

  const linkClass = (href, extra = "") => {
    const active = isActive(href);
    return `beego-nav-link ${active ? "beego-nav-link--active" : ""} ${extra}`.trim();
  };

  return (
    <>
      <div className="beego-mobile-head">
        <button type="button" className="beego-mobile-iconBtn" onClick={goBack} aria-label="Quay lại">
          ←
        </button>
        <Link href="/" className="beego-brand-logo" onClick={() => setMobileOpen(false)}>
          <span className="beego-brand-mark" aria-hidden>
            🐝
          </span>
          <span className="beego-brand-text">
            <span className="beego-brand-name">{BEEGO_BRAND.name}</span>
            <span className="beego-brand-domain">{BEEGO_BRAND.domain}</span>
          </span>
        </Link>
        <button
          type="button"
          className="beego-mobile-iconBtn"
          aria-label="Mở menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          ☰
        </button>
      </div>

      <div className="beego-nav-toolbar">
        <Link href="/" className="beego-brand-logo beego-nav-grow" style={{ flex: "0 0 auto" }}>
          <span className="beego-brand-mark" aria-hidden>
            🐝
          </span>
          <span className="beego-brand-text">
            <span className="beego-brand-name">{BEEGO_BRAND.name}</span>
            <span className="beego-brand-domain">{BEEGO_BRAND.domain}</span>
          </span>
        </Link>

        <nav
          className={`beego-nav-links beego-nav-grow ${mobileOpen ? "beego-nav-links--open" : ""}`}
          aria-label="Menu chính Beego"
        >
          {BEEGO_TRACKS.map((track) => (
            <Link
              key={track.id}
              href={`/tracks/${track.slug}`}
              className={linkClass(`/tracks/${track.slug}`, track.id === "kids" ? "beego-nav-link--kids" : "")}
              onClick={(e) => {
                onNavClick(e, `/tracks/${track.slug}`);
                setMobileOpen(false);
              }}
            >
              <span className="beego-nav-link-icon" aria-hidden>
                {track.icon}
              </span>
              <span>{track.shortName}</span>
              <span className="beego-nav-link-cta">Xem</span>
            </Link>
          ))}

          {CORE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(link.href)}
              onClick={(e) => {
                onNavClick(e, link.href);
                setMobileOpen(false);
              }}
            >
              <span className="beego-nav-link-icon" aria-hidden>
                {link.icon}
              </span>
              <span>{link.label}</span>
              <span className="beego-nav-link-cta">Học</span>
            </Link>
          ))}

          <Link
            href="/dashboard"
            className={linkClass("/dashboard", "beego-nav-link--dashboard")}
            onClick={(e) => {
              onNavClick(e, "/dashboard");
              setMobileOpen(false);
            }}
          >
            <span className="beego-nav-link-icon" aria-hidden>
              📊
            </span>
            <span>Dashboard</span>
            <span className="beego-nav-link-cta">Vào</span>
          </Link>

          <Link
            href="/admin"
            className={linkClass("/admin", "beego-nav-link--admin")}
            onClick={(e) => {
              onNavClick(e, "/admin");
              setMobileOpen(false);
            }}
          >
            <span className="beego-nav-link-icon" aria-hidden>
              ⚙️
            </span>
            <span>Admin</span>
            <span className="beego-nav-link-cta">Quản trị</span>
          </Link>
        </nav>
      </div>
    </>
  );
}
