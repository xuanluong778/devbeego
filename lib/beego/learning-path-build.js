import { LEARNING_PARTS, DEMO_ACTIVE_LESSON_ID } from "@/lib/beego/learning-path-catalog";
import {
  GATE_NODE_BLUEPRINT,
  NODE_TYPE_LABELS,
  UNLOCK_HINT,
  getNodeType,
} from "@/lib/beego/learning-path-schema";

/**
 * @param {import('./learning-path-catalog').GateCatalog} gate
 * @param {typeof GATE_NODE_BLUEPRINT[number]} blueprint
 */
function buildNodeTitle(blueprint, gate) {
  const { topicTitle, grammarPoint } = gate;

  switch (blueprint.nodeType) {
    case "vocabulary":
      return `20 từ vựng: ${topicTitle}`;
    case "sentence_patterns":
      return `5 câu mẫu: ${topicTitle}`;
    case "grammar":
      return `Ngữ pháp: ${grammarPoint}`;
    case "listening":
      return `Nghe ${blueprint.listenSlot}: ${topicTitle}`;
    case "speaking":
      return `Nói ${blueprint.speakSlot}: ${topicTitle}`;
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
 */
function buildNodeSubtitle(blueprint, gate) {
  switch (blueprint.nodeType) {
    case "vocabulary":
      return "Học và ghi nhớ 20 từ mới";
    case "sentence_patterns":
      return "5 mẫu câu giao tiếp thực tế";
    case "grammar":
      return gate.grammarPoint;
    case "listening":
      return `Luyện nghe bài ${blueprint.listenSlot}/5 · ${blueprint.duration} phút`;
    case "speaking":
      return `Luyện nói bài ${blueprint.speakSlot}/5 · Beego AI`;
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
    title: buildNodeTitle(blueprint, gate),
    subtitle: buildNodeSubtitle(blueprint, gate),
    goal: buildNodeSubtitle(blueprint, gate),
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
 * Assign locked → completed → active along global node order.
 * @param {ReturnType<typeof buildGateSection>[]} sections
 * @param {string} activeLessonId
 */
function assignProgress(sections, activeLessonId) {
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
 * @param {{ activeLessonId?: string }} [options]
 */
export function buildLearningPathFromCatalog(options = {}) {
  const activeLessonId = options.activeLessonId ?? DEMO_ACTIVE_LESSON_ID;
  const sections = [];

  for (const part of LEARNING_PARTS) {
    for (const gate of part.gates) {
      sections.push(buildGateSection(part, gate));
    }
  }

  assignProgress(sections, activeLessonId);

  const activeSection =
    sections.find((s) => s.nodes.some((n) => n.lessonId === activeLessonId)) ||
    sections.find((s) => s.nodes.some((n) => n.status === "active")) ||
    sections[0];

  return {
    currentSectionId: activeSection?.sectionId ?? sections[0]?.sectionId,
    activeLessonId,
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
