"use client";

/**
 * Duolingo-style unit banner: Phần/Cửa + title + description.
 * Data from learning-path catalog section only — no hardcoded curriculum.
 */
export default function UnitBanner({ section }) {
  if (!section) return null;

  const gateLabel = `Phần ${section.partNumber} · Cửa ${section.gateNumber}`;
  const description = section.sectionDescription || section.sectionTitle || "";

  return (
    <div className="beego-unit-banner" data-section-id={section.sectionId}>
      <div className="beego-unit-banner__inner">
        <div className="beego-unit-banner__top">
          <span className="beego-unit-banner__gate">{gateLabel}</span>
          {section.level ? (
            <span className="beego-unit-banner__level">{section.level}</span>
          ) : null}
        </div>
        <h2 className="beego-unit-banner__title">{section.topicTitle}</h2>
        {description ? <p className="beego-unit-banner__desc">{description}</p> : null}
        {section.partTitle ? (
          <p className="beego-unit-banner__part">{section.partTitle}</p>
        ) : null}
      </div>
    </div>
  );
}
