/** Cô Beego AI — phản hồi có cấu trúc, không chat tự do. */

export const KIDS_AI_SCENARIOS = [
  {
    id: "greeting",
    promptVi: "Chào cô Beego!",
    targetEn: "Hello Beego",
    hintVi: "Nói: Hello Beego",
  },
  {
    id: "like_apple",
    promptVi: "Con thích táo",
    targetEn: "I like apples",
    hintVi: "Nói: I like apples",
  },
  {
    id: "my_name",
    promptVi: "Tên con là Bee",
    targetEn: "My name is Bee",
    hintVi: "Nói: My name is Bee (dùng tên bé, không hỏi thông tin thật)",
  },
  {
    id: "thank_you",
    promptVi: "Cảm ơn cô",
    targetEn: "Thank you",
    hintVi: "Nói: Thank you",
  },
  {
    id: "goodbye",
    promptVi: "Tạm biệt cô",
    targetEn: "Goodbye",
    hintVi: "Nói: Goodbye",
  },
];

export function kidAiFeedback({ target, heard, score }) {
  const t = String(target || "").trim();
  const h = String(heard || "").trim();
  if (score >= 75) {
    return {
      kind: "ok",
      vi: "Giỏi lắm con! 🎉 Bé nói rất hay!",
      en: t,
    };
  }
  if (score >= 45) {
    return {
      kind: "near",
      vi: `Gần đúng rồi con! Mình nói là: ${t}. Con nói lại nhé.`,
      en: t,
    };
  }
  if (h) {
    return {
      kind: "try",
      vi: `Cô nghe con nói "${h}". Thử lại nhé: ${t}`,
      en: t,
    };
  }
  return {
    kind: "try",
    vi: `Chưa nghe rõ lắm. Con thử nói to hơn: ${t}`,
    en: t,
  };
}

/** Không hỏi thông tin cá nhân — chỉ bài học có sẵn. */
export const KIDS_SAFETY_NOTE =
  "Khu Beego Kids an toàn: không hỏi địa chỉ, số điện thoại hay thông tin riêng của bé.";
