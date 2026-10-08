import { buildLessonContentRegistry } from "@/lib/beego/learn/lesson-content-build";
import { flattenPathNodes, buildLearningPathFromCatalog } from "@/lib/beego/learning-path-build";
import { normalizeLessonActivities } from "@/lib/beego/learn/normalize-lesson-exercises";

/**
 * @param {string} lessonId
 * @returns {object|null}
 */
export function getLessonContentById(lessonId) {
  const id = String(lessonId || "").trim();
  if (!id) return null;

  const registry = buildLessonContentRegistry();
  const lesson = registry[id];
  if (!lesson || !Array.isArray(lesson.questions) || lesson.questions.length === 0) {
    return null;
  }

  const catalog = buildLearningPathFromCatalog({});
  const known = flattenPathNodes(catalog.sections).some((n) => n.lessonId === id);
  if (!known) return null;

  return normalizeLessonActivities(JSON.parse(JSON.stringify(lesson)));
}

/**
 * Player-facing shape (subset + meta).
 */
export function toPlayerLessonPayload(content) {
  if (!content) return null;
  return {
    lessonId: content.lessonId,
    title: content.title,
    objective: content.objective,
    type: content.type,
    level: content.level,
    estimatedMinutes: content.estimatedMinutes,
    lives: content.lives ?? 3,
    honeyReward: content.honeyReward,
    xpReward: content.xpReward,
    questions: content.questions,
    completionRules: content.completionRules,
    contentSource: content.contentSource || "api",
  };
}
