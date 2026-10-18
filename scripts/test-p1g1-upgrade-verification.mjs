/**
 * Comprehensive verification suite for Part 1 · Gate 1 upgrade.
 * Tests:
 * 1. Content generation & pedagogy matrix across all 16 lessons.
 * 2. Strict scope check for n08 (no premature phrases).
 * 3. Real-name scaffolded self-intro for n01.
 * 4. Option shuffling & answer validity for all questions.
 * 5. Other parts (p2-g1) regression check.
 * 6. Legacy mistake archival (retired = archived, never resolved).
 * 7. End-to-end user progress simulation:
 *    - New user start
 *    - In-progress resume
 *    - n08 mid-gate pass/fail thresholds
 *    - n15 gate checkpoint pass/fail (score >= 80% + 6 competency coverage)
 *    - n15 pass unlocks n16
 *    - n16 pass unlocks p2-g1-n01
 *    - Replay already completed
 */

import pool from "../lib/db.js";
import { getLessonContentById } from "../lib/beego/learn/get-lesson-content.js";
import { scoreSpeakingAttempt, checkAnswer } from "../lib/beego/learn/exercise-check.js";
import { getLessonExerciseByRef } from "../lib/beego/learn/get-lesson-exercise.js";
import { completeLessonForUser, getLearningPathForUser } from "../lib/beego/learning-path-progress.js";
import { buildPersonalizedReviewSession } from "../lib/beego/learn/personalized-review-engine.js";

const results = [];

function assert(condition, testName, details = "") {
  if (condition) {
    results.push({ name: testName, status: "PASS", details });
    console.log(`[PASS] ${testName}`);
  } else {
    results.push({ name: testName, status: "FAIL", details });
    console.error(`[FAIL] ${testName}: ${details}`);
  }
}

async function run() {
  console.log("=== STARTING P1-G1 UPGRADE VERIFICATION SUITE ===");

  // 1. Content generation check for all 16 lessons
  for (let i = 1; i <= 16; i++) {
    const lid = `p1-g1-n${String(i).padStart(2, "0")}`;
    const lesson = getLessonContentById(lid);
    const qCount = lesson?.questions?.length || 0;
    const isExpectedCount = (i <= 14 && qCount >= 6 && qCount <= 8) || (i >= 15 && qCount === 10);
    assert(
      lesson && isExpectedCount,
      `Lesson ${lid} content structure`,
      `Got ${qCount} questions, expected ${i <= 14 ? "6-8" : "10"}`
    );

    // Verify all multiple choice options have correct answers that match
    for (const q of lesson.questions || []) {
      if (q.options && q.options.length) {
        const matching = q.options.find((o) => o.id === q.correctAnswer);
        assert(
          Boolean(matching),
          `Question ${q.id} answer validity`,
          `Option id ${q.correctAnswer} not found in options: ${JSON.stringify(q.options.map((o) => o.id))}`
        );
      }
    }
  }

  // 2. Strict scope check for n08
  const n08 = getLessonContentById("p1-g1-n08");
  const n08Text = JSON.stringify(n08).toLowerCase();
  const hasNiceToMeetYou = n08Text.includes("nice to meet you");
  const hasGoodbye = n08Text.includes("goodbye") || n08Text.includes("see you later");
  assert(!hasNiceToMeetYou, "n08 does not contain premature 'Nice to meet you'");
  assert(!hasGoodbye, "n08 does not contain premature 'Goodbye / See you later'");

  // 3. Real-name scaffolded self-intro for n01
  const n01 = getLessonContentById("p1-g1-n01");
  const n01Speaking = n01.questions.find((q) => q.type === "speaking");
  assert(Boolean(n01Speaking), "n01 has speaking self-intro exercise");
  const speechTest1 = scoreSpeakingAttempt(n01Speaking, "Hello, I am Nam");
  const speechTest2 = scoreSpeakingAttempt(n01Speaking, "Hi, I am Linh");
  const speechTest3 = scoreSpeakingAttempt(n01Speaking, "Hello, my name is Alex");
  const speechTest4 = scoreSpeakingAttempt(n01Speaking, "Good morning, bananas");
  assert(speechTest1.passed, "n01 accepts 'Hello, I am Nam'");
  assert(speechTest2.passed, "n01 accepts 'Hi, I am Linh'");
  assert(speechTest3.passed, "n01 accepts 'Hello, my name is Alex'");
  assert(!speechTest4.passed, "n01 rejects unrelated phrase 'Good morning, bananas'");

  // 4. Regression check: Part 2 Gate 1 node 01
  const p2n01 = getLessonContentById("p2-g1-n01");
  assert(Boolean(p2n01 && p2n01.questions?.length > 0), "p2-g1-n01 is intact and functional");

  // 5. Legacy mistake archival
  const retiredEx = getLessonExerciseByRef("p1-g1-n01", "p1-g1-n01-a12");
  assert(retiredEx && retiredEx.retired === true, "Legacy activity a12 marked as retired");

  // 6. Database and progress flow testing with a simulated test user
  const conn = await pool.getConnection();
  let testUserId = null;
  try {
    // Create test user
    const [userRes] = await conn.query(
      `INSERT INTO users (email, password_hash, name, role, is_active, created_at)
       VALUES (?, 'test_hash', 'Test P1G1 Learner', 'user', 1, NOW())`,
      [`test_p1g1_${Date.now()}@beego.vn`]
    );
    testUserId = userRes.insertId;
    await conn.query(
      `INSERT INTO user_stats (user_id, xp_total, honey_total, active_lesson_id)
       VALUES (?, 0, 0, 'p1-g1-n01')`,
      [testUserId]
    );

    // Test A: User starts at p1-g1-n01
    const initialPath = await getLearningPathForUser(testUserId);
    assert(initialPath.progress.active_lesson_id === "p1-g1-n01", "New user starts at p1-g1-n01");

    // Complete n01 to n07
    for (let i = 1; i <= 7; i++) {
      const lid = `p1-g1-n${String(i).padStart(2, "0")}`;
      const lContent = getLessonContentById(lid);
      // Insert attempts for required questions
      for (const q of lContent.questions) {
        if (q.required) {
          await conn.query(
            `INSERT INTO user_learn_exercise_attempts
             (attempt_key, user_id, lesson_id, question_id, content_revision, skill_key, exercise_type, is_correct, created_at)
             VALUES (?, ?, ?, ?, 'p1g1-r4', 'vocab', 'choice', 1, NOW())`,
            [`att-${testUserId}-${q.id}`, testUserId, lid, q.id]
          );
        }
      }
      await completeLessonForUser(testUserId, lid);
    }

    const pathAtN08 = await getLearningPathForUser(testUserId);
    assert(pathAtN08.progress.active_lesson_id === "p1-g1-n08", "Progress advanced to p1-g1-n08");

    // Test B: n08 Mid-gate failure when score < 75% (e.g. 5/8 = 63%)
    const n08Content = getLessonContentById("p1-g1-n08");
    // Test B: n08 Mid-gate Check - Session Isolation & Failure
    const n08SessionFail = "sess-n08-fail-" + Date.now();
    for (let idx = 0; idx < n08Content.questions.length; idx++) {
      const q = n08Content.questions[idx];
      const isRight = idx < 5 ? 1 : 0; // 5 out of 8 = 62.5%
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, assessment_session_id, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n08', ?, 'p1g1-r4', ?, 'review', 'choice', ?, NOW())`,
        [`att-n08-fail-${testUserId}-${q.id}`, testUserId, q.id, n08SessionFail, isRight]
      );
    }

    // B1: Check without assessmentSessionId throws ASSESSMENT_SESSION_REQUIRED
    let n08SessionRequired = false;
    try {
      await completeLessonForUser(testUserId, "p1-g1-n08");
    } catch (err) {
      if (err.code === "ASSESSMENT_SESSION_REQUIRED") n08SessionRequired = true;
    }
    assert(n08SessionRequired, "n08 requires assessmentSessionId for server-side evaluation");

    // B2: Check fail routes to remediation
    let n08Failed = false;
    try {
      await completeLessonForUser(testUserId, "p1-g1-n08", { assessmentSessionId: n08SessionFail });
    } catch (err) {
      if (err.code === "GATE_TEST_FAILED" && err.remediationLessonId === "p1-g1-n06") {
        n08Failed = true;
      }
    }
    assert(n08Failed, "n08 fails when score < 75% and routes to remediation p1-g1-n06");

    // Retry n08 with a FRESH session (100%)
    const n08SessionPass = "sess-n08-pass-" + Date.now();
    for (const q of n08Content.questions) {
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, assessment_session_id, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n08', ?, 'p1g1-r4', ?, 'review', 'choice', 1, NOW() + INTERVAL 1 SECOND)`,
        [`att-n08-pass-${testUserId}-${q.id}`, testUserId, q.id, n08SessionPass]
      );
    }
    const n08PassRes = await completeLessonForUser(testUserId, "p1-g1-n08", {
      assessmentSessionId: n08SessionPass,
    });
    assert(n08PassRes.next_lesson_id === "p1-g1-n09", "n08 retry pass advances to p1-g1-n09");

    // Complete n09 to n14
    for (let i = 9; i <= 14; i++) {
      const lid = `p1-g1-n${String(i).padStart(2, "0")}`;
      const lContent = getLessonContentById(lid);
      for (const q of lContent.questions) {
        if (q.required) {
          await conn.query(
            `INSERT INTO user_learn_exercise_attempts
             (attempt_key, user_id, lesson_id, question_id, content_revision, skill_key, exercise_type, is_correct, created_at)
             VALUES (?, ?, ?, ?, 'p1g1-r4', 'vocab', 'choice', 1, NOW())`,
            [`att-${testUserId}-${q.id}`, testUserId, lid, q.id]
          );
        }
      }
      await completeLessonForUser(testUserId, lid);
    }

    const pathAtN15 = await getLearningPathForUser(testUserId);
    assert(pathAtN15.progress.active_lesson_id === "p1-g1-n15", "Progress advanced to p1-g1-n15");

    // Test C1: n15 Missing Session ID Rejected
    let n15SessionRequired = false;
    try {
      await completeLessonForUser(testUserId, "p1-g1-n15");
    } catch (err) {
      if (err.code === "ASSESSMENT_SESSION_REQUIRED") n15SessionRequired = true;
    }
    assert(n15SessionRequired, "n15 requires assessmentSessionId for server-side evaluation");

    // Test C2: Two simultaneous tabs (Hai tab đồng thời) cannot stitch answers together
    const sessTabA = "sess-n15-tabA-" + Date.now();
    const sessTabB = "sess-n15-tabB-" + Date.now();
    const n15Content = getLessonContentById("p1-g1-n15");

    // Tab A answers only questions 1 to 5 (all correct)
    for (let idx = 0; idx < 5; idx++) {
      const q = n15Content.questions[idx];
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, assessment_session_id, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n15', ?, 'p1g1-r4', ?, 'test', 'choice', 1, NOW())`,
        [`att-tabA-${testUserId}-${q.id}`, testUserId, q.id, sessTabA]
      );
    }

    // Tab B answers only questions 6 to 10 (all correct)
    for (let idx = 5; idx < 10; idx++) {
      const q = n15Content.questions[idx];
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, assessment_session_id, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n15', ?, 'p1g1-r4', ?, 'test', 'choice', 1, NOW())`,
        [`att-tabB-${testUserId}-${q.id}`, testUserId, q.id, sessTabB]
      );
    }

    // Attempting to complete Tab A must fail (questions 6-10 missing in sessTabA)
    let tabAFailed = false;
    try {
      await completeLessonForUser(testUserId, "p1-g1-n15", { assessmentSessionId: sessTabA });
    } catch (err) {
      if (err.code === "REQUIRED_QUESTIONS_SKIPPED") tabAFailed = true;
    }
    assert(tabAFailed, "Tab A cannot pass: questions answered in Tab B do not leak into Tab A session");

    // Attempting to complete Tab B must fail (questions 1-5 missing in sessTabB)
    let tabBFailed = false;
    try {
      await completeLessonForUser(testUserId, "p1-g1-n15", { assessmentSessionId: sessTabB });
    } catch (err) {
      if (err.code === "REQUIRED_QUESTIONS_SKIPPED") tabBFailed = true;
    }
    assert(tabBFailed, "Tab B cannot pass: questions answered in Tab A do not leak into Tab B session");

    // Test C3: Two consecutive runs (Hai lần thi liên tiếp) are strictly isolated
    const sessRun1 = "sess-n15-run1-" + Date.now();
    for (let idx = 0; idx < 10; idx++) {
      const q = n15Content.questions[idx];
      const isRight = idx < 5 ? 1 : 0; // 5/10 = 50%
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, assessment_session_id, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n15', ?, 'p1g1-r4', ?, 'test', 'choice', ?, NOW())`,
        [`att-run1-${testUserId}-${q.id}`, testUserId, q.id, sessRun1, isRight]
      );
    }
    let run1Failed = false;
    try {
      await completeLessonForUser(testUserId, "p1-g1-n15", { assessmentSessionId: sessRun1 });
    } catch (err) {
      if (err.code === "GATE_TEST_FAILED") run1Failed = true;
    }
    assert(run1Failed, "Run 1 fails due to 50% score");

    // Run 2 starts: if user only submits questions 6 to 10 on sessRun2, Run 1 answers are NOT blended
    const sessRun2 = "sess-n15-run2-" + Date.now();
    for (let idx = 5; idx < 10; idx++) {
      const q = n15Content.questions[idx];
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, assessment_session_id, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n15', ?, 'p1g1-r4', ?, 'test', 'choice', 1, NOW())`,
        [`att-run2-part-${testUserId}-${q.id}`, testUserId, q.id, sessRun2]
      );
    }
    let run2PartFailed = false;
    try {
      await completeLessonForUser(testUserId, "p1-g1-n15", { assessmentSessionId: sessRun2 });
    } catch (err) {
      if (err.code === "REQUIRED_QUESTIONS_SKIPPED") run2PartFailed = true;
    }
    assert(run2PartFailed, "Run 2 cannot borrow questions from Run 1 to complete");

    // Test C4: Core competency group check (origin_where_from failed)
    const sessCompetency = "sess-n15-comp-" + Date.now();
    for (const q of n15Content.questions) {
      const isRight = (q.id === "p1-g1-n15-q4" || q.id === "p1-g1-n15-q5") ? 0 : 1;
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, assessment_session_id, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n15', ?, 'p1g1-r4', ?, 'test', 'choice', ?, NOW())`,
        [`att-n15-comp-${testUserId}-${q.id}`, testUserId, q.id, sessCompetency, isRight]
      );
    }
    let n15CompetencyBlocked = false;
    try {
      await completeLessonForUser(testUserId, "p1-g1-n15", { assessmentSessionId: sessCompetency });
    } catch (err) {
      if (err.code === "GATE_TEST_FAILED" && err.unmetCompetencies?.includes("origin_where_from")) {
        n15CompetencyBlocked = true;
      }
    }
    assert(n15CompetencyBlocked, "n15 blocks pass if core competency is failed despite >= 80%");

    // Retry n15 with all 10 correct under a fresh valid session
    const sessPass = "sess-n15-pass-" + Date.now();
    for (const q of n15Content.questions) {
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, assessment_session_id, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n15', ?, 'p1g1-r4', ?, 'test', 'choice', 1, NOW() + INTERVAL 2 SECOND)`,
        [`att-n15-pass-${testUserId}-${q.id}`, testUserId, q.id, sessPass]
      );
    }
    const n15PassRes = await completeLessonForUser(testUserId, "p1-g1-n15", {
      assessmentSessionId: sessPass,
    });
    assert(n15PassRes.next_lesson_id === "p1-g1-n16", "n15 pass unlocks p1-g1-n16");

    // Complete n16 (Review)
    const n16Content = getLessonContentById("p1-g1-n16");
    for (const q of n16Content.questions) {
      await conn.query(
        `INSERT INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, content_revision, skill_key, exercise_type, is_correct, created_at)
         VALUES (?, ?, 'p1-g1-n16', ?, 'p1g1-r4', 'review', 'choice', 1, NOW())`,
        [`att-n16-pass-${testUserId}-${q.id}`, testUserId, q.id]
      );
    }
    const n16PassRes = await completeLessonForUser(testUserId, "p1-g1-n16");
    assert(n16PassRes.next_lesson_id === "p2-g1-n01", "Completing n16 unlocks Part 2 Gate 1 (p2-g1-n01)!");

    // Test D: Replay already completed lesson
    const replayRes = await completeLessonForUser(testUserId, "p1-g1-n01");
    assert(replayRes.already_completed === true, "Replaying already completed lesson returns already_completed: true");

    // Test E: Spaced repetition vs Gate Review label
    const reviewSession = await buildPersonalizedReviewSession(testUserId, "p1-g1-n16");
    assert(
      reviewSession.mode === "gate_curriculum",
      "SRS falls back to gate_curriculum when no personalized mistakes due"
    );

    // Test F1: Legacy mistake archival for retired questions (a09-a13)
    await conn.query(
      `INSERT INTO user_learn_mistakes
       (user_id, lesson_id, question_id, content_revision, skill_key, exercise_type, wrong_count, status, created_at, updated_at)
       VALUES (?, 'p1-g1-n01', 'p1-g1-n01-a12', 'p1g1-r3', 'speaking', 'speaking', 1, 'open', NOW(), NOW())
       ON DUPLICATE KEY UPDATE status = 'open'`,
      [testUserId]
    );
    await buildPersonalizedReviewSession(testUserId, "p1-g1-n16");
    const [archivedRetired] = await conn.query(
      `SELECT status FROM user_learn_mistakes WHERE user_id = ? AND question_id = 'p1-g1-n01-a12'`,
      [testUserId]
    );
    assert(
      archivedRetired[0]?.status === "archived",
      "Retired question mistake automatically archived in DB (never marked resolved)"
    );

    // Test F2: Legacy mistake disambiguation for kept IDs (a01-a08) with altered content
    // User made mistake on old a01 under p1g1-r3. The review engine must NOT serve the new a01!
    await conn.query(
      `INSERT INTO user_learn_mistakes
       (user_id, lesson_id, question_id, content_revision, skill_key, exercise_type, wrong_count, status, created_at, updated_at)
       VALUES (?, 'p1-g1-n01', 'p1-g1-n01-a01', 'p1g1-r3', 'listening', 'listening_choice', 2, 'open', NOW(), NOW())
       ON DUPLICATE KEY UPDATE content_revision = 'p1g1-r3', status = 'open'`,
      [testUserId]
    );
    const reviewWithLegacyA01 = await buildPersonalizedReviewSession(testUserId, "p1-g1-n16");
    const [archivedA01] = await conn.query(
      `SELECT status FROM user_learn_mistakes WHERE user_id = ? AND question_id = 'p1-g1-n01-a01'`,
      [testUserId]
    );
    assert(
      archivedA01[0]?.status === "archived",
      "Legacy mistake on kept ID a01 from p1g1-r3 is quarantined to status=archived and not served as new a01"
    );
    assert(
      !reviewWithLegacyA01.questions?.some((q) => q.reviewMeta?.reason === "open_mistake"),
      "Review session questions contain zero open_mistake items because legacy mistake was quarantined"
    );
    assert(
      !reviewWithLegacyA01.candidates?.some((c) => c.reason === "open_mistake"),
      "Review session candidates contain zero open_mistake items"
    );

  } finally {
    // Clean up test user
    if (testUserId) {
      await conn.query(`DELETE FROM user_learn_exercise_attempts WHERE user_id = ?`, [testUserId]).catch(() => {});
      await conn.query(`DELETE FROM user_learn_mistakes WHERE user_id = ?`, [testUserId]).catch(() => {});
      await conn.query(`DELETE FROM user_lesson_progress WHERE user_id = ?`, [testUserId]).catch(() => {});
      await conn.query(`DELETE FROM user_stats WHERE user_id = ?`, [testUserId]).catch(() => {});
      await conn.query(`DELETE FROM users WHERE id = ?`, [testUserId]).catch(() => {});
    }
    conn.release();
  }

  console.log("=== TEST SUMMARY ===");
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(`TOTAL: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
