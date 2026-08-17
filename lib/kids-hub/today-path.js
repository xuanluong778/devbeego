import { KIDS_VOCAB_LESSONS } from "@/lib/kids-vocabulary/curriculum";
import { lessonCompletionCount } from "@/lib/kids-vocabulary/progress";
import { loadRewards } from "./rewards";

/** Gợi ý lộ trình hôm nay — client-side MVP. */
export function buildTodayPath() {
  const rewards = typeof window !== "undefined" ? loadRewards() : { lessonsCompleted: [] };
  const completed = new Set(rewards.lessonsCompleted || []);

  let nextLesson = KIDS_VOCAB_LESSONS.find((l) => !completed.has(l.id));
  if (!nextLesson) {
    nextLesson = KIDS_VOCAB_LESSONS.reduce((best, l) => {
      const done = lessonCompletionCount(l.id, l.words.map((w) => w.id));
      const pct = done / l.words.length;
      if (!best || pct < best.pct) return { lesson: l, pct };
      return best;
    }, null)?.lesson;
  }
  if (!nextLesson) nextLesson = KIDS_VOCAB_LESSONS[0];

  return [
    {
      id: "vocab",
      emoji: nextLesson.emoji,
      title: "Học từ mới",
      desc: nextLesson.titleVi,
      href: `/kids-learn-vocabulary/${nextLesson.id}`,
      color: nextLesson.color,
    },
    {
      id: "game",
      emoji: "🎮",
      title: "Chơi game",
      desc: "Nghe · Kéo · Ghép thẻ",
      href: "/kids/games",
      color: "#ffd166",
    },
    {
      id: "speak",
      emoji: "🐝",
      title: "Nói với AI",
      desc: "Cô Beego dạy nói",
      href: "/kids/ai-teacher",
      color: "#06d6a0",
    },
    {
      id: "story",
      emoji: "📖",
      title: "Nghe truyện",
      desc: "Truyện tiếng Anh vui",
      href: "/kids-fun-stories",
      color: "#118ab2",
    },
  ];
}
