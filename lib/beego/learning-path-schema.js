/**
 * Learning path schema — 16 nodes per gate (cửa).
 * Single source of truth for node order, types, and labels.
 */

/** @typedef {'vocabulary'|'sentence_patterns'|'grammar'|'listening'|'speaking'|'story'|'test'|'review'} GateNodeType */
/** @typedef {'locked'|'active'|'completed'} NodeStatus */
/** @typedef {'A0'|'A1'|'A2'|'B1'|'B1+'} CefrLevel */

export const NODES_PER_GATE = 16;

export const UNLOCK_HINT = "Hoàn thành bài trước để mở khóa";

/** @type {Record<GateNodeType, string>} */
export const NODE_TYPE_LABELS = {
  vocabulary: "20 từ vựng",
  sentence_patterns: "5 câu mẫu",
  grammar: "Ngữ pháp",
  listening: "Luyện nghe",
  speaking: "Luyện nói",
  story: "Story",
  test: "Test / Vượt cửa",
  review: "Ôn tập lặp lại",
};

/**
 * Fixed 16-node sequence per gate.
 * @type {Array<{ nodeIndex: number, nodeType: GateNodeType, duration: number, xpReward: number, honeyReward: number, listenSlot?: number, speakSlot?: number }>}
 */
export const GATE_NODE_BLUEPRINT = [
  { nodeIndex: 1, nodeType: "vocabulary", duration: 12, xpReward: 15, honeyReward: 20 },
  { nodeIndex: 2, nodeType: "sentence_patterns", duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 3, nodeType: "grammar", duration: 12, xpReward: 14, honeyReward: 18 },
  { nodeIndex: 4, nodeType: "listening", listenSlot: 1, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 5, nodeType: "listening", listenSlot: 2, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 6, nodeType: "listening", listenSlot: 3, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 7, nodeType: "listening", listenSlot: 4, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 8, nodeType: "listening", listenSlot: 5, duration: 12, xpReward: 10, honeyReward: 12 },
  { nodeIndex: 9, nodeType: "speaking", speakSlot: 1, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 10, nodeType: "speaking", speakSlot: 2, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 11, nodeType: "speaking", speakSlot: 3, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 12, nodeType: "speaking", speakSlot: 4, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 13, nodeType: "speaking", speakSlot: 5, duration: 12, xpReward: 12, honeyReward: 15 },
  { nodeIndex: 14, nodeType: "story", duration: 12, xpReward: 18, honeyReward: 22 },
  { nodeIndex: 15, nodeType: "test", duration: 10, xpReward: 30, honeyReward: 50 },
  { nodeIndex: 16, nodeType: "review", duration: 6, xpReward: 12, honeyReward: 15 },
];

/**
 * Resolve nodeType from API/mock node (supports legacy `type` field).
 * @param {{ nodeType?: string, type?: string }} node
 * @returns {string}
 */
export function getNodeType(node) {
  return node?.nodeType || node?.type || "vocabulary";
}
