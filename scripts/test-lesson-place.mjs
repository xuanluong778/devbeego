/**
 * Reload keeps the open activity; a new mount in the same page does not.
 * node scripts/test-lesson-place.mjs
 */
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const {
  clearLessonPlace,
  lessonPlaceToRestore,
  readLessonPlace,
  writeLessonPlace,
} = await import("../lib/beego/learn/lesson-place.js");

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

const storage = memoryStorage();
writeLessonPlace(storage, "g01l01", true, { index: 10, phase: "playing", loadId: "old" });
const restored = lessonPlaceToRestore(storage, "g01l01", true, 11, "new");
assert(restored?.index === 10, "reload restores activity 11");
assert(lessonPlaceToRestore(storage, "g01l01", true, 11, "old") === null, "same page does not jump back");
assert(lessonPlaceToRestore(storage, "g01l01", false, 11, "new") === null, "replay place is separate");
assert(lessonPlaceToRestore(storage, "g01l02", true, 11, "new") === null, "another lesson stays put");
assert(lessonPlaceToRestore(storage, "g01l01", true, 10, "new") === null, "a stale index is ignored");

writeLessonPlace(storage, "g01l01", false, { index: 4, phase: "playing", loadId: "old" });
assert(lessonPlaceToRestore(storage, "g01l01", false, 11, "new")?.index === 4, "a normal lesson also restores");
clearLessonPlace(storage, "g01l01", false);
assert(readLessonPlace(storage, "g01l01", false) === null, "exit clears the saved activity");
storage.setItem("beego-lesson-place:v1:g01l01:1", "{");
assert(readLessonPlace(storage, "g01l01", true) === null, "broken storage does not throw");

console.log("lesson place ok");
