import { LEARNING_PATH_EMPTY } from "@/lib/beego/learning-path-mock";
import { enrichLearningPath, getNodeIconEmoji } from "@/lib/beego/learning-node-icons";
import { getLessonPlayerPath } from "@/lib/beego/lesson-player";
import { isReviewNode, isTestNode } from "@/lib/beego/learning-path-build";
import { NODE_TYPE_LABELS, getNodeType } from "@/lib/beego/learning-path-schema";
import { LISTENING_PATH, SPEAKING_PATH } from "@/lib/beego/routes";

const PLAYER_TYPES = new Set([
  "vocabulary",
  "sentence_patterns",
  "grammar",
  "listening",
  "speaking",
  "story",
  "test",
  "review",
  "lesson",
  "boss",
]);

/** Resolve href for a lesson node by type. TODO: map lessonId to specific clip/lesson when API ready. */
export function replayLessonHref(node) {
  const href = getLessonHref(node);
  if (!href || !String(href).startsWith("/learn/lesson/")) return href;
  return `${href}?replay=1`;
}

export function getLessonHref(node) {
  const nodeType = getNodeType(node);

  if (node?.lessonId && PLAYER_TYPES.has(nodeType)) {
    return getLessonPlayerPath(node.lessonId);
  }

  switch (nodeType) {
    case "listening":
      return LISTENING_PATH;
    case "speaking":
      return SPEAKING_PATH;
    case "vocabulary":
    case "sentence_patterns":
    case "grammar":
      return "/vocabulary";
    case "story":
      return "/kids-fun-stories";
    case "review":
      return "/quiz?mode=review";
    case "test":
      return "/quiz";
    default:
      return null;
  }
}

/** @deprecated Use getNodeIconEmoji(node) or LearningNodeIcon */
export function getNodeIcon(type) {
  const icons = {
    vocabulary: "📘",
    sentence_patterns: "💬",
    grammar: "📐",
    listening: "🎧",
    speaking: "🎙️",
    story: "📖",
    test: "🏆",
    review: "🔁",
    lesson: "⭐",
    chest: "🎁",
    boss: "🏆",
  };
  return icons[type] || "⭐";
}

export { getNodeIconEmoji };

export function findCurrentSection(pathData) {
  const byId = pathData.sections.find((s) => s.sectionId === pathData.currentSectionId);
  return byId || pathData.sections[0];
}

export function findActiveNode(sections) {
  for (const section of sections) {
    const active = section.nodes.find((n) => n.status === "active");
    if (active) return { section, node: active };
  }
  return null;
}

export function countCompletedNodes(sections) {
  let total = 0;
  let done = 0;
  for (const section of sections) {
    for (const node of section.nodes) {
      total += 1;
      if (node.status === "completed") done += 1;
    }
  }
  return { done, total };
}

export function getNextTest(sections) {
  for (const section of sections) {
    const test = section.nodes.find((n) => isTestNode(n) && n.status !== "completed");
    if (test) return { section, node: test };
  }
  return null;
}

/** @deprecated Use getNextTest */
export function getNextChest(sections) {
  return getNextTest(sections);
}

/**
 * Reward hint for desktop panel — bài còn lại trước Test/rương cửa.
 * @param {Array<{ nodes: object[] }>} sections
 */
export function getUpcomingReward(sections) {
  const active = findActiveNode(sections);
  if (!active) {
    const next = getNextTest(sections);
    if (!next) return null;
    return {
      section: next.section,
      remaining: null,
      honeyReward: next.node.honeyReward,
      hint: next.node.subtitle || "Hoàn thành cửa để nhận thưởng",
    };
  }

  const { section, node } = active;
  const testNode = section.nodes.find((n) => isTestNode(n));
  if (!testNode || testNode.status === "completed") {
    const next = getNextTest(sections);
    if (!next) return null;
    return {
      section: next.section,
      remaining: null,
      honeyReward: next.node.honeyReward,
      hint: next.node.subtitle || "Hoàn thành 14 bài trước Test",
    };
  }

  const activeIdx = section.nodes.findIndex((n) => n.lessonId === node.lessonId);
  const testIdx = section.nodes.findIndex((n) => isTestNode(n));
  const remaining = Math.max(0, testIdx - activeIdx);

  if (remaining === 0 && !isTestNode(node)) return null;

  return {
    section,
    remaining: remaining || null,
    honeyReward: testNode.honeyReward,
    hint:
      remaining > 1
        ? `${remaining} bài nữa đến rương thưởng cửa`
        : remaining === 1
          ? "1 bài nữa đến Test vượt cửa!"
          : "Sắp vượt cửa — hoàn thành Test để nhận thưởng",
  };
}

/**
 * Load learning path. Prefer server payload from /api/learning-path.
 * @param {object|null} dashOrPath optional dashboard or full path payload
 */
export function loadLearningPath(dashOrPath = null) {
  if (dashOrPath?.sections && Array.isArray(dashOrPath.sections)) {
    return enrichLearningPath(JSON.parse(JSON.stringify(dashOrPath)));
  }
  // Guest / loading: empty progress (first lesson active) — never demo mid-path
  const data = JSON.parse(JSON.stringify(LEARNING_PATH_EMPTY));
  return enrichLearningPath(data);
}

export function getMascotMessage(sections, streak = 0) {
  const active = findActiveNode(sections);
  const nextTest = getNextTest(sections);

  if (nextTest?.node?.status === "active" && isTestNode(nextTest.node)) {
    return "Sắp đến bài Test — vượt cửa rồi!";
  }
  if (active?.node && isTestNode(active.node)) {
    return "Vượt Test để mở cửa tiếp theo!";
  }
  if (active?.node && isReviewNode(active.node)) {
    return "Ôn tập lại để nhớ lâu hơn nhé.";
  }
  if (active?.node?.status === "active") {
    return "Hoàn thành bài này để mở bài tiếp theo.";
  }
  if (streak > 0) {
    return "Giữ streak hôm nay để không mất công hôm qua.";
  }
  return "Chỉ 5 phút thôi, Beego học cùng bạn.";
}

export function formatGateLabel(section) {
  return `Phần ${section.partNumber}, Cửa ${section.gateNumber}`;
}

export function formatLevelLabel(section) {
  return section.level ? `Trình độ ${section.level}` : "";
}

const NODE_STATUS_LABELS = {
  completed: "Đã hoàn thành",
  active: "Đang học",
  locked: "Chưa mở khóa",
};

export function getNodeTypeLabel(typeOrNode) {
  const type = typeof typeOrNode === "string" ? typeOrNode : getNodeType(typeOrNode);
  return NODE_TYPE_LABELS[type] || NODE_TYPE_LABELS.vocabulary;
}

export function getNodeStatusLabel(status) {
  return NODE_STATUS_LABELS[status] || status;
}

/** @param {{ type?: string, nodeType?: string, status: string }} node */
export function getActiveNodeBadge(node) {
  if (node.status !== "active") return null;
  if (isTestNode(node)) return "VƯỢT CỬA?";
  return "BẮT ĐẦU";
}

/** @param {object} node */
export function getNodeCta(node) {
  const nodeType = getNodeType(node);

  if (node.status === "locked") {
    return {
      label: node.unlockHint || "Hoàn thành bài trước để mở khóa",
      href: null,
      variant: "muted",
      disabled: true,
    };
  }

  const href = node.status === "completed" ? replayLessonHref(node) : getLessonHref(node);

  if (nodeType === "test") {
    return {
      label: node.status === "completed" ? "Học lại" : "Vượt cửa",
      href,
      variant: "primary",
      disabled: false,
    };
  }

  if (nodeType === "review") {
    return {
      label: node.status === "completed" ? "Học lại" : "Ôn tập ngay",
      href,
      variant: "primary",
      disabled: false,
    };
  }

  if (node.status === "completed") {
    return { label: "Học lại", href, variant: "primary", disabled: false };
  }
  if (node.status === "active") {
    return { label: "Bắt đầu học", href, variant: "primary", disabled: false };
  }

  return { label: "Bắt đầu học", href, variant: "primary", disabled: false };
}

export { getNodeType };
