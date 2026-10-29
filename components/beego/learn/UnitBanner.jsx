"use client";

/**
 * Duolingo-style unit banner: Phần/Cửa + title + description.
 * Data from learning-path catalog section only — no hardcoded curriculum.
 */
export default function UnitBanner({ section }) {
  if (!section) return null;

  const gateNum =
    Number(section.curriculumGateNumber || section.partNumber || section.gateNumber) || 1;
  const gateLabel = `Cửa ${gateNum}/50`;
  const title = String(section.topicTitle || "").trim();
  const rawDesc = String(section.sectionDescription || "").trim();
  const sameAsTitle =
    !rawDesc ||
    rawDesc === title ||
    rawDesc === String(section.sectionTitle || "").trim();
  const description = sameAsTitle ? "" : rawDesc;
  const part = String(section.partTitle || "").trim();
  const showPart = part && part !== title && part !== description;

  return (
    <div className="beego-unit-banner" data-section-id={section.sectionId}>
      <div className="beego-unit-banner__inner">
        <div className="beego-unit-banner__copy">
          <div className="beego-unit-banner__top">
            <span className="beego-unit-banner__gate">{gateLabel}</span>
            {section.level ? (
              <span className="beego-unit-banner__level">{section.level}</span>
            ) : null}
          </div>
          <h2 id={`learn-section-${section.sectionId}`} className="beego-unit-banner__title">
            {title}
          </h2>
          {description ? <p className="beego-unit-banner__desc">{description}</p> : null}
          {showPart ? <p className="beego-unit-banner__part">{part}</p> : null}
        </div>
      </div>
    </div>
  );
}
