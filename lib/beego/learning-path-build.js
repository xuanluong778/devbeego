import { LEARNING_PARTS, DEFAULT_FIRST_LESSON_ID } from "@/lib/beego/learning-path-catalog";
import {
  GATE_NODE_BLUEPRINT,
  NODE_TYPE_LABELS,
  UNLOCK_HINT,
  getNodeType,
} from "@/lib/beego/learning-path-schema";
import {
  getListenFocusLabel,
  getSpeakFocusLabel,
} from "@/lib/beego/learn/lesson-content-generate";
import { integratedNodeGoal } from "@/lib/beego/learn/integrated-node-content";
import { isIntegratedNodeType } from "@/lib/beego/learn/integrated-lesson";

/**
 * @param {import('./learning-path-catalog').GateCatalog} gate
 * @param {typeof GATE_NODE_BLUEPRINT[number]} blueprint
 * @param {import('./learning-path-catalog').PartCatalog} part
 */
function buildNodeTitle(blueprint, gate, part) {
  const { topicTitle, grammarPoint } = gate;

  if (isIntegratedNodeType(blueprint.nodeType)) {
    return integratedNodeGoal(part.partNumber, blueprint.nodeIndex);
  }

  switch (blueprint.nodeType) {
    case "vocabulary":
      return `20 từ vựng: ${topicTitle}`;
    case "sentence_patterns":
      return `5 câu mẫu: ${topicTitle}`;
    case "grammar":
      return `Ngữ pháp: ${grammarPoint}`;
    case "listening":
      return `Nghe ${blueprint.listenSlot}: ${getListenFocusLabel(part.partNumber, blueprint.listenSlot)}`;
    case "speaking":
      return `Nói ${blueprint.speakSlot}: ${getSpeakFocusLabel(part.partNumber, blueprint.speakSlot)}`;
    case "story":
      return `Story: ${topicTitle}`;
    case "test":
      return `Test — Vượt cửa: ${topicTitle}`;
    case "review":
      return `Ôn tập lặp lại: ${topicTitle}`;
    default:
      return topicTitle;
  }
}

/**
 * @param {import('./learning-path-catalog').GateCatalog} gate
 * @param {typeof GATE_NODE_BLUEPRINT[number]} blueprint
 * @param {import('./learning-path-catalog').PartCatalog} part
 */
function buildNodeSubtitle(blueprint, gate, part) {
  if (isIntegratedNodeType(blueprint.nodeType)) {
    return "Bài tích hợp nhiều kỹ năng trong cùng một tình huống.";
  }
  switch (blueprint.nodeType) {
    case "vocabulary":
      return "Học và ghi nhớ 20 từ mới";
    case "sentence_patterns":
      return "5 mẫu câu giao tiếp thực tế";
    case "grammar":
      return gate.grammarPoint;
    case "listening":
      return `${getListenFocusLabel(part.partNumber, blueprint.listenSlot)} · ${blueprint.duration} phút`;
    case "speaking":
      return `${getSpeakFocusLabel(part.partNumber, blueprint.speakSlot)} · Beego AI`;
    case "story":
      return "Đọc nghe story tích hợp từ vựng";
    case "test":
      return "Kiểm tra tổng hợp để vượt cửa";
    case "review":
      return "Spaced repetition — ôn lại toàn cửa";
    default:
      return NODE_TYPE_LABELS[blueprint.nodeType] || "";
  }
}

/**
 * @param {number} partNumber
 * @param {number} gateNumber
 * @param {typeof GATE_NODE_BLUEPRINT[number]} blueprint
 */
function buildLessonId(partNumber, gateNumber, blueprint) {
  const idx = String(blueprint.nodeIndex).padStart(2, "0");
  return `p${partNumber}-g${gateNumber}-n${idx}`;
}

/**
 * @param {import('./learning-path-catalog').PartCatalog} part
 * @param {import('./learning-path-catalog').GateCatalog} gate
 */
function buildGateSection(part, gate) {
  const sectionId = `p${part.partNumber}-g${gate.gateNumber}`;

  const nodes = GATE_NODE_BLUEPRINT.map((blueprint) => ({
    nodeIndex: blueprint.nodeIndex,
    nodeType: blueprint.nodeType,
    type: blueprint.nodeType,
    lessonId: buildLessonId(part.partNumber, gate.gateNumber, blueprint),
    title: buildNodeTitle(blueprint, gate, part),
    subtitle: buildNodeSubtitle(blueprint, gate, part),
    goal: isIntegratedNodeType(blueprint.nodeType)
      ? `Tình huống: ${gate.topicTitle}`
      : buildNodeSubtitle(blueprint, gate, part),
    integratedLesson: isIntegratedNodeType(blueprint.nodeType),
    duration: blueprint.duration,
    xpReward: blueprint.xpReward,
    honeyReward: blueprint.honeyReward,
    status: "locked",
    unlockHint: UNLOCK_HINT,
  }));

  return {
    sectionId,
    partNumber: part.partNumber,
    gateNumber: gate.gateNumber,
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

  if (useCompletedSet) {
    let unlockedNext = true;
    for (const section of sections) {
      for (const node of section.nodes) {
        if (completed.has(node.lessonId)) {
          node.status = "completed";
          unlockedNext = true;
          continue;
        }
        if (unlockedNext || node.lessonId === activeLessonId) {
          node.status = "active";
          unlockedNext = false;
        } else {
          node.status = "locked";
          if (section.partNumber > 1 && node.nodeIndex === 1) {
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

  // Legacy single-cursor mode (no completed set): active + all before = completed
  let foundActive = false;
  for (const section of sections) {
    for (const node of section.nodes) {
      if (node.lessonId === activeLessonId) {
        node.status = "active";
        foundActive = true;
        continue;
      }
      if (!foundActive) {
        node.status = "completed";
      } else {
        node.status = "locked";
        if (section.partNumber > 1 && node.nodeIndex === 1) {
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
  };
}

/** Flat ordered nodes across all gates */
export function flattenPathNodes(sections) {
  return sections.flatMap((s) => s.nodes);
}

/** @param {object} node */
export function isTestNode(node) {
  return getNodeType(node) === "test";
}

/** @param {object} node */
export function isReviewNode(node) {
  return getNodeType(node) === "review";
}
