"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { formatGateLabel } from "@/lib/beego/learning-path";

const LearnHeader = forwardRef(function LearnHeader(
  { section, userName, onGuideClick },
  ref
) {
  if (!section) return null;

  const firstName = userName ? userName.split(/\s+/)[0] : null;
  const description = section.sectionDescription || section.sectionTitle;

  return (
    <header ref={ref} className="beego-learn-header">
      <div className="beego-learn-header__brand" aria-hidden />
      <div className="beego-learn-header__inner">
        <p className="beego-learn-header__greeting beego-learn-header__greeting--desk">
          {firstName ? `Xin chào, ${firstName}! 👋` : "Lộ trình học Beego"}
        </p>
        <div className="beego-learn-header__row">
          <Link href="/progress" className="beego-learn-header__back beego-learn-header__back--mobile" aria-label="Quay lại">
            ‹
          </Link>
          <div className="beego-learn-header__center">
            <p className="beego-learn-header__gate">
              {formatGateLabel(section)}
              {section.level ? ` · ${section.level}` : ""}
            </p>
            <h1 className="beego-learn-header__topic">{section.topicTitle}</h1>
          </div>
          <button type="button" className="beego-learn-header__guide" onClick={onGuideClick}>
            Hướng dẫn
          </button>
        </div>
        {description ? <p className="beego-learn-header__desc">{description}</p> : null}
      </div>
    </header>
  );
});

export default LearnHeader;
