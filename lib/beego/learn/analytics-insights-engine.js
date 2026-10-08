/**
 * Phase 11 — Learning Analytics & Progress Insights.
 * Aggregates Phase 1–10 data only. Deterministic insights. No second progress engine.
 */
import crypto from "node:crypto";
import pool from "@/lib/db";
import { loadUserPathState } from "@/lib/beego/learning-path-progress";
import { buildLearningPathFromCatalog, flattenPathNodes } from "@/lib/beego/learning-path-build";
import { getLearnDailyMotivation } from "@/lib/beego/learn/daily-goal-streak-engine";
import { ensureLearnMasteryTables } from "@/lib/beego/learn/mastery-mistake-engine";
import { ensureSmartProgressionTables } from "@/lib/beego/learn/smart-progression";
import { LEARN_SKILL_KEYS } from "@/lib/beego/learn/learn-skill-keys";
import {
  DEFAULT_LEARN_TIMEZONE,
  resolveLearnTimezone,
  ymdInTimezone,
} from "@/lib/beego/learn/learn-daily-timezone";

const CACHE_TTL_SEC = 60;
const WEAK_THRESHOLD = 55;
const STRONG_THRESHOLD = 75;
const MIN_ATTEMPTS_FOR_ACCURACY = 5;
const MIN_DAYS_FOR_STREAK_INSIGHT = 3;

const SKILL_LABELS_VI = {
  vocabulary: "Từ vựng",
  grammar: "Ngữ pháp",
  sentence_patterns: "Mẫu câu",
  listening: "Listening",
  speaking: "Speaking",
  comprehension: "Đọc hiểu",
};

let schemaReady = false;

export async function ensureAnalyticsTables() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_analytics_cache (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      payload_json JSON NOT NULL,
      input_fingerprint CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ulac_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

/**
 * @param {number} userId
 */
export async function invalidateAnalyticsCache(userId) {
  if (!userId) return;
  try {
    await ensureAnalyticsTables();
    await pool.query(`DELETE FROM user_learn_analytics_cache WHERE user_id = ?`, [userId]);
  } catch {
    /* non-blocking */
  }
}

function clampPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function fingerprint(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

function skillLabel(key) {
  return SKILL_LABELS_VI[key] || key;
}

function lastNDates(n, tz) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(ymdInTimezone(d, tz));
  }
  return out;
}

/**
 * Batch-load raw analytics inputs (no N+1).
 * @param {number} userId
 */
export async function loadAnalyticsInputs(userId) {
  await ensureLearnMasteryTables();
  await ensureSmartProgressionTables();

  const [pathState, daily, masteryRes, mistakesRes, srsRes, placementRes, attemptsRes, lessonDaysRes, dailyProgRes, resolvedMistakesRes] =
    await Promise.all([
      loadUserPathState(userId),
      getLearnDailyMotivation(userId),
      pool.query(
        `SELECT skill_key, mastery_score, mastery_phase, accuracy_pct, correct_count, wrong_count, attempts_count, last_practiced_at
         FROM user_learn_skill_mastery WHERE user_id = ?`,
        [userId]
      ),
      pool.query(
        `SELECT skill_key, COUNT(*) AS open_count
         FROM user_learn_mistakes WHERE user_id = ? AND status = 'open'
         GROUP BY skill_key`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) AS due_count
         FROM user_word_progress
         WHERE user_id = ? AND next_review_at IS NOT NULL AND next_review_at <= NOW()`,
        [userId]
      ).catch(() => [[{ due_count: 0 }]]),
      pool.query(
        `SELECT estimated_level, weak_skills_json, strengths_json, placement_score, completed_at
         FROM user_learn_placement_results WHERE user_id = ? LIMIT 1`,
        [userId]
      ).catch(() => [[]]),
      pool.query(
        `SELECT DATE(created_at) AS d,
                COUNT(*) AS attempts,
                SUM(is_correct = 1) AS correct_n
         FROM user_learn_exercise_attempts
         WHERE user_id = ? AND created_at >= (NOW() - INTERVAL 14 DAY)
         GROUP BY DATE(created_at)
         ORDER BY d ASC`,
        [userId]
      ).catch(() => [[]]),
      pool.query(
        `SELECT DATE(completed_at) AS d, COUNT(*) AS lessons
         FROM user_lesson_progress
         WHERE user_id = ? AND status = 'completed' AND completed_at IS NOT NULL
           AND completed_at >= (NOW() - INTERVAL 14 DAY)
         GROUP BY DATE(completed_at)
         ORDER BY d ASC`,
        [userId]
      ),
      pool.query(
        `SELECT progress_date, xp_earned, lessons_completed, goal_completed_at
         FROM user_learn_daily_progress
         WHERE user_id = ? AND progress_date >= (CURDATE() - INTERVAL 13 DAY)
         ORDER BY progress_date ASC`,
        [userId]
      ).catch(() => [[]]),
      pool.query(
        `SELECT COUNT(*) AS c FROM user_learn_mistakes
         WHERE user_id = ? AND status = 'resolved'`,
        [userId]
      ).catch(() => [[{ c: 0 }]]),
    ]);

  const catalog = buildLearningPathFromCatalog({
    completedLessonIds: new Set(),
    activeLessonId: null,
  });
  const totalLessons = flattenPathNodes(catalog.sections).length || 1;
  const completedCount = pathState.completedIds.size;

  return {
    userId,
    pathState,
    daily,
    totalLessons,
    completedCount,
    masteryRows: masteryRes[0] || [],
    openMistakesBySkill: mistakesRes[0] || [],
    srsDue: Number(srsRes[0]?.[0]?.due_count || 0),
    placement: placementRes[0]?.[0] || null,
    attemptDays: attemptsRes[0] || [],
    lessonDays: lessonDaysRes[0] || [],
    dailyProgRows: dailyProgRes[0] || [],
    resolvedMistakes: Number(resolvedMistakesRes[0]?.[0]?.c || 0),
  };
}

/**
 * @param {Awaited<ReturnType<typeof loadAnalyticsInputs>>} inputs
 */
export function buildAnalyticsModel(inputs) {
  const tz = resolveLearnTimezone(inputs.daily?.timezone || DEFAULT_LEARN_TIMEZONE);
  const pathProgressPct = clampPct((inputs.completedCount / Math.max(1, inputs.totalLessons)) * 100);

  const masteryBySkill = new Map();
  for (const row of inputs.masteryRows) {
    masteryBySkill.set(String(row.skill_key), {
      skillKey: String(row.skill_key),
      label: skillLabel(String(row.skill_key)),
      masteryScore: Number(row.mastery_score) || 0,
      masteryPhase: String(row.mastery_phase || "NEW"),
      accuracyPct: Number(row.accuracy_pct) || 0,
      attempts: Number(row.attempts_count) || 0,
      correct: Number(row.correct_count) || 0,
      wrong: Number(row.wrong_count) || 0,
    });
  }

  const skills = LEARN_SKILL_KEYS.map((key) => {
    const m = masteryBySkill.get(key);
    if (m) return m;
    return {
      skillKey: key,
      label: skillLabel(key),
      masteryScore: 0,
      masteryPhase: "NEW",
      accuracyPct: 0,
      attempts: 0,
      correct: 0,
      wrong: 0,
      empty: true,
    };
  });

  const practiced = skills.filter((s) => s.attempts > 0 || (!s.empty && s.masteryScore > 0));
  const strengths = practiced
    .filter((s) => s.masteryScore >= STRONG_THRESHOLD)
    .sort((a, b) => b.masteryScore - a.masteryScore)
    .slice(0, 3)
    .map((s) => ({ skillKey: s.skillKey, label: s.label, masteryScore: Math.round(s.masteryScore) }));

  const openMistakeMap = new Map(
    inputs.openMistakesBySkill.map((r) => [String(r.skill_key), Number(r.open_count || 0)])
  );
  const openMistakesTotal = [...openMistakeMap.values()].reduce((a, b) => a + b, 0);

  const weaknesses = practiced
    .filter((s) => s.masteryScore < WEAK_THRESHOLD || (openMistakeMap.get(s.skillKey) || 0) >= 2)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, 3)
    .map((s) => ({
      skillKey: s.skillKey,
      label: s.label,
      masteryScore: Math.round(s.masteryScore),
      openMistakes: openMistakeMap.get(s.skillKey) || 0,
    }));

  let totalAttempts = 0;
  let totalCorrect = 0;
  for (const s of practiced) {
    totalAttempts += s.attempts;
    totalCorrect += s.correct;
  }
  const overallAccuracyPct =
    totalAttempts >= MIN_ATTEMPTS_FOR_ACCURACY
      ? clampPct((totalCorrect / totalAttempts) * 100)
      : null;

  // 7-day activity (lessons + attempts + xp)
  const days7 = lastNDates(7, tz);
  const lessonMap = new Map();
  for (const r of inputs.lessonDays) {
    const d = r.d instanceof Date ? ymdInTimezone(r.d, tz) : String(r.d).slice(0, 10);
    lessonMap.set(d, Number(r.lessons || 0));
  }
  const attemptMap = new Map();
  for (const r of inputs.attemptDays) {
    const d = r.d instanceof Date ? ymdInTimezone(r.d, tz) : String(r.d).slice(0, 10);
    attemptMap.set(d, {
      attempts: Number(r.attempts || 0),
      correct: Number(r.correct_n || 0),
    });
  }
  const xpMap = new Map();
  for (const r of inputs.dailyProgRows) {
    const d =
      r.progress_date instanceof Date
        ? ymdInTimezone(r.progress_date, tz)
        : String(r.progress_date).slice(0, 10);
    xpMap.set(d, Number(r.xp_earned || 0));
  }

  const activity7d = days7.map((date) => {
    const lessons = lessonMap.get(date) || 0;
    const att = attemptMap.get(date) || { attempts: 0, correct: 0 };
    const xp = xpMap.get(date) || 0;
    return {
      date,
      lessons,
      attempts: att.attempts,
      xp,
      active: lessons > 0 || att.attempts > 0 || xp > 0,
    };
  });
  const activeDays7 = activity7d.filter((d) => d.active).length;

  // Trend from last 3 days vs prior 3 days accuracy (attempts)
  const days14 = lastNDates(14, tz);
  const recent3 = days14.slice(-3);
  const prior3 = days14.slice(-6, -3);
  function accFor(days) {
    let a = 0;
    let c = 0;
    for (const d of days) {
      const row = attemptMap.get(d);
      if (!row) continue;
      a += row.attempts;
      c += row.correct;
    }
    if (a < 5) return null;
    return (c / a) * 100;
  }
  const recentAcc = accFor(recent3);
  const priorAcc = accFor(prior3);
  let trend = "insufficient_data";
  let trendDelta = null;
  if (recentAcc != null && priorAcc != null) {
    trendDelta = Math.round((recentAcc - priorAcc) * 10) / 10;
    if (trendDelta >= 5) trend = "improving";
    else if (trendDelta <= -5) trend = "declining";
    else trend = "stable";
  } else if (overallAccuracyPct != null && practiced.length >= 2) {
    // Fallback: mastery phases — more MASTERED/REVIEW than LEARNING → improving-ish stable
    const strongCount = practiced.filter((s) => s.masteryScore >= STRONG_THRESHOLD).length;
    const weakCount = practiced.filter((s) => s.masteryScore < WEAK_THRESHOLD).length;
    if (strongCount > weakCount) trend = "improving";
    else if (weakCount > strongCount + 1) trend = "declining";
    else trend = "stable";
  }

  let placement = null;
  if (inputs.placement) {
    let weakSkills = [];
    let strengthsPl = [];
    try {
      const w = inputs.placement.weak_skills_json;
      weakSkills = typeof w === "string" ? JSON.parse(w) : w || [];
    } catch {
      weakSkills = [];
    }
    try {
      const s = inputs.placement.strengths_json;
      strengthsPl = typeof s === "string" ? JSON.parse(s) : s || [];
    } catch {
      strengthsPl = [];
    }
    placement = {
      estimatedLevel: String(inputs.placement.estimated_level || ""),
      score: Number(inputs.placement.placement_score || 0),
      weakSkills: Array.isArray(weakSkills) ? weakSkills.map(String) : [],
      strengths: Array.isArray(strengthsPl) ? strengthsPl.map(String) : [],
    };
  }

  const reviewsCompletedApprox = inputs.resolvedMistakes; // recovery completions proxy
  // SRS reviews aren't in lesson progress — expose due count as review signal
  const dataSparse =
    inputs.completedCount === 0 &&
    practiced.length === 0 &&
    totalAttempts === 0 &&
    inputs.srsDue === 0;

  return {
    overview: {
      pathProgressPct,
      lessonsCompleted: inputs.completedCount,
      lessonsTotal: inputs.totalLessons,
      reviewsRecovered: reviewsCompletedApprox,
      srsDue: inputs.srsDue,
      openMistakes: openMistakesTotal,
      xpTotal: Number(inputs.pathState.stats?.xp_total || 0),
      honeyTotal: Number(inputs.pathState.stats?.honey_total || 0),
      streak: Number(inputs.daily?.streak || 0),
      xpToday: Number(inputs.daily?.xp_today || 0),
      dailyGoalXp: Number(inputs.daily?.daily_goal_xp || 30),
      dailyGoalCompleted: Boolean(inputs.daily?.daily_goal_completed),
      dailyGoalProgressPct: Number(inputs.daily?.daily_goal_progress_pct || 0),
      overallAccuracyPct,
      trend,
      trendDelta,
      activeDays7,
      dataSparse,
    },
    skills,
    strengths,
    weaknesses,
    activity7d,
    placement,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic, explainable insights — no AI fabrication.
 * @param {ReturnType<typeof buildAnalyticsModel>} model
 */
export function buildPersonalInsights(model) {
  const insights = [];
  const o = model.overview;

  if (o.dataSparse) {
    return [
      {
        code: "INSUFFICIENT_DATA",
        severity: "info",
        text: "Chưa đủ dữ liệu học tập — hoàn thành vài bài để xem tiến độ chi tiết.",
        skillKey: null,
      },
    ];
  }

  // Improving skill: highest mastery among practiced with recent signal
  const improving = [...model.skills]
    .filter((s) => s.attempts >= 5 && s.masteryScore >= 60 && s.accuracyPct >= 70)
    .sort((a, b) => b.masteryScore - a.masteryScore)[0];
  if (improving && (o.trend === "improving" || improving.masteryScore >= STRONG_THRESHOLD)) {
    insights.push({
      code: "SKILL_IMPROVING",
      severity: "positive",
      text: `${improving.label} đang tiến bộ`,
      skillKey: improving.skillKey,
    });
  }

  const weak = model.weaknesses[0];
  if (weak) {
    insights.push({
      code: "SKILL_NEEDS_PRACTICE",
      severity: "action",
      text: `${weak.label} cần luyện thêm`,
      skillKey: weak.skillKey,
    });
  }

  if (o.srsDue > 0) {
    insights.push({
      code: "SRS_DUE",
      severity: "action",
      text: `${o.srsDue} từ đang đến hạn ôn`,
      skillKey: "vocabulary",
    });
  }

  if (o.streak >= MIN_DAYS_FOR_STREAK_INSIGHT) {
    insights.push({
      code: "STREAK_CONSISTENT",
      severity: "positive",
      text: `Bạn học đều ${o.streak} ngày`,
      skillKey: null,
    });
  } else if (o.activeDays7 >= 4) {
    insights.push({
      code: "ACTIVE_WEEK",
      severity: "positive",
      text: `Bạn học đều ${o.activeDays7} ngày trong tuần này`,
      skillKey: null,
    });
  }

  if (o.openMistakes >= 3) {
    insights.push({
      code: "OPEN_MISTAKES",
      severity: "action",
      text: `${o.openMistakes} lỗi chưa sửa — nên luyện lại`,
      skillKey: null,
    });
  }

  if (o.trend === "declining" && o.trendDelta != null) {
    insights.push({
      code: "TREND_DECLINING",
      severity: "warn",
      text: "Độ chính xác gần đây đang giảm — nên ôn điểm yếu",
      skillKey: null,
    });
  } else if (o.trend === "improving" && o.trendDelta != null) {
    insights.push({
      code: "TREND_IMPROVING",
      severity: "positive",
      text: "Xu hướng học đang cải thiện",
      skillKey: null,
    });
  }

  if (!o.dailyGoalCompleted && o.xpToday > 0 && o.dailyGoalProgressPct >= 50) {
    insights.push({
      code: "DAILY_GOAL_NEAR",
      severity: "info",
      text: `Daily Goal còn ${Math.max(0, o.dailyGoalXp - o.xpToday)} XP nữa`,
      skillKey: null,
    });
  }

  if (model.placement?.estimatedLevel) {
    insights.push({
      code: "PLACEMENT_LEVEL",
      severity: "info",
      text: `Mức Placement: ${model.placement.estimatedLevel}`,
      skillKey: null,
    });
  }

  // Cap + stable order by severity weight then code
  const weight = { action: 1, warn: 2, positive: 3, info: 4 };
  insights.sort((a, b) => {
    const wa = weight[a.severity] || 9;
    const wb = weight[b.severity] || 9;
    if (wa !== wb) return wa - wb;
    return String(a.code).localeCompare(String(b.code));
  });

  return insights.slice(0, 6);
}

/**
 * @param {number} userId
 * @param {{ bypassCache?: boolean }} [opts]
 */
export async function getLearnAnalytics(userId, opts = {}) {
  await ensureAnalyticsTables();
  const inputs = await loadAnalyticsInputs(userId);

  const fp = fingerprint({
    completed: inputs.completedCount,
    active: inputs.pathState.activeLessonId,
    srs: inputs.srsDue,
    mistakes: inputs.openMistakesBySkill.map((r) => `${r.skill_key}:${r.open_count}`).join(","),
    mastery: inputs.masteryRows
      .map((r) => `${r.skill_key}:${Math.round(Number(r.mastery_score))}`)
      .join(","),
    xpToday: Number(inputs.daily?.xp_today || 0),
    streak: Number(inputs.daily?.streak || 0),
    goalDone: Boolean(inputs.daily?.daily_goal_completed),
    attemptDays: inputs.attemptDays.length,
    lessonDays: inputs.lessonDays.length,
  });

  if (!opts.bypassCache) {
    const [cached] = await pool.query(
      `SELECT payload_json, input_fingerprint, expires_at
       FROM user_learn_analytics_cache WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const row = cached[0];
    if (
      row &&
      String(row.input_fingerprint) === fp &&
      row.expires_at &&
      new Date(row.expires_at).getTime() > Date.now()
    ) {
      const payload =
        typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
      return { ...payload, cached: true };
    }
  }

  const analytics = buildAnalyticsModel(inputs);
  const insights = buildPersonalInsights(analytics);
  const result = {
    analytics,
    insights,
    recommendationsHref: "/?focus=today",
    cached: false,
  };

  const expires = new Date(Date.now() + CACHE_TTL_SEC * 1000);
  await pool.query(
    `INSERT INTO user_learn_analytics_cache (user_id, payload_json, input_fingerprint, expires_at)
     VALUES (?, CAST(? AS JSON), ?, ?)
     ON DUPLICATE KEY UPDATE
       payload_json = VALUES(payload_json),
       input_fingerprint = VALUES(input_fingerprint),
       expires_at = VALUES(expires_at),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify(result), fp, expires]
  );

  return result;
}
