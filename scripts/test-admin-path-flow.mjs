/**
 * DB smoke for admin path tables + assignment snapshot (no fake progress reset).
 * Run: docker exec beego-web node scripts/test-admin-path-flow.mjs
 */
import mysql from "mysql2/promise";

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "mysql",
  user: process.env.DB_USER || "beego_app",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "beego_vn",
});

function ok(label, cond) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exitCode = 1;
    return;
  }
  console.log("OK:", label);
}

const [[staff]] = await db.query(
  `SELECT id FROM users WHERE staff_role = 'system_owner' AND is_active = 1 LIMIT 1`
);
ok("system_owner exists", !!staff?.id);

const [[student]] = await db.query(
  `SELECT id FROM users WHERE (staff_role IS NULL OR staff_role = '') AND is_active = 1 ORDER BY id ASC LIMIT 1`
);
ok("student user exists", !!student?.id);

const tables = [
  "admin_path_templates",
  "admin_path_template_items",
  "admin_student_path_assignments",
  "admin_student_path_items",
  "admin_teacher_student_scope",
];
for (const t of tables) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [t]
  );
  ok(`table ${t}`, Number(row.c) === 1);
}

const title = `Smoke path ${Date.now()}`;
const [insTpl] = await db.query(
  `INSERT INTO admin_path_templates (title, status, version, created_by) VALUES (?, 'published', 1, ?)`,
  [title, staff.id]
);
const templateId = insTpl.insertId;

await db.query(
  `INSERT INTO admin_path_template_items
   (template_id, sort_index, gate_number, chapter_title, lesson_id, item_type, title, required)
   VALUES (?, 1, 1, 'Cửa 1', 'g01l01', 'lesson', 'Bài 1', 1),
          (?, 2, 1, 'Cửa 1', 'g01exam', 'exam', 'Thi vượt cửa 1', 1)`,
  [templateId, templateId]
);

const [[progBefore]] = await db.query(
  `SELECT COUNT(*) AS c FROM user_lesson_progress WHERE user_id = ? AND status = 'completed'`,
  [student.id]
);

await db.query(
  `UPDATE admin_student_path_assignments SET status = 'archived' WHERE student_user_id = ? AND status = 'active'`,
  [student.id]
);

const [insAsg] = await db.query(
  `INSERT INTO admin_student_path_assignments
   (student_user_id, template_id, template_version, snapshot_title, assigned_by, status)
   VALUES (?, ?, 1, ?, ?, 'active')`,
  [student.id, templateId, title, staff.id]
);
const assignmentId = insAsg.insertId;

await db.query(
  `INSERT INTO admin_student_path_items
   (assignment_id, sort_index, gate_number, chapter_title, lesson_id, item_type, title, required, is_disabled, is_custom)
   SELECT ?, sort_index, gate_number, chapter_title, lesson_id, item_type, title, required, 0, 0
   FROM admin_path_template_items WHERE template_id = ?`,
  [assignmentId, templateId]
);

const [[itemCount]] = await db.query(
  `SELECT COUNT(*) AS c FROM admin_student_path_items WHERE assignment_id = ?`,
  [assignmentId]
);
ok("snapshot has 2 items", Number(itemCount.c) === 2);

await db.query(
  `INSERT INTO user_lesson_progress (user_id, lesson_id, status, score, completed_at, updated_at)
   VALUES (?, 'g01l01', 'completed', 95, NOW(), NOW())
   ON DUPLICATE KEY UPDATE status = 'completed', score = GREATEST(COALESCE(score,0), 95), completed_at = COALESCE(completed_at, NOW())`,
  [student.id]
);

const [[progAfter]] = await db.query(
  `SELECT COUNT(*) AS c FROM user_lesson_progress WHERE user_id = ? AND status = 'completed'`,
  [student.id]
);
ok("completed progress preserved", Number(progAfter.c) >= Number(progBefore.c));

const [[completedInPath]] = await db.query(
  `SELECT ulp.status FROM admin_student_path_items i
   JOIN user_lesson_progress ulp ON ulp.user_id = ? AND ulp.lesson_id = i.lesson_id
   WHERE i.assignment_id = ? AND i.lesson_id = 'g01l01'`,
  [student.id, assignmentId]
);
ok("g01l01 shows completed in DB join", completedInPath?.status === "completed");

await db.query(`DELETE FROM admin_student_path_items WHERE assignment_id = ?`, [assignmentId]);
await db.query(`DELETE FROM admin_student_path_assignments WHERE id = ?`, [assignmentId]);
await db.query(`DELETE FROM admin_path_template_items WHERE template_id = ?`, [templateId]);
await db.query(`DELETE FROM admin_path_templates WHERE id = ?`, [templateId]);

await db.end();
console.log("Done admin path smoke.");
