/**
 * Mock learning path — generated from catalog (16 nodes × mỗi cửa).
 * Replace buildLearningPathFromCatalog() call with API fetch when ready.
 */

import { buildLearningPathFromCatalog } from "@/lib/beego/learning-path-build";

/** @typedef {import('./learning-path-schema').GateNodeType} GateNodeType */
/** @typedef {import('./learning-path-schema').NodeStatus} NodeStatus */
/** @typedef {import('./learning-path-schema').CefrLevel} CefrLevel */

/**
 * @typedef {object} PathNode
 * @property {number} nodeIndex
 * @property {GateNodeType} nodeType
 * @property {GateNodeType} type
 * @property {NodeStatus} status
 * @property {string} lessonId
 * @property {string} title
 * @property {string} subtitle
 * @property {string} [goal]
 * @property {number} duration
 * @property {number} xpReward
 * @property {number} honeyReward
 * @property {string} [unlockHint]
 * @property {string} [iconType]
 */

/**
 * @typedef {object} PathSection
 * @property {string} sectionId
 * @property {number} partNumber
 * @property {number} gateNumber
 * @property {string} partTitle
 * @property {CefrLevel} level
 * @property {string} sectionTitle
 * @property {string} topicTitle
 * @property {string} [sectionDescription]
 * @property {PathNode[]} nodes
 */

/** @type {{ currentSectionId: string, activeLessonId: string, sections: PathSection[] }} */
export const LEARNING_PATH_MOCK = buildLearningPathFromCatalog();

export const BEEGO_LEARN_MICROCOPY = [
  "Chỉ 5 phút thôi, Beego học cùng bạn.",
  "Hoàn thành bài này để mở cửa tiếp theo.",
  "Bạn đang có đà, đừng dừng lại.",
  "Giữ streak hôm nay để không mất công hôm qua.",
];
