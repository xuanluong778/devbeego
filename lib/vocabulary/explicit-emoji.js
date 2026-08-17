/**
 * Chỉ trả emoji đã map tường minh — KHÔNG dùng hash ngẫu nhiên cho từ vựng.
 */
import storyWordEmoji from "../kids-vocabulary/story-word-emoji.generated.js";

const OPENMOJI_CDN = "https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg";

/** @type {Record<string, string>} */
const EXPLICIT_EMOJI_HEX = {
  apple: "1f34e",
  banana: "1f34c",
  orange: "1f34a",
  beach: "1f3d6",
  bus: "1f697",
  car: "1f697",
  cat: "1f431",
  dog: "1f436",
  egg: "1f95a",
  fish: "1f41f",
  happy: "1f60a",
  sad: "1f622",
  sun: "1f31e",
  sunny: "1f31e",
  moon: "1f319",
  rainy: "1f327",
  snow: "1f328",
  swim: "1f3ca",
  tree: "1f333",
  water: "1f4a7",
  book: "1f4d6",
  school: "1f3eb",
  house: "1f3e0",
  family: "1f46a",
  baby: "1f476",
  heart: "2764",
  star: "2b50",
  rain: "1f327",
  wind: "1f4a8",
  fire: "1f525",
  food: "1f35e",
  rice: "1f35a",
  meat: "1f356",
  coffee: "2615",
  tea: "1f375",
  beer: "1f37a",
  wine: "1f377",
  phone: "1f4f1",
  camera: "1f4f7",
  music: "1f3b5",
  dance: "1f483",
  run: "1f3c3",
  walk: "1f6b6",
  sleep: "1f634",
  tired: "1f634",
  angry: "1f620",
  cry: "1f622",
  smile: "1f604",
  eye: "1f441",
  ear: "1f442",
  mouth: "1f444",
  hand: "1f91a",
  foot: "1f9b6",
  christmas: "1f384",
  gift: "1f381",
  party: "1f389",
  money: "1f4b0",
  key: "1f511",
  door: "1f6aa",
  bed: "1f6cf",
  clock: "1f551",
  watch: "231a",
  plane: "2708",
  train: "1f682",
  ship: "1f6a2",
  bike: "1f6b2",
  ball: "26bd",
  football: "26bd",
  tennis: "1f3be",
  golf: "26f3",
  yellow: "1f7e1",
  red: "1f534",
  blue: "1f535",
  green: "1f7e2",
  internet: "1f310",
  email: "1f4e7",
  question: "2753",
  yes: "2705",
  no: "274c",
  win: "1f3c6",
  love: "2764",
  friend: "1f46b",
  mother: "1f469",
  father: "1f468",
  grandma: "1f475",
  grandpa: "1f474",
  doctor: "1f9d1",
  teacher: "1f9d1",
  police: "1f46e",
  rain: "1f327",
  cloud: "1f325",
  rainbow: "1f308",
  mountain: "1f3d4",
  sea: "1f30a",
  river: "1f3ca",
  flower: "1f338",
  plant: "1f331",
  vegetable: "1f96c",
  strawberry: "1f353",
  tomato: "1f345",
  potato: "1f954",
  mushroom: "1f344",
  bread: "1f35e",
  cake: "1f370",
  ice: "1f9ca",
  hot: "1f525",
  cold: "1f976",
  big: "1f4cf",
  small: "1f539",
};

function normalizeKey(word) {
  return String(word || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function stems(word) {
  const w = word.toLowerCase();
  const out = new Set([w]);
  if (w.endsWith("ies")) out.add(`${w.slice(0, -3)}y`);
  if (w.endsWith("ing") && w.length > 5) out.add(w.slice(0, -3));
  if (w.endsWith("ed") && w.length > 4) out.add(w.slice(0, -2));
  if (w.endsWith("es") && w.length > 4) out.add(w.slice(0, -2));
  if (w.endsWith("s") && w.length > 3) out.add(w.slice(0, -1));
  return [...out];
}

/**
 * @param {string} word
 * @returns {string} OpenMoji SVG URL hoặc ""
 */
export function explicitOpenmojiImageUrl(word) {
  const key = normalizeKey(word);
  if (!key) return "";

  if (EXPLICIT_EMOJI_HEX[key]) {
    return `${OPENMOJI_CDN}/${EXPLICIT_EMOJI_HEX[key].toUpperCase()}.svg`;
  }
  if (storyWordEmoji[key]) {
    return `${OPENMOJI_CDN}/${String(storyWordEmoji[key]).toUpperCase()}.svg`;
  }

  for (const s of stems(key)) {
    if (EXPLICIT_EMOJI_HEX[s]) {
      return `${OPENMOJI_CDN}/${EXPLICIT_EMOJI_HEX[s].toUpperCase()}.svg`;
    }
    if (storyWordEmoji[s]) {
      return `${OPENMOJI_CDN}/${String(storyWordEmoji[s]).toUpperCase()}.svg`;
    }
  }

  return "";
}
