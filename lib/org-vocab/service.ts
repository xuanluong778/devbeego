import pool from "@/lib/db";
import { ensureOrgVocabSchema } from "@/lib/org-vocab/ensure-schema";
import { slugify } from "@/lib/org-vocab/access";
import type { AuthContext, ImportWordInput, OrgMemberRole } from "@/lib/org-vocab/types";
import { isOrgStaff } from "@/lib/org-vocab/access";

function num(v: unknown): number {
  return Number(v) || 0;
}

async function refreshSetWordCount(setId: number): Promise<void> {
  await pool.query(
    `UPDATE vocabulary_sets SET word_count = (
       SELECT COUNT(*) FROM vocabulary_set_words WHERE set_id = ?
     ), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [setId, setId]
  );
}

// ─── Organizations ───────────────────────────────────────────────

export async function listOrganizations(auth: AuthContext) {
  await ensureOrgVocabSchema();
  if (auth.isSystemAdmin) {
    const [rows] = await pool.query(
      `SELECT o.*, (SELECT COUNT(*) FROM organization_members om WHERE om.organization_id = o.id) AS member_count
       FROM organizations o ORDER BY o.name ASC`
    );
    return rows;
  }
  const [rows] = await pool.query(
    `SELECT o.*, om.role AS my_role
     FROM organizations o
     INNER JOIN organization_members om ON om.organization_id = o.id AND om.user_id = ?
     WHERE o.is_active = 1
     ORDER BY o.name ASC`,
    [auth.userId]
  );
  return rows;
}

export async function createOrganization(
  auth: AuthContext,
  input: { name: string; slug?: string }
) {
  if (!auth.isSystemAdmin) {
    throw new Error("FORBIDDEN");
  }
  await ensureOrgVocabSchema();
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("INVALID_NAME");
  const slug = input.slug?.trim() || slugify(name);
  const [result] = await pool.query(
    `INSERT INTO organizations (name, slug, created_by) VALUES (?, ?, ?)`,
    [name, slug || null, auth.userId]
  );
  const orgId = num((result as { insertId?: number }).insertId);
  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, 'owner')`,
    [orgId, auth.userId]
  );
  const [rows] = await pool.query(`SELECT * FROM organizations WHERE id = ? LIMIT 1`, [orgId]);
  return (rows as unknown[])?.[0];
}

export async function addOrganizationMember(
  auth: AuthContext,
  organizationId: number,
  input: { user_id: number; role?: OrgMemberRole }
) {
  if (!(await isOrgStaff(auth.userId, organizationId, auth.isSystemAdmin))) {
    throw new Error("FORBIDDEN");
  }
  const userId = num(input.user_id);
  const role = (input.role || "student") as OrgMemberRole;
  if (!userId) throw new Error("INVALID_USER");
  if (!["owner", "teacher", "student"].includes(role)) throw new Error("INVALID_ROLE");

  await pool.query(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [organizationId, userId, role]
  );
  return { organization_id: organizationId, user_id: userId, role };
}

export async function listOrganizationMembers(auth: AuthContext, organizationId: number) {
  if (!(await isOrgStaff(auth.userId, organizationId, auth.isSystemAdmin))) {
    throw new Error("FORBIDDEN");
  }
  const [rows] = await pool.query(
    `SELECT om.user_id, om.role, om.joined_at, u.name, u.email, u.phone
     FROM organization_members om
     INNER JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = ?
     ORDER BY om.role ASC, u.name ASC`,
    [organizationId]
  );
  return rows;
}

// ─── Classrooms ──────────────────────────────────────────────────

export async function listClassrooms(auth: AuthContext, organizationId?: number) {
  await ensureOrgVocabSchema();
  if (auth.isSystemAdmin) {
    const params: unknown[] = [];
    let sql = `SELECT c.*, o.name AS organization_name,
      (SELECT COUNT(*) FROM classroom_students cs WHERE cs.classroom_id = c.id) AS student_count
      FROM classrooms c INNER JOIN organizations o ON o.id = c.organization_id WHERE c.is_active = 1`;
    if (organizationId) {
      sql += ` AND c.organization_id = ?`;
      params.push(organizationId);
    }
    sql += ` ORDER BY c.name ASC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  const [rows] = await pool.query(
    `SELECT c.*, o.name AS organization_name,
      (SELECT COUNT(*) FROM classroom_students cs2 WHERE cs2.classroom_id = c.id) AS student_count,
      om.role AS my_role,
      CASE
        WHEN c.teacher_user_id = ? THEN 'teacher'
        WHEN om.role IN ('owner','teacher') THEN om.role
        ELSE 'student'
      END AS view_as
     FROM classrooms c
     INNER JOIN organizations o ON o.id = c.organization_id
     INNER JOIN organization_members om ON om.organization_id = c.organization_id AND om.user_id = ?
     WHERE c.is_active = 1
       AND (
         c.teacher_user_id = ?
         OR om.role IN ('owner','teacher')
         OR EXISTS (SELECT 1 FROM classroom_students cs WHERE cs.classroom_id = c.id AND cs.user_id = ?)
       )
       ${organizationId ? "AND c.organization_id = ?" : ""}
     ORDER BY c.name ASC`,
    organizationId
      ? [auth.userId, auth.userId, auth.userId, auth.userId, organizationId]
      : [auth.userId, auth.userId, auth.userId, auth.userId]
  );
  return rows;
}

export async function createClassroom(
  auth: AuthContext,
  input: { organization_id: number; name: string; description?: string; teacher_user_id?: number }
) {
  const orgId = num(input.organization_id);
  if (!(await isOrgStaff(auth.userId, orgId, auth.isSystemAdmin))) {
    throw new Error("FORBIDDEN");
  }
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("INVALID_NAME");
  const teacherId = num(input.teacher_user_id) || auth.userId;

  const [result] = await pool.query(
    `INSERT INTO classrooms (organization_id, name, description, teacher_user_id)
     VALUES (?, ?, ?, ?)`,
    [orgId, name, input.description?.trim() || null, teacherId]
  );
  const id = num((result as { insertId?: number }).insertId);
  const [rows] = await pool.query(`SELECT * FROM classrooms WHERE id = ? LIMIT 1`, [id]);
  return (rows as unknown[])?.[0];
}

export async function addClassroomStudents(
  auth: AuthContext,
  classroomId: number,
  userIds: number[]
) {
  const { canManageClassroom } = await import("@/lib/org-vocab/access");
  if (!(await canManageClassroom(auth, classroomId))) throw new Error("FORBIDDEN");

  const ids = userIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) throw new Error("INVALID_USERS");

  const cls = await pool.query(`SELECT organization_id FROM classrooms WHERE id = ? LIMIT 1`, [
    classroomId,
  ]);
  const orgId = num((cls[0] as { organization_id?: number }[])?.[0]?.organization_id);

  for (const userId of ids) {
    await pool.query(
      `INSERT IGNORE INTO classroom_students (classroom_id, user_id) VALUES (?, ?)`,
      [classroomId, userId]
    );
    if (orgId) {
      await pool.query(
        `INSERT INTO organization_members (organization_id, user_id, role)
         VALUES (?, ?, 'student')
         ON DUPLICATE KEY UPDATE role = IF(role = 'student', 'student', role)`,
        [orgId, userId]
      );
    }
  }
  return { classroom_id: classroomId, added: ids.length };
}

export async function listClassroomStudents(auth: AuthContext, classroomId: number) {
  const { canManageClassroom } = await import("@/lib/org-vocab/access");
  if (!(await canManageClassroom(auth, classroomId))) throw new Error("FORBIDDEN");
  const [rows] = await pool.query(
    `SELECT cs.user_id, cs.joined_at, u.name, u.email, u.phone
     FROM classroom_students cs
     INNER JOIN users u ON u.id = cs.user_id
     WHERE cs.classroom_id = ?
     ORDER BY u.name ASC`,
    [classroomId]
  );
  return rows;
}

// ─── Vocabulary Sets ───────────────────────────────────────────

export async function listVocabularySets(auth: AuthContext, organizationId?: number) {
  await ensureOrgVocabSchema();
  if (auth.isSystemAdmin) {
    const params: unknown[] = [];
    let sql = `SELECT vs.*, o.name AS organization_name FROM vocabulary_sets vs
      INNER JOIN organizations o ON o.id = vs.organization_id WHERE vs.is_active = 1`;
    if (organizationId) {
      sql += ` AND vs.organization_id = ?`;
      params.push(organizationId);
    }
    sql += ` ORDER BY vs.updated_at DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  const params: unknown[] = [auth.userId];
  let sql = `SELECT vs.*, o.name AS organization_name, om.role AS my_role
    FROM vocabulary_sets vs
    INNER JOIN organizations o ON o.id = vs.organization_id
    INNER JOIN organization_members om ON om.organization_id = vs.organization_id AND om.user_id = ?
    WHERE vs.is_active = 1 AND om.role IN ('owner','teacher')`;
  if (organizationId) {
    sql += ` AND vs.organization_id = ?`;
    params.push(organizationId);
  }
  sql += ` ORDER BY vs.updated_at DESC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function createVocabularySet(
  auth: AuthContext,
  input: {
    organization_id: number;
    title: string;
    description?: string;
    level?: string;
    topic?: string;
  }
) {
  const orgId = num(input.organization_id);
  if (!(await isOrgStaff(auth.userId, orgId, auth.isSystemAdmin))) {
    throw new Error("FORBIDDEN");
  }
  const title = String(input.title || "").trim();
  if (title.length < 2) throw new Error("INVALID_TITLE");

  const [result] = await pool.query(
    `INSERT INTO vocabulary_sets (organization_id, created_by, title, description, level, topic)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      orgId,
      auth.userId,
      title,
      input.description?.trim() || null,
      input.level?.trim() || "beginner",
      input.topic?.trim() || null,
    ]
  );
  const id = num((result as { insertId?: number }).insertId);
  const [rows] = await pool.query(`SELECT * FROM vocabulary_sets WHERE id = ? LIMIT 1`, [id]);
  return (rows as unknown[])?.[0];
}

export async function getVocabularySetWords(setId: number, auth?: AuthContext) {
  await ensureOrgVocabSchema();
  if (auth) {
    const { canViewVocabularySet } = await import("@/lib/org-vocab/access");
    if (!(await canViewVocabularySet(auth, setId))) throw new Error("FORBIDDEN");
  }
  const [rows] = await pool.query(
    `SELECT * FROM vocabulary_set_words WHERE set_id = ? ORDER BY sort_order ASC, id ASC`,
    [setId]
  );
  return rows;
}

export async function addVocabularySetWords(
  auth: AuthContext,
  setId: number,
  words: ImportWordInput[]
) {
  const { canManageVocabularySet } = await import("@/lib/org-vocab/access");
  if (!(await canManageVocabularySet(auth, setId))) throw new Error("FORBIDDEN");
  if (!words.length) throw new Error("EMPTY_WORDS");

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS c FROM vocabulary_set_words WHERE set_id = ?`,
    [setId]
  );
  let sortOrder = num((countRow as { c?: number })?.c);

  for (const w of words) {
    sortOrder += 1;
    await pool.query(
      `INSERT INTO vocabulary_set_words
        (set_id, word, meaning_vi, ipa, part_of_speech, example_sentence, example_vi, level, topic, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        setId,
        w.word,
        w.meaning_vi,
        w.ipa || null,
        w.part_of_speech || "other",
        w.example_sentence || null,
        w.example_vi || null,
        w.level || null,
        w.topic || null,
        sortOrder,
      ]
    );
  }
  await refreshSetWordCount(setId);
  return { set_id: setId, imported: words.length };
}

// ─── Assignments ─────────────────────────────────────────────────

export async function listAssignments(auth: AuthContext, filters: { classroom_id?: number } = {}) {
  await ensureOrgVocabSchema();

  if (auth.isSystemAdmin) {
    const params: unknown[] = [];
    let sql = `SELECT a.*, c.name AS classroom_name, vs.title AS set_title, vs.word_count,
      o.name AS organization_name
      FROM assignments a
      INNER JOIN classrooms c ON c.id = a.classroom_id
      INNER JOIN vocabulary_sets vs ON vs.id = a.set_id
      INNER JOIN organizations o ON o.id = a.organization_id
      WHERE a.is_active = 1`;
    if (filters.classroom_id) {
      sql += ` AND a.classroom_id = ?`;
      params.push(filters.classroom_id);
    }
    sql += ` ORDER BY a.created_at DESC`;
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  const [teacherRows] = await pool.query(
    `SELECT a.*, c.name AS classroom_name, vs.title AS set_title, vs.word_count,
      o.name AS organization_name, 'teacher' AS view_as
     FROM assignments a
     INNER JOIN classrooms c ON c.id = a.classroom_id
     INNER JOIN vocabulary_sets vs ON vs.id = a.set_id
     INNER JOIN organizations o ON o.id = a.organization_id
     INNER JOIN organization_members om ON om.organization_id = a.organization_id AND om.user_id = ?
     WHERE a.is_active = 1
       AND (c.teacher_user_id = ? OR om.role IN ('owner','teacher'))
       ${filters.classroom_id ? "AND a.classroom_id = ?" : ""}
     ORDER BY a.created_at DESC`,
    filters.classroom_id
      ? [auth.userId, auth.userId, filters.classroom_id]
      : [auth.userId, auth.userId]
  );

  const [studentRows] = await pool.query(
    `SELECT a.*, c.name AS classroom_name, vs.title AS set_title, vs.word_count,
      o.name AS organization_name, 'student' AS view_as,
      (SELECT COUNT(DISTINCT ar.set_word_id) FROM assignment_results ar
       WHERE ar.assignment_id = a.id AND ar.user_id = ?) AS words_studied,
      (SELECT COALESCE(SUM(s.duration_seconds), 0) FROM assignment_sessions s
       WHERE s.assignment_id = a.id AND s.user_id = ?) AS study_seconds
     FROM assignments a
     INNER JOIN classroom_students cs ON cs.classroom_id = a.classroom_id AND cs.user_id = ?
     INNER JOIN classrooms c ON c.id = a.classroom_id
     INNER JOIN vocabulary_sets vs ON vs.id = a.set_id
     INNER JOIN organizations o ON o.id = a.organization_id
     WHERE a.is_active = 1
       ${filters.classroom_id ? "AND a.classroom_id = ?" : ""}
     ORDER BY a.due_at IS NULL, a.due_at ASC, a.created_at DESC`,
    filters.classroom_id
      ? [auth.userId, auth.userId, auth.userId, filters.classroom_id]
      : [auth.userId, auth.userId, auth.userId]
  );

  const seen = new Set<number>();
  const merged = [];
  for (const row of [...(teacherRows as { id: number }[]), ...(studentRows as { id: number }[])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

export async function createAssignment(
  auth: AuthContext,
  input: {
    classroom_id: number;
    set_id: number;
    title: string;
    instructions?: string;
    due_at?: string | null;
  }
) {
  const { canManageClassroom, canManageVocabularySet } = await import("@/lib/org-vocab/access");
  const classroomId = num(input.classroom_id);
  const setId = num(input.set_id);
  if (!(await canManageClassroom(auth, classroomId))) throw new Error("FORBIDDEN");
  if (!(await canManageVocabularySet(auth, setId))) throw new Error("FORBIDDEN_SET");

  const [[clsRow]] = await pool.query(
    `SELECT organization_id FROM classrooms WHERE id = ? LIMIT 1`,
    [classroomId]
  );
  const orgId = num((clsRow as { organization_id?: number })?.organization_id);
  const title = String(input.title || "").trim();
  if (title.length < 2) throw new Error("INVALID_TITLE");

  const [result] = await pool.query(
    `INSERT INTO assignments (organization_id, classroom_id, set_id, assigned_by, title, instructions, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      orgId,
      classroomId,
      setId,
      auth.userId,
      title,
      input.instructions?.trim() || null,
      input.due_at || null,
    ]
  );
  const id = num((result as { insertId?: number }).insertId);
  const [rows] = await pool.query(
    `SELECT a.*, c.name AS classroom_name, vs.title AS set_title
     FROM assignments a
     INNER JOIN classrooms c ON c.id = a.classroom_id
     INNER JOIN vocabulary_sets vs ON vs.id = a.set_id
     WHERE a.id = ? LIMIT 1`,
    [id]
  );
  return (rows as unknown[])?.[0];
}

export async function recordAssignmentResult(
  auth: AuthContext,
  assignmentId: number,
  input: {
    set_word_id: number;
    is_correct: boolean;
    answer_type?: string;
    duration_seconds?: number;
    session_id?: string;
  }
) {
  const { canViewAssignment } = await import("@/lib/org-vocab/access");
  if (!(await canViewAssignment(auth, assignmentId))) throw new Error("FORBIDDEN");

  const setWordId = num(input.set_word_id);
  const [[check]] = await pool.query(
    `SELECT vsw.id FROM vocabulary_set_words vsw
     INNER JOIN assignments a ON a.set_id = vsw.set_id
     WHERE a.id = ? AND vsw.id = ? LIMIT 1`,
    [assignmentId, setWordId]
  );
  if (!check) throw new Error("INVALID_WORD");

  await pool.query(
    `INSERT INTO assignment_results
      (assignment_id, user_id, set_word_id, is_correct, answer_type, duration_seconds, studied_at, session_id)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [
      assignmentId,
      auth.userId,
      setWordId,
      input.is_correct ? 1 : 0,
      input.answer_type || null,
      num(input.duration_seconds),
      input.session_id || null,
    ]
  );
  return { recorded: true };
}

export async function startAssignmentSession(auth: AuthContext, assignmentId: number) {
  const { canViewAssignment } = await import("@/lib/org-vocab/access");
  if (!(await canViewAssignment(auth, assignmentId))) throw new Error("FORBIDDEN");
  const [result] = await pool.query(
    `INSERT INTO assignment_sessions (assignment_id, user_id, started_at) VALUES (?, ?, NOW())`,
    [assignmentId, auth.userId]
  );
  return { session_id: num((result as { insertId?: number }).insertId) };
}

export async function endAssignmentSession(
  auth: AuthContext,
  assignmentId: number,
  sessionId: number,
  stats: { words_studied?: number; correct_count?: number; wrong_count?: number }
) {
  const { canViewAssignment } = await import("@/lib/org-vocab/access");
  if (!(await canViewAssignment(auth, assignmentId))) throw new Error("FORBIDDEN");

  const [[row]] = await pool.query(
    `SELECT started_at FROM assignment_sessions
     WHERE id = ? AND assignment_id = ? AND user_id = ? AND ended_at IS NULL LIMIT 1`,
    [sessionId, assignmentId, auth.userId]
  );
  if (!row) throw new Error("SESSION_NOT_FOUND");

  const started = new Date(String((row as { started_at: string }).started_at)).getTime();
  const duration = Math.max(0, Math.round((Date.now() - started) / 1000));

  await pool.query(
    `UPDATE assignment_sessions
     SET ended_at = NOW(), duration_seconds = ?,
         words_studied = ?, correct_count = ?, wrong_count = ?
     WHERE id = ?`,
    [
      duration,
      num(stats.words_studied),
      num(stats.correct_count),
      num(stats.wrong_count),
      sessionId,
    ]
  );
  return { session_id: sessionId, duration_seconds: duration };
}

// ─── Reports ─────────────────────────────────────────────────────

export async function getAssignmentReport(auth: AuthContext, assignmentId: number) {
  const { canManageAssignment } = await import("@/lib/org-vocab/access");
  if (!(await canManageAssignment(auth, assignmentId))) throw new Error("FORBIDDEN");

  const [[assignment]] = await pool.query(
    `SELECT a.*, c.name AS classroom_name, vs.title AS set_title, vs.word_count
     FROM assignments a
     INNER JOIN classrooms c ON c.id = a.classroom_id
     INNER JOIN vocabulary_sets vs ON vs.id = a.set_id
     WHERE a.id = ? LIMIT 1`,
    [assignmentId]
  );
  if (!assignment) throw new Error("NOT_FOUND");

  const [students] = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email,
      COUNT(DISTINCT ar.set_word_id) AS words_studied,
      COALESCE(SUM(ar.is_correct), 0) AS correct_count,
      COUNT(ar.id) - COALESCE(SUM(ar.is_correct), 0) AS wrong_count,
      COALESCE((
        SELECT SUM(s.duration_seconds) FROM assignment_sessions s
        WHERE s.assignment_id = ? AND s.user_id = u.id
      ), 0) AS study_seconds,
      CASE WHEN COUNT(DISTINCT ar.set_word_id) >= ? THEN 1 ELSE 0 END AS completed
     FROM classroom_students cs
     INNER JOIN users u ON u.id = cs.user_id
     LEFT JOIN assignment_results ar ON ar.assignment_id = ? AND ar.user_id = u.id
     WHERE cs.classroom_id = ?
     GROUP BY u.id, u.name, u.email
     ORDER BY u.name ASC`,
    [
      assignmentId,
      num((assignment as { word_count?: number }).word_count),
      assignmentId,
      num((assignment as { classroom_id?: number }).classroom_id),
    ]
  );

  const [weakWords] = await pool.query(
    `SELECT ar.user_id, u.name AS student_name, vsw.word, vsw.meaning_vi,
      COUNT(*) AS wrong_count
     FROM assignment_results ar
     INNER JOIN vocabulary_set_words vsw ON vsw.id = ar.set_word_id
     INNER JOIN users u ON u.id = ar.user_id
     WHERE ar.assignment_id = ? AND ar.is_correct = 0
     GROUP BY ar.user_id, u.name, vsw.id, vsw.word, vsw.meaning_vi
     ORDER BY wrong_count DESC, u.name ASC
     LIMIT 100`,
    [assignmentId]
  );

  return {
    assignment,
    students,
    weak_words: weakWords,
    summary: {
      student_count: (students as unknown[]).length,
      studied_count: (students as { words_studied?: number }[]).filter(
        (s) => num(s.words_studied) > 0
      ).length,
      completed_count: (students as { completed?: number }[]).filter((s) => num(s.completed)).length,
    },
  };
}

/** Student-facing: assignments for current user only. */
export async function listStudentAssignments(auth: AuthContext) {
  await ensureOrgVocabSchema();
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.instructions, a.due_at, a.created_at,
      c.name AS classroom_name, vs.title AS set_title, vs.word_count, vs.id AS set_id,
      o.name AS organization_name,
      (SELECT COUNT(DISTINCT ar.set_word_id) FROM assignment_results ar
       WHERE ar.assignment_id = a.id AND ar.user_id = ?) AS words_studied,
      (SELECT COALESCE(SUM(s.duration_seconds), 0) FROM assignment_sessions s
       WHERE s.assignment_id = a.id AND s.user_id = ?) AS study_seconds,
      (SELECT COUNT(*) FROM assignment_results ar
       WHERE ar.assignment_id = a.id AND ar.user_id = ? AND ar.is_correct = 1) AS correct_count,
      (SELECT COUNT(*) FROM assignment_results ar
       WHERE ar.assignment_id = a.id AND ar.user_id = ? AND ar.is_correct = 0) AS wrong_count
     FROM assignments a
     INNER JOIN classroom_students cs ON cs.classroom_id = a.classroom_id AND cs.user_id = ?
     INNER JOIN classrooms c ON c.id = a.classroom_id
     INNER JOIN vocabulary_sets vs ON vs.id = a.set_id
     INNER JOIN organizations o ON o.id = a.organization_id
     WHERE a.is_active = 1
     ORDER BY (a.due_at IS NULL), a.due_at ASC, a.created_at DESC`,
    [auth.userId, auth.userId, auth.userId, auth.userId, auth.userId]
  );
  return rows;
}

export async function getStudentAssignmentDetail(auth: AuthContext, assignmentId: number) {
  const { canViewAssignment } = await import("@/lib/org-vocab/access");
  if (!(await canViewAssignment(auth, assignmentId))) throw new Error("FORBIDDEN");

  const [[assignment]] = await pool.query(
    `SELECT a.*, c.name AS classroom_name, vs.title AS set_title, vs.word_count, vs.id AS set_id
     FROM assignments a
     INNER JOIN classrooms c ON c.id = a.classroom_id
     INNER JOIN vocabulary_sets vs ON vs.id = a.set_id
     WHERE a.id = ? AND a.is_active = 1 LIMIT 1`,
    [assignmentId]
  );
  if (!assignment) throw new Error("NOT_FOUND");

  const words = await getVocabularySetWords(num((assignment as { set_id: number }).set_id));

  const [results] = await pool.query(
    `SELECT set_word_id, is_correct, studied_at FROM assignment_results
     WHERE assignment_id = ? AND user_id = ? ORDER BY studied_at DESC`,
    [assignmentId, auth.userId]
  );

  return { assignment, words, results };
}
