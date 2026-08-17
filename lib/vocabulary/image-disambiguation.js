/** Tránh nhầm nghĩa khi sinh ảnh (bank, orange, watch, …). */

function cleanText(value, max = 240) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const HOMONYM_RULES = {
  bank: [
    { test: /ngân hàng|tài chính|gửi tiền/, visual: "financial bank building", search: "bank building" },
    { test: /bờ|sông|hồ/, visual: "river bank shoreline", search: "riverbank" },
  ],
  orange: [
    { test: /quả|táo cam/, visual: "orange fruit", search: "orange fruit" },
    { test: /màu cam/, visual: "orange color swatch", search: "orange color" },
  ],
  watch: [
    { test: /đồng hồ/, visual: "wristwatch timepiece", search: "wristwatch" },
    { test: /xem|quan sát|theo dõi/, visual: "person watching carefully", search: "watching" },
  ],
  right: [
    { test: /bên phải|phải/, visual: "right direction arrow", search: "right arrow" },
    { test: /đúng/, visual: "correct checkmark", search: "correct" },
  ],
  left: [
    { test: /bên trái|trái/, visual: "left direction arrow", search: "left arrow" },
    { test: /ở lại|bỏ lại/, visual: "left behind object", search: "left behind" },
  ],
  fine: [
    { test: /khỏe|tốt/, visual: "person feeling fine and healthy", search: "feeling fine" },
    { test: /đẹp|tinh tế|phạt/, visual: "fine quality detail", search: "fine quality" },
  ],
  letter: [
    { test: /thư|lá thư/, visual: "envelope letter mail", search: "letter mail" },
    { test: /chữ cái/, visual: "alphabet letter B", search: "alphabet letter" },
  ],
  park: [
    { test: /công viên/, visual: "public city park", search: "city park" },
    { test: /đỗ xe/, visual: "parked car parking", search: "parking car" },
  ],
  match: [
    { test: /trận đấu|diêm/, visual: "sports match game", search: "sports match" },
    { test: /khớp|phù hợp/, visual: "matching pair objects", search: "matching pair" },
  ],
};

/**
 * @returns {{ visualFocus: string, searchWord: string, disambiguationNote: string }}
 */
export function resolveImageDisambiguation(row) {
  const word = cleanText(row?.word).toLowerCase().replace(/\?$/, "");
  const meaning = cleanText(row?.vietnamese_meaning || row?.meaning).toLowerCase();
  const example = cleanText(row?.example_sentence).toLowerCase();
  const head = word.split(/\s+/)[0];

  const rules = HOMONYM_RULES[head] || HOMONYM_RULES[word];
  if (rules) {
    for (const rule of rules) {
      if (rule.test.test(meaning) || rule.test.test(example)) {
        return {
          visualFocus: rule.visual,
          searchWord: rule.search,
          lookupWord: head,
          disambiguationNote: `Disambiguate "${word}" as: ${rule.visual} (Vietnamese: ${meaning}).`,
        };
      }
    }
  }

  if (meaning) {
    return {
      visualFocus: meaning,
      searchWord: word,
      lookupWord: head,
      disambiguationNote: `Use Vietnamese meaning "${meaning}" to choose the correct visual, not other senses of "${word}".`,
    };
  }

  return {
    visualFocus: word,
    searchWord: word,
    lookupWord: head,
    disambiguationNote: `Illustrate the English word "${word}" in its most common learner sense.`,
  };
}
