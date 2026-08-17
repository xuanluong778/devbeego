/**
 * Ảnh cố định đã kiểm tra — ưu tiên cao nhất khi resolve ảnh từ vựng.
 * Key: từ tiếng Anh lowercase (token đầu nếu cụm từ).
 */
import { arasaacPictogramImageUrl } from "../kids-vocabulary/word-pictogram-lookup.js";

const UNSPLASH = (id) =>
  `https://images.unsplash.com/${id}?w=640&h=480&fit=crop`;

const WIKI_FLAG = (path) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}`;

/** @type {Record<string, { url: string, source: string }>} */
export const VOCAB_IMAGE_OVERRIDES = {
  // --- Quốc gia (cờ Wikimedia — đúng nghĩa, không bản quyền) ---
  england: { url: WIKI_FLAG("a/ae/Flag_of_the_United_Kingdom.svg/320px-Flag_of_the_United_Kingdom.svg.png"), source: "wikimedia" },
  brazil: { url: WIKI_FLAG("0/05/Flag_of_Brazil.svg/320px-Flag_of_Brazil.svg.png"), source: "wikimedia" },
  japan: { url: WIKI_FLAG("9/9e/Flag_of_Japan.svg/320px-Flag_of_Japan.svg.png"), source: "wikimedia" },
  argentina: { url: WIKI_FLAG("1/1a/Flag_of_Argentina.svg/320px-Flag_of_Argentina.svg.png"), source: "wikimedia" },
  australia: { url: WIKI_FLAG("b/b9/Flag_of_Australia.svg/320px-Flag_of_Australia.svg.png"), source: "wikimedia" },
  canada: { url: WIKI_FLAG("d/d9/Flag_of_Canada.svg/320px-Flag_of_Canada.svg.png"), source: "wikimedia" },
  china: { url: WIKI_FLAG("f/fa/Flag_of_the_People%27s_Republic_of_China.svg/320px-Flag_of_the_People%27s_Republic_of_China.svg.png"), source: "wikimedia" },
  greece: { url: WIKI_FLAG("5/5c/Flag_of_Greece.svg/320px-Flag_of_Greece.svg.png"), source: "wikimedia" },
  hungary: { url: WIKI_FLAG("c/c1/Flag_of_Hungary.svg/320px-Flag_of_Hungary.svg.png"), source: "wikimedia" },
  ireland: { url: WIKI_FLAG("4/45/Flag_of_Ireland.svg/320px-Flag_of_Ireland.svg.png"), source: "wikimedia" },
  italy: { url: WIKI_FLAG("0/03/Flag_of_Italy.svg/320px-Flag_of_Italy.svg.png"), source: "wikimedia" },
  mexico: { url: WIKI_FLAG("f/fc/Flag_of_Mexico.svg/320px-Flag_of_Mexico.svg.png"), source: "wikimedia" },
  poland: { url: WIKI_FLAG("1/12/Flag_of_Poland.svg/320px-Flag_of_Poland.svg.png"), source: "wikimedia" },
  portugal: { url: WIKI_FLAG("5/5c/Flag_of_Portugal.svg/320px-Flag_of_Portugal.svg.png"), source: "wikimedia" },
  russia: { url: WIKI_FLAG("f/f3/Flag_of_Russia.svg/320px-Flag_of_Russia.svg.png"), source: "wikimedia" },
  spain: { url: WIKI_FLAG("9/9a/Flag_of_Spain.svg/320px-Flag_of_Spain.svg.png"), source: "wikimedia" },
  switzerland: { url: WIKI_FLAG("f/f3/Flag_of_Switzerland.svg/200px-Flag_of_Switzerland.svg.png"), source: "wikimedia" },
  "the usa": { url: WIKI_FLAG("a/a4/Flag_of_the_United_States.svg/320px-Flag_of_the_United_States.svg.png"), source: "wikimedia" },

  // --- Thời gian / buổi ---
  evening: { url: arasaacPictogramImageUrl(26997), source: "arasaac" },
  night: { url: arasaacPictogramImageUrl(26997), source: "arasaac" },
  morning: { url: arasaacPictogramImageUrl(25704), source: "arasaac" },
  afternoon: { url: arasaacPictogramImageUrl(7268), source: "arasaac" },
  midnight: { url: arasaacPictogramImageUrl(26997), source: "arasaac" },
  dawn: { url: arasaacPictogramImageUrl(25704), source: "arasaac" },
  "at night": { url: arasaacPictogramImageUrl(26997), source: "arasaac" },
  "yesterday evening": { url: arasaacPictogramImageUrl(26997), source: "arasaac" },

  // --- Đồ uống / thức ăn ---
  "apple juice": { url: UNSPLASH("photo-1613478223719-0abe73a7f536"), source: "curated_unsplash" },
  "orange juice": { url: UNSPLASH("photo-1621506287337-a8e2df4cad1b"), source: "curated_unsplash" },
  "fizzy water": { url: UNSPLASH("photo-1548839140-29a7492991f8"), source: "curated_unsplash" },
  "mineral water": { url: UNSPLASH("photo-1548839140-29a7492991f8"), source: "curated_unsplash" },
  "still water": { url: UNSPLASH("photo-1548839140-29a7492991f8"), source: "curated_unsplash" },

  // --- Công nghệ / văn phòng ---
  extension: { url: arasaacPictogramImageUrl(2280), source: "arasaac" },
  telephone: { url: arasaacPictogramImageUrl(2280), source: "arasaac" },
  "telephone number": { url: arasaacPictogramImageUrl(2280), source: "arasaac" },
  clock: { url: arasaacPictogramImageUrl(6564), source: "arasaac" },
  television: { url: arasaacPictogramImageUrl(3626), source: "arasaac" },
  radio: { url: arasaacPictogramImageUrl(3627), source: "arasaac" },

  // --- Gia đình ---
  grandmother: { url: arasaacPictogramImageUrl(7068), source: "arasaac" },
  grandfather: { url: arasaacPictogramImageUrl(7067), source: "arasaac" },
  grandma: { url: arasaacPictogramImageUrl(7068), source: "arasaac" },
  cousin: { url: arasaacPictogramImageUrl(38351), source: "arasaac" },
  wife: { url: UNSPLASH("photo-1494790108377-be9c29b29330"), source: "curated_unsplash" },

  // --- Địa điểm ---
  beach: { url: UNSPLASH("photo-1507525428034-b723cf961d3e"), source: "curated_unsplash" },
  hotel: { url: UNSPLASH("photo-1566073771259-6a8506099945"), source: "curated_unsplash" },
  library: { url: UNSPLASH("photo-1521587760476-6c12a7b04425"), source: "curated_unsplash" },
  office: { url: UNSPLASH("photo-1497366216548-37526070297c"), source: "curated_unsplash" },
  supermarket: { url: UNSPLASH("photo-1578916171728-46686eac8d58"), source: "curated_unsplash" },
  garage: { url: UNSPLASH("photo-1486262715619-67b85e0b08d3"), source: "curated_unsplash" },

  // --- Khác ---
  learn: { url: arasaacPictogramImageUrl(7074), source: "arasaac" },
  dancer: { url: arasaacPictogramImageUrl(6601), source: "arasaac" },
  dance: { url: arasaacPictogramImageUrl(6601), source: "arasaac" },
  piano: { url: arasaacPictogramImageUrl(3641), source: "arasaac" },
  salad: { url: UNSPLASH("photo-1512621776951-a57141f2eefd"), source: "curated_unsplash" },
  parachute: { url: arasaacPictogramImageUrl(6722), source: "arasaac" },
};

/** ARASAAC pictogram IDs không dùng cho từ vựng (stem sai nghĩa). */
export const BLOCKED_PICTOGRAM_IDS = new Set([
  4685, // "even" — bị match nhầm từ evening
]);

/** Stem gây nhầm — không dùng khi tra pictogram cho từ vựng. */
export const BLOCKED_STEM_KEYS = new Set(["even"]);

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\?$/, "");
}

/**
 * @param {object} row
 * @returns {{ url: string, source: string } | null}
 */
export function lookupVocabImageOverride(row) {
  const word = normalizeKey(row?.word);
  const meaning = normalizeKey(row?.vietnamese_meaning);

  if (VOCAB_IMAGE_OVERRIDES[word]) return VOCAB_IMAGE_OVERRIDES[word];

  const first = word.split(/\s+/)[0];
  if (first && VOCAB_IMAGE_OVERRIDES[first]) return VOCAB_IMAGE_OVERRIDES[first];

  if (meaning.includes("nước anh")) return VOCAB_IMAGE_OVERRIDES.england;
  if (meaning.includes("ai cập")) return { url: arasaacPictogramImageUrl(8099), source: "arasaac" };
  if (meaning.includes("nước pháp")) return { url: arasaacPictogramImageUrl(8121), source: "arasaac" };
  if (meaning.includes("nước đức")) return { url: arasaacPictogramImageUrl(8011), source: "arasaac" };
  if (meaning.includes("buổi tối") || meaning.includes("ban đêm")) return VOCAB_IMAGE_OVERRIDES.evening;
  if (meaning.includes("buổi sáng")) return VOCAB_IMAGE_OVERRIDES.morning;
  if (meaning.includes("buổi chiều")) return VOCAB_IMAGE_OVERRIDES.afternoon;
  if (meaning.includes("máy nhánh") || meaning.includes("số máy lẻ")) return VOCAB_IMAGE_OVERRIDES.extension;

  const countryMatch = meaning.match(/^nước (.+)$/);
  if (countryMatch) {
    const countryKey = countryMatch[1]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
    const aliases = {
      brazil: "brazil",
      argentina: "argentina",
      uc: "australia",
      australia: "australia",
      canada: "canada",
      "hy lap": "greece",
      hungary: "hungary",
      ireland: "ireland",
      y: "italy",
      italy: "italy",
      nhat: "japan",
      japan: "japan",
      mexico: "mexico",
      "ba lan": "poland",
      "bo dao nha": "portugal",
      nga: "russia",
      russia: "russia",
      "tay ban nha": "spain",
      spain: "spain",
      "thuy si": "switzerland",
      switzerland: "switzerland",
    };
    const key = aliases[countryKey] || countryKey.replace(/\s+/g, "");
    if (VOCAB_IMAGE_OVERRIDES[key]) return VOCAB_IMAGE_OVERRIDES[key];
  }

  return null;
}
