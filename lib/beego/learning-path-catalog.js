/**
 * Curriculum catalog — 8 phần, mỗi phần 1 cửa (chủ đề), A0 → B1+.
 * Mỗi cửa sinh 16 node qua GATE_NODE_BLUEPRINT.
 */

/** @typedef {{ gateNumber: number, topicTitle: string, sectionTitle: string, grammarPoint: string }} GateCatalog */
/** @typedef {{ partNumber: number, partTitle: string, level: string, gates: GateCatalog[] }} PartCatalog */

/** @type {PartCatalog[]} */
export const LEARNING_PARTS = [
  {
    partNumber: 1,
    partTitle: "Mất gốc / Làm quen tiếng Anh",
    level: "A0",
    gates: [
      {
        gateNumber: 1,
        topicTitle: "Chào hỏi",
        sectionTitle: "Chào, hỏi tên, hỏi sức khỏe và tạm biệt",
        grammarPoint: "Đại từ nhân xưng I / You / He / She",
      },
    ],
  },
  {
    partNumber: 2,
    partTitle: "Sinh hoạt hằng ngày",
    level: "A0",
    gates: [
      {
        gateNumber: 1,
        topicTitle: "Thói quen buổi sáng",
        sectionTitle: "Thức dậy, vệ sinh cá nhân và ăn sáng",
        grammarPoint: "Thì hiện tại đơn (Present Simple)",
      },
    ],
  },
  {
    partNumber: 3,
    partTitle: "Giao tiếp cơ bản ngoài đời",
    level: "A1",
    gates: [
      {
        gateNumber: 1,
        topicTitle: "Mua sắm & hỏi giá",
        sectionTitle: "Chợ, siêu thị và thanh toán",
        grammarPoint: "How much / How many",
      },
    ],
  },
  {
    partNumber: 4,
    partTitle: "Gia đình, bạn bè, cảm xúc",
    level: "A1",
    gates: [
      {
        gateNumber: 1,
        topicTitle: "Kể về gia đình",
        sectionTitle: "Thành viên gia đình và mối quan hệ",
        grammarPoint: "Sở hữu cách (my, your, his, her)",
      },
    ],
  },
  {
    partNumber: 5,
    partTitle: "Công việc và học tập",
    level: "A1+",
    gates: [
      {
        gateNumber: 1,
        topicTitle: "Nghề nghiệp & môi trường làm việc",
        sectionTitle: "Giới thiệu công việc và nhiệm vụ hàng ngày",
        grammarPoint: "Thì hiện tại tiếp diễn (Present Continuous)",
      },
    ],
  },
  {
    partNumber: 6,
    partTitle: "Du lịch và tình huống thực tế",
    level: "A2",
    gates: [
      {
        gateNumber: 1,
        topicTitle: "Sân bay & khách sạn",
        sectionTitle: "Check-in, hỏi đường và đặt phòng",
        grammarPoint: "Can / Could — yêu cầu lịch sự",
      },
    ],
  },
  {
    partNumber: 7,
    partTitle: "Trung cấp giao tiếp",
    level: "B1",
    gates: [
      {
        gateNumber: 1,
        topicTitle: "Họp & email công việc",
        sectionTitle: "Giao tiếp trong văn phòng",
        grammarPoint: "Thì quá khứ đơn (Past Simple)",
      },
    ],
  },
  {
    partNumber: 8,
    partTitle: "Nâng cao / Tự tin giao tiếp",
    level: "B1+",
    gates: [
      {
        gateNumber: 1,
        topicTitle: "Thuyết trình & tranh luận",
        sectionTitle: "Trình bày ý kiến và phản biện",
        grammarPoint: "Liên từ (although, however, therefore)",
      },
    ],
  },
];

/** First lesson for new users (no demo progress). */
export const DEFAULT_FIRST_LESSON_ID = "p1-g1-n01";

/** @deprecated Use DEFAULT_FIRST_LESSON_ID — demo hardcode removed for Web+App sync */
export const DEMO_ACTIVE_LESSON_ID = DEFAULT_FIRST_LESSON_ID;
