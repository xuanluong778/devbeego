/**
 * Curated dialogue completion. One pending turn, graded by choice id.
 * Follow-up is shown only after the existing check; it is not a second score.
 */

function line(turnId, speaker, avatar, text) {
  return { turnId, speaker, avatar, text, pending: false };
}

function blank(turnId, speaker, avatar) {
  return { turnId, speaker, avatar, text: "", pending: true };
}

function item({
  blankId,
  situation,
  lines,
  followUp,
  reply,
  distractors,
  explanation,
}) {
  return { blankId, situation, lines, followUp, reply, distractors, explanation };
}

const BANK = {
  1: [
    item({
      blankId: "p1-name-reply",
      situation: "acquaintance",
      lines: [
        line("p1-name-mai", "Mai", "👩", "Hi. What is your name?"),
        blank("p1-name-you", "Beego", "🐝"),
      ],
      followUp: line("p1-name-next", "Mai", "👩", "Nice to meet you."),
      reply: "My name is Beego.",
      distractors: ["It is ten dollars.", "Turn left.", "A tea, please."],
      explanation: "Mai đang hỏi tên. Câu đáp cần nói tên, không gọi món hay chỉ đường.",
    }),
    item({
      blankId: "p1-tea-reply",
      situation: "order",
      lines: [
        line("p1-tea-nam", "Nam", "🧑‍🍳", "Hello. What would you like?"),
        blank("p1-tea-you", "Beego", "🐝"),
      ],
      followUp: line("p1-tea-next", "Nam", "🧑‍🍳", "One tea. Here you are."),
      reply: "I would like tea, please.",
      distractors: ["My name is tea.", "The station is on the left.", "I work in an office."],
      explanation: "Nam đang hỏi món. Câu đáp cần gọi món, không giới thiệu tên hay chỉ đường.",
    }),
  ],
  2: [
    item({
      blankId: "p2-station-reply",
      situation: "directions",
      lines: [
        line("p2-station-lan", "Lan", "🚶", "Excuse me. Where is the station?"),
        blank("p2-station-you", "Beego", "🐝"),
      ],
      followUp: line("p2-station-next", "Lan", "🚶", "Thank you. I will go straight."),
      reply: "Go straight, then turn left.",
      distractors: ["I would like the station.", "My name is station.", "It costs five dollars."],
      explanation: "Lan hỏi đường đến nhà ga. Câu đáp cần chỉ hướng đi.",
    }),
    item({
      blankId: "p2-bag-reply",
      situation: "shopping",
      lines: [
        line("p2-bag-hoa", "Hoa", "🛍️", "How much is this bag?"),
        blank("p2-bag-you", "Beego", "🐝"),
      ],
      followUp: line("p2-bag-next", "Hoa", "🛍️", "I will take it."),
      reply: "It is ten dollars.",
      distractors: ["Turn left at the bag.", "Nice to meet you.", "Please send the file."],
      explanation: "Hoa hỏi giá túi. Câu đáp cần nói số tiền.",
    }),
  ],
  3: [
    item({
      blankId: "p3-file-reply",
      situation: "work",
      lines: [
        line("p3-file-an", "An", "💼", "Can you send the file today?"),
        blank("p3-file-you", "Beego", "🐝"),
      ],
      followUp: line("p3-file-next", "An", "💼", "Thank you. I need it before noon."),
      reply: "Yes. I will send it today.",
      distractors: ["The file is two dollars.", "Turn left after the file.", "A tea, please."],
      explanation: "An nhờ gửi tệp trong hôm nay. Câu đáp cần nhận việc và nói thời điểm gửi.",
    }),
    item({
      blankId: "p3-table-reply",
      situation: "order",
      lines: [
        line("p3-table-nam", "Nam", "🧑‍🍳", "Is this table free?"),
        blank("p3-table-you", "Beego", "🐝"),
      ],
      followUp: line("p3-table-next", "Nam", "🧑‍🍳", "Thank you. A water, please."),
      reply: "Yes. Please sit here.",
      distractors: ["The table is twenty dollars.", "Turn left at the table.", "I will attach the table."],
      explanation: "Nam hỏi bàn còn trống không. Câu đáp cần mời ngồi, không báo giá hay chỉ đường.",
    }),
  ],
  4: [
    item({
      blankId: "p4-shirt-reply",
      situation: "shopping",
      lines: [
        line("p4-shirt-hoa", "Hoa", "🛍️", "Do you have this shirt in blue?"),
        blank("p4-shirt-you", "Beego", "🐝"),
      ],
      followUp: line("p4-shirt-next", "Hoa", "🛍️", "Great. I will try it on."),
      reply: "Yes. Here is a blue shirt.",
      distractors: ["The shirt turns left.", "My name is blue.", "I will email the shirt."],
      explanation: "Hoa hỏi áo màu xanh. Câu đáp cần xác nhận và đưa đúng màu.",
    }),
    item({
      blankId: "p4-hospital-reply",
      situation: "directions",
      lines: [
        line("p4-hospital-lan", "Lan", "🚶", "How do I get to the hospital?"),
        blank("p4-hospital-you", "Beego", "🐝"),
      ],
      followUp: line("p4-hospital-next", "Lan", "🚶", "Thanks. I will walk there."),
      reply: "Walk two blocks and turn right.",
      distractors: ["The hospital costs ten dollars.", "I would like a hospital, please.", "Please attach the hospital."],
      explanation: "Lan hỏi đường đến bệnh viện. Câu đáp cần mô tả lối đi.",
    }),
  ],
  5: [
    item({
      blankId: "p5-meet-reply",
      situation: "work",
      lines: [
        line("p5-meet-an", "An", "💼", "Could we meet at 3?"),
        blank("p5-meet-you", "Beego", "🐝"),
      ],
      followUp: line("p5-meet-next", "An", "💼", "Good. See you at 3."),
      reply: "Yes. Three o'clock works for me.",
      distractors: ["Three o'clock is on the left.", "I would like three coffees.", "It is three dollars."],
      explanation: "An hỏi họp lúc 3 giờ. Câu đáp cần nhận giờ họp, không gọi món hay báo giá.",
    }),
    item({
      blankId: "p5-hello-reply",
      situation: "acquaintance",
      lines: [
        line("p5-hello-mai", "Mai", "👩", "I am new here. Are you on this team?"),
        blank("p5-hello-you", "Beego", "🐝"),
      ],
      followUp: line("p5-hello-next", "Mai", "👩", "Good. I am Mai."),
      reply: "Yes. I am Beego. Welcome.",
      distractors: ["The team is twelve dollars.", "Turn right at the team.", "One tea for the team, please."],
      explanation: "Mai làm quen và hỏi có cùng nhóm không. Câu đáp cần xác nhận và chào.",
    }),
  ],
  6: [
    item({
      blankId: "p6-jacket-reply",
      situation: "shopping",
      lines: [
        line("p6-jacket-hoa", "Hoa", "🛍️", "I would like to return this jacket."),
        blank("p6-jacket-you", "Beego", "🐝"),
      ],
      followUp: line("p6-jacket-next", "Hoa", "🛍️", "Yes. Here is the receipt."),
      reply: "Do you have the receipt?",
      distractors: ["The jacket turns right.", "Nice to meet you, jacket.", "I will send the jacket at 3."],
      explanation: "Hoa muốn trả áo khoác. Câu đáp của người bán cần hỏi hóa đơn.",
    }),
    item({
      blankId: "p6-bus-reply",
      situation: "directions",
      lines: [
        line("p6-bus-lan", "Lan", "🚶", "Which bus goes to the hotel?"),
        blank("p6-bus-you", "Beego", "🐝"),
      ],
      followUp: line("p6-bus-next", "Lan", "🚶", "Thanks. I will take that bus."),
      reply: "Take bus number 5.",
      distractors: ["The hotel is five dollars.", "I would like a bus, please.", "My name is bus."],
      explanation: "Lan hỏi xe buýt nào đến khách sạn. Câu đáp cần nói tuyến xe.",
    }),
  ],
  7: [
    item({
      blankId: "p7-report-reply",
      situation: "work",
      lines: [
        line("p7-report-an", "An", "💼", "Did you attach the report?"),
        blank("p7-report-you", "Beego", "🐝"),
      ],
      followUp: line("p7-report-next", "An", "💼", "Perfect. I will read it now."),
      reply: "Yes. The report is attached.",
      distractors: ["The report is next to the station.", "I would like a report, please.", "The report costs nine dollars."],
      explanation: "An hỏi báo cáo đã đính kèm chưa. Câu đáp cần xác nhận tệp đính kèm.",
    }),
    item({
      blankId: "p7-bill-reply",
      situation: "order",
      lines: [
        line("p7-bill-nam", "Nam", "🧑‍🍳", "Could we have the bill, please?"),
        blank("p7-bill-you", "Beego", "🐝"),
      ],
      followUp: line("p7-bill-next", "Nam", "🧑‍🍳", "Thank you. I will pay by card."),
      reply: "Of course. Here is the bill.",
      distractors: ["Turn left for the bill.", "My name is Bill.", "The bill is in the attachment."],
      explanation: "Nam gọi tính tiền. Câu đáp cần đưa hóa đơn, không chỉ đường hay nói về tệp đính kèm.",
    }),
  ],
  8: [
    item({
      blankId: "p8-summary-reply",
      situation: "work",
      lines: [
        line("p8-summary-an", "An", "💼", "The client wants a shorter summary."),
        blank("p8-summary-you", "Beego", "🐝"),
      ],
      followUp: line("p8-summary-next", "An", "💼", "Thanks. Send it before the meeting."),
      reply: "I will make the summary shorter.",
      distractors: ["Turn left to make it shorter.", "A shorter coffee, please.", "My name is Summary."],
      explanation: "An nói khách muốn bản tóm tắt ngắn hơn. Câu đáp cần nhận việc chỉnh bản tóm tắt.",
    }),
    item({
      blankId: "p8-shoes-reply",
      situation: "shopping",
      lines: [
        line("p8-shoes-hoa", "Hoa", "🛍️", "These shoes are too small."),
        blank("p8-shoes-you", "Beego", "🐝"),
      ],
      followUp: line("p8-shoes-next", "Hoa", "🛍️", "Yes. Size 42, please."),
      reply: "Would you like a larger size?",
      distractors: ["The shoes are in the email.", "Go straight, then the shoes.", "Nice to meet you."],
      explanation: "Hoa nói giày chật. Câu đáp của người bán cần đề nghị cỡ lớn hơn.",
    }),
  ],
};

export function buildDialogueResponse(partNumber, seed) {
  const part = Math.min(8, Math.max(1, Number(partNumber) || 1));
  const bank = BANK[part];
  return bank[Math.abs(Number(seed) || 0) % bank.length];
}

/** Lines in order. The follow-up appears only after grading. */
export function visibleDialogueTurns(exercise, graded) {
  const lines = Array.isArray(exercise?.extensions?.lines) ? exercise.extensions.lines : [];
  const reply = graded
    ? String(
        exercise?.options?.find((opt) => opt.id === exercise.correctAnswer)?.text ||
          exercise?.extensions?.reply ||
          ""
      )
    : "";
  const shown = lines.map((entry) =>
    entry?.pending ? { ...entry, text: reply } : entry
  );
  if (graded && exercise?.extensions?.followUp) shown.push(exercise.extensions.followUp);
  return shown;
}
