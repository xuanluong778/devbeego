/**
 * Beego curriculum 50 gates × 16 lessons (+ gate exam).
 * IDs stay in the gXXlYY / gXXexam namespace so legacy pN-gN-nNN progress never maps onto new lessons.
 */

export const CURRICULUM_50_SCHEMA = "beego-curriculum-50/3.0";
/** Bump when question bank shape changes (resume / content_revision isolation). */
export const CURRICULUM_50_REVISION = "c50-v6-passage";
export const CURRICULUM_50_QUESTIONS_PER_LESSON = 12;
export const CURRICULUM_50_GATE_COUNT = 50;
export const CURRICULUM_50_LESSONS_PER_GATE = 16;
export const CURRICULUM_50_PARTS_PER_LESSON = 11;

/** First lesson on the new map (not p1-g1-n01). */
export const CURRICULUM_50_FIRST_LESSON_ID = "g01l01";

export const CURRICULUM_50_LESSON_ID_RE = /^g(\d{2})l(\d{2})$/;
export const CURRICULUM_50_EXAM_ID_RE = /^g(\d{2})exam$/;
export const CURRICULUM_50_SECTION_ID_RE = /^c50-g(\d{2})$/;

/** XP / Honey by node index 1..16 (lesson) and 17 (exam). */
export const CURRICULUM_50_NODE_REWARDS = [
  { nodeIndex: 1, duration: 12, xpReward: 15, honeyReward: 20 },
  { nodeIndex: 2, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 3, duration: 12, xpReward: 14, honeyReward: 18 },
  { nodeIndex: 4, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 5, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 6, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 7, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 8, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 9, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 10, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 11, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 12, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 13, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 14, duration: 12, xpReward: 18, honeyReward: 22 },
  { nodeIndex: 15, duration: 12, xpReward: 18, honeyReward: 22 },
  { nodeIndex: 16, duration: 12, xpReward: 18, honeyReward: 22 },
  { nodeIndex: 17, duration: 15, xpReward: 30, honeyReward: 50 },
];

export function curriculum50SectionId(gateNumber) {
  return `c50-g${String(gateNumber).padStart(2, "0")}`;
}

export function curriculum50ExamId(gateNumber) {
  return `g${String(gateNumber).padStart(2, "0")}exam`;
}

export function parseCurriculum50LessonId(lessonId) {
  const id = String(lessonId || "").trim();
  const lesson = id.match(CURRICULUM_50_LESSON_ID_RE);
  if (lesson) {
    return {
      kind: "lesson",
      gateNumber: Number(lesson[1]),
      lessonNumber: Number(lesson[2]),
      lessonId: id,
    };
  }
  const exam = id.match(CURRICULUM_50_EXAM_ID_RE);
  if (exam) {
    return {
      kind: "exam",
      gateNumber: Number(exam[1]),
      lessonNumber: null,
      lessonId: id,
    };
  }
  return null;
}

export function isCurriculum50LessonId(lessonId) {
  return Boolean(parseCurriculum50LessonId(lessonId));
}

export function nodeTypeForCurriculumRole(role, isExam = false) {
  if (isExam) return "test";
  if (String(role || "").toLowerCase() === "review") return "review";
  return "vocabulary";
}
