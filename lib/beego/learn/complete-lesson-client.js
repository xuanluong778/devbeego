/**
 * POST /api/learning-path/complete — cookie session (CSRF Origin) or Bearer (Android).
 */

export const LEARNING_PATH_UPDATED_EVENT = "beego:learning-path-updated";

/**
 * @param {string} lessonId
 * @param {{ score?: number }} [opts]
 * @returns {Promise<{ ok: true, data: object } | { ok: false, status: number, code?: string, message: string }>}
 */
export async function postLearningPathComplete(lessonId, opts = {}) {
  const id = String(lessonId || "").trim();
  if (!id) {
    return { ok: false, status: 400, message: "lesson_id required." };
  }

  let score;
  if (opts.score != null && Number.isFinite(Number(opts.score))) {
    score = Math.max(0, Math.min(100, Math.round(Number(opts.score))));
  }

  const body = { lesson_id: id, lessonId: id };
  if (score != null) body.score = score;

  const res = await fetch("/api/learning-path/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok || !json?.success) {
    return {
      ok: false,
      status: res.status,
      code: json?.code,
      message: json?.message || "Could not save lesson progress.",
    };
  }

  return { ok: true, data: json.data || {} };
}

export function notifyLearningPathUpdated(detail = null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEARNING_PATH_UPDATED_EVENT, { detail }));
}
