/**
 * One-blank context cloze.
 * The gap is an index, so a repeated word is not replaced everywhere.
 */

function tidy(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function gapAt(tokens, index) {
  return (tokens || []).map((token, i) => (i === index ? "___" : token)).join(" ");
}

export function completeAt(tokens, index, word) {
  return (tokens || []).map((token, i) => (i === index ? word : token)).join(" ");
}

function normalizeBlank(value) {
  return tidy(value)
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

export function gradeContextCloze(exercise, answer) {
  const given = normalizeBlank(answer);
  if (!given) return false;
  const answers = Array.isArray(exercise?.extensions?.answers) ? exercise.extensions.answers : [];
  return answers.some((item) => normalizeBlank(item) === given);
}

function item(blankId, focus, prompt, tokens, gapIndex, answers, distractors, explanation) {
  return { blankId, focus, prompt, tokens, gapIndex, answers, distractors, explanation };
}

const BANK = {
  1: [
    item("p1-hello-am", "Đại từ", "Đọc lời chào và điền đại từ.", ["Hello.", "I", "am", "Beego."], 1, ["I"], ["You", "He", "She"], "Chỉ I đi với am khi tự giới thiệu."),
    item("p1-mother-she", "Đại từ", "Đọc câu về mẹ và điền đại từ.", ["My", "mother", "is", "at", "home.", "She", "is", "kind."], 5, ["She"], ["He", "They", "I"], "mother là một người nữ, nên đại từ là She."),
  ],
  2: [
    item("p2-breakfast-eats", "Chia động từ", "Đọc thói quen buổi sáng và điền động từ.", ["Every", "morning", "she", "eats", "breakfast", "at", "home."], 3, ["eats"], ["eat", "ate", "eating"], "she ở hiện tại đơn đi với eats."),
    item("p2-work-go", "Chia động từ", "Đọc giờ đi làm và điền động từ.", ["They", "go", "to", "work", "at", "7."], 1, ["go"], ["goes", "went", "going"], "They đi với go, không thêm -s."),
  ],
  3: [
    item("p3-bag-in", "Giới từ", "Đọc câu ở chợ và điền giới từ.", ["The", "apples", "are", "in", "the", "bag."], 3, ["in"], ["on", "at", "to"], "Đồ nằm bên trong túi dùng in."),
    item("p3-shop-at", "Giới từ", "Đọc giờ mở cửa và điền giới từ.", ["The", "shop", "opens", "at", "8."], 3, ["at"], ["in", "on", "to"], "Giờ đúng dùng at."),
  ],
  4: [
    item("p4-brother-he", "Đại từ", "Đọc câu về anh trai và điền đại từ.", ["This", "photo", "shows", "my", "brother.", "He", "is", "young."], 5, ["He"], ["She", "They", "We"], "brother là một người nam, nên đại từ là He."),
    item("p4-home-our", "Đại từ", "Đọc câu về nhà và điền đại từ.", ["We", "live", "here.", "Our", "home", "is", "happy."], 3, ["Our"], ["My", "Their", "His"], "We sở hữu ngôi nhà thì dùng Our."),
  ],
  5: [
    item("p5-job-but", "Liên kết ý", "Đọc câu về công việc và điền từ nối.", ["I", "like", "my", "job,", "but", "I", "am", "busy", "today."], 4, ["but"], ["and", "because", "or"], "but nối hai ý trái nhau: thích việc nhưng hôm nay bận."),
    item("p5-office-works", "Chia động từ", "Đọc câu về văn phòng và điền động từ.", ["She", "works", "in", "an", "office", "every", "day."], 1, ["works"], ["work", "worked", "working"], "She ở hiện tại đơn đi với works."),
  ],
  6: [
    item("p6-floor-on", "Giới từ", "Đọc câu ở khách sạn và điền giới từ.", ["Mai", "asks", "for", "the", "room.", "The", "room", "is", "on", "the", "second", "floor."], 8, ["on"], ["in", "at", "to"], "Tầng của một tòa nhà dùng on."),
    item("p6-taxi-to", "Giới từ", "Đọc câu xin đi taxi và điền giới từ.", ["I", "need", "a", "taxi", "to", "the", "hotel."], 4, ["to"], ["on", "at", "in"], "Điểm đến của taxi dùng to."),
  ],
  7: [
    item("p7-email-attach", "Cụm từ thông dụng", "Đọc yêu cầu trong email và điền động từ.", ["Please", "attach", "the", "file", "before", "noon."], 1, ["attach"], ["attached", "attaches", "attaching"], "Please đứng trước động từ nguyên mẫu attach."),
    item("p7-minutes-and", "Liên kết ý", "Đọc hai việc đã làm và điền từ nối.", ["I", "sent", "the", "minutes", "yesterday", "and", "I", "will", "call", "today."], 5, ["and"], ["but", "or", "because"], "and nối hai việc cùng chiều, không đối lập."),
  ],
  8: [
    item("p8-evidence-therefore", "Liên kết ý", "Đọc kết luận và điền từ nối.", ["The", "evidence", "is", "clear.", "Therefore,", "we", "should", "agree."], 4, ["Therefore", "So"], ["However", "Although", "But"], "Therefore và So cùng dẫn ra kết luận. However đổi chiều ý."),
    item("p8-cost-however", "Liên kết ý", "Đọc ý kiến và phần phản đối rồi điền từ nối.", ["I", "like", "the", "idea.", "However,", "the", "cost", "is", "high."], 4, ["However", "But"], ["Therefore", "So", "And"], "However và But báo ý trái lại. Therefore báo kết luận."),
  ],
};

export function buildContextCloze(partNumber, seed) {
  const part = Number(partNumber) || 1;
  const list = BANK[part] || BANK[1];
  const source = list[Math.abs(Number(seed) || 0) % list.length];
  const tokens = source.tokens.map((token, index) => (index === source.gapIndex ? source.answers[0] : token));
  return {
    blankId: source.blankId,
    focus: source.focus,
    prompt: source.prompt,
    tokens,
    gapIndex: source.gapIndex,
    answers: [...source.answers],
    distractors: [...source.distractors],
    display: gapAt(tokens, source.gapIndex),
    completed: completeAt(tokens, source.gapIndex, source.answers[0]),
    explanation: source.explanation,
    inputMode: part >= 5 ? "text" : "choice",
  };
}
