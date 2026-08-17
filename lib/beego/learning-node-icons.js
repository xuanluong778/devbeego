/**
 * Learning path node icon types — mapped from nodeType.
 * @typedef {'star'|'headphone'|'mic'|'book'|'review'|'chest'|'trophy'|'lock'|'check'|'grammar'|'sentence'} IconType
 */

import { getNodeType } from "@/lib/beego/learning-path-schema";

/** @type {Record<string, IconType>} */
export const DEFAULT_ICON_BY_NODE_TYPE = {
  vocabulary: "book",
  sentence_patterns: "sentence",
  grammar: "grammar",
  listening: "headphone",
  speaking: "mic",
  story: "story",
  test: "trophy",
  review: "review",
  lesson: "star",
  chest: "chest",
  boss: "trophy",
};

/**
 * Resolve display icon from node data + status.
 * @param {{ nodeType?: string, type?: string, status: string, iconType?: IconType }} node
 * @returns {IconType}
 */
export function getNodeIconType(node) {
  if (node.status === "locked") return "lock";
  if (node.status === "completed") return "check";
  if (node.iconType) return node.iconType;
  return DEFAULT_ICON_BY_NODE_TYPE[getNodeType(node)] || "star";
}

/**
 * Attach iconType to path nodes when missing (API-ready enrich step).
 * @param {object} pathData
 */
export function enrichLearningPath(pathData) {
  for (const section of pathData.sections || []) {
    for (const node of section.nodes || []) {
      if (!node.type && node.nodeType) node.type = node.nodeType;
      if (!node.nodeType && node.type) node.nodeType = node.type;
      if (!node.iconType) {
        node.iconType = DEFAULT_ICON_BY_NODE_TYPE[getNodeType(node)] || "star";
      }
    }
  }
  return pathData;
}

/** Emoji fallback for sheet / non-SVG contexts */
export const ICON_EMOJI = {
  star: "⭐",
  headphone: "🎧",
  mic: "🎙️",
  book: "📘",
  story: "📖",
  sentence: "💬",
  grammar: "📐",
  review: "🔁",
  chest: "🎁",
  trophy: "🏆",
  lock: "🔒",
  check: "✅",
};

export function getNodeIconEmoji(node) {
  return ICON_EMOJI[getNodeIconType(node)] || "⭐";
}
