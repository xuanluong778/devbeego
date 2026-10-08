/**
 * Build lesson content for all catalog nodes (128) + merge enriched overrides
 * only when enriched has a full usable bank (≥10 for normal lessons).
 */
import { LEARNING_PARTS } from "@/lib/beego/learning-path-catalog";
import { GATE_NODE_BLUEPRINT } from "@/lib/beego/learning-path-schema";
import { ENRICHED_LESSONS } from "@/lib/beego/learn/lesson-content-enriched";
import {
  generateLessonQuestions,
  NORMAL_LESSON_MIN_EXERCISES,
  getListenFocusLabel,
  getSpeakFocusLabel,
} from "@/lib/beego/learn/lesson-content-generate";
import { integratedNodeGoal } from "@/lib/beego/learn/integrated-node-content";
import { isIntegratedNodeType } from "@/lib/beego/learn/integrated-lesson";

function buildLessonId(partNumber, gateNumber, nodeIndex) {
  return `p${partNumber}-g${gateNumber}-n${String(nodeIndex).padStart(2, "0")}`;
}

function buildNodeTitle(blueprint, gate, part) {
  const { topicTitle, grammarPoint } = gate;
  const partNumber = part.partNumber;
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
    case "listening": {
      const focus = getListenFocusLabel(partNumber, blueprint.listenSlot);
      return `Nghe ${blueprint.listenSlot}: ${focus}`;
    }
    case "speaking": {
      const focus = getSpeakFocusLabel(partNumber, blueprint.speakSlot);
      return `Nói ${blueprint.speakSlot}: ${focus}`;
    }
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

function buildObjective(blueprint, gate, part) {
  if (isIntegratedNodeType(blueprint.nodeType)) {
    return `${integratedNodeGoal(part.partNumber, blueprint.nodeIndex)}. Bài luyện nghe, nghĩa, ghép, câu, dịch hai chiều, điền từ, hội thoại, nói và đọc trong chủ đề ${gate.topicTitle}.`;
  }
  switch (blueprint.nodeType) {
    case "vocabulary":
      return `Học và ghi nhớ từ vựng chủ đề: ${gate.topicTitle}.`;
    case "sentence_patterns":
      return `Luyện mẫu câu giao tiếp: ${gate.topicTitle}.`;
    case "grammar":
      return `Nắm điểm ngữ pháp: ${gate.grammarPoint}.`;
    case "listening": {
      const focus = getListenFocusLabel(part.partNumber, blueprint.listenSlot);
      return `Luyện nghe «${focus}» trong chủ đề ${gate.topicTitle}.`;
    }
    case "speaking": {
      const focus = getSpeakFocusLabel(part.partNumber, blueprint.speakSlot);
      return `Luyện nói «${focus}» — ${gate.topicTitle}.`;
    }
    case "story":
      return `Đọc/nghe story tích hợp từ vựng: ${gate.topicTitle}.`;
    case "test":
      return `Kiểm tra tổng hợp cửa: ${gate.topicTitle}.`;
    case "review":
      return `Ôn tập spaced repetition cửa: ${gate.topicTitle}.`;
    default:
      return gate.sectionTitle || gate.topicTitle;
  }
}

function buildFromNodeMeta(part, gate, blueprint) {
  const lessonId = buildLessonId(part.partNumber, gate.gateNumber, blueprint.nodeIndex);
  const title = buildNodeTitle(blueprint, gate, part);
  const objective = buildObjective(blueprint, gate, part);

  const questions = generateLessonQuestions({
    lessonId,
    nodeType: blueprint.nodeType,
    gate,
    part,
    blueprint,
  });

  const base = {
    lessonId,
    title,
    objective,
    type: blueprint.nodeType,
    level: part.level,
    estimatedMinutes: blueprint.duration,
    xpReward: blueprint.xpReward,
    honeyReward: blueprint.honeyReward,
    lives: 3,
    partNumber: part.partNumber,
    gateNumber: gate.gateNumber,
    topicTitle: gate.topicTitle,
    grammarPoint: gate.grammarPoint,
    listenSlot: blueprint.listenSlot || null,
    speakSlot: blueprint.speakSlot || null,
    completionRules: {
      minScorePercent: 0,
      minQuestionsAnswered: 1,
      allowCompleteOnFinish: true,
    },
    questions,
    contentGaps: questions.contentGaps || [],
    contentSource: questions.contentGaps ? "catalog_generated_v4" : "catalog_generated_v3",
  };

  const enriched = ENRICHED_LESSONS[lessonId];
  const enrichedCount = enriched?.questions?.length || 0;
  const needFull =
    blueprint.nodeType !== "review" ? NORMAL_LESSON_MIN_EXERCISES : 1;
  // Only merge hand-authored overrides when they meet the bank size bar
  if (enriched && enrichedCount >= needFull) {
    return {
      ...base,
      ...enriched,
      questions: enriched.questions,
      topicTitle: gate.topicTitle,
      grammarPoint: gate.grammarPoint,
      partNumber: part.partNumber,
      contentSource: "enriched",
    };
  }

  return base;
}

let registryCache = null;

export function clearLessonContentRegistryCache() {
  registryCache = null;
}

export function buildLessonContentRegistry() {
  if (registryCache) return registryCache;

  /** @type {Record<string, object>} */
  const registry = {};
  for (const part of LEARNING_PARTS) {
    for (const gate of part.gates) {
      for (const blueprint of GATE_NODE_BLUEPRINT) {
        const lesson = buildFromNodeMeta(part, gate, blueprint);
        registry[lesson.lessonId] = lesson;
      }
    }
  }
  registryCache = registry;
  return registry;
}

/** @returns {string[]} */
export function listAllLessonIds() {
  return Object.keys(buildLessonContentRegistry()).sort();
}
