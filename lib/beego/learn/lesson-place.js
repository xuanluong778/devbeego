/** Remember the open lesson activity across a reload of this tab. */

export function lessonPlaceKey(lessonId, replay) {
  return `beego-lesson-place:v1:${String(lessonId || "")}:${replay ? "1" : "0"}`;
}

export function pageLoadId() {
  if (typeof performance === "undefined") return "";
  const origin = Number(performance.timeOrigin);
  return Number.isFinite(origin) ? String(origin) : "";
}

export function readLessonPlace(storage, lessonId, replay) {
  try {
    const raw = storage.getItem(lessonPlaceKey(lessonId, replay));
    if (!raw) return null;
    const data = JSON.parse(raw);
    const index = Number(data?.index);
    if (!Number.isInteger(index) || index < 0) return null;
    return {
      index,
      phase: data.phase === "complete" ? "complete" : "playing",
      loadId: String(data.loadId || ""),
    };
  } catch {
    return null;
  }
}

/**
 * A saved place applies only when this document is a new load (F5 / fresh navigation),
 * not when the player mounts again inside the same page.
 */
export function lessonPlaceToRestore(storage, lessonId, replay, questionCount, loadId) {
  const saved = readLessonPlace(storage, lessonId, replay);
  if (!saved || !loadId || saved.loadId === loadId) return null;
  if (!Number.isInteger(questionCount) || saved.index >= questionCount) return null;
  return saved;
}

export function writeLessonPlace(storage, lessonId, replay, place) {
  const index = Number(place?.index);
  if (!Number.isInteger(index) || index < 0) return;
  storage.setItem(
    lessonPlaceKey(lessonId, replay),
    JSON.stringify({
      index,
      phase: place?.phase === "complete" ? "complete" : "playing",
      loadId: String(place?.loadId || ""),
    })
  );
}

export function clearLessonPlace(storage, lessonId, replay) {
  try {
    storage.removeItem(lessonPlaceKey(lessonId, replay));
  } catch {
    /* ignore */
  }
}
