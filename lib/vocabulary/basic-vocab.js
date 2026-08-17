/** Chủ đề từ vựng cơ bản — chỉ nguồn file Tu_vung_tong_hop_chuan.txt */

export const BASIC_VOCAB_TOPIC = "Từ vựng Cơ Bản";
export const BASIC_VOCAB_SOURCE = "co_ban_txt";
export const LEGACY_BASIC_TOPICS = ["Từ vựng tổng hợp", BASIC_VOCAB_TOPIC];

function normalizeTopicKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isBasicVocabTopic(topic) {
  const key = normalizeTopicKey(topic);
  return LEGACY_BASIC_TOPICS.some((t) => normalizeTopicKey(t) === key);
}

/** SQL fragment + params when listing chủ đề cơ bản (requires vocab_source column). */
export function basicVocabTopicWhere(topic, hasVocabSource) {
  if (!isBasicVocabTopic(topic)) return null;
  if (!hasVocabSource) {
    return { clause: "topic = ?", params: [BASIC_VOCAB_TOPIC] };
  }
  return {
    clause: "topic = ? AND vocab_source = ?",
    params: [BASIC_VOCAB_TOPIC, BASIC_VOCAB_SOURCE],
  };
}

/** Ẩn bộ từ cơ bản khỏi danh sách “Tất cả” để không trùng từ Beego. */
export function excludeBasicVocabWhere(hasVocabSource) {
  if (!hasVocabSource) return null;
  return {
    clause: "(vocab_source IS NULL OR vocab_source = '' OR vocab_source = 'beego')",
    params: [],
  };
}
