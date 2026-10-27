import { CURRICULUM_50_SLIM } from "@/lib/beego/learn/curriculum-50/catalog-slim.js";
import { curriculum50ExamId } from "@/lib/beego/learn/curriculum-50/constants";

export type CatalogLesson = {
  lessonId: string;
  title: string;
  role: string;
  itemType: "lesson" | "exam";
  goal: string;
  estimatedMinutes: number;
};

export type CatalogChapter = {
  gateNumber: number;
  chapterTitle: string;
  level: string;
  lessons: CatalogLesson[];
};

export type CatalogCourse = {
  schema: string;
  gateCount: number;
  lessonCount: number;
  chapters: CatalogChapter[];
};

/** Cấu trúc: khóa (50 cửa) → chương (cửa) → bài (16 bài + thi vượt cửa). */
export function getCurriculumCatalogTree(): CatalogCourse {
  const chapters: CatalogChapter[] = [];
  for (const gate of CURRICULUM_50_SLIM.gates || []) {
    const gateNumber = Number(gate.gateNumber);
    const lessons: CatalogLesson[] = (gate.lessons || []).map((row) => ({
      lessonId: row.lessonId,
      title: row.title,
      role: row.role || "learn",
      itemType: "lesson",
      goal: row.goal || "",
      estimatedMinutes: Number(row.estimatedMinutes) || 25,
    }));
    const examId = gate.examId || curriculum50ExamId(gateNumber);
    lessons.push({
      lessonId: examId,
      title: "Thi vượt cửa",
      role: "test",
      itemType: "exam",
      goal: `Kiểm tra tổng hợp cửa ${gateNumber}`,
      estimatedMinutes: 20,
    });
    chapters.push({
      gateNumber,
      chapterTitle: gate.title,
      level: String(gate.level ?? gate.band ?? ""),
      lessons,
    });
  }
  return {
    schema: CURRICULUM_50_SLIM.schema,
    gateCount: Number(CURRICULUM_50_SLIM.gateCount) || chapters.length,
    lessonCount: Number(CURRICULUM_50_SLIM.lessonCount) || 0,
    chapters,
  };
}

export function catalogLessonMeta(lessonId: string) {
  const tree = getCurriculumCatalogTree();
  for (const chapter of tree.chapters) {
    for (const lesson of chapter.lessons) {
      if (lesson.lessonId === lessonId) {
        return { chapter, lesson };
      }
    }
  }
  return null;
}
