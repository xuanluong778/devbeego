/** Dashboard vocabulary — filters, topic chips, study status labels. */

export const VOCAB_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "not_learned", label: "Chưa học", auth: true },
  { id: "learning", label: "Đang học", auth: true },
  { id: "review_today", label: "Cần ôn", auth: true },
  { id: "difficult", label: "Từ yếu", auth: true },
  { id: "mastered", label: "Đã nhớ", auth: true },
  { id: "saved", label: "Bookmark", auth: false },
];

export const VOCAB_ACTION_CARDS = [
  {
    id: "learn_today",
    filter: "learning",
    sessionMode: "learn",
    ctaLabel: "Bắt đầu học",
    title: "Học hôm nay",
    desc: "Từ mới và đang học trong SRS",
    icon: "✨",
    statKey: "new_today",
    statSuffix: "từ mới",
    accent: "blue",
  },
  {
    id: "review_due",
    filter: "review_today",
    sessionMode: "review",
    ctaLabel: "Ôn ngay",
    title: "Ôn từ đến hạn",
    desc: "SRS nhắc ôn ngay hôm nay",
    icon: "🔄",
    statKey: "review_due",
    statSuffix: "từ",
    accent: "amber",
  },
  {
    id: "weak_words",
    filter: "difficult",
    sessionMode: "weak",
    ctaLabel: "Luyện ngay",
    title: "Từ yếu của tôi",
    desc: "Từ hay sai — cần luyện thêm",
    icon: "💪",
    statKey: "weak_count",
    statSuffix: "từ",
    accent: "rose",
  },
];

export const VOCAB_TOPIC_CHIPS = [
  { label: "Từ vựng Cơ Bản", icon: "📚", needles: ["tu vung co ban", "từ vựng cơ bản"] },
  { label: "Daily Life", icon: "🏠", needles: ["hang ngay", "daily", "gia dinh", "nha o", "con nguoi", "co the"] },
  { label: "Travel", icon: "✈️", needles: ["du lich", "travel", "phuong tien", "san bay"] },
  { label: "Business", icon: "💼", needles: ["kinh te", "business", "van phong", "tai chinh"] },
  { label: "School", icon: "🏫", needles: ["truong", "school", "hoc tap", "giao duc"] },
  { label: "Kids", icon: "🧒", needles: ["tre em", "kids", "cho be", "em be"] },
  { label: "Food", icon: "🍽️", needles: ["thuc an", "food", "do uong", "an uong", "nau"] },
  { label: "Work", icon: "👔", needles: ["nghe nghiep", "job", "work", "cong viec", "van phong"] },
];

function normalizeTopicKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function resolveTopicChipsFromApi(topics = []) {
  return VOCAB_TOPIC_CHIPS.map((chip) => {
    const hit = topics.find((row) => {
      const nt = normalizeTopicKey(row.topic);
      return chip.needles.some((n) => nt.includes(n));
    });
    return {
      ...chip,
      topic: hit?.topic || "",
      count: hit ? Number(hit.total || 0) : 0,
      disabled: !hit,
    };
  });
}

export const STUDY_STATUS_META = {
  not_learned: { label: "Chưa học", tone: "new" },
  learning: { label: "Đang học", tone: "learning" },
  review: { label: "Cần ôn", tone: "review" },
  weak: { label: "Từ yếu", tone: "weak" },
  mastered: { label: "Đã nhớ", tone: "mastered" },
};

export function resolveStudyStatusMeta(item) {
  const key = item?.study_status || "not_learned";
  return STUDY_STATUS_META[key] || STUDY_STATUS_META.not_learned;
}
