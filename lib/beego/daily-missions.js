import { LISTENING_PATH } from "@/lib/beego/routes";

/** @typedef {'not_started' | 'in_progress' | 'completed'} MissionStatus */

export const MISSION_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

const LISTEN_SECONDS = 300;

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Derive mission status from progress values.
 * @param {number} current
 * @param {number} target
 * @returns {MissionStatus}
 */
export function getMissionStatus(current, target) {
  if (target > 0 && current >= target) return MISSION_STATUS.COMPLETED;
  if (current > 0) return MISSION_STATUS.IN_PROGRESS;
  return MISSION_STATUS.NOT_STARTED;
}

/**
 * Human-readable progress label.
 * @param {{ progressCurrent: number, progressTarget: number, progressKind?: string }} mission
 */
export function formatMissionProgress(mission) {
  if (mission.progressKind === "time") {
    return `${formatTime(mission.progressCurrent)} / ${formatTime(mission.progressTarget)}`;
  }
  return `${mission.progressCurrent} / ${mission.progressTarget}`;
}

/**
 * Status pill on each mission row (mockup labels).
 * @param {MissionStatus} status
 */
export function getMissionStatusLabel(status) {
  if (status === MISSION_STATUS.COMPLETED) return "Đã hoàn thành";
  if (status === MISSION_STATUS.IN_PROGRESS) return "Đang làm";
  return "Chưa làm";
}

/**
 * Main CTA below the mission list.
 * @param {Array<{ status: MissionStatus, href: string }>} missions
 */
export function getMissionCta(missions) {
  const allDone = missions.every((m) => m.status === MISSION_STATUS.COMPLETED);
  if (allDone) {
    return { label: "Mở rương thưởng", href: "/progress", icon: "🎁" };
  }

  const anyStarted = missions.some((m) => m.status !== MISSION_STATUS.NOT_STARTED);
  const next = missions.find((m) => m.status !== MISSION_STATUS.COMPLETED) || missions[0];

  if (anyStarted) {
    return { label: "Tiếp tục nhiệm vụ", href: next.href, icon: "›" };
  }

  return { label: "Làm nhiệm vụ ngay", href: next.href, icon: "›" };
}

function enrichMission(raw) {
  const status = getMissionStatus(raw.progressCurrent, raw.progressTarget);
  return {
    ...raw,
    status,
    progressLabel: formatMissionProgress(raw),
    statusLabel: getMissionStatusLabel(status),
  };
}

/** Fallback mock aligned with design mockup when API data is missing. */
export function getMockDailyMissions() {
  return [
    enrichMission({
      id: "listen",
      label: "Nghe 1 bài 5 phút",
      subtitle: "Nghe và trả lời câu hỏi",
      icon: "🎧",
      iconTone: "purple",
      href: LISTENING_PATH,
      progressKind: "time",
      progressCurrent: 195,
      progressTarget: LISTEN_SECONDS,
      reward: 20,
    }),
    enrichMission({
      id: "vocab",
      label: "Học 10 từ mới",
      subtitle: "Học từ vựng theo chủ đề",
      icon: "📚",
      iconTone: "purple",
      href: "/vocabulary",
      progressKind: "count",
      progressCurrent: 10,
      progressTarget: 10,
      reward: 20,
    }),
    enrichMission({
      id: "quiz",
      label: "Làm đúng 8/10 câu quiz",
      subtitle: "Kiểm tra hiểu bài",
      icon: "🎯",
      iconTone: "orange",
      href: "/quiz",
      progressKind: "count",
      progressCurrent: 6,
      progressTarget: 10,
      reward: 20,
    }),
  ];
}

/**
 * Build daily missions from dashboard payload (easy to swap for dedicated API later).
 * @param {object|null} profile
 * @param {object|null|undefined} dash
 */
export function buildDailyMissions(profile, dash) {
  if (!dash) return getMockDailyMissions();

  const progress = Number(dash.daily_progress ?? 0);
  const completedToday = Number(dash.completed_today ?? 0);
  const newWords = Number(dash.new_words_count ?? 0);

  if (profile?.purpose === "kids") {
    return [
      enrichMission({
        id: "kids-vocab",
        label: "Học 10 từ mới",
        subtitle: "Beego Kids — từ vựng vui",
        icon: "📚",
        iconTone: "purple",
        href: "/kids-learn-vocabulary",
        progressKind: "count",
        progressCurrent: progress >= 30 ? 10 : Math.min(9, Math.floor(progress / 3)),
        progressTarget: 10,
        reward: 20,
      }),
      enrichMission({
        id: "kids-story",
        label: "Đọc 1 câu chuyện",
        subtitle: "Truyện tương tác",
        icon: "📖",
        iconTone: "purple",
        href: "/kids-fun-stories",
        progressKind: "count",
        progressCurrent: 0,
        progressTarget: 1,
        reward: 20,
      }),
      enrichMission({
        id: "kids-game",
        label: "Chơi 1 mini game",
        subtitle: "Beego Kids",
        icon: "🎯",
        iconTone: "orange",
        href: "/kids/games",
        progressKind: "count",
        progressCurrent: 0,
        progressTarget: 1,
        reward: 20,
      }),
    ];
  }

  const listenDone = progress >= 25;
  const listenSeconds = listenDone
    ? LISTEN_SECONDS
    : Math.min(LISTEN_SECONDS - 1, Math.round((progress / 25) * LISTEN_SECONDS));

  const vocabCurrent = Math.min(10, newWords + completedToday);
  const quizCurrent = Math.min(10, completedToday);

  return [
    enrichMission({
      id: "listen",
      label: "Nghe 1 bài 5 phút",
      subtitle: "Nghe và trả lời câu hỏi",
      icon: "🎧",
      iconTone: "purple",
      href: LISTENING_PATH,
      progressKind: "time",
      progressCurrent: listenSeconds,
      progressTarget: LISTEN_SECONDS,
      reward: 20,
    }),
    enrichMission({
      id: "vocab",
      label: "Học 10 từ mới",
      subtitle: "Học từ vựng theo chủ đề",
      icon: "📚",
      iconTone: "purple",
      href: "/vocabulary",
      progressKind: "count",
      progressCurrent: vocabCurrent,
      progressTarget: 10,
      reward: 20,
    }),
    enrichMission({
      id: "quiz",
      label: "Làm đúng 8/10 câu quiz",
      subtitle: "Kiểm tra hiểu bài",
      icon: "🎯",
      iconTone: "orange",
      href: "/quiz",
      progressKind: "count",
      progressCurrent: quizCurrent,
      progressTarget: 10,
      reward: 20,
    }),
  ];
}
