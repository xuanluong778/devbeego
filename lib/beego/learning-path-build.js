import { LEARNING_PARTS, DEFAULT_FIRST_LESSON_ID } from "@/lib/beego/learning-path-catalog";
import {
  NODE_TYPE_LABELS,
  UNLOCK_HINT,
  getNodeType,
} from "@/lib/beego/learning-path-schema";
import {
  CURRICULUM_50_NODE_REWARDS,
  curriculum50ExamId,
  curriculum50SectionId,
  nodeTypeForCurriculumRole,
} from "@/lib/beego/learn/curriculum-50/constants";

function rewardFor(nodeIndex) {
  return (
    CURRICULUM_50_NODE_REWARDS.find((item) => item.nodeIndex === nodeIndex) ||
    CURRICULUM_50_NODE_REWARDS[0]
  );
}

/**
 * Build one gate section from curriculum-50 catalog gate (16 lessons + exam).
 * @param {import('./learning-path-catalog').PartCatalog} part
 * @param {import('./learning-path-catalog').GateCatalog} gate
 */
function buildGateSection(part, gate) {
  const curriculumGate =
    Number(gate.curriculumGateNumber || part.partNumber) || Number(part.partNumber);
  const sectionId = gate.sectionIdHint || curriculum50SectionId(curriculumGate);

  const nodes = (gate.lessons || []).map((lesson, index) => {
    const nodeIndex = index + 1;
    const reward = rewardFor(nodeIndex);
    const nodeType = nodeTypeForCurriculumRole(lesson.role);
    return {
      nodeIndex,
      nodeType,
      type: nodeType,
      lessonId: lesson.lessonId,
      title: lesson.title,
      subtitle: lesson.goal || NODE_TYPE_LABELS[nodeType] || "",
      goal: lesson.goal || `Chủ đề: ${gate.topicTitle}`,
      integratedLesson: true,
      curriculum50: true,
      duration: Number(lesson.estimatedMinutes) || reward.duration,
      xpReward: reward.xpReward,
      honeyReward: reward.honeyReward,
      status: "locked",
      unlockHint: UNLOCK_HINT,
    };
  });

  const examId = gate.examId || curriculum50ExamId(curriculumGate);
  const examReward = rewardFor(17);
  nodes.push({
    nodeIndex: 17,
    nodeType: "test",
    type: "test",
    lessonId: examId,
    title: `Thi vượt cửa`,
    subtitle: `Kiểm tra tổng hợp: ${gate.topicTitle}`,
    goal: `Nghe/đọc tự chấm; nói/viết theo rubric giáo viên.`,
    integratedLesson: true,
    curriculum50: true,
    isGateExam: true,
    duration: examReward.duration,
    xpReward: examReward.xpReward,
    honeyReward: examReward.honeyReward,
    status: "locked",
    unlockHint: UNLOCK_HINT,
  });

  return {
    sectionId,
    partNumber: curriculumGate,
    gateNumber: 1,
    curriculumGateNumber: curriculumGate,
    partTitle: part.partTitle,
    level: part.level,
    sectionTitle: gate.sectionTitle,
    topicTitle: gate.topicTitle,
    sectionDescription: gate.sectionTitle,
    nodes,
  };
}

/**
 * Assign locked / completed / active from real completed set + active id.
 * @param {ReturnType<typeof buildGateSection>[]} sections
 * @param {string} activeLessonId
 * @param {Set<string>|string[]|null|undefined} completedLessonIds
 */
function assignProgress(sections, activeLessonId, completedLessonIds) {
  const completed =
    completedLessonIds instanceof Set
      ? completedLessonIds
      : new Set(Array.isArray(completedLessonIds) ? completedLessonIds : []);

  const useCompletedSet = completedLessonIds != null;
  const knownIds = new Set(sections.flatMap((s) => s.nodes.map((n) => n.lessonId)));
  const safeActive =
    activeLessonId && knownIds.has(activeLessonId) ? activeLessonId : DEFAULT_FIRST_LESSON_ID;

  if (useCompletedSet) {
    let unlockedNext = true;
    for (const section of sections) {
      for (const node of section.nodes) {
        if (completed.has(node.lessonId)) {
          node.status = "completed";
          unlockedNext = true;
          continue;
        }
        if (unlockedNext || node.lessonId === safeActive) {
          node.status = "active";
          unlockedNext = false;
        } else {
          node.status = "locked";
          if (section.curriculumGateNumber > 1 && node.nodeIndex === 1) {
            node.unlockHint = `Hoàn thành Cửa trước để mở khóa`;
          }
        }
      }
    }
    const hasActive = sections.some((s) => s.nodes.some((n) => n.status === "active"));
    if (!hasActive && sections[0]?.nodes[0]) {
      const first = sections[0].nodes.find((n) => n.status !== "completed");
      if (first) first.status = "active";
    }
    return;
  }

  let foundActive = false;
  for (const section of sections) {
    for (const node of section.nodes) {
      if (node.lessonId === safeActive) {
        node.status = "active";
        foundActive = true;
        continue;
      }
      if (!foundActive) {
        node.status = "completed";
      } else {
        node.status = "locked";
        if (section.curriculumGateNumber > 1 && node.nodeIndex === 1) {
          node.unlockHint = `Hoàn thành Cửa trước để mở khóa`;
        }
      }
    }
  }

  if (!foundActive && sections[0]?.nodes[0]) {
    sections[0].nodes[0].status = "active";
  }
}

/**
 * Build full learning path from catalog.
 * @param {{ activeLessonId?: string|null, completedLessonIds?: Set<string>|string[]|null }} [options]
 */
export function buildLearningPathFromCatalog(options = {}) {
  const completedLessonIds = options.completedLessonIds ?? null;
  let activeLessonId = options.activeLessonId ?? null;
  if (!activeLessonId) {
    activeLessonId = DEFAULT_FIRST_LESSON_ID;
  }
  const sections = [];

  for (const part of LEARNING_PARTS) {
    for (const gate of part.gates) {
      sections.push(buildGateSection(part, gate));
    }
  }

  assignProgress(sections, activeLessonId, completedLessonIds);

  const resolvedActive =
    sections.flatMap((s) => s.nodes).find((n) => n.status === "active")?.lessonId ||
    activeLessonId;

  const activeSection =
    sections.find((s) => s.nodes.some((n) => n.lessonId === resolvedActive)) ||
    sections.find((s) => s.nodes.some((n) => n.status === "active")) ||
    sections[0];

  return {
    currentSectionId: activeSection?.sectionId ?? sections[0]?.sectionId,
    activeLessonId: resolvedActive,
    sections,
    curriculum: "curriculum-50",
  };
}

/** Flat ordered nodes across all gates */
export function flattenPathNodes(sections) {
  return sections.flatMap((s) => s.nodes);
}

/** @param {object} node */
export function isTestNode(node) {
  return getNodeType(node) === "test" || Boolean(node?.isGateExam);
}

/** @param {object} node */
export function isReviewNode(node) {
  return getNodeType(node) === "review";
}
