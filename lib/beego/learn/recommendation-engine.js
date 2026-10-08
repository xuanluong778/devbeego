/**
 * Phase 10 — Personalized Learning Recommendation (coordinating brain).
 * Deterministic ranking over Phase 1–9 data. No second XP/mastery/progression engine.
 */
import crypto from "node:crypto";
import pool from "@/lib/db";
import { getLearningPathForUser, loadUserPathState } from "@/lib/beego/learning-path-progress";
import { flattenPathNodes } from "@/lib/beego/learning-path-build";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import { resolveLearnSkillKey } from "@/lib/beego/learn/learn-skill-keys";
import { getLessonPlayerPath } from "@/lib/beego/lesson-player";
import { getLearnDailyMotivation } from "@/lib/beego/learn/daily-goal-streak-engine";
import { ensureLearnMasteryTables } from "@/lib/beego/learn/mastery-mistake-engine";
import { ensureSmartProgressionTables } from "@/lib/beego/learn/smart-progression";

const CACHE_TTL_SEC = 45;
const MAX_RECS = 3;
const WEAK_MASTERY_THRESHOLD = 55;
const STRONG_MASTERY_THRESHOLD = 80;

/** Stable type order for tie-breaks */
const TYPE_ORDER = {
  review_due: 1,
  mistake_recovery: 2,
  weak_skill_practice: 3,
  daily_goal_completion: 4,
  continue_next_lesson: 5,
  challenge: 6,
};

const REASON_TEXT = {
  SRS_DUE: "Có từ/SRS đến hạn ôn hôm nay",
  OPEN_MISTAKES: "Có lỗi chưa sửa — nên luyện lại",
  WEAK_MASTERY: "Kỹ năng còn yếu — luyện điểm yếu",
  CONTINUE_PATH: "Tiếp tục bài đang mở trên lộ trình",
  HIGH_MASTERY_CHALLENGE: "Mastery cao — thử thách tùy chọn",
  DAILY_GOAL_REMAINING: "Chưa đạt Daily Goal hôm nay",
  PLACEMENT_FOCUS: "Khớp mức Placement / điểm yếu placement",
  SURVEY_TIME_BUDGET: "Phù hợp thời gian học bạn đã chọn",
  SURVEY_GOAL_FOCUS: "Khớp mục tiêu / focus từ khảo sát",
};

let schemaReady = false;

export async function ensureRecommendationTables() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_recommendation_cache (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      payload_json JSON NOT NULL,
      input_fingerprint CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ulrc_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

/**
 * Invalidate short cache after complete / review / mastery updates.
 * @param {number} userId
 */
export async function invalidateRecommendationCache(userId) {
  if (!userId) return;
  try {
    await ensureRecommendationTables();
    await pool.query(`DELETE FROM user_learn_recommendation_cache WHERE user_id = ?`, [userId]);
  } catch {
    /* non-blocking */
  }
}

function clampInt(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

function estimatedMinutesForLesson(lessonId, fallback = 5) {
  const lesson = getLessonContentById(lessonId);
  const m = Number(lesson?.estimatedMinutes);
  if (Number.isFinite(m) && m > 0) return clampInt(m, 1, 30);
  return fallback;
}

function nodePlayable(node) {
  if (!node) return false;
  const st = String(node.status || "");
  return st === "active" || st === "completed" || st === "skipped";
}

function fingerprintInputs(raw) {
  return crypto.createHash("sha256").update(JSON.stringify(raw)).digest("hex");
}

/**
 * Batch-load recommendation inputs (no N+1).
 * @param {number} userId
 * @param {{ purpose?: string, focus?: string, dailyMinutes?: number }} [survey]
 */
export async function loadRecommendationInputs(userId, survey = {}) {
  await ensureLearnMasteryTables();
  await ensureSmartProgressionTables();

  const [
    path,
    pathState,
    daily,
    masteryRes,
    mistakesRes,
    srsRes,
    progRes,
    placementRes,
    attemptsRes,
  ] = await Promise.all([
    getLearningPathForUser(userId),
    loadUserPathState(userId),
    getLearnDailyMotivation(userId),
    pool.query(
      `SELECT skill_key, mastery_score, mastery_phase, accuracy_pct, wrong_count, attempts_count
       FROM user_learn_skill_mastery WHERE user_id = ?
       ORDER BY mastery_score ASC, wrong_count DESC`,
      [userId]
    ),
    pool.query(
      `SELECT lesson_id, skill_key, COUNT(*) AS open_count, MAX(wrong_count) AS max_wrong
       FROM user_learn_mistakes
       WHERE user_id = ? AND status = 'open'
       GROUP BY lesson_id, skill_key
       ORDER BY open_count DESC, max_wrong DESC
       LIMIT 20`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*) AS due_count
       FROM user_word_progress
       WHERE user_id = ? AND next_review_at IS NOT NULL AND next_review_at <= NOW()`,
      [userId]
    ).catch(() => [[{ due_count: 0 }]]),
    pool.query(
      `SELECT progression_tier, recovery_priority, challenge_priority, primary_skill_key, last_lesson_id
       FROM user_learn_smart_progression WHERE user_id = ? LIMIT 1`,
      [userId]
    ),
    pool.query(
      `SELECT estimated_level, weak_skills_json, recommended_lesson_id, start_choice, placement_start_lesson_id
       FROM user_learn_placement_results WHERE user_id = ? LIMIT 1`,
      [userId]
    ).catch(() => [[]]),
    pool.query(
      `SELECT is_correct FROM user_learn_exercise_attempts
       WHERE user_id = ?
       ORDER BY id DESC LIMIT 20`,
      [userId]
    ).catch(() => [[]]),
  ]);

  const nodes = flattenPathNodes(path.sections || []);
  const byId = new Map(nodes.map((n) => [n.lessonId, n]));
  const activeLessonId = String(path.progress?.active_lesson_id || pathState.activeLessonId || "");
  const activeNode = byId.get(activeLessonId) || nodes.find((n) => n.status === "active") || null;

  const masteryRows = masteryRes[0] || [];
  const weakest = masteryRows[0] || null;
  const openMistakes = mistakesRes[0] || [];
  const openMistakeTotal = openMistakes.reduce((s, r) => s + Number(r.open_count || 0), 0);
  const srsDue = Number(srsRes[0]?.[0]?.due_count || 0);
  const progression = progRes[0]?.[0] || null;
  const placement = placementRes[0]?.[0] || null;
  let placementWeak = [];
  if (placement?.weak_skills_json) {
    try {
      const parsed =
        typeof placement.weak_skills_json === "string"
          ? JSON.parse(placement.weak_skills_json)
          : placement.weak_skills_json;
      if (Array.isArray(parsed)) placementWeak = parsed.map(String);
    } catch {
      placementWeak = [];
    }
  }

  const attemptRows = attemptsRes[0] || [];
  const recentTotal = attemptRows.length;
  const recentCorrect = attemptRows.filter((r) => Number(r.is_correct) === 1).length;
  const recentAccuracyPct =
    recentTotal > 0 ? Math.round((recentCorrect / recentTotal) * 1000) / 10 : null;

  const purpose = String(survey.purpose || "").trim().slice(0, 64);
  const focus = String(survey.focus || "").trim().slice(0, 64);
  const dailyMinutes = clampInt(survey.dailyMinutes ?? survey.daily_minutes ?? 0, 0, 120) || null;

  return {
    userId,
    nodes,
    byId,
    activeLessonId,
    activeNode,
    completedIds: pathState.completedIds,
    daily,
    masteryRows,
    weakestSkill: weakest
      ? {
          skillKey: String(weakest.skill_key),
          masteryScore: Number(weakest.mastery_score),
          masteryPhase: String(weakest.mastery_phase || "NEW"),
          accuracyPct: Number(weakest.accuracy_pct || 0),
        }
      : null,
    openMistakes,
    openMistakeTotal,
    srsDue,
    progression: progression
      ? {
          tier: String(progression.progression_tier || "medium"),
          recoveryPriority: Number(progression.recovery_priority || 50),
          challengePriority: Number(progression.challenge_priority || 50),
          primarySkillKey: progression.primary_skill_key
            ? String(progression.primary_skill_key)
            : null,
          lastLessonId: progression.last_lesson_id ? String(progression.last_lesson_id) : null,
        }
      : null,
    placement: placement
      ? {
          estimatedLevel: String(placement.estimated_level || ""),
          weakSkills: placementWeak,
          recommendedLessonId: placement.recommended_lesson_id
            ? String(placement.recommended_lesson_id)
            : null,
          startChoice: placement.start_choice ? String(placement.start_choice) : null,
        }
      : null,
    recentAccuracyPct,
    recentAttemptCount: recentTotal,
    survey: { purpose, focus, dailyMinutes },
  };
}

function findUnlockedBySkill(inputs, skillKey) {
  if (!skillKey) return null;
  const playable = inputs.nodes.filter((n) => nodePlayable(n) && n.lessonId);
  // Prefer active if skill matches
  if (inputs.activeNode) {
    const content = getLessonContentById(inputs.activeNode.lessonId);
    const sk = resolveLearnSkillKey(content?.type || inputs.activeNode.type || "", "", "");
    if (sk === skillKey) return inputs.activeNode;
  }
  for (const n of playable) {
    const content = getLessonContentById(n.lessonId);
    const sk = resolveLearnSkillKey(content?.type || n.type || "", "", "");
    if (sk === skillKey) return n;
  }
  return null;
}

function findUnlockedReview(inputs) {
  const playable = inputs.nodes.filter(
    (n) => nodePlayable(n) && (n.type === "review" || n.nodeType === "review")
  );
  return playable.find((n) => n.status === "active") || playable[0] || null;
}

function findUnlockedChallenge(inputs) {
  const playable = inputs.nodes.filter((n) => {
    if (!nodePlayable(n)) return false;
    const t = String(n.type || n.nodeType || "");
    return t === "test" || t === "boss";
  });
  return playable.find((n) => n.status === "active") || playable[0] || null;
}

function findMistakeLessonNode(inputs) {
  for (const row of inputs.openMistakes) {
    const lid = String(row.lesson_id || "");
    const node = inputs.byId.get(lid);
    if (node && nodePlayable(node)) return { node, skillKey: String(row.skill_key || "") };
  }
  // Mistakes on locked lessons → use review node if unlocked
  const review = findUnlockedReview(inputs);
  if (review) {
    return {
      node: review,
      skillKey: String(inputs.openMistakes[0]?.skill_key || inputs.weakestSkill?.skillKey || ""),
    };
  }
  return null;
}

function makeRec({
  type,
  lessonId,
  href,
  priority,
  reasonCode,
  reasonText,
  estimatedMinutes,
  skillKey,
  title,
  slotHint,
}) {
  return {
    type,
    lessonId: lessonId || null,
    href: href || (lessonId ? getLessonPlayerPath(lessonId) : null),
    priority: clampInt(priority, 0, 9999),
    reasonCode,
    reasonText: reasonText || REASON_TEXT[reasonCode] || reasonCode,
    estimatedMinutes: clampInt(estimatedMinutes, 1, 30),
    skillKey: skillKey || null,
    title: title || null,
    slotHint: slotHint || null,
  };
}

/**
 * Build ranked candidates (deterministic).
 * @param {Awaited<ReturnType<typeof loadRecommendationInputs>>} inputs
 */
export function buildRecommendationCandidates(inputs) {
  const candidates = [];
  const surveyBoost =
    inputs.survey.purpose || inputs.survey.focus ? 15 : 0;
  const timeBudget = inputs.survey.dailyMinutes;
  const timeBoost = timeBudget && timeBudget <= 10 ? 10 : 0;

  // 1) review_due — SRS
  if (inputs.srsDue > 0) {
    const reviewNode = findUnlockedReview(inputs);
    const href = reviewNode
      ? getLessonPlayerPath(reviewNode.lessonId)
      : "/review/today";
    const mins = Math.min(15, Math.max(3, Math.ceil(inputs.srsDue / 2)));
    candidates.push(
      makeRec({
        type: "review_due",
        lessonId: reviewNode?.lessonId || null,
        href,
        priority: 900 + Math.min(50, inputs.srsDue) + timeBoost,
        reasonCode: "SRS_DUE",
        reasonText: `${REASON_TEXT.SRS_DUE} (${inputs.srsDue})`,
        estimatedMinutes: timeBudget ? Math.min(mins, timeBudget) : mins,
        skillKey: "vocabulary",
        title: "Ôn từ đến hạn",
        slotHint: "primary",
      })
    );
  }

  // 2) mistake_recovery
  if (inputs.openMistakeTotal > 0) {
    const hit = findMistakeLessonNode(inputs);
    if (hit?.node) {
      candidates.push(
        makeRec({
          type: "mistake_recovery",
          lessonId: hit.node.lessonId,
          href: getLessonPlayerPath(hit.node.lessonId),
          priority:
            800 +
            Math.min(40, inputs.openMistakeTotal) +
            (inputs.progression?.recoveryPriority || 0) / 10 +
            surveyBoost,
          reasonCode: "OPEN_MISTAKES",
          reasonText: `${REASON_TEXT.OPEN_MISTAKES} (${inputs.openMistakeTotal})`,
          estimatedMinutes: estimatedMinutesForLesson(hit.node.lessonId, 6),
          skillKey: hit.skillKey || null,
          title: hit.node.title || "Sửa lỗi sai",
          slotHint: "weak",
        })
      );
    }
  }

  // 3) weak_skill_practice
  const weak = inputs.weakestSkill;
  if (weak && weak.masteryScore < WEAK_MASTERY_THRESHOLD) {
    let node = findUnlockedBySkill(inputs, weak.skillKey);
    if (!node && inputs.activeNode && nodePlayable(inputs.activeNode)) {
      node = inputs.activeNode;
    }
    if (node) {
      const placementHit = inputs.placement?.weakSkills?.includes(weak.skillKey);
      candidates.push(
        makeRec({
          type: "weak_skill_practice",
          lessonId: node.lessonId,
          href: getLessonPlayerPath(node.lessonId),
          priority:
            700 +
            Math.round(WEAK_MASTERY_THRESHOLD - weak.masteryScore) +
            (placementHit ? 25 : 0) +
            surveyBoost,
          reasonCode: placementHit ? "PLACEMENT_FOCUS" : "WEAK_MASTERY",
          reasonText: placementHit
            ? `${REASON_TEXT.PLACEMENT_FOCUS}: ${weak.skillKey}`
            : `${REASON_TEXT.WEAK_MASTERY} (${weak.skillKey}: ${Math.round(weak.masteryScore)})`,
          estimatedMinutes: estimatedMinutesForLesson(node.lessonId, 5),
          skillKey: weak.skillKey,
          title: node.title || "Luyện điểm yếu",
          slotHint: "weak",
        })
      );
    }
  }

  // 4) daily_goal_completion
  if (inputs.daily && !inputs.daily.daily_goal_completed && inputs.activeNode) {
    const remain = Math.max(
      0,
      Number(inputs.daily.daily_goal_xp || 30) - Number(inputs.daily.xp_today || 0)
    );
    candidates.push(
      makeRec({
        type: "daily_goal_completion",
        lessonId: inputs.activeNode.lessonId,
        href: getLessonPlayerPath(inputs.activeNode.lessonId),
        priority: 650 + Math.min(40, remain) + timeBoost,
        reasonCode: "DAILY_GOAL_REMAINING",
        reasonText: `${REASON_TEXT.DAILY_GOAL_REMAINING} (−${remain} XP)`,
        estimatedMinutes: timeBudget
          ? Math.min(estimatedMinutesForLesson(inputs.activeNode.lessonId, 5), timeBudget)
          : estimatedMinutesForLesson(inputs.activeNode.lessonId, 5),
        skillKey: resolveLearnSkillKey(
          getLessonContentById(inputs.activeNode.lessonId)?.type || "",
          "",
          ""
        ),
        title: inputs.activeNode.title || "Hoàn thành Daily Goal",
        slotHint: "primary",
      })
    );
  }

  // 5) continue_next_lesson
  if (inputs.activeNode && nodePlayable(inputs.activeNode)) {
    candidates.push(
      makeRec({
        type: "continue_next_lesson",
        lessonId: inputs.activeNode.lessonId,
        href: getLessonPlayerPath(inputs.activeNode.lessonId),
        priority: 500 + (inputs.recentAccuracyPct != null && inputs.recentAccuracyPct < 60 ? 20 : 0),
        reasonCode: "CONTINUE_PATH",
        reasonText: REASON_TEXT.CONTINUE_PATH,
        estimatedMinutes: estimatedMinutesForLesson(inputs.activeNode.lessonId, 5),
        skillKey: resolveLearnSkillKey(
          getLessonContentById(inputs.activeNode.lessonId)?.type || "",
          "",
          ""
        ),
        title: inputs.activeNode.title || "Bài tiếp theo",
        slotHint: "primary",
      })
    );
  }

  // 6) challenge — strong mastery / strong tier
  const strong =
    (weak && weak.masteryScore >= STRONG_MASTERY_THRESHOLD) ||
    inputs.progression?.tier === "strong" ||
    (inputs.recentAccuracyPct != null &&
      inputs.recentAccuracyPct >= 85 &&
      inputs.recentAttemptCount >= 8);

  if (strong) {
    const challengeNode = findUnlockedChallenge(inputs) || inputs.activeNode;
    if (challengeNode && nodePlayable(challengeNode)) {
      candidates.push(
        makeRec({
          type: "challenge",
          lessonId: challengeNode.lessonId,
          href: getLessonPlayerPath(challengeNode.lessonId),
          priority: 400 + (inputs.progression?.challengePriority || 50) / 2,
          reasonCode: "HIGH_MASTERY_CHALLENGE",
          reasonText: REASON_TEXT.HIGH_MASTERY_CHALLENGE,
          estimatedMinutes: estimatedMinutesForLesson(challengeNode.lessonId, 8),
          skillKey: resolveLearnSkillKey(
            getLessonContentById(challengeNode.lessonId)?.type || "",
            "",
            ""
          ),
          title: challengeNode.title || "Thử thách",
          slotHint: "challenge",
        })
      );
    }
  }

  // Survey goal focus nudge — bump matching continue/weak already created
  if (inputs.survey.focus) {
    const focusLower = inputs.survey.focus.toLowerCase();
    for (const c of candidates) {
      if (c.skillKey && focusLower.includes(c.skillKey.replace("_", " "))) {
        c.priority += 12;
        if (c.reasonCode === "CONTINUE_PATH" || c.reasonCode === "WEAK_MASTERY") {
          c.reasonCode = "SURVEY_GOAL_FOCUS";
          c.reasonText = REASON_TEXT.SURVEY_GOAL_FOCUS;
        }
      }
    }
  }
  if (timeBudget && timeBudget <= 10) {
    for (const c of candidates) {
      if (c.estimatedMinutes > timeBudget) {
        c.estimatedMinutes = timeBudget;
        if (!["SRS_DUE", "OPEN_MISTAKES"].includes(c.reasonCode)) {
          c.reasonCode = "SURVEY_TIME_BUDGET";
          c.reasonText = REASON_TEXT.SURVEY_TIME_BUDGET;
        }
      }
    }
  }

  // Drop invalid / locked targets
  const valid = candidates.filter((c) => {
    if (!c.href) return false;
    if (!c.lessonId) return c.type === "review_due"; // SRS may use /review/today
    const node = inputs.byId.get(c.lessonId);
    if (!node) return false;
    if (node.status === "locked") return false;
    return true;
  });

  // Sort deterministic: priority DESC, type order ASC, lessonId ASC
  valid.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const ta = TYPE_ORDER[a.type] || 99;
    const tb = TYPE_ORDER[b.type] || 99;
    if (ta !== tb) return ta - tb;
    return String(a.lessonId || "").localeCompare(String(b.lessonId || ""));
  });

  return valid;
}

/**
 * Pick max 3 with diversity: primary / weak / challenge slots when possible.
 * @param {ReturnType<typeof buildRecommendationCandidates>} ranked
 */
export function selectTopRecommendations(ranked) {
  const picked = [];
  const usedTypes = new Set();
  const usedLessons = new Set();

  function take(pred) {
    for (const c of ranked) {
      if (usedTypes.has(c.type)) continue;
      if (c.lessonId && usedLessons.has(c.lessonId) && c.type !== "challenge") continue;
      if (!pred(c)) continue;
      picked.push(c);
      usedTypes.add(c.type);
      if (c.lessonId) usedLessons.add(c.lessonId);
      return true;
    }
    return false;
  }

  // ① Nên học ngay
  take(
    (c) =>
      c.type === "review_due" ||
      c.type === "mistake_recovery" ||
      c.type === "daily_goal_completion" ||
      c.type === "continue_next_lesson"
  );
  // ② Ôn/luyện điểm yếu
  take(
    (c) =>
      c.type === "weak_skill_practice" ||
      c.type === "mistake_recovery" ||
      c.type === "review_due"
  );
  // ③ Challenge tùy chọn
  take((c) => c.type === "challenge");

  // Fill remaining from ranked
  for (const c of ranked) {
    if (picked.length >= MAX_RECS) break;
    if (usedTypes.has(c.type)) continue;
    if (c.lessonId && usedLessons.has(c.lessonId)) continue;
    picked.push(c);
    usedTypes.add(c.type);
    if (c.lessonId) usedLessons.add(c.lessonId);
  }

  return picked.slice(0, MAX_RECS).map((c, i) => ({
    ...c,
    rank: i + 1,
    slotLabel:
      i === 0 ? "Nên học ngay" : i === 1 ? "Ôn / luyện điểm yếu" : "Challenge tùy chọn",
  }));
}

/**
 * @param {number} userId
 * @param {{ purpose?: string, focus?: string, dailyMinutes?: number, bypassCache?: boolean }} [opts]
 */
export async function getPersonalizedRecommendations(userId, opts = {}) {
  await ensureRecommendationTables();
  const survey = {
    purpose: opts.purpose,
    focus: opts.focus,
    dailyMinutes: opts.dailyMinutes ?? opts.daily_minutes,
  };

  const inputs = await loadRecommendationInputs(userId, survey);
  const fpPayload = {
    active: inputs.activeLessonId,
    srs: inputs.srsDue,
    mistakes: inputs.openMistakeTotal,
    weak: inputs.weakestSkill
      ? `${inputs.weakestSkill.skillKey}:${Math.round(inputs.weakestSkill.masteryScore)}`
      : null,
    goalDone: Boolean(inputs.daily?.daily_goal_completed),
    xpToday: Number(inputs.daily?.xp_today || 0),
    tier: inputs.progression?.tier || null,
    recentAcc: inputs.recentAccuracyPct,
    survey,
  };
  const fingerprint = fingerprintInputs(fpPayload);

  if (!opts.bypassCache) {
    const [cached] = await pool.query(
      `SELECT payload_json, input_fingerprint, expires_at
       FROM user_learn_recommendation_cache WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const row = cached[0];
    if (
      row &&
      String(row.input_fingerprint) === fingerprint &&
      row.expires_at &&
      new Date(row.expires_at).getTime() > Date.now()
    ) {
      const payload =
        typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
      return { ...payload, cached: true };
    }
  }

  const ranked = buildRecommendationCandidates(inputs);
  const recommendations = selectTopRecommendations(ranked);

  const result = {
    recommendations,
    generatedAt: new Date().toISOString(),
    inputsSummary: {
      srsDue: inputs.srsDue,
      openMistakes: inputs.openMistakeTotal,
      weakestSkill: inputs.weakestSkill,
      activeLessonId: inputs.activeLessonId,
      dailyGoalCompleted: Boolean(inputs.daily?.daily_goal_completed),
      xpToday: Number(inputs.daily?.xp_today || 0),
      dailyGoalXp: Number(inputs.daily?.daily_goal_xp || 30),
      streak: Number(inputs.daily?.streak || 0),
      recentAccuracyPct: inputs.recentAccuracyPct,
      progressionTier: inputs.progression?.tier || null,
      placementLevel: inputs.placement?.estimatedLevel || null,
      survey: inputs.survey,
    },
    cached: false,
  };

  const expires = new Date(Date.now() + CACHE_TTL_SEC * 1000);
  await pool.query(
    `INSERT INTO user_learn_recommendation_cache (user_id, payload_json, input_fingerprint, expires_at)
     VALUES (?, CAST(? AS JSON), ?, ?)
     ON DUPLICATE KEY UPDATE
       payload_json = VALUES(payload_json),
       input_fingerprint = VALUES(input_fingerprint),
       expires_at = VALUES(expires_at),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify(result), fingerprint, expires]
  );

  return result;
}
