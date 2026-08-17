import pool from "@/lib/db";
import { ensureRoleSchema } from "@/lib/auth/ensure-role-schema";
import { ensureGoogleAuthColumns } from "@/lib/auth/ensure-google-auth-columns";
import { ensureSubscriptionTables, type UserPlanState } from "@/lib/subscriptions/subscription-service";
import { ensureUserStatsTables } from "@/lib/srs/ensure-stats";
import { ensureUserWordProgressTable } from "@/lib/srs/ensure-schema";
import { ensureChatLogTable } from "@/lib/data/lesson-chat-logs";

function planStateFromRow(r: Record<string, unknown>): UserPlanState {
  const now = Date.now();
  const expires = r.expires_at ? new Date(String(r.expires_at)).getTime() : 0;
  const trialEnd = r.trial_end_at ? new Date(String(r.trial_end_at)).getTime() : 0;
  const plan = String(r.plan || "free");
  if (expires > now && (plan === "pro" || plan === "vip")) return plan as UserPlanState;
  if (trialEnd > now) return "trial";
  return "expired";
}

export type UserFilter =
  | "all"
  | "new"
  | "activated"
  | "not_activated"
  | "trial"
  | "paid"
  | "expired"
  | "inactive_7d";

function filterClause(filter: UserFilter): string {
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

export async function listAdminUsers(params: {
  q?: string;
  filter?: UserFilter;
  page?: number;
  limit?: number;
}) {
  await ensureRoleSchema();
  await ensureGoogleAuthColumns();
  await ensureSubscriptionTables();
  await ensureUserStatsTables();
  await ensureUserWordProgressTable();
  await ensureChatLogTable();

  const q = String(params.q || "")
    .trim()
    .toLowerCase();
  const filter = (params.filter || "all") as UserFilter;
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(100, Math.max(5, Number(params.limit || 20)));
  const offset = (page - 1) * limit;
  const fClause = filterClause(filter);

  const searchClause =
    q === ""
      ? ""
      : ` AND (
          LOWER(u.name) LIKE CONCAT('%', ?, '%')
          OR LOWER(IFNULL(u.email,'')) LIKE CONCAT('%', ?, '%')
          OR IFNULL(u.phone,'') LIKE CONCAT('%', ?, '%')
        )`;
  const searchParams = q === "" ? [] : [q, q, q];

  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT u.id) AS total
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE 1=1 ${searchClause} ${fClause}`,
    searchParams
  );
  const total = Number((countRows as { total: number }[])[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT
       u.id, u.name, u.email, u.phone, u.role, u.is_active, u.created_at, u.last_login_at,
       s.plan, s.trial_end_at, s.expires_at, s.subscribed_at,
       COALESCE(st.current_streak, 0) AS streak,
       COALESCE(st.xp_total, 0) AS xp_total,
       (SELECT COUNT(*) FROM user_word_progress p WHERE p.user_id = u.id) AS words_learned,
       (SELECT COUNT(*) FROM lesson_chat_logs l WHERE l.user_id = u.id) AS ai_call_sessions,
       (SELECT MAX(e.created_at) FROM user_review_events e WHERE e.user_id = u.id) AS last_study_at,
       (SELECT COUNT(*) FROM vocabulary v WHERE v.level = 'beginner' AND v.word IS NOT NULL AND TRIM(v.word) <> '') AS total_words
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     LEFT JOIN user_stats st ON st.user_id = u.id
     WHERE 1=1 ${searchClause} ${fClause}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...searchParams, limit, offset]
  );

  const items = (rows as Record<string, unknown>[]).map((r) => {
    const planState = planStateFromRow(r);
    const totalWords = Number(r.total_words || 0);
    const wordsLearned = Number(r.words_learned || 0);
    const progressPct = totalWords > 0 ? Math.round((wordsLearned / totalWords) * 100) : 0;
    const activated = planState !== "expired";
    return {
      id: Number(r.id),
      name: String(r.name || ""),
      email: r.email != null ? String(r.email) : null,
      phone: r.phone != null ? String(r.phone) : null,
      role: String(r.role || "user"),
      status: Number(r.is_active) === 1 ? "active" : "blocked",
      plan: String(r.plan || "free"),
      plan_state: planState as UserPlanState,
      activated,
      created_at: r.created_at,
      last_login_at: r.last_login_at,
      last_study_at: r.last_study_at,
      streak: Number(r.streak || 0),
      progress_pct: progressPct,
      words_learned: wordsLearned,
      ai_call_sessions: Number(r.ai_call_sessions || 0),
      xp_total: Number(r.xp_total || 0),
    };
  });

  return { items, total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getAdminUserDetail(userId: number) {
  await ensureRoleSchema();
  await ensureGoogleAuthColumns();
  await ensureSubscriptionTables();
  await ensureUserStatsTables();
  await ensureUserWordProgressTable();
  await ensureChatLogTable();

  const [userRows] = await pool.query(
    `SELECT u.*, s.plan, s.trial_start_at, s.trial_end_at, s.expires_at, s.subscribed_at
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  const u = (userRows as Record<string, unknown>[])[0];
  if (!u) return null;

  const [statsRows] = await pool.query(
    "SELECT xp_total, current_streak, longest_streak FROM user_stats WHERE user_id = ? LIMIT 1",
    [userId]
  );
  const stats = (statsRows as Record<string, unknown>[])[0] || {};

  const [wordsRows] = await pool.query(
    `SELECT COUNT(*) AS learned FROM user_word_progress WHERE user_id = ?`,
    [userId]
  );

  const [reviewRows] = await pool.query(
    `SELECT COUNT(*) AS due FROM user_word_progress p
     WHERE p.user_id = ? AND p.next_review_at IS NOT NULL AND p.next_review_at <= NOW()`,
    [userId]
  );

  const [weakRows] = await pool.query(
    `SELECT v.word, COUNT(*) AS attempts,
            ROUND(SUM(CASE WHEN e.is_correct = 1 THEN 1 ELSE 0 END) / COUNT(*) * 100) AS correct_rate
     FROM user_events e
     INNER JOIN vocabulary v ON v.id = e.word_id
     WHERE e.user_id = ? AND e.event_type = 'quiz_answer'
     GROUP BY v.id, v.word
     HAVING COUNT(*) >= 2
     ORDER BY correct_rate ASC, attempts DESC
     LIMIT 10`,
    [userId]
  );

  const [aiRows] = await pool.query(
    `SELECT id, source, message, pronunciation_score, created_at
     FROM lesson_chat_logs WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 15`,
    [userId]
  );

  const [recentStudy] = await pool.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS sessions, SUM(xp_delta) AS xp
     FROM user_review_events WHERE user_id = ?
     GROUP BY DATE(created_at) ORDER BY day DESC LIMIT 14`,
    [userId]
  );

  const planState = planStateFromRow(u);

  return {
    user: {
      id: Number(u.id),
      name: String(u.name || ""),
      email: u.email != null ? String(u.email) : null,
      phone: u.phone != null ? String(u.phone) : null,
      role: String(u.role || "user"),
      status: Number(u.is_active) === 1 ? "active" : "blocked",
      avatar_url: u.avatar_url != null ? String(u.avatar_url) : null,
      auth_provider: u.auth_provider != null ? String(u.auth_provider) : "local",
      created_at: u.created_at,
      last_login_at: u.last_login_at,
    },
    subscription: {
      plan: String(u.plan || "free"),
      plan_state: planState,
      trial_end_at: u.trial_end_at,
      expires_at: u.expires_at,
      subscribed_at: u.subscribed_at,
    },
    stats: {
      xp_total: Number(stats.xp_total || 0),
      streak: Number(stats.current_streak || 0),
      longest_streak: Number(stats.longest_streak || 0),
      words_learned: Number((wordsRows as { learned: number }[])[0]?.learned || 0),
      review_due: Number((reviewRows as { due: number }[])[0]?.due || 0),
    },
    weak_words: weakRows,
    ai_sessions: aiRows,
    study_history: recentStudy,
  };
}

export async function getAdminOverview() {
  await ensureSubscriptionTables();
  await ensureRoleSchema();

  const [[users]] = await pool.query(`SELECT COUNT(*) AS total FROM users`);
  const [[today]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users WHERE DATE(created_at) = CURDATE()`
  );
  const [[active]] = await pool.query(
    `SELECT COUNT(DISTINCT user_id) AS total FROM user_sessions WHERE expires_at > NOW()`
  );
  const [[trial]] = await pool.query(
    `SELECT COUNT(*) AS total FROM subscriptions WHERE trial_end_at > NOW() AND (expires_at IS NULL OR expires_at <= NOW())`
  );
  const [[paid]] = await pool.query(
    `SELECT COUNT(*) AS total FROM subscriptions WHERE expires_at > NOW() AND plan IN ('pro','vip')`
  );
  const [[expired]] = await pool.query(
    `SELECT COUNT(*) AS total FROM subscriptions s
     WHERE NOT (
       (s.expires_at IS NOT NULL AND s.expires_at > NOW())
       OR (s.trial_end_at IS NOT NULL AND s.trial_end_at > NOW())
     )`
  );
  const [[inactive]] = await pool.query(
    `SELECT COUNT(*) AS total FROM users u
     WHERE NOT EXISTS (
       SELECT 1 FROM user_review_events e
       WHERE e.user_id = u.id AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     )`
  );
  const [[pendingPay]] = await pool.query(
    `SELECT COUNT(*) AS total FROM payments WHERE status = 'pending'`
  ).catch(() => [[{ total: 0 }]]);

  return {
    total_users: Number(users?.total || 0),
    registered_today: Number(today?.total || 0),
    active_sessions: Number(active?.total || 0),
    trial_users: Number(trial?.total || 0),
    paid_users: Number(paid?.total || 0),
    expired_users: Number(expired?.total || 0),
    inactive_7d: Number(inactive?.total || 0),
    pending_payments: Number(pendingPay?.total || 0),
  };
}
