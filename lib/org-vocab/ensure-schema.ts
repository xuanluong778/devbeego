import pool from "@/lib/db";

let ensured = false;

async function tryAlter(sql: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch {
    /* column/index exists */
  }
}

export async function ensureOrgVocabSchema(): Promise<void> {
  if (ensured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(100) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_organizations_slug (slug),
      INDEX idx_organizations_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organization_members (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      role ENUM('owner','teacher','student') NOT NULL DEFAULT 'student',
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_org_member (organization_id, user_id),
      INDEX idx_org_members_user (user_id),
      CONSTRAINT fk_org_members_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_org_members_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(200) NOT NULL,
      description TEXT NULL,
      teacher_user_id BIGINT UNSIGNED NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_classrooms_org (organization_id),
      INDEX idx_classrooms_teacher (teacher_user_id),
      CONSTRAINT fk_classrooms_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_classrooms_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS classroom_students (
      classroom_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (classroom_id, user_id),
      INDEX idx_classroom_students_user (user_id),
      CONSTRAINT fk_classroom_students_class FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_classroom_students_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vocabulary_sets (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT NULL,
      level VARCHAR(50) NOT NULL DEFAULT 'beginner',
      topic VARCHAR(100) NULL,
      word_count INT UNSIGNED NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_vocab_sets_org (organization_id),
      CONSTRAINT fk_vocab_sets_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_vocab_sets_creator FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vocabulary_set_words (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      set_id BIGINT UNSIGNED NOT NULL,
      word VARCHAR(120) NOT NULL,
      meaning_vi VARCHAR(500) NOT NULL,
      ipa VARCHAR(120) NULL,
      part_of_speech VARCHAR(50) NOT NULL DEFAULT 'other',
      example_sentence TEXT NULL,
      example_vi TEXT NULL,
      level VARCHAR(50) NULL,
      topic VARCHAR(100) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_set_words_set (set_id, sort_order),
      CONSTRAINT fk_set_words_set FOREIGN KEY (set_id) REFERENCES vocabulary_sets(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      organization_id BIGINT UNSIGNED NOT NULL,
      classroom_id BIGINT UNSIGNED NOT NULL,
      set_id BIGINT UNSIGNED NOT NULL,
      assigned_by BIGINT UNSIGNED NOT NULL,
      title VARCHAR(200) NOT NULL,
      instructions TEXT NULL,
      due_at DATETIME NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_assignments_classroom (classroom_id),
      INDEX idx_assignments_set (set_id),
      CONSTRAINT fk_assignments_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_assignments_class FOREIGN KEY (classroom_id) REFERENCES classrooms(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_assignments_set FOREIGN KEY (set_id) REFERENCES vocabulary_sets(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT fk_assignments_assigner FOREIGN KEY (assigned_by) REFERENCES users(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignment_results (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      assignment_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      set_word_id BIGINT UNSIGNED NOT NULL,
      is_correct TINYINT(1) NOT NULL DEFAULT 0,
      answer_type VARCHAR(20) NULL,
      duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
      studied_at DATETIME NOT NULL,
      session_id VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_assignment_results_user (assignment_id, user_id),
      INDEX idx_assignment_results_word (assignment_id, set_word_id),
      CONSTRAINT fk_assignment_results_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_assignment_results_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_assignment_results_word FOREIGN KEY (set_word_id) REFERENCES vocabulary_set_words(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignment_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      assignment_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      started_at DATETIME NOT NULL,
      ended_at DATETIME NULL,
      duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
      words_studied INT UNSIGNED NOT NULL DEFAULT 0,
      correct_count INT UNSIGNED NOT NULL DEFAULT 0,
      wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_assignment_sessions_user (assignment_id, user_id),
      CONSTRAINT fk_assignment_sessions_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_assignment_sessions_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await tryAlter("CREATE INDEX idx_assignments_active ON assignments (is_active, classroom_id)");

  ensured = true;
}
