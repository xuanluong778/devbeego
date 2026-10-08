/**
 * Placement item bank from 128-lesson curriculum (no AI generation).
 */
import { buildLessonContentRegistry } from "@/lib/beego/learn/lesson-content-build";
import { normalizeExercise } from "@/lib/beego/learn/normalize-lesson-exercises";
import { resolveLearnSkillKey } from "@/lib/beego/learn/learn-skill-keys";
import { listAllLessonIds } from "@/lib/beego/learn/lesson-content-build";

const LEVEL_DIFFICULTY = {
  A0: 1,
  A1: 2,
  "A1+": 3,
  A2: 3,
  "B1+": 4,
  B1: 4,
};

const TYPE_SKILL_BUCKET = {
  vocabulary: "vocabulary",
  sentence_patterns: "grammar",
  grammar: "grammar",
  listening: "listening",
  speaking: "listening", // no speaking mic in placement — skip speaking types
  story: "reading",
  test: "grammar",
  review: "reading",
};

const ALLOWED_EXERCISE_TYPES = new Set([
  "multiple_choice",
  "vocabulary_choice",
  "fill_blank",
  "listening_choice",
  "listening_fill",
  "story_comprehension",
]);

let bankCache = null;

function partDifficulty(lessonId, level) {
  const m = String(lessonId).match(/^p(\d+)/);
  const part = m ? Number(m[1]) : 1;
  if (LEVEL_DIFFICULTY[level]) return LEVEL_DIFFICULTY[level];
  if (part <= 2) return 1;
  if (part <= 4) return 2;
  if (part <= 6) return 3;
  return 4;
}

/**
 * @returns {Array<{
 *   ref: string,
 *   lessonId: string,
 *   questionId: string,
 *   lessonType: string,
 *   skillKey: string,
 *   difficulty: number,
 *   exercise: object
 * }>}
 */
export function buildPlacementItemBank() {
  if (bankCache) return bankCache;
  const registry = buildLessonContentRegistry();
  const items = [];

  for (const lessonId of listAllLessonIds()) {
    const lesson = registry[lessonId];
    if (!lesson?.questions?.length) continue;
    if (lesson.type === "speaking" || lesson.type === "review") continue;

    const skillBucket = TYPE_SKILL_BUCKET[lesson.type] || "vocabulary";
    const difficulty = partDifficulty(lessonId, lesson.level);

    for (const raw of lesson.questions) {
      const exercise = normalizeExercise(raw);
      if (!ALLOWED_EXERCISE_TYPES.has(exercise.type)) continue;
      if (exercise.type === "speaking" || exercise.type === "pronunciation") continue;

      const skillKey =
        skillBucket === "reading"
          ? "reading"
          : skillBucket === "listening"
            ? "listening"
            : resolveLearnSkillKey(lesson.type, exercise.type, exercise.skillLabel);

      items.push({
        ref: `${lessonId}::${exercise.id}`,
        lessonId,
        questionId: String(exercise.id),
        lessonType: lesson.type,
        skillKey: skillKey === "comprehension" ? "reading" : skillKey,
        difficulty,
        exercise,
      });
    }
  }

  bankCache = items;
  return items;
}

/**
 * @param {number} difficulty 1–4
 * @param {Set<string>} usedRefs
 * @param {string} [preferSkill]
 */
export function pickPlacementItem(difficulty, usedRefs, preferSkill = "") {
  const bank = buildPlacementItemBank();
  const target = Math.max(1, Math.min(4, Number(difficulty) || 2));
  const unused = bank.filter((it) => !usedRefs.has(it.ref));

  const exact = unused.filter((it) => it.difficulty === target);
  const near = unused.filter((it) => Math.abs(it.difficulty - target) <= 1);
  let candidates = exact.length ? exact : near.length ? near : unused;
  if (preferSkill) {
    const skillPool = candidates.filter((it) => it.skillKey === preferSkill);
    if (skillPool.length) candidates = skillPool;
  }
  if (!candidates.length) return null;

  const idx = usedRefs.size % candidates.length;
  return candidates[idx];
}

/**
 * Public exercise payload — never includes correctAnswer.
 * @param {object} item
 */
export function toClientPlacementQuestion(item) {
  const ex = item.exercise;
  return {
    lessonId: item.lessonId,
    questionId: item.questionId,
    skillKey: item.skillKey,
    difficulty: item.difficulty,
    type: ex.type,
    prompt: ex.prompt,
    skillLabel: ex.skillLabel,
    options: ex.options,
    wordBank: ex.wordBank,
    extensions: {
      ttsText: ex.extensions?.ttsText || ex.ttsText || null,
      modality: ex.extensions?.modality || null,
    },
  };
}
