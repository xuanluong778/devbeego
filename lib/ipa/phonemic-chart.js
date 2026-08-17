/**
 * Bảng phiên âm IPA tiếng Anh (US) — 44 âm theo phonemic chart chuẩn.
 * @typedef {{ ipa: string, word: string, voiced?: boolean }} IpaChartCell
 */

/** @type {{ label: string, kind: "mono" | "diph", rows: IpaChartCell[][] }} */
const MONOPHTHONGS = {
  label: "monophthongs",
  kind: "mono",
  rows: [
    [
      { ipa: "/iː/", word: "leave" },
      { ipa: "/ɪ/", word: "live" },
      { ipa: "/ʊ/", word: "put" },
      { ipa: "/uː/", word: "pool" },
    ],
    [
      { ipa: "/e/", word: "pen" },
      { ipa: "/ə/", word: "a" },
      { ipa: "/ɜː/", word: "girl" },
      { ipa: "/ɔː/", word: "door" },
    ],
    [
      { ipa: "/æ/", word: "man" },
      { ipa: "/ʌ/", word: "cup" },
      { ipa: "/ɑː/", word: "car" },
      { ipa: "/ɒ/", word: "hot" },
    ],
  ],
};

/** @type {{ label: string, kind: "mono" | "diph", rows: IpaChartCell[][] }} */
const DIPHTHONGS = {
  label: "diphthongs",
  kind: "diph",
  rows: [
    [
      { ipa: "/ɪə/", word: "year" },
      { ipa: "/eɪ/", word: "paper" },
      { ipa: null },
      { ipa: null },
    ],
    [
      { ipa: "/ʊə/", word: "tourist" },
      { ipa: "/ɔɪ/", word: "boy" },
      { ipa: "/oʊ/", word: "phone" },
      { ipa: null },
    ],
    [
      { ipa: "/eə/", word: "chair" },
      { ipa: "/aɪ/", word: "fine" },
      { ipa: "/aʊ/", word: "house" },
      { ipa: null },
    ],
  ],
};

/** @type {IpaChartCell[][]} */
const CONSONANT_ROWS = [
  [
    { ipa: "/p/", word: "pen", voiced: false },
    { ipa: "/b/", word: "baby", voiced: true },
    { ipa: "/t/", word: "table", voiced: false },
    { ipa: "/d/", word: "door", voiced: true },
    { ipa: "/tʃ/", word: "chip", voiced: false },
    { ipa: "/dʒ/", word: "January", voiced: true },
    { ipa: "/k/", word: "key", voiced: false },
    { ipa: "/g/", word: "girl", voiced: true },
  ],
  [
    { ipa: "/f/", word: "fan", voiced: false },
    { ipa: "/v/", word: "van", voiced: true },
    { ipa: "/θ/", word: "think", voiced: false },
    { ipa: "/ð/", word: "this", voiced: true },
    { ipa: "/s/", word: "sun", voiced: false },
    { ipa: "/z/", word: "zoo", voiced: true },
    { ipa: "/ʃ/", word: "shoes", voiced: false },
    { ipa: "/ʒ/", word: "vision", voiced: true },
  ],
  [
    { ipa: "/m/", word: "mouth", voiced: true },
    { ipa: "/n/", word: "nose", voiced: true },
    { ipa: "/ŋ/", word: "ring", voiced: true },
    { ipa: "/h/", word: "hear", voiced: false },
    { ipa: "/l/", word: "letter", voiced: true },
    { ipa: "/r/", word: "rain", voiced: true },
    { ipa: "/w/", word: "window", voiced: true },
    { ipa: "/j/", word: "yellow", voiced: true },
  ],
];

export const IPA_CHART_TITLE = "BẢNG PHIÊN ÂM TIẾNG ANH IPA";

export const IPA_PHONEMIC_CHART = {
  vowels: {
    label: "VOWELS",
    sections: [MONOPHTHONGS, DIPHTHONGS],
  },
  consonants: {
    label: "CONSONANTS",
    rows: CONSONANT_ROWS,
  },
};

export function countChartPhonemes() {
  let n = 0;
  IPA_PHONEMIC_CHART.vowels.sections.forEach((sec) => {
    sec.rows.forEach((row) => {
      row.forEach((cell) => {
        if (cell?.ipa) n += 1;
      });
    });
  });
  IPA_PHONEMIC_CHART.consonants.rows.forEach((row) => {
    row.forEach((cell) => {
      if (cell?.ipa) n += 1;
    });
  });
  return n;
}
