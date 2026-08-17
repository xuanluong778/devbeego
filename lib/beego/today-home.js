import { LISTENING_PATH, SPEAKING_PATH } from "@/lib/beego/routes";
import { BEEGO_LEVELS, BEEGO_PURPOSES } from "@/lib/beego/onboarding-storage";

export function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Chào buổi sáng";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

export function getDisplayName(userName) {
  const name = String(userName || "").trim();
  if (!name) return "bạn";
  return name.split(/\s+/)[0];
}

function levelToLabel(levelId) {
  const map = { new: "Cơ bản", little: "Sơ cấp", medium: "Trung bình", good: "Khá" };
  return map[levelId] || "Cơ bản";
}

function withLessonMeta(profile, base) {
  const levelLabel = profile ? levelToLabel(profile.level) : "Cơ bản";
  const defaults = {
    lessonName: "Coffee Shop",
    badge: "Luyện nghe 5 phút",
    levelLabel,
    emoji: "☕",
    progressCurrent: 2,
    progressTotal: 5,
  };

  if (profile?.purpose === "kids") {
    return { ...defaults, ...base, lessonName: "Fun Words", badge: "Beego Kids", levelLabel: "Kids", emoji: "🎈", progressCurrent: 1, progressTotal: 3 };
  }
  if (profile?.purpose === "work") {
    return { ...defaults, ...base, lessonName: "Office Talk", badge: "Luyện nói AI", emoji: "💼", progressCurrent: 1, progressTotal: 4 };
  }
  if (profile?.purpose === "travel") {
    return { ...defaults, ...base, lessonName: "Airport", badge: "Luyện nghe 5 phút", emoji: "✈️", progressCurrent: 1, progressTotal: 5 };
  }
  return { ...defaults, ...base };
}

export function getSuggestedLesson(profile) {
  if (!profile) {
    return withLessonMeta(null, {
      title: "Luyện nghe 5 phút",
      subtitle: "Bài đầu tiên — At the café",
      description: "Nghe hội thoại ngắn, trả lời câu hỏi và luyện tai trong 5 phút.",
      href: LISTENING_PATH,
      icon: "🎧",
      level: "A2",
      cta: "Bắt đầu học 5 phút",
    });
  }

  if (profile.purpose === "kids") {
    return withLessonMeta(profile, {
      title: "Từ vựng vui cho bé",
      subtitle: "Beego Kids",
      description: "Flashcard, game và phần thưởng ong mật — học mà chơi.",
      href: "/kids-learn-vocabulary",
      icon: "🎈",
      level: "Kids",
      cta: "Bắt đầu học 5 phút",
    });
  }

  if (profile.purpose === "work") {
    return withLessonMeta(profile, {
      title: "Beego Speaking AI",
      subtitle: "Hội thoại công việc",
      description: "Luyện nói email, họp và thuyết trình với AI thân thiện.",
      href: SPEAKING_PATH,
      icon: "🎙️",
      level: "B1",
      cta: "Bắt đầu học 5 phút",
    });
  }

  if (profile.purpose === "travel") {
    return withLessonMeta(profile, {
      title: "Luyện nghe 5 phút",
      subtitle: "Du lịch & sân bay",
      description: "Nghe thông báo, hỏi đường và giao tiếp khi đi du lịch.",
      href: LISTENING_PATH,
      icon: "✈️",
      level: "A2",
      cta: "Bắt đầu học 5 phút",
    });
  }

  return withLessonMeta(profile, {
    title: "Luyện nghe 5 phút",
    subtitle: "Bài đề xuất hôm nay",
    description: "Nghe — hiểu — trả lời. Chỉ 5 phút mỗi ngày cũng tiến bộ rõ rệt.",
    href: LISTENING_PATH,
    icon: "🎧",
    level: profile.level === "new" ? "A1" : "A2",
    cta: "Bắt đầu học 5 phút",
  });
}

export function buildTodayMissions(profile, dash) {
  const progress = Number(dash?.daily_progress ?? 0);
  const completedToday = Number(dash?.completed_today ?? 0);
  const newWords = Number(dash?.new_words_count ?? 0);

  if (profile?.purpose === "kids") {
    return [
      {
        id: "kids-vocab",
        label: "Học 10 từ mới",
        hint: "Beego Kids",
        icon: "📚",
        href: "/kids-learn-vocabulary",
        done: progress >= 30,
        progressCurrent: progress >= 30 ? 10 : 3,
        progressTarget: 10,
        reward: 20,
      },
      {
        id: "kids-story",
        label: "Đọc 1 câu chuyện",
        hint: "Truyện tương tác",
        icon: "📖",
        href: "/kids-fun-stories",
        done: false,
        progressCurrent: 0,
        progressTarget: 1,
        reward: 20,
      },
      {
        id: "kids-game",
        label: "Chơi 1 mini game",
        hint: "Beego Kids",
        icon: "🎯",
        href: "/kids/games",
        done: false,
        progressCurrent: 0,
        progressTarget: 1,
        reward: 20,
      },
    ];
  }

  const listenDone = progress >= 25;
  const vocabCurrent = Math.min(10, completedToday + Math.min(newWords, 3));
  const quizCurrent = Math.min(10, completedToday);

  return [
    {
      id: "listen",
      label: "Nghe 1 bài 5 phút",
      hint: "Luyện nghe",
      icon: "🎧",
      href: LISTENING_PATH,
      done: listenDone,
      progressCurrent: listenDone ? 1 : 0,
      progressTarget: 1,
      reward: 20,
    },
    {
      id: "review",
      label: "Học 10 từ mới",
      hint: "Từ vựng",
      icon: "📚",
      href: "/vocabulary",
      done: vocabCurrent >= 10,
      progressCurrent: vocabCurrent,
      progressTarget: 10,
      reward: 20,
    },
    {
      id: "speak",
      label: "Làm đúng 8/10 câu quiz",
      hint: "Ôn tập",
      icon: "🎯",
      href: "/quiz",
      done: quizCurrent >= 8,
      progressCurrent: quizCurrent,
      progressTarget: 10,
      reward: 20,
    },
  ];
}

export function getProfileSummary(profile) {
  if (!profile) return null;
  const purpose = BEEGO_PURPOSES.find((p) => p.id === profile.purpose);
  const level = BEEGO_LEVELS.find((l) => l.id === profile.level);
  return {
    purposeLabel: purpose?.label || "Học tiếng Anh",
    levelLabel: level?.label || "Trung bình",
    purposeIcon: purpose?.icon || "🐝",
  };
}
