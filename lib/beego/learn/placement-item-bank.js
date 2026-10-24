/**
 * Placement item bank from curriculum-50 (no AI generation).
 * Samples learn lessons across gates to keep memory bounded.
 */
import { getBuiltLessonById, listAllLessonIds } from "@/lib/beego/learn/lesson-content-build";
import { normalizeExercise } from "@/lib/beego/learn/normalize-lesson-exercises";
import { resolveLearnSkillKey } from "@/lib/beego/learn/learn-skill-keys";

const LEVEL_DIFFICULTY = {
  A0: 1,
  A1: 2,
  "A1+": 3,
  A2: 3,
  "B1+": 4,
  B1: 4,
  "Pre-A1 → A1": 1,
  "A1 → A2": 2,
  "A2 → B1": 3,
  "B1 → B2": 4,
  "B2 → tiền C1": 4,
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
  const gateMatch = String(lessonId).match(/^g(\d{2})/);
  const gate = gateMatch ? Number(gateMatch[1]) : 1;
  if (LEVEL_DIFFICULTY[level]) return LEVEL_DIFFICULTY[level];
  if (gate <= 10) return 1;
  if (gate <= 20) return 2;
  if (gate <= 35) return 3;
  return 4;
}

/** Prefer early learn lessons per gate; skip exams and most review nodes. */
function selectPlacementLessonIds(allIds) {
  const picked = [];
  for (const id of allIds) {
    const m = String(id).match(/^g(\d{2})l(\d{2})$/);
    if (!m) continue;
    const lessonNum = Number(m[2]);
    // 01 learn + mid-gate learn sample keeps bank diverse without loading 850 full banks.
    if (lessonNum === 1 || lessonNum === 5 || lessonNum === 9 || lessonNum === 13) {
      picked.push(id);
    }
  }
  return picked;
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
  const items = [];

  for (const lessonId of selectPlacementLessonIds(listAllLessonIds())) {
    const lesson = getBuiltLessonById(lessonId);
    if (!lesson?.questions?.length) continue;
    if (lesson.type === "speaking" || lesson.type === "review" || lesson.type === "test") continue;

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
