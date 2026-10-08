/**
 * Empty catalog path for guests — no demo progress.
 * Authenticated users should fetch /api/learning-path.
 */
import { buildLearningPathFromCatalog } from "@/lib/beego/learning-path-build";
import { DEFAULT_FIRST_LESSON_ID } from "@/lib/beego/learning-path-catalog";

export const LEARNING_PATH_EMPTY = buildLearningPathFromCatalog({
  completedLessonIds: new Set(),
  activeLessonId: DEFAULT_FIRST_LESSON_ID,
});

/** @deprecated Use LEARNING_PATH_EMPTY or /api/learning-path */
export const LEARNING_PATH_MOCK = LEARNING_PATH_EMPTY;
