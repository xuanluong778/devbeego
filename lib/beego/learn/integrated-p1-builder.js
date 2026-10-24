/**
 * Dedicated builder for Part 1 Gate 1 lessons (p1-g1-n01 to p1-g1-n14).
 * Mỗi bài chuẩn hóa đúng 10 hoạt động: giữ câu cũ, chỉ thêm phần đệm sư phạm.
 */

import { P1_CONTENT_REVISION, evidenceRoleForActivity } from "@/lib/beego/learn/p1-g1-plan";

const OPTION_IDS = ["a", "b", "c", "d"];
const TARGET_ACTIVITY_COUNT = 10;

function tidy(val) {
  return String(val || "").replace(/\s+/g, " ").trim();
}

function shuffleList(list, seed) {
  const copy = [...list];
  const out = [];
  let state = Math.abs(Number(seed) || 1);
  while (copy.length) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    out.push(copy.splice(state % copy.length, 1)[0]);
  }
  return out;
}

export function fourOptions(correctText, distractors, seed) {
  const correct = tidy(correctText);
  const wrongs = [];
  for (const item of distractors || []) {
    const text = tidy(item);
    if (!text || text.toLowerCase() === correct.toLowerCase()) continue;
    if (wrongs.some((w) => w.toLowerCase() === text.toLowerCase())) continue;
    wrongs.push(text);
    if (wrongs.length === 3) break;
  }
  const bag = shuffleList(
    [{ text: correct, correct: true }, ...wrongs.slice(0, 3).map((t) => ({ text: t, correct: false }))],
    seed
  );
  const options = bag.map((item, idx) => ({ id: OPTION_IDS[idx], text: item.text }));
  const correctIdx = bag.findIndex((item) => item.correct);
  return {
    options,
    correctAnswer: options[correctIdx >= 0 ? correctIdx : 0].id,
  };
}

function stamp(q, actNum) {
  return {
    ...q,
    extensions: {
      ...(q.extensions || {}),
      integratedLesson: true,
      activity: actNum,
      evidenceRole: evidenceRoleForActivity(actNum),
      contentRevision: P1_CONTENT_REVISION,
    },
  };
}

function maxSourceIndex(questions) {
  let max = 0;
  for (const question of questions || []) {
    const match = String(question?.id || "").match(/-a(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

function hasType(questions, type) {
  return (questions || []).some((question) => question?.type === type);
}

/**
 * Pad to exactly 10 activities without removing existing ones.
 * New items use fresh aXX ids (> max existing) so lịch sử a01… cũ vẫn khớp.
 */
function ensureTenP1Activities(questions, { gatePlan, seed, idFor }) {
  const out = Array.isArray(questions) ? [...questions] : [];
  if (out.length >= TARGET_ACTIVITY_COUNT) {
    return out.slice(0, TARGET_ACTIVITY_COUNT).map((question, index) => stamp(question, index + 1));
  }

  let nextIdx = maxSourceIndex(out) + 1;
  const allocId = () => idFor(nextIdx++);
  const goal = tidy(gatePlan?.goal) || "chào hỏi và giao tiếp cơ bản";
  const phrase = gatePlan?.phrases?.[0] || null;
  const listen = tidy(gatePlan?.listen || phrase?.en);
  const listenVi = tidy(phrase?.vi || "");
  const speak = tidy(gatePlan?.speak || phrase?.en);
  const vocab = Array.isArray(gatePlan?.vocab) ? gatePlan.vocab : [];

  const fillers = [];

  // Mục tiêu bài (VI) — không lộ đáp án Anh
  {
    const choice = fourOptions(`Luyện: ${goal}`, ["Viết luận học thuật", "Dịch hợp đồng", "Học bảng chữ cái Latin"], seed + 801);
    fillers.push({
      id: allocId(),
      type: "multiple_choice",
      skillLabel: "Mục tiêu bài",
      prompt: "Bài học này giúp bạn làm gì?",
      options: choice.options,
      correctAnswer: choice.correctAnswer,
      explanation: `Mục tiêu bài: ${goal}.`,
      required: true,
    });
  }

  if (listen) {
    const wrongs = (gatePlan?.phrases || [])
      .map((item) => tidy(item?.en))
      .filter((text) => text && text.toLowerCase() !== listen.toLowerCase());
    while (wrongs.length < 3) wrongs.push("Thank you.", "Good night.", "Excuse me.");
    const choice = fourOptions(listen, wrongs, seed + 802);
    fillers.push({
      id: allocId(),
      type: "listening_choice",
      skillLabel: "Nghe và chọn câu",
      prompt: "Nghe và chọn câu đúng.",
      options: choice.options,
      correctAnswer: choice.correctAnswer,
      explanation: listenVi ? `${listen} nghĩa là ${listenVi}.` : listen,
      ttsText: listen,
      required: true,
      extensions: { ttsText: listen },
    });
  }

  if (listen && listenVi) {
    const choice = fourOptions(listenVi, ["Cảm ơn bạn.", "Xin lỗi.", "Tạm biệt."], seed + 803);
    fillers.push({
      id: allocId(),
      type: "listening_choice",
      skillLabel: "Nghe chọn nghĩa",
      prompt: "Nghe câu tiếng Anh rồi chọn nghĩa tiếng Việt đúng.",
      options: choice.options,
      correctAnswer: choice.correctAnswer,
      explanation: `${listen} = ${listenVi}.`,
      ttsText: listen,
      required: true,
      extensions: { ttsText: listen, choicePresentation: "picture" },
    });
  }

  if (!hasType(out, "matching_pairs") && vocab.length >= 4) {
    const pairs = vocab.slice(0, 4).map((item, index) => ({
      pairId: `pair-pad-${index + 1}-${tidy(item.en).toLowerCase().replace(/[^a-z0-9]+/g, "") || index}`,
      en: tidy(item.en),
      vi: tidy(item.vi),
    }));
    fillers.push({
      id: allocId(),
      type: "matching_pairs",
      skillLabel: "Ghép từ Anh–Việt",
      prompt: "Ghép từ tiếng Anh với nghĩa tiếng Việt tương ứng.",
      pairs,
      explanation: "Ghép đúng từng cặp Anh–Việt.",
      required: true,
    });
  }

  if (phrase?.en && phrase?.words?.length) {
    const extras = vocab.map((item) => tidy(item.en)).filter(Boolean).slice(0, 2);
    fillers.push({
      id: allocId(),
      type: "word_order",
      skillLabel: "Sắp xếp từ",
      prompt: `Sắp xếp thành câu tiếng Anh có nghĩa: «${phrase.vi || goal}»`,
      wordBank: [...phrase.words, ...extras].slice(0, Math.max(phrase.words.length + 2, 6)),
      correctAnswer: [...phrase.words],
      acceptedAnswers: [[...phrase.words]],
      explanation: phrase.en,
      required: true,
      extensions: { modelSentence: phrase.en, meaning: phrase.vi || goal },
    });
  }

  if (listenVi) {
    const words = tidy(listen)
      .replace(/[.!?]+$/g, "")
      .split(/\s+/)
      .filter(Boolean);
    if (words.length >= 2) {
      fillers.push({
        id: allocId(),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: `Dịch sang tiếng Anh: «${listenVi}»`,
        wordBank: [...words, "is", "are", "the"].slice(0, Math.max(words.length + 2, 5)),
        correctAnswer: words,
        acceptedAnswers: [words],
        explanation: `${listenVi} → ${listen}`,
        required: true,
        extensions: { translationDirection: "vi-to-en", modelSentence: listen },
      });
    }
  }

  fillers.push({
    id: allocId(),
    type: "multiple_choice",
    skillLabel: "Bạn vừa làm được",
    prompt: "Cuối bài: hôm nay bạn vừa luyện chủ đề gì?",
    ...(() => {
      const choice = fourOptions(goal, ["Đặt vé máy bay", "Viết báo cáo dài", "Học công thức toán"], seed + 809);
      return { options: choice.options, correctAnswer: choice.correctAnswer };
    })(),
    explanation: `Bạn vừa luyện: ${goal}.`,
    required: true,
    extensions: { lessonWrapUp: true, ...(speak ? { modelSentence: speak } : {}) },
  });

  // Chèn phần đệm trước câu speaking (nếu có) để phần nói vẫn ở cuối.
  const speakIndex = out.findIndex((question) => question?.type === "speaking");
  const head = speakIndex >= 0 ? out.slice(0, speakIndex) : out;
  const tail = speakIndex >= 0 ? out.slice(speakIndex) : [];
  const need = TARGET_ACTIVITY_COUNT - out.length;
  const extra = fillers.slice(0, Math.max(0, need));
  const merged = [...head, ...extra, ...tail].slice(0, TARGET_ACTIVITY_COUNT);

  // Nếu vẫn thiếu (hiếm), lặp wrap-up biến thể
  while (merged.length < TARGET_ACTIVITY_COUNT) {
    const choice = fourOptions(goal, ["Chủ đề khác A", "Chủ đề khác B", "Chủ đề khác C"], seed + 900 + merged.length);
    merged.push({
      id: allocId(),
      type: "multiple_choice",
      skillLabel: "Củng cố",
      prompt: "Chọn mục tiêu đúng của bài học.",
      options: choice.options,
      correctAnswer: choice.correctAnswer,
      explanation: `Mục tiêu: ${goal}.`,
      required: true,
    });
  }

  return merged.map((question, index) => stamp(question, index + 1));
}

export function buildP1GateLessonQuestions({ lessonId, nodeIndex, gatePlan, seed, idFor }) {
  const questions = [];
  const n = Number(nodeIndex);

  if (n === 1) {
    // n01 r5: giữ nguyên a01–a06; thêm mở đầu hội thoại, giới thiệu mẫu câu, kết bài.
    // Thứ tự phát: a07 → a08 → a09 → a01…a06 → a10 (id cũ không đổi).

    // a07 — Hội thoại mở đầu: nghe câu chào + xưng tên
    const openListen = fourOptions("Hello. I am Nam.", ["Good night.", "Thank you.", "Excuse me."], seed + 70);
    questions.push(
      stamp(
        {
          id: idFor(7),
          type: "listening_choice",
          skillLabel: "Hội thoại mở đầu",
          prompt: "Nghe hội thoại ngắn. Nam đang nói gì?",
          options: openListen.options,
          correctAnswer: openListen.correctAnswer,
          explanation:
            "Nam chào và tự giới thiệu: «Hello. I am Nam.» = Xin chào. Tôi là Nam. Nghe lại nếu cần rồi chọn đúng.",
          ttsText: "Hello. I am Nam.",
          required: true,
          extensions: {
            ttsText: "Hello. I am Nam.",
            dialogueLead: true,
            meaningVi: "Xin chào. Tôi là Nam.",
          },
        },
        1
      )
    );

    // a08 — Nghĩa hội thoại vừa nghe
    const openMeaning = fourOptions(
      "Xin chào. Tôi là Nam.",
      ["Tạm biệt. Hẹn gặp lại.", "Cảm ơn bạn nhiều.", "Xin lỗi, tôi đến muộn."],
      seed + 71
    );
    questions.push(
      stamp(
        {
          id: idFor(8),
          type: "multiple_choice",
          skillLabel: "Hiểu nghĩa hội thoại",
          prompt: "Câu «Hello. I am Nam.» nghĩa là gì?",
          options: openMeaning.options,
          correctAnswer: openMeaning.correctAnswer,
          explanation: "Hello = xin chào; I am + tên = tôi là / tôi tên là …",
          required: true,
          extensions: { ttsText: "Hello. I am Nam.", meaningVi: "Xin chào. Tôi là Nam." },
        },
        2
      )
    );

    // a09 — Giới thiệu ý mẫu câu (không lộ cấu trúc Anh trong đề)
    const patternIntro = fourOptions(
      "Chào hỏi rồi nói tên mình",
      ["Chào tạm biệt rồi hỏi đường", "Chỉ cảm ơn rồi hỏi sức khỏe", "Hỏi giá rồi nói tên"],
      seed + 72
    );
    questions.push(
      stamp(
        {
          id: idFor(9),
          type: "multiple_choice",
          skillLabel: "Mẫu câu cần nhớ",
          prompt: "Trước khi luyện: khi mới gặp ai, bạn thường làm gì để tự giới thiệu?",
          options: patternIntro.options,
          correctAnswer: patternIntro.correctAnswer,
          explanation:
            "Đúng: chào rồi nói tên mình. Cấu trúc tiếng Anh: Hello, I am + [tên]. Ví dụ: Hello, I am Nam.",
          required: true,
          extensions: {
            modelSentence: "Hello, I am Nam.",
            meaning: "Xin chào, tôi là Nam.",
            patternIntro: true,
          },
        },
        3
      )
    );

    // —— Giữ nguyên nội dung a01–a06 (không đổi đáp án / id) ——
    const picOpts = shuffleList(
      [
        { text: "name", meaningVi: "tên gọi", imageEmoji: "🪪", correct: true },
        { text: "morning", meaningVi: "buổi sáng", imageEmoji: "🌅", correct: false },
        { text: "night", meaningVi: "buổi tối", imageEmoji: "🌙", correct: false },
        { text: "thanks", meaningVi: "cảm ơn", imageEmoji: "🙏", correct: false },
      ],
      seed + 1
    );
    const picChoice = picOpts.map((item, i) => ({
      id: OPTION_IDS[i],
      text: item.text,
      meaningVi: item.meaningVi,
      imageEmoji: item.imageEmoji,
    }));
    questions.push(
      stamp(
        {
          id: idFor(1),
          type: "listening_choice",
          skillLabel: "Nghe và chọn nghĩa",
          prompt: "Nghe từ tiếng Anh rồi chọn nghĩa tiếng Việt đúng.",
          options: picChoice,
          correctAnswer: picChoice[picOpts.findIndex((p) => p.correct)].id,
          explanation: "name có nghĩa là tên gọi. Nếu sai, nghe lại từ «name» rồi chọn «tên gọi».",
          ttsText: "name",
          required: true,
          extensions: { choicePresentation: "picture", ttsText: "name" },
        },
        4
      )
    );

    const q2Opts = fourOptions("Xin chào", ["Tạm biệt", "Cảm ơn", "Xin lỗi"], seed + 2);
    questions.push(
      stamp(
        {
          id: idFor(2),
          type: "multiple_choice",
          skillLabel: "Chọn nghĩa đúng",
          prompt: "Từ «Hello» trong tiếng Anh có nghĩa là gì?",
          options: q2Opts.options,
          correctAnswer: q2Opts.correctAnswer,
          explanation: "Hello là lời chào thân thiện khi gặp mặt — không phải tạm biệt hay cảm ơn.",
          required: true,
          extensions: { ttsText: "Hello" },
        },
        5
      )
    );

    questions.push(
      stamp(
        {
          id: idFor(3),
          type: "matching_pairs",
          skillLabel: "Ghép từ Anh–Việt",
          prompt: "Ghép từ tiếng Anh với nghĩa tiếng Việt tương ứng.",
          pairs: [
            { pairId: "pair-1-hello", en: "Hello", vi: "Xin chào" },
            { pairId: "pair-2-name", en: "name", vi: "tên" },
            { pairId: "pair-3-i", en: "I", vi: "tôi" },
            { pairId: "pair-4-you", en: "you", vi: "bạn" },
          ],
          explanation: "Ghép đúng từng từ với nghĩa tương ứng. Sai một cặp thì chỉnh lại trước khi tiếp tục.",
          required: true,
        },
        6
      )
    );

    questions.push(
      stamp(
        {
          id: idFor(4),
          type: "word_order",
          skillLabel: "Sắp xếp từ",
          prompt: "Sắp xếp các từ thành câu tiếng Anh có nghĩa: «Xin chào, tôi là Nam.»",
          wordBank: ["Hello,", "I", "am", "Nam.", "you", "name"],
          correctAnswer: ["Hello,", "I", "am", "Nam."],
          acceptedAnswers: [
            ["Hello,", "I", "am", "Nam."],
            ["Hello", "I", "am", "Nam."],
            ["Hi,", "I", "am", "Nam."],
            ["Hello,", "I", "am", "Beego."],
          ],
          explanation: "Cấu trúc xưng tên: Hello, I am + [Tên]. Ví dụ đúng: Hello, I am Nam.",
          required: true,
          extensions: { modelSentence: "Hello, I am Nam.", meaning: "Xin chào, tôi là Nam." },
        },
        7
      )
    );

    questions.push(
      stamp(
        {
          id: idFor(5),
          type: "translation",
          skillLabel: "Dịch câu",
          prompt: "Dịch sang tiếng Anh: «Tôi là Nam.»",
          wordBank: ["I", "am", "Nam", "Hello", "is", "my"],
          correctAnswer: ["I", "am", "Nam"],
          acceptedAnswers: [
            ["I", "am", "Nam"],
            ["I'm", "Nam"],
            ["I", "am", "Beego"],
          ],
          explanation: "I am Nam = Tôi là Nam. Không dùng is với I.",
          required: true,
          extensions: { translationDirection: "vi-to-en", modelSentence: "I am Nam." },
        },
        8
      )
    );

    questions.push(
      stamp(
        {
          id: idFor(6),
          type: "speaking",
          skillLabel: "Luyện nói phản xạ",
          prompt:
            "Bấm micro và tự giới thiệu bằng tên thật của bạn bằng tiếng Anh (tùy chọn). Có thể bỏ qua nếu chưa tiện mở mic.",
          speakTarget: "Hello, I am [name].",
          explanation:
            "Nói rõ: Hello, I am + tên thật (ví dụ Hello, I am Nam). Đây là luyện tập; lỗi mic không trừ tim.",
          required: false,
          extensions: {
            speakTarget: "Hello, I am Nam.",
            allowSelfIntroName: true,
            modelSentence: "Hello, I am Nam.",
            speakingHints: ["Hello, I am Nam.", "Hello, I am Linh.", "Hello, I am Beego."],
          },
        },
        9
      )
    );

    // a10 — Kết bài: nêu điều vừa làm được
    const wrap = fourOptions(
      "Chào hỏi và nói tên mình",
      ["Hỏi đường đến sân bay", "Kể về gia đình đầy đủ", "Viết email công việc"],
      seed + 73
    );
    questions.push(
      stamp(
        {
          id: idFor(10),
          type: "multiple_choice",
          skillLabel: "Bạn vừa làm được",
          prompt: "Cuối bài: hôm nay bạn vừa luyện được điều gì?",
          options: wrap.options,
          correctAnswer: wrap.correctAnswer,
          explanation:
            "Bạn đã luyện chào hỏi và nói tên (Hello, I am + tên), ghép từ, xếp câu, dịch và (tuỳ chọn) nói tên mình.",
          required: true,
          extensions: { lessonWrapUp: true, modelSentence: "Hello, I am Nam." },
        },
        10
      )
    );
  } else if (n === 2) {
    // n02: Hỏi tên người đối diện và nói tên trang trọng (6 câu)
    // 1. Nghe điền name
    const q1Opts = fourOptions("name", ["morning", "night", "thanks"], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "listening_fill",
        skillLabel: "Nghe và chọn từ còn thiếu",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "What is your ____?",
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "What is your name? nghĩa là Bạn tên gì?",
        ttsText: "What is your name?",
        required: true,
        extensions: { ttsText: "What is your name?", gapWord: "name" },
      }, 1)
    );

    // 2. Sắp xếp câu hỏi tên
    questions.push(
      stamp({
        id: idFor(2),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu hỏi: «Bạn tên gì?»",
        wordBank: ["What", "is", "your", "name?", "am", "fine"],
        correctAnswer: ["What", "is", "your", "name?"],
        acceptedAnswers: [["What", "is", "your", "name?"], ["What", "is", "your", "name"]],
        explanation: "Cấu trúc hỏi tên: What is your name?",
        required: true,
        extensions: { modelSentence: "What is your name?", meaning: "Bạn tên gì?" },
      }, 2)
    );

    // 3. Chọn ngữ cảnh hỏi tên
    const q3Opts = fourOptions("Hỏi tên người đối diện", ["Hỏi thăm sức khỏe", "Chào buổi sáng", "Chào tạm biệt"], seed + 3);
    questions.push(
      stamp({
        id: idFor(3),
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: "Câu «What is your name?» dùng trong tình huống nào?",
        options: q3Opts.options,
        correctAnswer: q3Opts.correctAnswer,
        explanation: "What is your name? dùng để hỏi tên người khác.",
        required: true,
      }, 3)
    );

    // 4. Phản hồi đối thoại
    const q4Opts = fourOptions("My name is Nam.", ["I am fine.", "Good morning.", "Thank you."], seed + 4);
    questions.push(
      stamp({
        id: idFor(4),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Lan hỏi bạn: «What is your name?». Bạn trả lời thế nào?",
        options: q4Opts.options,
        correctAnswer: q4Opts.correctAnswer,
        explanation: "Sau câu hỏi xin tên, ta trả lời: My name is + [Tên].",
        required: true,
      }, 4)
    );

    // 5. Dịch câu đáp tên
    questions.push(
      stamp({
        id: idFor(5),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Tên tôi là Nam.»",
        wordBank: ["My", "name", "is", "Nam", "What", "your"],
        correctAnswer: ["My", "name", "is", "Nam"],
        acceptedAnswers: [["My", "name", "is", "Nam"], ["My", "name", "is", "Beego"]],
        explanation: "My name is Nam nghĩa là Tên tôi là Nam.",
        required: true,
        extensions: { translationDirection: "vi-to-en", modelSentence: "My name is Nam." },
      }, 5)
    );

    // 6. Nói câu hỏi và đáp tên
    questions.push(
      stamp({
        id: idFor(6),
        type: "speaking",
        skillLabel: "Luyện nói phản xạ",
        prompt: "Luyện phát âm câu: «What is your name? My name is Nam.»",
        speakTarget: "What is your name? My name is Nam.",
        explanation: "Luyện tập hỏi và đáp tên lưu loát.",
        required: false,
        extensions: { speakTarget: "What is your name? My name is Nam." },
      }, 6)
    );
  } else if (n === 3) {
    // n03: Chào theo thời điểm (Sáng / Chiều) (7 câu)
    const picOpts = shuffleList(
      [
        { text: "morning", meaningVi: "buổi sáng", correct: true },
        { text: "afternoon", meaningVi: "buổi chiều", correct: false },
        { text: "night", meaningVi: "buổi tối", correct: false },
        { text: "name", meaningVi: "tên", correct: false },
      ],
      seed + 1
    );
    const picChoice = picOpts.map((item, i) => ({ id: OPTION_IDS[i], text: item.text, meaningVi: item.meaningVi }));
    questions.push(
      stamp({
        id: idFor(1),
        type: "listening_choice",
        skillLabel: "Nghe và chọn hình",
        prompt: "Nghe và chọn hình ảnh buổi sáng.",
        options: picChoice,
        correctAnswer: picChoice[picOpts.findIndex((p) => p.correct)].id,
        explanation: "morning là buổi sáng.",
        ttsText: "morning",
        required: true,
        extensions: { choicePresentation: "picture", ttsText: "morning" },
      }, 1)
    );

    const q2Opts = fourOptions("Buổi sáng", ["Buổi chiều", "Buổi tối", "Lúc chia tay"], seed + 2);
    questions.push(
      stamp({
        id: idFor(2),
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: "«Good morning» là lời chào vào thời điểm nào?",
        options: q2Opts.options,
        correctAnswer: q2Opts.correctAnswer,
        explanation: "Good morning dùng để chào vào buổi sáng.",
        required: true,
        extensions: { ttsText: "Good morning" },
      }, 2)
    );

    questions.push(
      stamp({
        id: idFor(3),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp lời chào: «Chào buổi sáng.»",
        wordBank: ["Good", "morning.", "night", "Hello"],
        correctAnswer: ["Good", "morning."],
        acceptedAnswers: [["Good", "morning."], ["Good", "morning"]],
        explanation: "Good morning. nghĩa là Chào buổi sáng.",
        required: true,
        extensions: { modelSentence: "Good morning." },
      }, 3)
    );

    const q4Opts = fourOptions("afternoon", ["morning", "night", "name"], seed + 4);
    questions.push(
      stamp({
        id: idFor(4),
        type: "listening_fill",
        skillLabel: "Nghe và chọn từ còn thiếu",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "Good ____.",
        options: q4Opts.options,
        correctAnswer: q4Opts.correctAnswer,
        explanation: "Good afternoon là lời chào buổi chiều.",
        ttsText: "Good afternoon.",
        required: true,
        extensions: { ttsText: "Good afternoon.", gapWord: "afternoon" },
      }, 4)
    );

    const q5Opts = fourOptions("Good afternoon!", ["Good morning!", "Good night!", "Excuse me!"], seed + 5);
    questions.push(
      stamp({
        id: idFor(5),
        type: "multiple_choice",
        skillLabel: "Tình huống giao tiếp",
        prompt: "Vào lúc 2 giờ chiều khi gặp đồng nghiệp, bạn chào thế nào?",
        options: q5Opts.options,
        correctAnswer: q5Opts.correctAnswer,
        explanation: "Từ sau 12h trưa đến chiều tối dùng Good afternoon!.",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Chào buổi chiều.»",
        wordBank: ["Good", "afternoon", "morning", "night", "Hello"],
        correctAnswer: ["Good", "afternoon"],
        acceptedAnswers: [["Good", "afternoon"]],
        explanation: "Good afternoon nghĩa là Chào buổi chiều.",
        required: true,
        extensions: { translationDirection: "vi-to-en", modelSentence: "Good afternoon." },
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "speaking",
        skillLabel: "Luyện nói phản xạ",
        prompt: "Luyện nói hai lời chào theo buổi: «Good morning! Good afternoon!»",
        speakTarget: "Good morning! Good afternoon!",
        explanation: "Luyện phát âm rõ hai buổi sáng và chiều.",
        required: false,
        extensions: { speakTarget: "Good morning! Good afternoon!" },
      }, 7)
    );
  } else if (n === 4) {
    // n04: Hỏi thăm sức khỏe và phản hồi (7 câu)
    const q1Opts = fourOptions("are", ["is", "am", "do"], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "listening_fill",
        skillLabel: "Nghe và chọn từ còn thiếu",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "How ____ you?",
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "How are you? là câu hỏi thăm sức khỏe phổ biến.",
        ttsText: "How are you?",
        required: true,
        extensions: { ttsText: "How are you?", gapWord: "are" },
      }, 1)
    );

    const q2Opts = fourOptions("Khỏe / ổn", ["Mệt mỏi", "Buồn ngủ", "Bận rộn"], seed + 2);
    questions.push(
      stamp({
        id: idFor(2),
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: "Từ «fine» trong câu «I am fine» có nghĩa là gì?",
        options: q2Opts.options,
        correctAnswer: q2Opts.correctAnswer,
        explanation: "fine có nghĩa là khỏe hoặc ổn định.",
        required: true,
      }, 2)
    );

    questions.push(
      stamp({
        id: idFor(3),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu: «Tôi khỏe, cảm ơn bạn.»",
        wordBank: ["I", "am", "fine,", "thank", "you.", "Where", "from"],
        correctAnswer: ["I", "am", "fine,", "thank", "you."],
        acceptedAnswers: [
          ["I", "am", "fine,", "thank", "you."],
          ["I", "am", "fine", "thank", "you."],
          ["I'm", "fine,", "thank", "you."],
        ],
        explanation: "I am fine, thank you. nghĩa là Tôi khỏe, cảm ơn bạn.",
        required: true,
        extensions: { modelSentence: "I am fine, thank you." },
      }, 3)
    );

    questions.push(
      stamp({
        id: idFor(4),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Bạn khỏe không?»",
        wordBank: ["How", "are", "you", "What", "is", "name"],
        correctAnswer: ["How", "are", "you"],
        acceptedAnswers: [["How", "are", "you"]],
        explanation: "How are you? là câu hỏi sức khỏe.",
        required: true,
        extensions: { translationDirection: "vi-to-en", modelSentence: "How are you?" },
      }, 4)
    );

    const q5Opts = fourOptions("I am fine, thank you.", ["My name is Nam.", "Good night.", "Where are you from?"], seed + 5);
    questions.push(
      stamp({
        id: idFor(5),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Khi John hỏi: «How are you?», bạn trả lời thế nào?",
        options: q5Opts.options,
        correctAnswer: q5Opts.correctAnswer,
        explanation: "Trả lời câu hỏi sức khỏe bằng: I am fine, thank you.",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Cảm ơn bạn.»",
        wordBank: ["Thank", "you", "fine", "am", "are"],
        correctAnswer: ["Thank", "you"],
        acceptedAnswers: [["Thank", "you"], ["Thanks"]],
        explanation: "Thank you nghĩa là Cảm ơn bạn.",
        required: true,
        extensions: { translationDirection: "vi-to-en", modelSentence: "Thank you." },
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "speaking",
        skillLabel: "Luyện nói phản xạ",
        prompt: "Luyện phát âm câu: «How are you? I am fine, thank you.»",
        speakTarget: "How are you? I am fine, thank you.",
        explanation: "Luyện phản xạ hỏi và đáp thăm sức khỏe tự nhiên.",
        required: false,
        extensions: { speakTarget: "How are you? I am fine, thank you." },
      }, 7)
    );
  } else if (n === 5) {
    // n05: Xuất thân & Quê quán (Where are you from / I am from Vietnam) (7 câu)
    const picOpts = shuffleList(
      [
        { text: "vietnam", meaningVi: "việt nam", correct: true },
        { text: "name", meaningVi: "tên", correct: false },
        { text: "morning", meaningVi: "buổi sáng", correct: false },
        { text: "thanks", meaningVi: "cảm ơn", correct: false },
      ],
      seed + 1
    );
    const picChoice = picOpts.map((item, i) => ({ id: OPTION_IDS[i], text: item.text, meaningVi: item.meaningVi }));
    questions.push(
      stamp({
        id: idFor(1),
        type: "listening_choice",
        skillLabel: "Nghe và chọn hình",
        prompt: "Nghe và chọn hình biểu thị Việt Nam.",
        options: picChoice,
        correctAnswer: picChoice[picOpts.findIndex((p) => p.correct)].id,
        explanation: "Vietnam nghĩa là Việt Nam.",
        ttsText: "Vietnam",
        required: true,
        extensions: { choicePresentation: "picture", ttsText: "Vietnam" },
      }, 1)
    );

    const q2Opts = fourOptions("Hỏi quê quán / xuất thân", ["Hỏi tên gọi", "Hỏi thăm sức khỏe", "Hỏi tuổi tác"], seed + 2);
    questions.push(
      stamp({
        id: idFor(2),
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: "Câu «Where are you from?» dùng để hỏi điều gì?",
        options: q2Opts.options,
        correctAnswer: q2Opts.correctAnswer,
        explanation: "Where are you from? hỏi về quê hương, đất nước xuất thân.",
        required: true,
        extensions: { ttsText: "Where are you from?" },
      }, 2)
    );

    questions.push(
      stamp({
        id: idFor(3),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu hỏi: «Bạn đến từ đâu?»",
        wordBank: ["Where", "are", "you", "from?", "is", "name"],
        correctAnswer: ["Where", "are", "you", "from?"],
        acceptedAnswers: [["Where", "are", "you", "from?"], ["Where", "are", "you", "from"]],
        explanation: "Cấu trúc hỏi xuất thân: Where are you from?",
        required: true,
        extensions: { modelSentence: "Where are you from?" },
      }, 3)
    );

    const q4Opts = fourOptions("from", ["name", "fine", "morning"], seed + 4);
    questions.push(
      stamp({
        id: idFor(4),
        type: "listening_fill",
        skillLabel: "Nghe và chọn từ còn thiếu",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "I am ____ Vietnam.",
        options: q4Opts.options,
        correctAnswer: q4Opts.correctAnswer,
        explanation: "Đi kèm địa danh là giới từ from: I am from Vietnam.",
        ttsText: "I am from Vietnam.",
        required: true,
        extensions: { ttsText: "I am from Vietnam.", gapWord: "from" },
      }, 4)
    );

    questions.push(
      stamp({
        id: idFor(5),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu: «Tôi đến từ Việt Nam.»",
        wordBank: ["I", "am", "from", "Vietnam.", "Where", "you"],
        correctAnswer: ["I", "am", "from", "Vietnam."],
        acceptedAnswers: [
          ["I", "am", "from", "Vietnam."],
          ["I", "am", "from", "Vietnam"],
          ["I'm", "from", "Vietnam."],
        ],
        explanation: "I am from Vietnam nghĩa là Tôi đến từ Việt Nam.",
        required: true,
        extensions: { modelSentence: "I am from Vietnam." },
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Tôi đến từ Việt Nam.»",
        wordBank: ["I", "am", "from", "Vietnam", "Where", "is"],
        correctAnswer: ["I", "am", "from", "Vietnam"],
        acceptedAnswers: [["I", "am", "from", "Vietnam"], ["I'm", "from", "Vietnam"]],
        explanation: "I am from Vietnam là câu nói xuất xứ chuẩn.",
        required: true,
        extensions: { translationDirection: "vi-to-en", modelSentence: "I am from Vietnam." },
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "speaking",
        skillLabel: "Luyện nói phản xạ",
        prompt: "Luyện nói câu quê quán: «Where are you from? I am from Vietnam.»",
        speakTarget: "Where are you from? I am from Vietnam.",
        explanation: "Tự tin nói mình đến từ Việt Nam.",
        required: false,
        extensions: { speakTarget: "Where are you from? I am from Vietnam." },
      }, 7)
    );
  } else if (n === 6) {
    // n06: Ôn truy hồi n01–n05 (8 câu, newItems: [])
    const q1Opts = fourOptions("Hello. What is your name?", ["Good night. How are you?", "Goodbye. See you later.", "Thank you very much."], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "listening_choice",
        skillLabel: "Nghe nhận diện",
        prompt: "Nghe và chọn câu nói chính xác.",
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "Hello. What is your name? là câu chào rồi hỏi tên.",
        ttsText: "Hello. What is your name?",
        required: true,
      }, 1)
    );

    questions.push(
      stamp({
        id: idFor(2),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu: «Tên tôi là Nam.»",
        wordBank: ["My", "name", "is", "Nam.", "What", "your"],
        correctAnswer: ["My", "name", "is", "Nam."],
        acceptedAnswers: [["My", "name", "is", "Nam."], ["My", "name", "is", "Nam"]],
        explanation: "My name is Nam.",
        required: true,
      }, 2)
    );

    const q3Opts = fourOptions("My name is Nam.", ["I am fine.", "Good morning.", "Thank you."], seed + 3);
    questions.push(
      stamp({
        id: idFor(3),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Khi ai đó hỏi: «What is your name?», bạn đáp:",
        options: q3Opts.options,
        correctAnswer: q3Opts.correctAnswer,
        explanation: "Đáp lại câu hỏi tên bằng My name is...",
        required: true,
      }, 3)
    );

    questions.push(
      stamp({
        id: idFor(4),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu: «Tôi khỏe, cảm ơn bạn.»",
        wordBank: ["I", "am", "fine,", "thank", "you.", "Where", "from"],
        correctAnswer: ["I", "am", "fine,", "thank", "you."],
        acceptedAnswers: [["I", "am", "fine,", "thank", "you."], ["I", "am", "fine", "thank", "you."]],
        explanation: "I am fine, thank you.",
        required: true,
      }, 4)
    );

    const q5Opts = fourOptions("from", ["name", "fine", "is"], seed + 5);
    questions.push(
      stamp({
        id: idFor(5),
        type: "listening_fill",
        skillLabel: "Nghe và điền từ",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "Where are you ____?",
        options: q5Opts.options,
        correctAnswer: q5Opts.correctAnswer,
        explanation: "Where are you from? hỏi về xuất xứ.",
        ttsText: "Where are you from?",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Tôi đến từ Việt Nam.»",
        wordBank: ["I", "am", "from", "Vietnam", "What", "is"],
        correctAnswer: ["I", "am", "from", "Vietnam"],
        acceptedAnswers: [["I", "am", "from", "Vietnam"]],
        explanation: "I am from Vietnam.",
        required: true,
      }, 6)
    );

    const q7Opts = fourOptions("I am from Vietnam.", ["Good afternoon.", "My name is Vietnam.", "Fine, thank you."], seed + 7);
    questions.push(
      stamp({
        id: idFor(7),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Khi được hỏi: «Where are you from?», bạn trả lời:",
        options: q7Opts.options,
        correctAnswer: q7Opts.correctAnswer,
        explanation: "Trả lời xuất xứ: I am from Vietnam.",
        required: true,
      }, 7)
    );

    questions.push(
      stamp({
        id: idFor(8),
        type: "speaking",
        skillLabel: "Luyện nói phản xạ",
        prompt: "Luyện nói câu tổng hợp: «Hello, I am from Vietnam.»",
        speakTarget: "Hello, I am from Vietnam.",
        explanation: "Tự tin giới thiệu chào và xuất thân.",
        required: false,
      }, 8)
    );
  } else if (n === 7) {
    // n07: Lịch sự xã giao: Xin phép, Cảm ơn & Xin lỗi (7 câu)
    const q1Opts = fourOptions("Xin lỗi, cho tôi hỏi", ["Cảm ơn bạn", "Chúc ngủ ngon", "Tạm biệt nhé"], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: "Cụm từ «Excuse me» dùng để làm gì khi bắt chuyện?",
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "Excuse me là lời xin phép lịch sự trước khi hỏi hoặc nhờ cậy.",
        required: true,
      }, 1)
    );

    const q2Opts = fourOptions("Excuse", ["Thank", "Sorry", "Please"], seed + 2);
    questions.push(
      stamp({
        id: idFor(2),
        type: "listening_fill",
        skillLabel: "Nghe và chọn từ còn thiếu",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "____ me, what is your name?",
        options: q2Opts.options,
        correctAnswer: q2Opts.correctAnswer,
        explanation: "Dùng Excuse me trước khi hỏi thông tin người khác.",
        ttsText: "Excuse me, what is your name?",
        required: true,
      }, 2)
    );

    const q3Opts = fourOptions("Sorry!", ["Excuse me!", "Thank you!", "Good morning!"], seed + 3);
    questions.push(
      stamp({
        id: idFor(3),
        type: "multiple_choice",
        skillLabel: "Phân biệt từ",
        prompt: "Khi bạn vô tình va chạm vào người khác trên đường, bạn nói:",
        options: q3Opts.options,
        correctAnswer: q3Opts.correctAnswer,
        explanation: "Dùng Sorry! khi muốn xin lỗi vì gây phiền hoặc va chạm.",
        required: true,
      }, 3)
    );

    const q4Opts = fourOptions("You are welcome!", ["Good night!", "My name is Nam.", "I am from Vietnam."], seed + 4);
    questions.push(
      stamp({
        id: idFor(4),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Khi bạn giúp đỡ ai đó và họ nói «Thank you!», câu đáp lại lịch sự là:",
        options: q4Opts.options,
        correctAnswer: q4Opts.correctAnswer,
        explanation: "You are welcome! dùng để đáp lại lời cảm ơn (Không có gì / Rất sẵn lòng).",
        required: true,
      }, 4)
    );

    questions.push(
      stamp({
        id: idFor(5),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu: «Xin lỗi, làm ơn.»",
        wordBank: ["Excuse", "me,", "please.", "Thank", "you"],
        correctAnswer: ["Excuse", "me,", "please."],
        acceptedAnswers: [["Excuse", "me,", "please."], ["Excuse", "me", "please"]],
        explanation: "Excuse me, please.",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Xin lỗi, cho tôi hỏi.»",
        wordBank: ["Excuse", "me", "Sorry", "Thank", "you"],
        correctAnswer: ["Excuse", "me"],
        acceptedAnswers: [["Excuse", "me"]],
        explanation: "Excuse me nghĩa là Xin lỗi, cho tôi hỏi.",
        required: true,
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "speaking",
        skillLabel: "Luyện nói phản xạ",
        prompt: "Luyện phát âm câu lịch sự: «Excuse me. Thank you. You are welcome.»",
        speakTarget: "Excuse me. Thank you. You are welcome.",
        explanation: "Thực hành phản xạ các câu lịch thiệp xã giao.",
        required: false,
      }, 7)
    );
  } else if (n === 8) {
    // n08: Kiểm tra giữa cửa (8 câu, strictly n01–n07, pass ≥ 75%)
    const q1Opts = fourOptions("Good morning. How are you?", ["Good night. How are you?", "Good morning. What is your name?", "Hello. What is your name?"], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "listening_choice",
        skillLabel: "Nghe nhận diện",
        prompt: "Nghe và chọn câu đối thoại chính xác.",
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "Good morning. How are you?",
        ttsText: "Good morning. How are you?",
        required: true,
      }, 1)
    );

    const q2Opts = fourOptions("Where are you from?", ["What is your name?", "How are you?", "Good morning."], seed + 2);
    questions.push(
      stamp({
        id: idFor(2),
        type: "multiple_choice",
        skillLabel: "Tình huống xuất xứ",
        prompt: "Khi muốn hỏi xuất thân của người đối diện, câu hỏi đúng là:",
        options: q2Opts.options,
        correctAnswer: q2Opts.correctAnswer,
        explanation: "Where are you from? là câu hỏi quê quán.",
        required: true,
      }, 2)
    );

    questions.push(
      stamp({
        id: idFor(3),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu: «Tôi đến từ Việt Nam.»",
        wordBank: ["I", "am", "from", "Vietnam.", "Where", "are"],
        correctAnswer: ["I", "am", "from", "Vietnam."],
        acceptedAnswers: [["I", "am", "from", "Vietnam."], ["I", "am", "from", "Vietnam"]],
        explanation: "I am from Vietnam.",
        required: true,
      }, 3)
    );

    const q4Opts = fourOptions("Excuse", ["Thank", "Sorry", "Please"], seed + 4);
    questions.push(
      stamp({
        id: idFor(4),
        type: "listening_fill",
        skillLabel: "Nghe và điền từ",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "____ me, what is your name?",
        options: q4Opts.options,
        correctAnswer: q4Opts.correctAnswer,
        explanation: "Excuse me dùng để mở đầu câu hỏi lịch sự.",
        ttsText: "Excuse me, what is your name?",
        required: true,
      }, 4)
    );

    const q5Opts = fourOptions("You are welcome!", ["Good night!", "My name is Beego.", "I am from Vietnam."], seed + 5);
    questions.push(
      stamp({
        id: idFor(5),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Khi bạn giúp đỡ ai đó và họ nói: «Thank you!», câu đáp lại lịch sự đã học là:",
        options: q5Opts.options,
        correctAnswer: q5Opts.correctAnswer,
        explanation: "You are welcome! là lời đáp lại cảm ơn.",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu: «Tên tôi là Beego.»",
        wordBank: ["My", "name", "is", "Beego.", "What", "your"],
        correctAnswer: ["My", "name", "is", "Beego."],
        acceptedAnswers: [["My", "name", "is", "Beego."], ["My", "name", "is", "Beego"]],
        explanation: "My name is Beego.",
        required: true,
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Bạn khỏe không?»",
        wordBank: ["How", "are", "you", "What", "is", "name"],
        correctAnswer: ["How", "are", "you"],
        acceptedAnswers: [["How", "are", "you"]],
        explanation: "How are you? nghĩa là Bạn khỏe không?",
        required: true,
      }, 7)
    );

    const q8Opts = fourOptions("Good afternoon!", ["Good morning!", "Good night!", "Excuse me!"], seed + 8);
    questions.push(
      stamp({
        id: idFor(8),
        type: "multiple_choice",
        skillLabel: "Chào theo thời điểm",
        prompt: "Gặp đồng nghiệp vào lúc 2 giờ chiều, bạn chào:",
        options: q8Opts.options,
        correctAnswer: q8Opts.correctAnswer,
        explanation: "Good afternoon! là lời chào buổi chiều.",
        required: true,
      }, 8)
    );
  } else if (n === 9) {
    // n09: Giới thiệu người thứ ba (7 câu)
    const picOpts = shuffleList(
      [
        { text: "friend", meaningVi: "bạn bè", correct: true },
        { text: "name", meaningVi: "tên", correct: false },
        { text: "morning", meaningVi: "buổi sáng", correct: false },
        { text: "thanks", meaningVi: "cảm ơn", correct: false },
      ],
      seed + 1
    );
    const picChoice = picOpts.map((item, i) => ({ id: OPTION_IDS[i], text: item.text, meaningVi: item.meaningVi }));
    questions.push(
      stamp({
        id: idFor(1),
        type: "listening_choice",
        skillLabel: "Nghe và chọn hình",
        prompt: "Nghe và chọn hình biểu thị bạn bè.",
        options: picChoice,
        correctAnswer: picChoice[picOpts.findIndex((p) => p.correct)].id,
        explanation: "friend có nghĩa là bạn bè.",
        ttsText: "friend",
        required: true,
      }, 1)
    );

    const q2Opts = fourOptions("Đây là bạn của tôi", ["Tên tôi là bạn", "Bạn của tôi ở đâu", "Tôi khỏe, cảm ơn bạn"], seed + 2);
    questions.push(
      stamp({
        id: idFor(2),
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: "Câu «This is my friend» có nghĩa là gì?",
        options: q2Opts.options,
        correctAnswer: q2Opts.correctAnswer,
        explanation: "This is my friend dùng để giới thiệu người bạn của mình.",
        required: true,
      }, 2)
    );

    questions.push(
      stamp({
        id: idFor(3),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu: «Đây là bạn của tôi, Nam.»",
        wordBank: ["This", "is", "my", "friend,", "Nam.", "She", "are"],
        correctAnswer: ["This", "is", "my", "friend,", "Nam."],
        acceptedAnswers: [["This", "is", "my", "friend,", "Nam."], ["This", "is", "my", "friend", "Nam."]],
        explanation: "This is my friend, Nam.",
        required: true,
      }, 3)
    );

    const q4Opts = fourOptions("from", ["name", "fine", "am"], seed + 4);
    questions.push(
      stamp({
        id: idFor(4),
        type: "listening_fill",
        skillLabel: "Nghe và điền từ",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "He is ____ Vietnam.",
        options: q4Opts.options,
        correctAnswer: q4Opts.correctAnswer,
        explanation: "He is from Vietnam nghĩa là Anh ấy đến từ Việt Nam.",
        ttsText: "He is from Vietnam.",
        required: true,
      }, 4)
    );

    questions.push(
      stamp({
        id: idFor(5),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp thành câu: «Cô ấy là bạn của tôi.»",
        wordBank: ["She", "is", "my", "friend.", "He", "are"],
        correctAnswer: ["She", "is", "my", "friend."],
        acceptedAnswers: [["She", "is", "my", "friend."]],
        explanation: "She is my friend.",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Đây là bạn của tôi.»",
        wordBank: ["This", "is", "my", "friend", "She", "name"],
        correctAnswer: ["This", "is", "my", "friend"],
        acceptedAnswers: [["This", "is", "my", "friend"]],
        explanation: "This is my friend.",
        required: true,
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "speaking",
        skillLabel: "Luyện nói phản xạ",
        prompt: "Luyện nói câu giới thiệu: «This is my friend, Nam. He is from Vietnam.»",
        speakTarget: "This is my friend, Nam. He is from Vietnam.",
        explanation: "Giới thiệu bạn và xuất thân của bạn.",
        required: false,
      }, 7)
    );
  } else if (n === 10) {
    // n10: Chào đón người mới đến & Hiếu khách (7 câu)
    const picOpts = shuffleList(
      [
        { text: "welcome", meaningVi: "chào mừng", correct: true },
        { text: "name", meaningVi: "tên", correct: false },
        { text: "morning", meaningVi: "buổi sáng", correct: false },
        { text: "thanks", meaningVi: "cảm ơn", correct: false },
      ],
      seed + 1
    );
    const picChoice = picOpts.map((item, i) => ({ id: OPTION_IDS[i], text: item.text, meaningVi: item.meaningVi }));
    questions.push(
      stamp({
        id: idFor(1),
        type: "listening_choice",
        skillLabel: "Nghe và chọn hình",
        prompt: "Nghe và chọn hình chào mừng.",
        options: picChoice,
        correctAnswer: picChoice[picOpts.findIndex((p) => p.correct)].id,
        explanation: "welcome có nghĩa là chào mừng.",
        ttsText: "welcome",
        required: true,
      }, 1)
    );

    const q2Opts = fourOptions("Lần đầu làm quen", ["Chào buổi sáng", "Lúc chuẩn bị đi ngủ", "Khi xin lỗi ai đó"], seed + 2);
    questions.push(
      stamp({
        id: idFor(2),
        type: "multiple_choice",
        skillLabel: "Chọn ngữ cảnh",
        prompt: "Câu «Nice to meet you» dùng trong tình huống nào?",
        options: q2Opts.options,
        correctAnswer: q2Opts.correctAnswer,
        explanation: "Nice to meet you dùng khi lần đầu gặp mặt, làm quen.",
        required: true,
      }, 2)
    );

    questions.push(
      stamp({
        id: idFor(3),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu: «Rất vui được gặp bạn.»",
        wordBank: ["Nice", "to", "meet", "you.", "am", "from"],
        correctAnswer: ["Nice", "to", "meet", "you."],
        acceptedAnswers: [["Nice", "to", "meet", "you."], ["Nice", "to", "meet", "you"]],
        explanation: "Nice to meet you.",
        required: true,
      }, 3)
    );

    const q4Opts = fourOptions("Nice to meet you too!", ["Good night!", "Excuse me.", "Where are you from?"], seed + 4);
    questions.push(
      stamp({
        id: idFor(4),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Lan nói: «Nice to meet you!». Bạn đáp lại thế nào?",
        options: q4Opts.options,
        correctAnswer: q4Opts.correctAnswer,
        explanation: "Đáp lại bằng: Nice to meet you too!",
        required: true,
      }, 4)
    );

    const q5Opts = fourOptions("Welcome", ["Hello", "Thanks", "Sorry"], seed + 5);
    questions.push(
      stamp({
        id: idFor(5),
        type: "listening_fill",
        skillLabel: "Nghe và điền từ",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "____ to Vietnam.",
        options: q5Opts.options,
        correctAnswer: q5Opts.correctAnswer,
        explanation: "Welcome to Vietnam nghĩa là Chào mừng đến Việt Nam.",
        ttsText: "Welcome to Vietnam.",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Chào mừng bạn đến Việt Nam.»",
        wordBank: ["Welcome", "to", "Vietnam", "Nice", "meet", "you"],
        correctAnswer: ["Welcome", "to", "Vietnam"],
        acceptedAnswers: [["Welcome", "to", "Vietnam"]],
        explanation: "Welcome to Vietnam.",
        required: true,
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "speaking",
        skillLabel: "Luyện nói phản xạ",
        prompt: "Luyện phát âm câu: «Welcome to Vietnam! Nice to meet you.»",
        speakTarget: "Welcome to Vietnam! Nice to meet you.",
        explanation: "Thể hiện sự hiếu khách với bạn mới.",
        required: false,
      }, 7)
    );
  } else if (n === 11) {
    // n11: Củng cố điểm yếu n01–n10 (8 câu, newItems: [])
    const q1Opts = fourOptions("Where are you from?", ["Where you are from?", "You are from where?", "Where is from you?"], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "multiple_choice",
        skillLabel: "Sửa lỗi trật tự từ",
        prompt: "Chọn câu hỏi xuất thân có cấu trúc đúng:",
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "Cấu trúc chuẩn: Where + are + you + from?",
        required: true,
      }, 1)
    );

    questions.push(
      stamp({
        id: idFor(2),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu hỏi: «Bạn đến từ đâu?»",
        wordBank: ["Where", "are", "you", "from?", "is", "am"],
        correctAnswer: ["Where", "are", "you", "from?"],
        acceptedAnswers: [["Where", "are", "you", "from?"]],
        explanation: "Where are you from?",
        required: true,
      }, 2)
    );

    const q3Opts = fourOptions("My name is Nam.", ["My name Nam is.", "Name my is Nam.", "Nam is name my."], seed + 3);
    questions.push(
      stamp({
        id: idFor(3),
        type: "multiple_choice",
        skillLabel: "Sửa lỗi trật tự từ",
        prompt: "Chọn câu xưng tên có trật tự đúng:",
        options: q3Opts.options,
        correctAnswer: q3Opts.correctAnswer,
        explanation: "Cấu trúc chuẩn: My name is + [Tên].",
        required: true,
      }, 3)
    );

    questions.push(
      stamp({
        id: idFor(4),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu hỏi: «Bạn khỏe không?»",
        wordBank: ["How", "are", "you?", "What", "is"],
        correctAnswer: ["How", "are", "you?"],
        acceptedAnswers: [["How", "are", "you?"]],
        explanation: "How are you?",
        required: true,
      }, 4)
    );

    const q5Opts = fourOptions("I am fine, thank you.", ["My name is Nam.", "Good night.", "Where are you from?"], seed + 5);
    questions.push(
      stamp({
        id: idFor(5),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Hỏi: «How are you?». Đáp chuẩn là:",
        options: q5Opts.options,
        correctAnswer: q5Opts.correctAnswer,
        explanation: "I am fine, thank you.",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu hỏi lịch sự: «Xin lỗi, bạn tên gì?»",
        wordBank: ["Excuse", "me,", "what", "is", "your", "name?", "are", "from"],
        correctAnswer: ["Excuse", "me,", "what", "is", "your", "name?"],
        acceptedAnswers: [["Excuse", "me,", "what", "is", "your", "name?"]],
        explanation: "Excuse me, what is your name?",
        required: true,
      }, 6)
    );

    const q7Opts = fourOptions("Nice to meet you too!", ["Good night!", "Excuse me.", "Where are you from?"], seed + 7);
    questions.push(
      stamp({
        id: idFor(7),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Lan nói: «Nice to meet you!». Đáp lại là:",
        options: q7Opts.options,
        correctAnswer: q7Opts.correctAnswer,
        explanation: "Nice to meet you too!",
        required: true,
      }, 7)
    );

    questions.push(
      stamp({
        id: idFor(8),
        type: "speaking",
        skillLabel: "Luyện nói củng cố",
        prompt: "Luyện nói câu hoàn chỉnh: «I am from Vietnam.»",
        speakTarget: "I am from Vietnam.",
        explanation: "Khắc sâu phản xạ nói xuất xứ.",
        required: false,
      }, 8)
    );
  } else if (n === 12) {
    // n12: Câu chuyện ngữ cảnh: bạn mới đến lớp (6 câu)
    const storyText = "Hello, I am a new student. My name is Nam. I am from Vietnam. Welcome to our class, Nam! We learn together.";
    const q1Opts = fourOptions("Nam", ["John", "Lan", "Mai"], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "story_comprehension",
        skillLabel: "Đọc hiểu câu chuyện",
        prompt: "Bạn học sinh mới tên là gì?",
        storyText,
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "Trong câu chuyện, bạn mới nói: My name is Nam.",
        required: true,
      }, 1)
    );

    const q2Opts = fourOptions("Việt Nam", ["Nước Anh", "Nước Mỹ", "Singapore"], seed + 2);
    questions.push(
      stamp({
        id: idFor(2),
        type: "story_comprehension",
        skillLabel: "Đọc hiểu câu chuyện",
        prompt: "Bạn Nam đến từ đâu?",
        storyText,
        options: q2Opts.options,
        correctAnswer: q2Opts.correctAnswer,
        explanation: "Nam nói: I am from Vietnam.",
        required: true,
      }, 2)
    );

    const q3Opts = fourOptions("Welcome to our class.", ["Good night.", "Goodbye.", "Excuse me."], seed + 3);
    questions.push(
      stamp({
        id: idFor(3),
        type: "listening_choice",
        skillLabel: "Nghe hiểu câu chuyện",
        prompt: "Nghe và chọn câu nói của cả lớp.",
        options: q3Opts.options,
        correctAnswer: q3Opts.correctAnswer,
        explanation: "Cả lớp nói: Welcome to our class.",
        ttsText: "Welcome to our class.",
        required: true,
      }, 3)
    );

    questions.push(
      stamp({
        id: idFor(4),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu: «Xin chào, tôi là học sinh mới.»",
        wordBank: ["Hello,", "I", "am", "a", "new", "student.", "class", "from"],
        correctAnswer: ["Hello,", "I", "am", "a", "new", "student."],
        acceptedAnswers: [["Hello,", "I", "am", "a", "new", "student."]],
        explanation: "Hello, I am a new student.",
        required: true,
      }, 4)
    );

    const q5Opts = fourOptions("Thank you so much!", ["Good night!", "Excuse me.", "Where are you from?"], seed + 5);
    questions.push(
      stamp({
        id: idFor(5),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Cả lớp nói: «Welcome to our class!». Nam đáp lại thế nào?",
        options: q5Opts.options,
        correctAnswer: q5Opts.correctAnswer,
        explanation: "Nam cảm ơn sự đón nhận của cả lớp.",
        required: true,
      }, 5)
    );

    questions.push(
      stamp({
        id: idFor(6),
        type: "speaking",
        skillLabel: "Luyện nói câu chuyện",
        prompt: "Luyện đọc câu chào đón: «Hello, I am a new student. Welcome to our class.»",
        speakTarget: "Hello, I am a new student. Welcome to our class.",
        explanation: "Đọc to câu văn trôi chảy.",
        required: false,
      }, 6)
    );
  } else if (n === 13) {
    // n13: Hội thoại hướng dẫn 4 lượt thoại (7 câu)
    const q1Opts = fourOptions("Hi John! Good to see you too.", ["Good night, John.", "Goodbye, John.", "What is your name?"], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "dialogue_response",
        skillLabel: "Lượt thoại 1: Chào hỏi",
        prompt: "John nói: «Hi! Good to see you.». Bạn đáp lại thế nào?",
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "Đáp lại lời chào gặp gỡ thân thiện.",
        required: true,
      }, 1)
    );

    questions.push(
      stamp({
        id: idFor(2),
        type: "word_order",
        skillLabel: "Sắp xếp câu hỏi thăm",
        prompt: "Sắp xếp câu hỏi thăm: «Dạo này thế nào?»",
        wordBank: ["How", "is", "it", "going?", "What", "are"],
        correctAnswer: ["How", "is", "it", "going?"],
        acceptedAnswers: [["How", "is", "it", "going?"]],
        explanation: "How is it going? là cách hỏi thăm thân mật.",
        required: true,
      }, 2)
    );

    const q3Opts = fourOptions("Good, and you?", ["My name is Nam.", "I am from Vietnam.", "Good night."], seed + 3);
    questions.push(
      stamp({
        id: idFor(3),
        type: "dialogue_response",
        skillLabel: "Lượt thoại 2: Phản hồi sức khỏe",
        prompt: "John hỏi: «How is it going?». Bạn trả lời và hỏi lại:",
        options: q3Opts.options,
        correctAnswer: q3Opts.correctAnswer,
        explanation: "Good, and you? nghĩa là Tốt, còn bạn thì sao?",
        required: true,
      }, 3)
    );

    const q4Opts = fourOptions("I am from Vietnam.", ["My name is Vietnam.", "Fine, thank you.", "Good morning."], seed + 4);
    questions.push(
      stamp({
        id: idFor(4),
        type: "dialogue_response",
        skillLabel: "Lượt thoại 3: Trả lời quê quán",
        prompt: "John hỏi: «Where are you from?». Bạn trả lời:",
        options: q4Opts.options,
        correctAnswer: q4Opts.correctAnswer,
        explanation: "I am from Vietnam.",
        required: true,
      }, 4)
    );

    questions.push(
      stamp({
        id: idFor(5),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu: «Tôi đến từ Việt Nam.»",
        wordBank: ["I", "am", "from", "Vietnam.", "Where", "you"],
        correctAnswer: ["I", "am", "from", "Vietnam."],
        acceptedAnswers: [["I", "am", "from", "Vietnam."]],
        explanation: "I am from Vietnam.",
        required: true,
      }, 5)
    );

    const q6Opts = fourOptions("Nice talking to you too!", ["Good morning!", "Excuse me.", "What is your name?"], seed + 6);
    questions.push(
      stamp({
        id: idFor(6),
        type: "dialogue_response",
        skillLabel: "Lượt thoại 4: Kết thúc lịch sự",
        prompt: "John nói: «Nice talking to you!». Bạn đáp:",
        options: q6Opts.options,
        correctAnswer: q6Opts.correctAnswer,
        explanation: "Nice talking to you too!",
        required: true,
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "speaking",
        skillLabel: "Luyện nói hội thoại",
        prompt: "Luyện nói lượt thoại của bạn: «Hi! Good to see you. I am from Vietnam.»",
        speakTarget: "Hi! Good to see you. I am from Vietnam.",
        explanation: "Thực hành hội thoại trọn vẹn 2 chiều.",
        required: false,
      }, 7)
    );
  } else if (n === 14) {
    // n14: Tự giới thiệu trọn vẹn & Rời đi lịch sự (8 câu)
    const q1Opts = fourOptions("Tôi phải đi bây giờ", ["Tôi muốn ở lại", "Tôi mới đến đây", "Tôi đang ăn sáng"], seed + 1);
    questions.push(
      stamp({
        id: idFor(1),
        type: "multiple_choice",
        skillLabel: "Chọn nghĩa đúng",
        prompt: "Câu «I have to go now» có nghĩa là gì?",
        options: q1Opts.options,
        correctAnswer: q1Opts.correctAnswer,
        explanation: "I have to go now nghĩa là Tôi phải đi bây giờ.",
        required: true,
      }, 1)
    );

    questions.push(
      stamp({
        id: idFor(2),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu: «Tôi phải đi bây giờ.»",
        wordBank: ["I", "have", "to", "go", "now.", "come", "see"],
        correctAnswer: ["I", "have", "to", "go", "now."],
        acceptedAnswers: [["I", "have", "to", "go", "now."], ["I", "have", "to", "go", "now"]],
        explanation: "I have to go now.",
        required: true,
      }, 2)
    );

    const q3Opts = fourOptions("later", ["now", "morning", "night"], seed + 3);
    questions.push(
      stamp({
        id: idFor(3),
        type: "listening_fill",
        skillLabel: "Nghe và điền từ",
        prompt: "Nghe và chọn từ còn thiếu.",
        sentenceTemplate: "Thank you. See you ____.",
        options: q3Opts.options,
        correctAnswer: q3Opts.correctAnswer,
        explanation: "See you later nghĩa là Hẹn gặp lại sau.",
        ttsText: "Thank you. See you later.",
        required: true,
      }, 3)
    );

    questions.push(
      stamp({
        id: idFor(4),
        type: "word_order",
        skillLabel: "Sắp xếp từ",
        prompt: "Sắp xếp câu: «Tạm biệt! Hẹn gặp lại.»",
        wordBank: ["Goodbye!", "See", "you", "later.", "Hello", "How"],
        correctAnswer: ["Goodbye!", "See", "you", "later."],
        acceptedAnswers: [["Goodbye!", "See", "you", "later."], ["Goodbye", "See", "you", "later"]],
        explanation: "Goodbye! See you later.",
        required: true,
      }, 4)
    );

    questions.push(
      stamp({
        id: idFor(5),
        type: "translation",
        skillLabel: "Dịch câu",
        prompt: "Dịch sang tiếng Anh: «Tôi phải đi bây giờ.»",
        wordBank: ["I", "have", "to", "go", "now", "see", "later"],
        correctAnswer: ["I", "have", "to", "go", "now"],
        acceptedAnswers: [["I", "have", "to", "go", "now"]],
        explanation: "I have to go now.",
        required: true,
      }, 5)
    );

    const q6Opts = fourOptions("Goodbye! Take care!", ["Good morning!", "What is your name?", "Where are you from?"], seed + 6);
    questions.push(
      stamp({
        id: idFor(6),
        type: "dialogue_response",
        skillLabel: "Phản hồi hội thoại",
        prompt: "Bạn nói: «I have to go now. Goodbye!». Người kia đáp lại:",
        options: q6Opts.options,
        correctAnswer: q6Opts.correctAnswer,
        explanation: "Goodbye! Take care! nghĩa là Tạm biệt! Bảo trọng nhé!",
        required: true,
      }, 6)
    );

    questions.push(
      stamp({
        id: idFor(7),
        type: "word_order",
        skillLabel: "Sắp xếp bài giới thiệu",
        prompt: "Sắp xếp bài tự giới thiệu: «Xin chào, tên tôi là Nam. Tôi đến từ Việt Nam.»",
        wordBank: ["Hello,", "my", "name", "is", "Nam.", "I", "am", "from", "Vietnam."],
        correctAnswer: ["Hello,", "my", "name", "is", "Nam.", "I", "am", "from", "Vietnam."],
        acceptedAnswers: [["Hello,", "my", "name", "is", "Nam.", "I", "am", "from", "Vietnam."]],
        explanation: "Bài nói cá nhân giới thiệu trọn vẹn thông tin.",
        required: true,
      }, 7)
    );

    questions.push(
      stamp({
        id: idFor(8),
        type: "speaking",
        skillLabel: "Luyện nói trọn vẹn",
        prompt: "Luyện nói trọn vẹn: «Hello, my name is Nam. I am from Vietnam. I have to go now. Goodbye!»",
        speakTarget: "Hello, my name is Nam. I am from Vietnam. I have to go now. Goodbye!",
        explanation: "Hoàn thiện bài tự giới thiệu bản thân và chào tạm biệt lịch sự.",
        required: false,
      }, 8)
    );
  }

  const normalized = ensureTenP1Activities(questions, { gatePlan, seed, idFor });
  return { questions: normalized, gaps: [] };
}
