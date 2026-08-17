/** image_style: auto | cartoon | real_photo | none */

export const IMAGE_STYLE_OPTIONS = ["auto", "cartoon", "real_photo", "none"];

export const IMAGE_STATUS_OPTIONS = ["pending", "approved", "rejected", "hidden"];

export const IMAGE_SOURCE_OPTIONS = [
  "arasaac",
  "openmoji",
  "curated_unsplash",
  "wikimedia",
  "beego_seed",
  "admin_upload",
  "none",
];

const REAL_PHOTO_TOPIC_NEEDLES = [
  "du lich",
  "travel",
  "business",
  "kinh doanh",
  "tai chinh",
  "van phong",
  "cong viec",
];

const CARTOON_TOPIC_NEEDLES = [
  "tre em",
  "kids",
  "co ban",
  "beginner",
  "gia dinh",
  "family",
  "dong vat",
  "animal",
  "trai cay",
  "fruit",
];

function normalizeTopicKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveEffectiveImageStyle(row) {
  const raw = String(row?.image_style || "auto").toLowerCase().trim();
  if (raw && raw !== "auto" && IMAGE_STYLE_OPTIONS.includes(raw)) return raw;

  const topic = normalizeTopicKey(row?.topic);
  const level = String(row?.level || "beginner").toLowerCase();

  if (REAL_PHOTO_TOPIC_NEEDLES.some((n) => topic.includes(n))) return "real_photo";
  if (CARTOON_TOPIC_NEEDLES.some((n) => topic.includes(n)) || level === "beginner") {
    return "cartoon";
  }
  return "cartoon";
}

export function stylePromptGuide(style) {
  if (style === "real_photo") {
    return "Professional realistic photograph, semi-realistic, natural lighting, clean composition, no text, no watermark, suitable for adult learners.";
  }
  if (style === "cartoon") {
    return "Friendly 3D educational cartoon illustration, flat colors, clean white background, soft blue and honey-yellow Beego accents, simple shapes, child-friendly, no text, no watermark.";
  }
  return "";
}

export function isImageHidden(row) {
  const status = String(row?.image_status || "").toLowerCase();
  const style = resolveEffectiveImageStyle(row);
  return status === "hidden" || style === "none";
}
