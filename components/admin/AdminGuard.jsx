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
        const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !json.success) {
          router.replace("/auth?next=/admin");
          return;
        }
        if (json.data?.role !== "admin" && !json.data?.is_admin) {
          router.replace("/dashboard");
          return;
        }
        setState("ok");
      } catch {
        if (!cancelled) router.replace("/auth?next=/admin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state !== "ok") {
    return (
      <div className="adm-loading">
        <p>Đang xác minh quyền admin…</p>
        <style jsx>{`
          .adm-loading {
            min-height: 60vh;
            display: grid;
            place-items: center;
            font-weight: 700;
            color: #1e40af;
          }
        `}</style>
      </div>
    );
  }
  return children;
}
