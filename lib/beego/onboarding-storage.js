import { getBeegoTrack } from "./brand";
import { SPEAKING_PATH } from "./routes";

const STORAGE_KEY = "beego_onboarding_v2";
const LEGACY_KEY = "beego_onboarding_v1";

/** @typedef {"zero"|"communicate"|"work"|"exam"|"travel"|"kids"} BeegoPurpose */
/** @typedef {"new"|"little"|"medium"|"good"} BeegoLevelId */
/** @typedef {5|10|15|30} BeegoDailyMinutes */

/** @typedef {{ purpose: BeegoPurpose, level: BeegoLevelId, dailyMinutes: BeegoDailyMinutes, trackId: string, completedAt: string, userId?: string|null }} BeegoOnboardingProfile */

export const BEEGO_PURPOSES = [
  { id: "zero", icon: "🌱", label: "Mất gốc", desc: "Bắt đầu lại từ đầu, từ từ từng bước" },
  { id: "communicate", icon: "💬", label: "Giao tiếp", desc: "Nói chuyện hằng ngày tự tin hơn" },
  { id: "work", icon: "💼", label: "Công việc", desc: "Email, họp, thuyết trình" },
  { id: "exam", icon: "📝", label: "Luyện thi", desc: "IELTS, TOEIC, Cambridge" },
  { id: "travel", icon: "✈️", label: "Du lịch", desc: "Đặt phòng, hỏi đường, gọi món" },
  { id: "kids", icon: "🐝", label: "Trẻ em", desc: "Beego Kids — học vui cho bé" },
];

export const BEEGO_LEVELS = [
  { id: "new", label: "Mới bắt đầu", desc: "Chưa biết hoặc rất ít tiếng Anh" },
  { id: "little", label: "Biết chút ít", desc: "Hiểu vài câu, cần luyện thêm" },
  { id: "medium", label: "Trung bình", desc: "Giao tiếp được nhưng còn lỗi" },
  { id: "good", label: "Khá", desc: "Muốn nói tự nhiên và chính xác hơn" },
];

export const BEEGO_DAILY_MINUTES = [
  { id: 5, label: "5 phút", desc: "Một chút mỗi ngày cũng tiến bộ" },
  { id: 10, label: "10 phút", desc: "Phù hợp lịch bận rộn" },
  { id: 15, label: "15 phút", desc: "Cân bằng tốt nhất" },
  { id: 30, label: "30 phút", desc: "Học sâu, tiến nhanh" },
];

const PURPOSE_TO_TRACK = {
  zero: "beginner",
  communicate: "beginner",
  work: "work",
  exam: "exam",
  travel: "travel",
  kids: "kids",
};

export function purposeToTrackId(purpose) {
  return PURPOSE_TO_TRACK[purpose] || "beginner";
}

function isValidPurpose(v) {
  return BEEGO_PURPOSES.some((p) => p.id === v);
}

function isValidLevel(v) {
  return BEEGO_LEVELS.some((l) => l.id === v);
}

function isValidMinutes(v) {
  return BEEGO_DAILY_MINUTES.some((m) => m.id === v);
}

function migrateLegacy(raw) {
  if (!raw?.trackId || !raw?.completedAt) return null;
  const track = getBeegoTrack(raw.trackId);
  const purpose =
    raw.trackId === "kids"
      ? "kids"
      : raw.trackId === "work"
        ? "work"
        : raw.trackId === "exam"
          ? "exam"
          : raw.trackId === "travel"
            ? "travel"
            : "communicate";
  const levelMap = { starter: "new", intermediate: "medium", advanced: "good" };
  return {
    purpose,
    level: levelMap[raw.level] || "medium",
    dailyMinutes: 10,
    trackId: raw.trackId,
    completedAt: raw.completedAt,
    userId: raw.userId ?? null,
  };
}

function normalizeProfile(parsed) {
  if (!parsed || typeof parsed !== "object" || !parsed.completedAt) return null;

  if (parsed.purpose && isValidPurpose(parsed.purpose)) {
    return {
      purpose: parsed.purpose,
      level: isValidLevel(parsed.level) ? parsed.level : "medium",
      dailyMinutes: isValidMinutes(Number(parsed.dailyMinutes)) ? Number(parsed.dailyMinutes) : 10,
      trackId: parsed.trackId || purposeToTrackId(parsed.purpose),
      completedAt: String(parsed.completedAt),
      userId: parsed.userId ?? null,
    };
  }

  return migrateLegacy(parsed);
}

/** @returns {BeegoOnboardingProfile|null} */
export function readOnboardingProfile() {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const migrated = normalizeProfile(JSON.parse(raw));
        if (migrated) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
      return null;
    }
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** @param {Partial<BeegoOnboardingProfile> & { purpose: BeegoPurpose }} profile */
export function saveOnboardingProfile(profile) {
  if (typeof window === "undefined") return null;
  const purpose = profile.purpose;
  if (!isValidPurpose(purpose)) return null;
  const next = {
    purpose,
    level: isValidLevel(profile.level) ? profile.level : "medium",
    dailyMinutes: isValidMinutes(Number(profile.dailyMinutes)) ? Number(profile.dailyMinutes) : 10,
    trackId: profile.trackId || purposeToTrackId(purpose),
    completedAt: profile.completedAt || new Date().toISOString(),
    userId: profile.userId ?? null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("beego:onboarding", { detail: next }));
  return next;
}

export function clearOnboardingProfile() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
  window.dispatchEvent(new CustomEvent("beego:onboarding", { detail: null }));
}

export function needsOnboarding() {
  return !readOnboardingProfile();
}

export function getContinueLearningHref(profile) {
  if (!profile) return "/onboarding";
  if (profile.purpose === "kids") return "/kids";
  return SPEAKING_PATH;
}
