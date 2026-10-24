/**
 * Curriculum catalog — 50 cửa Beego (curriculum-50 v3).
 * Client-safe: imports static slim data (no fs).
 * Each gate has 16 topic lessons + 1 gate exam on the map.
 * Legacy pN-gN catalog is retired from the active path (progress rows kept orphaned).
 */
import { CURRICULUM_50_SLIM } from "@/lib/beego/learn/curriculum-50/catalog-slim.js";
import {
  CURRICULUM_50_FIRST_LESSON_ID,
  curriculum50ExamId,
  curriculum50SectionId,
} from "@/lib/beego/learn/curriculum-50/constants";

/** @typedef {{ gateNumber: number, topicTitle: string, sectionTitle: string, grammarPoint: string, examId: string, lessons: Array<{ lessonId: string, title: string, role: string, goal: string, estimatedMinutes: number }> }} GateCatalog */
/** @typedef {{ partNumber: number, partTitle: string, level: string, gates: GateCatalog[] }} PartCatalog */

function buildPartsFromSlim(slim = CURRICULUM_50_SLIM) {
  /** @type {PartCatalog[]} */
  const parts = [];
  for (const gate of slim.gates || []) {
    const gateNumber = Number(gate.gateNumber);
    parts.push({
      partNumber: gateNumber,
      partTitle: `Cửa ${gateNumber}`,
      level: gate.level || gate.band || "",
      gates: [
        {
          gateNumber: 1,
          curriculumGateNumber: gateNumber,
          sectionIdHint: curriculum50SectionId(gateNumber),
          topicTitle: gate.title,
          sectionTitle: gate.title,
          grammarPoint: gate.level || "",
          examId: gate.examId || curriculum50ExamId(gateNumber),
          lessons: (gate.lessons || []).map((lesson) => ({
            lessonId: lesson.lessonId,
            title: lesson.title,
            role: lesson.role || "learn",
            goal: lesson.goal || "",
            estimatedMinutes: Number(lesson.estimatedMinutes) || 12,
          })),
        },
      ],
    });
  }
  return parts;
}

/** @type {PartCatalog[]} */
export const LEARNING_PARTS = buildPartsFromSlim();

/** First lesson for new users on curriculum-50. */
export const DEFAULT_FIRST_LESSON_ID = CURRICULUM_50_FIRST_LESSON_ID;

/** @deprecated Use DEFAULT_FIRST_LESSON_ID */
export const DEMO_ACTIVE_LESSON_ID = DEFAULT_FIRST_LESSON_ID;
