import { loadLessonFallback } from "@/lib/beego/lesson-player";
import { normalizeLessonActivities } from "@/lib/beego/learn/normalize-lesson-exercises";

/**
 * Load lesson for player: API first, mock fallback if API missing/degraded.
 * @returns {Promise<{ ok: true, lesson: object, source: 'api'|'mock_fallback' } | { ok: false, message: string }>}
 */
export async function fetchLessonForPlayer(lessonId) {
  const id = String(lessonId || "").trim();
  if (!id) {
    return { ok: false, message: "Missing lesson id." };
  }

  try {
    const res = await fetch(`/api/learn/lesson/${encodeURIComponent(id)}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.success && json.data?.questions?.length) {
      const d = json.data;
      const lesson = normalizeLessonActivities({
        lessonId: d.lessonId,
        title: d.title,
        objective: d.objective,
        type: d.type,
        level: d.level,
        estimatedMinutes: d.estimatedMinutes,
        lives: d.lives ?? 3,
        honeyReward: d.honeyReward,
        xpReward: d.xpReward,
        questions: d.questions,
        completionRules: d.completionRules,
        contentSource: d.contentSource,
        resume: d.resume || null,
      });
      return {
        ok: true,
        source: "api",
        lesson,
      };
    }
  } catch {
    /* fall through to mock */
  }

  const fallback = loadLessonFallback(id);
  if (fallback?.questions?.length) {
    return {
      ok: true,
      source: "mock_fallback",
      lesson: { ...fallback, contentSource: "mock_fallback" },
    };
  }

  return { ok: false, message: "Không tải được nội dung bài học." };
}
