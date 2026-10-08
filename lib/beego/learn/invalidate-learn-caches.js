/**
 * Invalidate short-lived Learn derived caches (Phase 10 + 11).
 * Call after complete / exercise / review / mastery updates.
 */
import { invalidateRecommendationCache } from "@/lib/beego/learn/recommendation-engine";
import { invalidateAnalyticsCache } from "@/lib/beego/learn/analytics-insights-engine";
import { invalidateAchievementsCache } from "@/lib/beego/learn/achievements-engine";

/**
 * @param {number} userId
 */
export async function invalidateLearnDerivedCaches(userId) {
  if (!userId) return;
  await Promise.all([
    invalidateRecommendationCache(userId),
    invalidateAnalyticsCache(userId),
    invalidateAchievementsCache(userId),
  ]);
}
