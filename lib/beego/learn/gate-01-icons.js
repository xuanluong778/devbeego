// Explicit lesson IDs from docs/beego-icon-cua-1/manifest.json.
// Feature icons are deliberately kept outside the lesson map.
export const GATE_01_LESSON_ICON_FILES = Object.freeze({
  g01l01: "01-chao-lan-dau.png",
  g01l02: "02-noi-ten.png",
  g01l03: "03-hoi-ten.png",
  g01l04: "04-on-loi-chao.png",
  g01l05: "05-gap-giao-vien.png",
  g01l06: "06-gap-ban-moi.png",
  g01l07: "07-chao-buoi-sang.png",
  g01l08: "08-on-vai-giao-tiep.png",
  g01l09: "09-gioi-thieu-ban.png",
  g01l10: "10-nho-nhac-lai.png",
  g01l11: "11-danh-van-ten.png",
  g01l12: "12-on-hoi-thoai.png",
  g01l13: "13-cam-on.png",
  g01l14: "14-xin-loi.png",
  g01l15: "15-tam-biet.png",
  g01l16: "16-tu-gioi-thieu.png",
  g01exam: "17-thi-vuot-cua.png",
});

const BASE = "/uploads/lesson-icons/gate-01/";
const artwork = (file) => Object.freeze({
  src: `${BASE}${file.replace(/\.png$/, ".webp")}`,
  original: `${BASE}${file}`,
});
const LESSON_ARTWORK = Object.freeze(Object.fromEntries(
  Object.entries(GATE_01_LESSON_ICON_FILES).map(([id, file]) => [id, artwork(file)])
));

export function getGate01LessonIcon(lessonId) {
  return Object.hasOwn(LESSON_ARTWORK, lessonId) ? LESSON_ARTWORK[lessonId] : null;
}

const CALL_ARTWORK = artwork("19-gau-goi-gia-su-ai.png");

export function getGate01CallIcon(section) {
  return section?.sectionId === "c50-g01" ? CALL_ARTWORK : null;
}
