import pool from "@/lib/db";

let ensured = false;

export async function ensurePathAdminSchema(): Promise<void> {
  if (ensured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_path_templates (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT NULL,
      status ENUM('draft','published') NOT NULL DEFAULT 'draft',
      version INT UNSIGNED NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NOT NULL,
      published_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_apt_status (status, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_path_template_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      template_id BIGINT UNSIGNED NOT NULL,
      sort_index INT UNSIGNED NOT NULL,
      gate_number SMALLINT UNSIGNED NOT NULL,
      chapter_title VARCHAR(200) NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      item_type ENUM('lesson','exam') NOT NULL DEFAULT 'lesson',
      title VARCHAR(200) NOT NULL,
      required TINYINT(1) NOT NULL DEFAULT 1,
      UNIQUE KEY uq_template_lesson (template_id, lesson_id),
      KEY idx_template_sort (template_id, sort_index)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_student_path_assignments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      student_user_id BIGINT UNSIGNED NOT NULL,
      template_id BIGINT UNSIGNED NULL,
      template_version INT UNSIGNED NULL,
      snapshot_title VARCHAR(200) NOT NULL,
      status ENUM('active','archived') NOT NULL DEFAULT 'active',
      goal_text VARCHAR(500) NULL,
      due_at DATETIME NULL,
      assigned_by BIGINT UNSIGNED NOT NULL,
      assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_aspa_student (student_user_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_student_path_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      assignment_id BIGINT UNSIGNED NOT NULL,
      sort_index INT UNSIGNED NOT NULL,
      gate_number SMALLINT UNSIGNED NOT NULL,
      chapter_title VARCHAR(200) NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      item_type ENUM('lesson','exam') NOT NULL DEFAULT 'lesson',
      title VARCHAR(200) NOT NULL,
      required TINYINT(1) NOT NULL DEFAULT 1,
      is_disabled TINYINT(1) NOT NULL DEFAULT 0,
      is_custom TINYINT(1) NOT NULL DEFAULT 0,
      UNIQUE KEY uq_assign_lesson (assignment_id, lesson_id),
      KEY idx_assign_sort (assignment_id, sort_index)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_teacher_student_scope (
      teacher_user_id BIGINT UNSIGNED NOT NULL,
      student_user_id BIGINT UNSIGNED NOT NULL,
      assigned_by BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (teacher_user_id, student_user_id),
      KEY idx_scope_student (student_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  ensured = true;
}

/** Hoàn thành bài = ghi nhận qua API complete sau khi làm đủ câu bắt buộc — không tính khi chỉ mở bài. */
export const LESSON_COMPLETION_RULE_VI =
  "Bài chỉ hoàn thành khi hệ thống ghi user_lesson_progress.status = completed (API hoàn thành bài, đủ câu bắt buộc). Mở bài hoặc làm dở không tính xong.";
