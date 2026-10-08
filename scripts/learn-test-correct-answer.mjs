/**
 * Resolve catalog correctAnswer for regression tests (Lesson GET strips answers).
 * Must be loaded with: node --import ./scripts/register-alias.mjs ...
 * Or call registerAlias() before importCorrect().
 */
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let _registered = false;
let _getRef = null;

export function registerAlias() {
  if (_registered) return;
  register(
    pathToFileURL(path.join(root, "scripts", "alias-loader.mjs")).href
  );
  _registered = true;
}

export async function importCorrect() {
  registerAlias();
  if (!_getRef) {
    const mod = await import("@/lib/beego/learn/get-lesson-exercise.js");
    _getRef = mod.getLessonExerciseByRef;
  }
  return _getRef;
}

/** @returns {Promise<string|null>} */
export async function resolveCorrectAnswer(lessonId, questionId) {
  const getRef = await importCorrect();
  const hit = getRef(String(lessonId || ""), String(questionId || ""));
  const ans = hit?.exercise?.correctAnswer;
  return ans != null && String(ans).length ? String(ans) : null;
}
