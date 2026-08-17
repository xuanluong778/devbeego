import { IPA_PHONEMIC_CHART } from "./phonemic-chart";

function normalizeIpaKey(ipa) {
  return String(ipa || "")
    .replace(/\//g, "")
    .trim()
    .toLowerCase();
}

function buildIpaSampleMap() {
  const map = new Map();
  const add = (ipa, word) => {
    const key = normalizeIpaKey(ipa);
    if (!key || !word || map.has(key)) return;
    map.set(key, word);
  };

  IPA_PHONEMIC_CHART.vowels.sections.forEach((sec) => {
    sec.rows.forEach((row) => {
      row.forEach((cell) => {
        if (cell?.ipa) add(cell.ipa, cell.word);
      });
    });
  });

  IPA_PHONEMIC_CHART.consonants.rows.forEach((row) => {
    row.forEach((cell) => add(cell.ipa, cell.word));
  });

  return map;
}

const IPA_SAMPLE_MAP = buildIpaSampleMap();

/**
 * Từ mẫu để nghe qua TTS cho một ký hiệu IPA (vd. /l/ → "letter").
 * @param {string} ipaFocus - ví dụ "/l/" hoặc "/eɪ/"
 * @returns {string|null}
 */
export function getIpaSampleWord(ipaFocus) {
  const key = normalizeIpaKey(ipaFocus);
  if (!key) return null;
  if (IPA_SAMPLE_MAP.has(key)) return IPA_SAMPLE_MAP.get(key);
  const withoutLength = key.replace(/ː/g, "");
  if (withoutLength !== key && IPA_SAMPLE_MAP.has(withoutLength)) {
    return IPA_SAMPLE_MAP.get(withoutLength);
  }
  return null;
}
