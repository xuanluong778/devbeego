import pool from "@/lib/db";
import { ensurePathAdminSchema, LESSON_COMPLETION_RULE_VI } from "@/lib/admin/ensure-path-admin-schema";
import { writeAdminAuditLog } from "@/lib/admin/audit-log";
import { getPathTemplate, type PathTemplateItemInput } from "@/lib/admin/path-template-service";
import { catalogLessonMeta } from "@/lib/admin/path-catalog";

export type LessonProgressStatus = "not_started" | "in_progress" | "completed";

async function loadProgressContext(userId: number) {
  const [progRows] = await pool.query(
    `SELECT lesson_id, status, score, completed_at, updated_at
     FROM user_lesson_progress WHERE user_id = ?`,
    [userId]
  );
  const completed = new Map<string, { score: number | null; completedAt: unknown }>();
  for (const row of progRows as Record<string, unknown>[]) {
    if (String(row.status) === "completed") {
      completed.set(String(row.lesson_id), {
        score: row.score == null ? null : Number(row.score),
        completedAt: row.completed_at,
      });
    }
  }
  const [statsRows] = await pool.query(
    `SELECT active_lesson_id, last_answer_at FROM user_stats WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const activeLessonId = statsRows[0]?.active_lesson_id
    ? String((statsRows as Record<string, unknown>[])[0].active_lesson_id)
    : null;
  const lastStudyAt = (statsRows as Record<string, unknown>[])[0]?.last_answer_at ?? null;

  const [attemptRows] = await pool.query(
    `SELECT lesson_id, COUNT(*) AS c, MAX(created_at) AS last_attempt
     FROM user_learn_exercise_attempts WHERE user_id = ?
     GROUP BY lesson_id`,
    [userId]
  );
  const attempts = new Map<string, { count: number; lastAttempt: unknown }>();
  for (const row of attemptRows as Record<string, unknown>[]) {
    attempts.set(String(row.lesson_id), {
      count: Number(row.c || 0),
      lastAttempt: row.last_attempt,
    });
  }
  return { completed, activeLessonId, lastStudyAt, attempts };
}

function lessonStatus(
  lessonId: string,
  ctx: Awaited<ReturnType<typeof loadProgressContext>>
): LessonProgressStatus {
  if (ctx.completed.has(lessonId)) return "completed";
  if (ctx.activeLessonId === lessonId) return "in_progress";
  const att = ctx.attempts.get(lessonId);
  if (att && att.count > 0) return "in_progress";
  return "not_started";
}

function statusLabelVi(status: LessonProgressStatus) {
  if (status === "completed") return "Hoàn thành";
  if (status === "in_progress") return "Đang học";
  return "Chưa học";
}

async function loadAssignmentItems(assignmentId: number) {
  const [rows] = await pool.query(
    `SELECT * FROM admin_student_path_items WHERE assignment_id = ? ORDER BY sort_index ASC, id ASC`,
    [assignmentId]
  );
  return rows as Record<string, unknown>[];
}

async function getActiveAssignment(studentUserId: number) {
  await ensurePathAdminSchema();
  const [rows] = await pool.query(
    `SELECT * FROM admin_student_path_assignments
     WHERE student_user_id = ? AND status = 'active'
     ORDER BY assigned_at DESC LIMIT 1`,
    [studentUserId]
  );
  return (rows as Record<string, unknown>[])[0] || null;
}

export async function getStudentLearningPathView(studentUserId: number) {
  await ensurePathAdminSchema();
  const assignment = await getActiveAssignment(studentUserId);
  const ctx = await loadProgressContext(studentUserId);

  if (!assignment) {
    return {
      hasAssignment: false,
      completionRule: LESSON_COMPLETION_RULE_VI,
      summary: null,
      items: [],
      exams: [],
      lastStudyAt: ctx.lastStudyAt,
    };
  }

  const assignmentId = Number(assignment.id);
  const itemRows = await loadAssignmentItems(assignmentId);
  const enabled = itemRows.filter((r) => Number(r.is_disabled) !== 1);

  let completedCount = 0;
  let inProgressCount = 0;
  const items = enabled.map((row) => {
    const lessonId = String(row.lesson_id);
    const status = lessonStatus(lessonId, ctx);
    if (status === "completed") completedCount += 1;
    if (status === "in_progress") inProgressCount += 1;
    const done = ctx.completed.get(lessonId);
    const att = ctx.attempts.get(lessonId);
    return {
      id: Number(row.id),
      sortIndex: Number(row.sort_index),
      gateNumber: Number(row.gate_number),
      chapterTitle: String(row.chapter_title),
      lessonId,
      itemType: String(row.item_type) as "lesson" | "exam",
      title: String(row.title),
      required: Number(row.required) === 1,
      isCustom: Number(row.is_custom) === 1,
      status,
      statusLabel: statusLabelVi(status),
      score: done?.score ?? null,
      completedAt: done?.completedAt ?? null,
      lastAttemptAt: att?.lastAttempt ?? null,
    };
  });

  const total = items.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  const exams = items.filter((i) => i.itemType === "exam");

  let templateUpdateAvailable = false;
  let latestTemplateVersion: number | null = null;
  if (assignment.template_id != null) {
    const tpl = await getPathTemplate(Number(assignment.template_id));
    if (tpl?.status === "published") {
      latestTemplateVersion = tpl.version;
      templateUpdateAvailable = tpl.version > Number(assignment.template_version || 0);
    }
  }

  return {
    hasAssignment: true,
    completionRule: LESSON_COMPLETION_RULE_VI,
    assignment: {
      id: assignmentId,
      templateId: assignment.template_id != null ? Number(assignment.template_id) : null,
      templateVersion: assignment.template_version != null ? Number(assignment.template_version) : null,
      title: String(assignment.snapshot_title),
      goalText: assignment.goal_text != null ? String(assignment.goal_text) : null,
      dueAt: assignment.due_at,
      assignedAt: assignment.assigned_at,
    },
    summary: {
      total,
      completedCount,
      inProgressCount,
      notStartedCount: total - completedCount - inProgressCount,
      progressPct,
      lastStudyAt: ctx.lastStudyAt,
    },
    items,
    exams,
    templateUpdateAvailable,
    latestTemplateVersion,
  };
}

async function copyTemplateItemsToAssignment(
  assignmentId: number,
  templateItems: NonNullable<Awaited<ReturnType<typeof getPathTemplate>>>["items"]
) {
  await pool.query(`DELETE FROM admin_student_path_items WHERE assignment_id = ?`, [assignmentId]);
  for (const item of templateItems) {
    await pool.query(
      `INSERT INTO admin_student_path_items
       (assignment_id, sort_index, gate_number, chapter_title, lesson_id, item_type, title, required, is_disabled, is_custom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        assignmentId,
        item.sortIndex,
        item.gateNumber,
        item.chapterTitle,
        item.lessonId,
        item.itemType,
        item.title,
        item.required ? 1 : 0,
      ]
    );
  }
}

export async function assignPathToStudent(params: {
  studentUserId: number;
  templateId: number;
  actorUserId: number;
  goalText?: string;
  dueAt?: string | null;
}) {
  await ensurePathAdminSchema();
  const tpl = await getPathTemplate(params.templateId);
  if (!tpl || tpl.status !== "published") {
    return { ok: false as const, code: "TEMPLATE_NOT_PUBLISHED", message: "Chỉ gán lộ trình đã xuất bản." };
  }

  await pool.query(
    `UPDATE admin_student_path_assignments SET status = 'archived' WHERE student_user_id = ? AND status = 'active'`,
    [params.studentUserId]
  );

  const [ins] = await pool.query(
    `INSERT INTO admin_student_path_assignments
     (student_user_id, template_id, template_version, snapshot_title, goal_text, due_at, assigned_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.studentUserId,
      tpl.id,
      tpl.version,
      tpl.title,
      params.goalText ? String(params.goalText).slice(0, 500) : null,
      params.dueAt || null,
      params.actorUserId,
    ]
  );
  const assignmentId = Number((ins as { insertId?: number }).insertId);
  await copyTemplateItemsToAssignment(assignmentId, tpl.items);

  await writeAdminAuditLog({
    actorUserId: params.actorUserId,
    targetUserId: params.studentUserId,
    action: "student_path.assign",
    meta: { template_id: tpl.id, template_version: tpl.version, assignment_id: assignmentId },
  });
  return { ok: true as const, assignmentId };
}

export async function updateStudentPathPersonal(params: {
  studentUserId: number;
  assignmentId: number;
  actorUserId: number;
  reason: string;
  goalText?: string | null;
  dueAt?: string | null;
  disableLessonIds?: string[];
  addItems?: PathTemplateItemInput[];
}) {
  await ensurePathAdminSchema();
  const reason = String(params.reason || "").trim();
  if (!reason) return { ok: false as const, code: "REASON_REQUIRED" };

  const [assignRows] = await pool.query(
    `SELECT * FROM admin_student_path_assignments
     WHERE id = ? AND student_user_id = ? AND status = 'active' LIMIT 1`,
    [params.assignmentId, params.studentUserId]
  );
  if (!(assignRows as unknown[]).length) return { ok: false as const, code: "NOT_FOUND" };

  if (params.goalText !== undefined || params.dueAt !== undefined) {
    await pool.query(
      `UPDATE admin_student_path_assignments SET goal_text = ?, due_at = ? WHERE id = ?`,
      [
        params.goalText != null ? String(params.goalText).slice(0, 500) : null,
        params.dueAt ?? null,
        params.assignmentId,
      ]
    );
  }

  for (const lessonId of params.disableLessonIds || []) {
    await pool.query(
      `UPDATE admin_student_path_items SET is_disabled = 1 WHERE assignment_id = ? AND lesson_id = ?`,
      [params.assignmentId, lessonId]
    );
  }

  if (params.addItems?.length) {
    const [maxRow] = await pool.query(
      `SELECT COALESCE(MAX(sort_index), 0) AS m FROM admin_student_path_items WHERE assignment_id = ?`,
      [params.assignmentId]
    );
    let sort = Number((maxRow as { m: number }[])[0]?.m || 0);
    for (const raw of params.addItems) {
      const lessonId = String(raw.lessonId || "").trim();
      const meta = catalogLessonMeta(lessonId);
      if (!meta) continue;
      sort += 1;
      await pool.query(
        `INSERT INTO admin_student_path_items
         (assignment_id, sort_index, gate_number, chapter_title, lesson_id, item_type, title, required, is_disabled, is_custom)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
         ON DUPLICATE KEY UPDATE is_disabled = 0, is_custom = 1`,
        [
          params.assignmentId,
          sort,
          meta.chapter.gateNumber,
          meta.chapter.chapterTitle,
          lessonId,
          meta.lesson.itemType,
          meta.lesson.title,
          raw.required !== false ? 1 : 0,
        ]
      );
    }
  }

  await writeAdminAuditLog({
    actorUserId: params.actorUserId,
    targetUserId: params.studentUserId,
    action: "student_path.personal_update",
    reason,
    meta: { assignment_id: params.assignmentId },
  });
  return { ok: true as const };
}

export async function applyPublishedTemplateToAssignment(params: {
  studentUserId: number;
  assignmentId: number;
  actorUserId: number;
  reason: string;
}) {
  await ensurePathAdminSchema();
  const reason = String(params.reason || "").trim();
  if (!reason) return { ok: false as const, code: "REASON_REQUIRED" };

  const [assignRows] = await pool.query(
    `SELECT * FROM admin_student_path_assignments
     WHERE id = ? AND student_user_id = ? AND status = 'active' LIMIT 1`,
    [params.assignmentId, params.studentUserId]
  );
  const assignment = (assignRows as Record<string, unknown>[])[0];
  if (!assignment) return { ok: false as const, code: "NOT_FOUND" };
  const templateId = Number(assignment.template_id);
  if (!templateId) return { ok: false as const, code: "NO_TEMPLATE" };

  const tpl = await getPathTemplate(templateId);
  if (!tpl || tpl.status !== "published") {
    return { ok: false as const, code: "TEMPLATE_NOT_PUBLISHED" };
  }

  const ctx = await loadProgressContext(params.studentUserId);
  const existing = await loadAssignmentItems(params.assignmentId);
  const existingIds = new Set(existing.map((r) => String(r.lesson_id)));

  let added = 0;
  let sort = existing.length
    ? Math.max(...existing.map((r) => Number(r.sort_index)))
    : 0;
  for (const item of tpl.items) {
    if (existingIds.has(item.lessonId)) continue;
    sort += 1;
    added += 1;
    await pool.query(
      `INSERT INTO admin_student_path_items
       (assignment_id, sort_index, gate_number, chapter_title, lesson_id, item_type, title, required, is_disabled, is_custom)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        params.assignmentId,
        sort,
        item.gateNumber,
        item.chapterTitle,
        item.lessonId,
        item.itemType,
        item.title,
        item.required ? 1 : 0,
      ]
    );
  }

  await pool.query(
    `UPDATE admin_student_path_assignments SET template_version = ?, snapshot_title = ? WHERE id = ?`,
    [tpl.version, tpl.title, params.assignmentId]
  );

  await writeAdminAuditLog({
    actorUserId: params.actorUserId,
    targetUserId: params.studentUserId,
    action: "student_path.apply_template_update",
    reason,
    meta: {
      assignment_id: params.assignmentId,
      template_id: templateId,
      template_version: tpl.version,
      added_items: added,
      preserved_completed: ctx.completed.size,
    },
  });
  return { ok: true as const, addedItems: added, templateVersion: tpl.version };
}
