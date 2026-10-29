"use client";

import { forwardRef } from "react";

function StatIcon({ kind }) {
  if (kind === "honey") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <path fill="#FFC944" stroke="#C48A00" strokeWidth="1.4" d="M8 4h8l2 4-6 12L6 8l2-4z" />
        <path d="M8 8h8" stroke="#C48A00" strokeWidth="1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="#FF8A3D" d="M12 3c1 3 3 4 6 5-3 1-4 3-5 6-1-3-3-5-6-6 3-1 5-2 5-5z" />
      <path fill="#FFC944" d="M12 10c.6 1.6 1.6 2.2 3.2 2.8-1.6.6-2.2 1.6-2.8 3.2-.6-1.6-1.6-2.6-3.2-3.2 1.6-.6 2.6-1.2 2.8-2.8z" />
    </svg>
  );
}

const LearnHeader = forwardRef(function LearnHeader(
  { userName, honeyPoints = 0, streak = 0, loading = false, onGuideClick },
  ref
) {
  const firstName = userName ? userName.split(/\s+/)[0] : null;

  return (
    <header ref={ref} className="beego-learn-header">
      <div className="beego-learn-header__inner">
        <p className="beego-learn-header__greeting">
          {firstName ? `Xin chào, ${firstName}` : "Lộ trình học"}
        </p>
        <div className="beego-learn-header__stats">
          <span className="beego-learn-header__stat" title="Chuỗi ngày học">
            <StatIcon kind="streak" />
            <b>{loading ? "…" : streak}</b>
            <span>ngày</span>
          </span>
          <span className="beego-learn-header__stat" title="Honey">
            <StatIcon kind="honey" />
            <b>{loading ? "…" : Number(honeyPoints || 0).toLocaleString("vi-VN")}</b>
          </span>
          <button type="button" className="beego-learn-header__guide" onClick={onGuideClick}>
            Hướng dẫn
          </button>
        </div>
      </div>
    </header>
  );
});

export default LearnHeader;
