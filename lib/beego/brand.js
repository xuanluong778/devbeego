/** Beego product brand & learning tracks — single source of truth for UI copy/routes. */

import { SPEAKING_PATH } from "./routes";

export const BEEGO_BRAND = {
  name: "Beego",
  domain: "beego.vn",
  url: "https://beego.vn",
  tagline: "Học tiếng Anh bằng AI cho mọi độ tuổi",
  description:
    "Nền tảng học tiếng Anh thông minh với AI — từ trẻ em đến đi làm, du lịch, thi cử và kinh doanh.",
};

/** @typedef {"kids"|"beginner"|"student"|"work"|"travel"|"exam"|"business"} BeegoTrackId */

/** @type {Array<{id: BeegoTrackId, slug: string, name: string, shortName: string, icon: string, accent: string, tagline: string, audience: string, goals: string[], path: Array<{step: number, title: string, desc: string, href: string}>, tools: Array<{label: string, href: string, icon: string}>}>} */
export const BEEGO_TRACKS = [
  {
    id: "kids",
    slug: "kids",
    name: "Beego Kids",
    shortName: "Kids",
    icon: "🐝",
    accent: "#FFB020",
    tagline: "Tiếng Anh vui, an toàn cho trẻ em",
    audience: "Trẻ 4–12 tuổi",
    goals: [
      "Làm quen từ vựng qua hình ảnh",
      "Phát âm và nói câu ngắn",
      "Đọc truyện tương tác",
      "Học qua trò chơi",
    ],
    path: [
      { step: 1, title: "Khám phá từ mới", desc: "Flashcard & game từ vựng", href: "/kids" },
      { step: 2, title: "Luyện nói", desc: "Ghi âm và chấm điểm phát âm", href: "/kids/ai-teacher" },
      { step: 3, title: "Đọc truyện", desc: "Truyện song ngữ tương tác", href: "/kids-fun-stories" },
    ],
    tools: [
      { label: "Beego Kids", href: "/kids", icon: "🐝" },
      { label: "Truyện vui", href: "/kids-fun-stories", icon: "📖" },
      { label: "Phát âm IPA", href: "/pronunciation", icon: "🎙️" },
    ],
  },
  {
    id: "beginner",
    slug: "beginner",
    name: "Beego Beginner",
    shortName: "Beginner",
    icon: "🌱",
    accent: "#34C759",
    tagline: "Bắt đầu từ con số 0",
    audience: "Người mới học tiếng Anh",
    goals: [
      "Nắm từ vựng cơ bản hằng ngày",
      "Nghe – nói câu đơn giản",
      "Luyện phát âm chuẩn",
      "Chat với AI giáo viên",
    ],
    path: [
      { step: 1, title: "Từ vựng nền", desc: "1000 từ cơ bản", href: "/vocabulary" },
      { step: 2, title: "Luyện phát âm", desc: "IPA & nhận diện giọng nói", href: "/pronunciation" },
      { step: 3, title: "Hội thoại AI", desc: "Giáo viên ảo kiên nhẫn", href: SPEAKING_PATH },
      { step: 4, title: "Quiz ôn tập", desc: "Ghi nhớ lâu hơn", href: "/quiz" },
    ],
    tools: [
      { label: "Từ vựng", href: "/vocabulary", icon: "📚" },
      { label: "Phát âm IPA", href: "/pronunciation", icon: "🎙️" },
      { label: "Bài học AI", href: SPEAKING_PATH, icon: "📘" },
      { label: "Quiz", href: "/quiz", icon: "🧠" },
    ],
  },
  {
    id: "student",
    slug: "student",
    name: "Beego Student",
    shortName: "Student",
    icon: "🎓",
    accent: "#4F8CFF",
    tagline: "Hỗ trợ học sinh – sinh viên",
    audience: "Học sinh, sinh viên",
    goals: [
      "Mở rộng từ vựng học thuật",
      "Luyện nghe – nói trong lớp",
      "Ôn tập theo lịch SRS",
      "Luyện viết & dịch",
    ],
    path: [
      { step: 1, title: "Ôn tập hôm nay", desc: "Quiz SRS thông minh", href: "/quiz?mode=review" },
      { step: 2, title: "Học từ mới", desc: "Theo chủ đề", href: "/vocabulary" },
      { step: 3, title: "Thực hành AI", desc: "Hội thoại & sửa lỗi", href: SPEAKING_PATH },
      { step: 4, title: "Tra từ điển", desc: "Nghĩa tiếng Việt tức thì", href: "/dictionary" },
    ],
    tools: [
      { label: "Dashboard", href: "/dashboard", icon: "📊" },
      { label: "Quiz", href: "/quiz", icon: "🧠" },
      { label: "Từ vựng", href: "/vocabulary", icon: "📚" },
      { label: "Bài học AI", href: SPEAKING_PATH, icon: "📘" },
    ],
  },
  {
    id: "work",
    slug: "work",
    name: "Beego Work",
    shortName: "Work",
    icon: "💼",
    accent: "#6366F1",
    tagline: "Tiếng Anh công sở thực chiến",
    audience: "Người đi làm",
    goals: [
      "Email & họp online",
      "Thuyết trình ngắn gọn",
      "Từ vựng chuyên ngành",
      "Giao tiếp với đồng nghiệp",
    ],
    path: [
      { step: 1, title: "Hội thoại công sở", desc: "Role-play với AI", href: SPEAKING_PATH },
      { step: 2, title: "Từ vựng ngành", desc: "Business & office", href: "/vocabulary" },
      { step: 3, title: "Phát âm rõ ràng", desc: "Tự tin trong meeting", href: "/pronunciation" },
    ],
    tools: [
      { label: "Bài học AI", href: SPEAKING_PATH, icon: "📘" },
      { label: "Từ vựng", href: "/vocabulary", icon: "📚" },
      { label: "Voice call", href: SPEAKING_PATH, icon: "📞" },
    ],
  },
  {
    id: "travel",
    slug: "travel",
    name: "Beego Travel",
    shortName: "Travel",
    icon: "✈️",
    accent: "#00A8B0",
    tagline: "Tự tin khi đi du lịch",
    audience: "Du khách, người hay đi công tác",
    goals: [
      "Check-in, đặt phòng, mua vé",
      "Hỏi đường & gọi món",
      "Tình huống khẩn cấp",
      "Small talk với người bản xứ",
    ],
    path: [
      { step: 1, title: "Tình huống du lịch", desc: "Chat AI theo scenario", href: SPEAKING_PATH },
      { step: 2, title: "Từ vựng travel", desc: "Sân bay, khách sạn, nhà hàng", href: "/vocabulary" },
      { step: 3, title: "Tra cứu nhanh", desc: "Từ điển song ngữ", href: "/dictionary" },
    ],
    tools: [
      { label: "Bài học AI", href: SPEAKING_PATH, icon: "📘" },
      { label: "Từ điển", href: "/dictionary", icon: "🔍" },
      { label: "Từ vựng", href: "/vocabulary", icon: "📚" },
    ],
  },
  {
    id: "exam",
    slug: "exam",
    name: "Beego Exam",
    shortName: "Exam",
    icon: "📝",
    accent: "#F97316",
    tagline: "Luyện thi IELTS, TOEIC, Cambridge",
    audience: "Thí sinh luyện thi",
    goals: [
      "Từ vựng theo band điểm",
      "Ngữ pháp & cấu trúc câu",
      "Luyện nghe – nói có chấm điểm",
      "Ôn tập theo lịch",
    ],
    path: [
      { step: 1, title: "Quiz luyện thi", desc: "SRS & thống kê", href: "/quiz" },
      { step: 2, title: "Phát âm chuẩn", desc: "Azure chấm điểm", href: "/pronunciation" },
      { step: 3, title: "Sửa lỗi AI", desc: "Grammar & speaking", href: SPEAKING_PATH },
      { step: 4, title: "Theo dõi tiến độ", desc: "Dashboard cá nhân", href: "/dashboard" },
    ],
    tools: [
      { label: "Quiz", href: "/quiz", icon: "🧠" },
      { label: "Phát âm IPA", href: "/pronunciation", icon: "🎙️" },
      { label: "Dashboard", href: "/dashboard", icon: "📊" },
    ],
  },
  {
    id: "business",
    slug: "business",
    name: "Beego Business",
    shortName: "Business",
    icon: "📈",
    accent: "#8B5CF6",
    tagline: "Tiếng Anh thương mại & đàm phán",
    audience: "Doanh nhân, quản lý, sales",
    goals: [
      "Pitch & đàm phán",
      "Email & báo cáo chuyên nghiệp",
      "Networking quốc tế",
      "Từ vựng finance & marketing",
    ],
    path: [
      { step: 1, title: "Role-play kinh doanh", desc: "AI coach chuyên sâu", href: SPEAKING_PATH },
      { step: 2, title: "Từ vựng business", desc: "Theo ngành & chức danh", href: "/vocabulary" },
      { step: 3, title: "Voice call", desc: "Luyện nói realtime", href: SPEAKING_PATH },
    ],
    tools: [
      { label: "Bài học AI", href: SPEAKING_PATH, icon: "📘" },
      { label: "Từ vựng", href: "/vocabulary", icon: "📚" },
      { label: "Dashboard", href: "/dashboard", icon: "📊" },
    ],
  },
];

export const BEEGO_CORE_TOOLS = [
  { href: SPEAKING_PATH, label: "Học với AI", icon: "🤖", desc: "Giáo viên ảo & voice call" },
  { href: "/vocabulary", label: "Từ vựng", icon: "📚", desc: "Học & ôn theo chủ đề" },
  { href: "/quiz", label: "Quiz", icon: "🧠", desc: "SRS thông minh" },
  { href: "/pronunciation", label: "Phát âm", icon: "🎙️", desc: "IPA & chấm điểm" },
  { href: "/dictionary", label: "Từ điển", icon: "🔍", desc: "Tra nghĩa EN–VI" },
];

/** @param {string} id */
export function getBeegoTrack(id) {
  return BEEGO_TRACKS.find((t) => t.id === id || t.slug === id) || null;
}

/** @param {string} id */
export function isBeegoTrackId(id) {
  return BEEGO_TRACKS.some((t) => t.id === id);
}
