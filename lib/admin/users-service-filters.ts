/** Tách bộ lọc gói học — dùng chung users-service và student-admin. */

export type UserFilter =
  | "all"
  | "new"
  | "activated"
  | "not_activated"
  | "trial"
  | "paid"
  | "expired"
  | "inactive_7d";

export function filterClause(filter: UserFilter): string {
  switch (filter) {
    case "new":
      return " AND u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    case "activated":
      return ` AND (
        (s.expires_at IS NOT NULL AND s.expires_at > NOW())
        OR (s.trial_end_at IS NOT NULL AND s.trial_end_at > NOW())
      )`;
    case "not_activated":
      return ` AND NOT (
        (s.expires_at IS NOT NULL AND s.expires_at > NOW())
        OR (s.trial_end_at IS NOT NULL AND s.trial_end_at > NOW())
      )`;
    case "trial":
      return " AND s.trial_end_at > NOW() AND (s.expires_at IS NULL OR s.expires_at <= NOW())";
    case "paid":
      return " AND s.expires_at > NOW() AND s.plan IN ('pro','vip')";
    case "expired":
      return ` AND NOT (
        (s.expires_at IS NOT NULL AND s.expires_at > NOW())
        OR (s.trial_end_at IS NOT NULL AND s.trial_end_at > NOW())
      )`;
    case "inactive_7d":
      return ` AND NOT EXISTS (
        SELECT 1 FROM user_review_events e
        WHERE e.user_id = u.id AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      )`;
    default:
      return "";
  }
}
