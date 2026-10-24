/** Rotating praise for correct answers (flow 03). Avoids repeating the same line twice in a row. */

export const LEARN_CORRECT_PRAISE = [
  "Bạn là thiên tài!",
  "Bạn là cao thủ rồi!",
  "Bạn rất pro!",
  "Giỏi quá!",
  "Quá xuất sắc!",
  "Đúng rồi, tiếp tục nào!",
  "Beego tự hào về bạn!",
];

/** Milder line for open situation speaking (not pronunciation mastery). */
export const LEARN_SOFT_SPEAK_PRAISE = [
  "Ổn rồi — bạn đã dùng đủ từ trọng tâm!",
  "Tốt — câu nói đúng hướng đề bài!",
  "Được đó — tiếp tục nào!",
  "Đã ghi nhận — từ khóa đủ rồi!",
];

export const LEARN_LOADING_TIPS = [
  "Mẹo hay: Lặp lại thật to từng câu trong bài học.",
  "Mẹo hay: Nghe chậm một lần rồi nhắc lại.",
  "Mẹo hay: Học 5 phút mỗi ngày vẫn giữ được streak.",
  "Mẹo hay: Sai cũng được — sửa ngay sẽ nhớ lâu hơn.",
  "Mẹo hay: Đọc to giúp phát âm tự nhiên hơn.",
];

let lastPraiseIndex = -1;

export function nextCorrectPraise(seed, { soft = false } = {}) {
  const list = soft && LEARN_SOFT_SPEAK_PRAISE.length ? LEARN_SOFT_SPEAK_PRAISE : LEARN_CORRECT_PRAISE;
  if (!list.length) return soft ? "Ổn rồi!" : "Giỏi quá!";
  let index;
  if (Number.isFinite(Number(seed))) {
    index = Math.abs(Number(seed)) % list.length;
  } else {
    index = Math.floor(Math.random() * list.length);
  }
  if (index === lastPraiseIndex && list.length > 1) {
    index = (index + 1) % list.length;
  }
  lastPraiseIndex = index;
  return list[index];
}

export function pickLoadingTip(seed) {
  const list = LEARN_LOADING_TIPS;
  if (!list.length) return "";
  const index = Number.isFinite(Number(seed))
    ? Math.abs(Number(seed)) % list.length
    : Math.floor(Math.random() * list.length);
  return list[index];
}
