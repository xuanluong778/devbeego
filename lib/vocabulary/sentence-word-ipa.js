/** Tách câu ví dụ + chuỗi IPA thành từng từ kèm phiên âm. */

function tokenizeEnglish(sentence) {
  return String(sentence || "").match(/[A-Za-z']+|[^A-Za-z'\s]+/g) || [];
}

function stripTrailingPunct(token) {
  return String(token || "").replace(/[.,!?;:]+$/, "");
}

function normalizeIpaDisplay(ipa) {
  const s = stripTrailingPunct(String(ipa || "").trim());
  if (!s) return "";
  if (s.startsWith("/") && s.endsWith("/")) return s;
  const body = s.replace(/^\/+|\/+$/g, "");
  return body ? `/${body}/` : "";
}

/**
 * Parse mixed IPA strings from DB, e.g.:
 * - "maɪ 'fæməli /is/ /big/."
 * - "/maɪ/ /ˈfæməli/ /ɪz/ /bɪɡ/"
 * - "My family is big" (invalid — ignored)
 */
function extractIpaChunks(sentenceIpa) {
  const raw = String(sentenceIpa || "").trim();
  if (!raw) return [];

  const slashChunks = raw.match(/\/[^/]+\//g);
  const spaceParts = raw.split(/\s+/).map(stripTrailingPunct).filter(Boolean);

  // Prefer space-delimited when it yields enough tokens (handles mixed slash formats).
  if (spaceParts.length >= 2) {
    return spaceParts.map(normalizeIpaDisplay).filter(Boolean);
  }

  if (slashChunks?.length) {
    return slashChunks.map(normalizeIpaDisplay).filter(Boolean);
  }

  return spaceParts.map(normalizeIpaDisplay).filter(Boolean);
}

function isCorruptSentenceIpa(sentenceIpa, wordCount) {
  const raw = String(sentenceIpa || "").trim();
  if (!raw) return true;
  const chunks = extractIpaChunks(sentenceIpa);
  if (!chunks.length) return true;
  // Partial slash-only IPA (e.g. "/is/ /big/" for a 4-word sentence) — discard.
  if (chunks.length < wordCount && (raw.match(/\/[^/]+\//g)?.length || 0) <= chunks.length) {
    return true;
  }
  return false;
}

/** Hiển thị IPA từ — luôn có dấu /.../ */
export function formatWordIpa(ipa, word) {
  const raw = String(ipa || "").trim();
  if (raw) {
    const body = raw.replace(/^\/+|\/+$/g, "");
    return body ? `/${body}/` : "";
  }
  const w = String(word || "").trim().toLowerCase();
  return w ? `/${w}/` : "";
}

/**
 * @returns {{ word: string, ipa: string, isWord: boolean }[]}
 */
export function buildSentenceWordIpaPairs(sentence, sentenceIpa, headword = "", headwordIpa = "") {
  const tokens = tokenizeEnglish(sentence);
  if (!tokens.length) return [];

  const wordTokens = tokens.filter((t) => /^[A-Za-z']+$/.test(t));
  const head = String(headword || "").toLowerCase();
  const headIpa = normalizeIpaDisplay(headwordIpa);

  let ipaChunks = extractIpaChunks(sentenceIpa);
  if (isCorruptSentenceIpa(sentenceIpa, wordTokens.length)) {
    ipaChunks = [];
  }

  let ipaIdx = 0;
  return tokens.map((token) => {
    if (!/^[A-Za-z']+$/.test(token)) {
      return { word: token, ipa: "", isWord: false };
    }

    const lower = token.toLowerCase();
    let ipa = ipaChunks[ipaIdx] ? ipaChunks[ipaIdx] : "";
    if (ipaChunks[ipaIdx]) ipaIdx += 1;

    if (head && lower === head && headIpa) {
      ipa = headIpa;
    }

    if (!ipa) {
      ipa = `/${lower}/`;
    }

    return { word: token, ipa, isWord: true };
  });
}
