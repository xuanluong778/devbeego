"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminGuard({ children }) {
  const router = useRouter();
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/staff/me", { credentials: "same-origin", cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json.success) {
          router.replace("/auth?next=/admin/students");
          return;
        }
        setState("ok");
      } catch {
        if (!cancelled) router.replace("/auth?next=/admin/students");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state !== "ok") {
    return (
      <div className="adm-loading">
        <p>Đang xác minh quyền quản trị…</p>
      </div>
    );
  }
  return children;
}
