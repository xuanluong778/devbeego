"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { BEEGO_MORE_MENU_GROUPS } from "@/lib/beego/nav";
import { useAuthMe } from "@/hooks/useAuthMe";

export default function MoreMenuSheet({ open, onClose }) {
  const { hideBillingUi } = useAuthMe();
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const groups = BEEGO_MORE_MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !(hideBillingUi && item.id === "billing")),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="beego-more-sheet" role="presentation">
      <button
        type="button"
        className="beego-more-sheet__backdrop"
        aria-label="Đóng menu"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="beego-more-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="beego-more-sheet__head">
          <h2 id={titleId} className="beego-more-sheet__title">
            Thêm
          </h2>
          <button type="button" className="beego-more-sheet__close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>

        <div className="beego-more-sheet__body">
          {groups.map((group) => (
            <section key={group.id} className="beego-more-sheet__group" aria-label={group.title}>
              <h3 className="beego-more-sheet__groupTitle">{group.title}</h3>
              <ul className="beego-more-sheet__list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="beego-more-sheet__link" onClick={onClose}>
                      <span className="beego-more-sheet__linkIcon" aria-hidden>
                        {item.icon}
                      </span>
                      <span className="beego-more-sheet__linkLabel">{item.label}</span>
                      <span className="beego-more-sheet__chevron" aria-hidden>
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
