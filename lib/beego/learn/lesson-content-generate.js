/**
 * LEARN CONTENT V3 — topic-aligned lesson banks.
 * - Exactly 4 options on every choice exercise (1 correct + 3 distractors)
 * - No answer-hint leaks (equal visuals / text-only)
 * - Diverse activity types per lesson; listening/speaking slots differentiated
 * - correctAnswer tracks shuffled option id
 */
import { getTopicBank } from "@/lib/beego/learn/lesson-topic-banks";
import { buildListenPictureOptions } from "@/lib/beego/learn/listen-picture-choice";
import { buildListenFill } from "@/lib/beego/learn/listen-fill";
import { buildListenDictation, meaningForTranscript } from "@/lib/beego/learn/listen-dictation";
import { buildTranslationExercise, curatedTranslation } from "@/lib/beego/learn/translation";
import { buildContextCloze } from "@/lib/beego/learn/context-cloze";
import { buildDialogueResponse } from "@/lib/beego/learn/dialogue-response";
import { buildIntegratedLessonQuestions, isIntegratedNodeType } from "@/lib/beego/learn/integrated-lesson";
import { buildLessonMatchPairs, buildLessonAudioMatchPairs } from "@/lib/beego/learn/match-pairs";
import {
  meaningSampleForPart,
  prepareEnToViMeaning,
  prepareViToEnMeaning,
  senseForWord,
} from "@/lib/beego/learn/meaning-choice";

const TARGET_BANK = 12;
const CHOICE_COUNT = 4;
const OPTION_IDS = ["a", "b", "c", "d"];

/** Per-slot listening focus labels (index 0 = slot 1) */
const LISTEN_FOCUS = {
  1: ["Lời chào cơ bản", "Hỏi thăm sức khỏe", "Giới thiệu tên", "Cảm ơn & tạm biệt", "Alphabet & số đếm"],
  2: ["Thức dậy sớm", "Vệ sinh cá nhân", "Ăn sáng", "Chuẩn bị đi làm", "Thói quen buổi sáng"],
  3: ["Hỏi giá", "Mua theo cân", "Thanh toán", "Xin giảm giá", "Ở chợ / siêu thị"],
  4: ["Thành viên gia đình", "Mối quan hệ", "Tính cách", "Ảnh gia đình", "Nhà cửa"],
  5: ["Nghề nghiệp", "Văn phòng", "Email & họp", "Deadline", "Đồng nghiệp"],
  6: ["Check-in sân bay", "Cổng & chuyến bay", "Đặt phòng khách sạn", "Hỏi đường", "Taxi & wifi"],
  7: ["Agenda họp", "Gửi email", "Biên bản", "Phê duyệt", "Follow-up"],
  8: ["Nêu ý kiến", "Đồng ý / phản đối", "Although / However", "Bằng chứng", "Kết luận"],
};

const SPEAK_FOCUS = LISTEN_FOCUS;

function hashId(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pick(arr, seed) {
  if (!arr?.length) return null;
  return arr[Math.abs(seed) % arr.length];
}

/** Deterministic shuffle copy */
function shuffle(arr, seed) {
  const out = [...arr];
  let s = Math.abs(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function uniqueTexts(texts) {
  const seen = new Set();
  const out = [];
  for (const t of texts) {
    const key = String(t || "")
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(t).trim());
  }
  return out;
}

/**
 * Build exactly 4 options; shuffle display order; correctAnswer = winning id.
 * @param {string} correctText
 * @param {string[]} distractors at least 3 unique wrongs
 * @param {number} seed
 * @param {{ mode?: 'text'|'image', emojiFor?: (text:string)=>string }} [opts]
 */
export function mcOptions4(correctText, distractors, seed, opts = {}) {
  const correct = String(correctText).trim();
  let wrongs = uniqueTexts(distractors.filter((t) => String(t).trim().toLowerCase() !== correct.toLowerCase()));
  while (wrongs.length < 3) {
    wrongs.push(`Choice ${wrongs.length + 1}-${seed % 97}`);
  }
  wrongs = wrongs.slice(0, 3);

  const bag = shuffle(
    [{ text: correct, isCorrect: true }, ...wrongs.map((t) => ({ text: t, isCorrect: false }))],
    seed
  );

  const options = bag.map((item, i) => {
    const opt = { id: OPTION_IDS[i], text: item.text };
    if (opts.mode === "image" && typeof opts.emojiFor === "function") {
      opt.imageEmoji = opts.emojiFor(item.text) || "📘";
    }
    // text mode: never attach imageEmoji (avoids leak)
    return opt;
  });

  const correctAnswer = options[bag.findIndex((x) => x.isCorrect)].id;
  return { options, correctAnswer };
}

function qid(lessonId, n) {
  return `${lessonId}-q${n}`;
}

function vocabEmojiLookup(bank) {
  /** @type {Map<string,string>} */
  const map = new Map();
  for (const v of bank.vocab || []) {
    if (v.en) map.set(String(v.en).toLowerCase(), v.emoji || "📘");
    if (v.vi) map.set(String(v.vi).toLowerCase(), v.emoji || "📘");
  }
  return (text) => map.get(String(text).toLowerCase()) || "📘";
}

function fillBlankFromPhrase(phrase, bank, seed) {
  const words = (phrase?.words || []).map((word) => String(word || "").trim()).filter(Boolean);
  if (words.length < 2) return null;
  const gap = words[Math.min(1, words.length - 1)];
  const template = words.map((word) => (word === gap ? "___" : word)).join(" ");
  if (!template.includes("___") || template.replaceAll("_", "").trim() === "") return null;
  const wrongs = otherVocab(bank, gap, seed, 3);
  return { ...mcOptions4(gap, wrongs, seed, { mode: "text" }), template, phrase };
}

function wordOrderFields(phrase, extras) {
  const answerWords = [...(phrase?.words || [])];
  const used = new Set(answerWords.map((word) => String(word).toLowerCase()));
  const safeExtras = (extras || []).filter((word) => !used.has(String(word).toLowerCase()));
  return {
    wordBank: [...answerWords, ...safeExtras].slice(0, Math.max(answerWords.length + 2, 6)),
    correctAnswer: answerWords,
    explanation: phrase?.en,
    extensions: { modelSentence: phrase?.en || "", meaning: phrase?.vi || "" },
  };
}

function otherVocab(bank, excludeEn, seed, n = 3) {
  const pool = (bank.vocab || []).filter((v) => v.en !== excludeEn);
  const shuffled = shuffle(pool, seed);
  const out = [];
  for (const v of shuffled) {
    if (out.length >= n) break;
    out.push(v.en);
  }
  let i = 0;
  while (out.length < n) {
    out.push(bank.distractors[i % bank.distractors.length] || `word${i}`);
    i += 1;
  }
  return uniqueTexts(out).slice(0, n);
}

function otherListening(bank, exclude, seed, n = 3) {
  const pool = (bank.listening || []).filter((t) => t !== exclude);
  const shuffled = shuffle(pool, seed);
  const out = [...shuffled.slice(0, n)];
  let i = 0;
  while (out.length < n) {
    out.push(bank.distractors[i % bank.distractors.length] || `line ${i}`);
    i += 1;
  }
  return uniqueTexts(out).slice(0, n);
}

function otherVi(bank, excludeVi, seed, n = 3) {
  const pool = (bank.vocab || []).filter((v) => v.vi !== excludeVi).map((v) => v.vi);
  const shuffled = shuffle(pool, seed);
  const out = [...shuffled.slice(0, n)];
  while (out.length < n) out.push(`nghĩa khác ${out.length}`);
  return uniqueTexts(out).slice(0, n);
}

function pushMeaningChoice(push, { lessonId, n, seed, prepared }) {
  if (!prepared || prepared.wrongs.length < 3) return false;
  const { options, correctAnswer } = mcOptions4(prepared.correct, prepared.wrongs, seed, {
    mode: "text",
  });
  push({
    id: qid(lessonId, n),
    type: "multiple_choice",
    skillLabel: "Chọn nghĩa đúng",
    prompt: prepared.prompt,
    options,
    correctAnswer,
    explanation: prepared.explanation,
    extensions: {
      meaningChoice: true,
      meaningDirection: prepared.direction,
      ttsText: prepared.ttsText || "",
    },
  });
  return true;
}

function padGrammarTo4(g, bank, seed) {
  const correct = g.options.find((o) => o.id === g.correctAnswer) || g.options[0];
  const wrongs = g.options.filter((o) => o.id !== correct.id).map((o) => o.text);
  while (wrongs.length < 3) {
    wrongs.push(pick(bank.distractors, seed + wrongs.length) || `Sai ${wrongs.length}`);
  }
  return mcOptions4(correct.text, wrongs, seed, { mode: "text" });
}

function slotFocus(partNumber, slot, kind) {
  const table = kind === "speak" ? SPEAK_FOCUS : LISTEN_FOCUS;
  const list = table[partNumber] || table[1];
  return list[(slot - 1) % list.length];
}

/** Listening line slice unique per slot */
function listeningLinesForSlot(bank, slot) {
  const all = bank.listening || [];
  const start = ((slot - 1) * 2) % Math.max(all.length, 1);
  const out = [];
  for (let i = 0; i < all.length; i += 1) {
    out.push(all[(start + i) % all.length]);
  }
  return out;
}

function speakingLinesForSlot(bank, slot) {
  const all = bank.speaking || [];
  const start = ((slot - 1) * 2 + 1) % Math.max(all.length, 1);
  const out = [];
  for (let i = 0; i < all.length; i += 1) {
    out.push(all[(start + i) % all.length]);
  }
  return out;
}

/**
 * @param {object} args
 */
export function generateLessonQuestions({ lessonId, nodeType, gate, part, blueprint }) {
  const bank = getTopicBank(part.partNumber);
  const topic = gate.topicTitle || bank.topicTitle;
  const seed0 = hashId(lessonId);
  const slot = Number(blueprint?.listenSlot || blueprint?.speakSlot || 1);
  const emojiFor = vocabEmojiLookup(bank);
  const focusListen = slotFocus(part.partNumber, slot, "listen");
  const focusSpeak = slotFocus(part.partNumber, slot, "speak");
  const questions = [];
  const push = (q) => questions.push(q);

  if (isIntegratedNodeType(nodeType)) {
    const built = buildIntegratedLessonQuestions({ lessonId, nodeType, gate, part, blueprint });
    built.questions.contentGaps = built.gaps;
    return built.questions;
  }

  if (nodeType === "vocabulary") {
    // Diverse mix: image vocab, meaning MC, fill blank, word order, context MC
    for (let i = 0; i < TARGET_BANK; i += 1) {
      const v = bank.vocab[(i + (seed0 % 5)) % bank.vocab.length];
      const seed = seed0 + i * 31;
      const mode = i % 5;
      if (mode === 0) {
        const wrongs = otherVocab(bank, v.en, seed, 3);
        const { options, correctAnswer } = mcOptions4(v.en, wrongs, seed, {
          mode: "image",
          emojiFor,
        });
        push({
          id: qid(lessonId, i + 1),
          type: "vocabulary_choice",
          skillLabel: "Từ vựng",
          prompt: `Chọn từ nghĩa là «${v.vi}»`,
          options,
          correctAnswer,
          explanation: `${v.en} = ${v.vi}.`,
          required: i < 2,
        });
      } else if (mode === 1) {
        const sample = i === 1 ? meaningSampleForPart(part.partNumber) : null;
        const sense = senseForWord(v.en);
        const prepared = sample
          ? prepareEnToViMeaning({
              stimulus: sample.en,
              correct: sample.vi,
              seed,
              context: sample.context,
              explanation: sample.explanation,
              distractors: sample.distractors,
            })
          : prepareEnToViMeaning({
              stimulus: sense ? v.en : v.en,
              correct: sense ? sense.vi : v.vi,
              pool: (bank.vocab || []).map((item) => item.vi).concat(sense ? sense.distractors : []),
              seed,
              context: sense?.context,
              explanation: sense?.explanation,
              distractors: sense?.distractors,
            });
        const saved = pushMeaningChoice(push, { lessonId, n: i + 1, seed, prepared });
        if (!saved) {
          const wrongs = otherVi(bank, v.vi, seed, 3);
          const { options, correctAnswer } = mcOptions4(v.vi, wrongs, seed, { mode: "text" });
          push({
            id: qid(lessonId, i + 1),
            type: "multiple_choice",
            skillLabel: "Chọn nghĩa đúng",
            prompt: `"${v.en}" nghĩa là gì?`,
            options,
            correctAnswer,
            explanation: `«${v.en}» nghĩa là «${v.vi}».`,
            extensions: { meaningChoice: true, meaningDirection: "en-to-vi", ttsText: v.en },
          });
        }
      } else if (mode === 2) {
        const p = bank.phrases[i % bank.phrases.length];
        const blank = fillBlankFromPhrase(p, bank, seed) || fillBlankFromPhrase(
          bank.phrases.find((item) => (item.words || []).length >= 2),
          bank,
          seed
        );
        if (!blank) continue;
        push({
          id: qid(lessonId, i + 1),
          type: "fill_blank",
          skillLabel: "Ngữ cảnh",
          prompt: `Chọn từ điền vào chỗ trống. Nghĩa: «${blank.phrase.vi}»`,
          sentenceTemplate: blank.template,
          options: blank.options,
          correctAnswer: blank.correctAnswer,
          explanation: blank.phrase.en,
        });
      } else if (mode === 3) {
        const p = bank.phrases[(i + 2) % bank.phrases.length];
        const extras = otherVocab(bank, p.words[0], seed, 3);
        push({
          id: qid(lessonId, i + 1),
          type: "word_order",
          skillLabel: "Sắp xếp từ",
          prompt: `Sắp xếp thành câu: «${p.vi}»`,
          ...wordOrderFields(p, extras),
        });
      } else {
        const p = bank.phrases[(i + 4) % bank.phrases.length];
        const prepared = prepareViToEnMeaning({
          vi: p.vi,
          correct: p.en,
          pool: (bank.phrases || []).map((item) => item.en),
          seed,
        });
        const saved = pushMeaningChoice(push, { lessonId, n: i + 1, seed, prepared });
        if (!saved) {
          const wrongs = shuffle(
            bank.phrases.filter((x) => x.en !== p.en).map((x) => x.en),
            seed
          ).slice(0, 3);
          while (wrongs.length < 3) wrongs.push(pick(bank.distractors, seed + wrongs.length));
          const { options, correctAnswer } = mcOptions4(p.en, wrongs, seed, { mode: "text" });
          push({
            id: qid(lessonId, i + 1),
            type: "multiple_choice",
            skillLabel: "Chọn nghĩa đúng",
            prompt: `Câu nào đúng cho «${p.vi}»?`,
            options,
            correctAnswer,
            explanation: `«${p.vi}» nói là “${p.en}”.`,
            extensions: { meaningChoice: true, meaningDirection: "vi-to-en", ttsText: "" },
          });
        }
      }
    }
    const matchPairs = buildLessonMatchPairs(bank.vocab, seed0, 5);
    if (matchPairs) {
      questions.splice(2, 0, {
        id: qid(lessonId, questions.length + 1),
        type: "matching_pairs",
        skillLabel: "Ghép từ Anh–Việt",
        prompt: "Ghép từ tiếng Anh với nghĩa tiếng Việt.",
        pairs: matchPairs,
        explanation: "Ghép từng từ với đúng một nghĩa.",
      });
    }
    const audioPairs = buildLessonAudioMatchPairs(bank.vocab, seed0 + 17, {
      advanced: Number(part?.partNumber) >= 5,
      count: 5,
    });
    if (audioPairs) {
      questions.splice(matchPairs ? 3 : 2, 0, {
        id: qid(lessonId, questions.length + 1),
        type: "matching_pairs",
        skillLabel: "Ghép âm thanh với từ",
        prompt: "Nghe và ghép với từ tiếng Anh. Bấm Nghe không bị tính là chọn.",
        pairs: audioPairs,
        extensions: { audioMatch: true },
        explanation: "Nghe rồi chọn từ đúng. Lỗi phát âm thanh không bị tính là trả lời sai.",
      });
    }
  } else if (nodeType === "sentence_patterns") {
    for (let i = 0; i < TARGET_BANK; i += 1) {
      const p = bank.phrases[(i + slot) % bank.phrases.length];
      const seed = seed0 + i * 29 + slot * 7;
      const mode = i % 3;
      if (mode === 0) {
        const extras = otherVocab(bank, p.words[0], seed, 3);
        push({
          id: qid(lessonId, i + 1),
          type: "word_order",
          skillLabel: "Câu mẫu",
          prompt: `Sắp xếp: «${p.vi}»`,
          ...wordOrderFields(p, extras),
          required: i === 0,
        });
      } else if (mode === 1) {
        const wrongs = shuffle(
          bank.phrases.filter((x) => x.en !== p.en).map((x) => x.en),
          seed
        ).slice(0, 3);
        while (wrongs.length < 3) wrongs.push(`Wrong ${wrongs.length}`);
        const { options, correctAnswer } = mcOptions4(p.en, wrongs, seed, { mode: "text" });
        push({
          id: qid(lessonId, i + 1),
          type: "multiple_choice",
          skillLabel: "Câu mẫu",
          prompt: `Chọn câu đúng cho «${p.vi}»`,
          options,
          correctAnswer,
          explanation: p.en,
        });
      } else {
        const blank = fillBlankFromPhrase(p, bank, seed) || fillBlankFromPhrase(
          bank.phrases.find((item) => (item.words || []).length >= 2),
          bank,
          seed
        );
        if (!blank) continue;
        push({
          id: qid(lessonId, i + 1),
          type: "fill_blank",
          skillLabel: "Câu mẫu",
          prompt: `Chọn từ điền vào chỗ trống. Nghĩa: «${blank.phrase.vi}»`,
          sentenceTemplate: blank.template,
          options: blank.options,
          correctAnswer: blank.correctAnswer,
          explanation: blank.phrase.en,
        });
      }
    }
    const curatedPhrases = (bank.phrases || []).filter((phrase) => curatedTranslation(phrase));
    const otherPhrases = (bank.phrases || []).filter((phrase) => !curatedTranslation(phrase));
    const translationPhrases = [
      curatedPhrases[0] || otherPhrases[0],
      curatedPhrases[1] || otherPhrases[0] || curatedPhrases[0],
    ].filter(Boolean);
    translationPhrases.forEach((phrase, index) => {
      const direction = index === 0 ? "vi-to-en" : "en-to-vi";
      const built = buildTranslationExercise(phrase, direction, {
        partNumber: part?.partNumber,
        distractors: direction === "vi-to-en" ? otherVocab(bank, phrase?.en, seed0 + index, 3) : ["không", "họ", "ngày mai"],
      });
      if (!built) return;
      questions.splice(1 + index, 0, {
        id: qid(lessonId, 81 + index),
        type: "translation",
        skillLabel: direction === "vi-to-en" ? "Dịch sang tiếng Anh" : "Dịch sang tiếng Việt",
        prompt: direction === "vi-to-en" ? "Dịch sang tiếng Anh." : "Dịch sang tiếng Việt.",
        wordBank: built.wordBank,
        correctAnswer: built.correctAnswer,
        acceptedAnswers: built.accepted,
        explanation: built.explanation,
        extensions: {
          translationDirection: built.direction,
          inputMode: built.inputMode,
          sourceText: built.sourceText,
          context: built.context,
          modelSentence: built.modelSentence,
          speakText: built.speakText,
        },
      });
    });
  } else if (nodeType === "grammar") {
    for (let i = 0; i < TARGET_BANK; i += 1) {
      const g = bank.grammar[i % bank.grammar.length];
      const seed = seed0 + i * 17;
      const { options, correctAnswer } = padGrammarTo4(g, bank, seed);
      push({
        id: qid(lessonId, i + 1),
        type: "multiple_choice",
        skillLabel: "Ngữ pháp",
        prompt: `${gate.grammarPoint}: ${g.prompt}`,
        options,
        correctAnswer,
        explanation: g.explanation,
        required: i === 0,
      });
    }
    const cloze = buildContextCloze(part?.partNumber, seed0);
    if (cloze) {
      const choice = cloze.inputMode === "choice"
        ? mcOptions4(cloze.answers[0], cloze.distractors, seed0, { mode: "text" })
        : { options: null, correctAnswer: cloze.answers[0] };
      questions.splice(1, 0, {
        id: qid(lessonId, 83),
        type: "context_cloze",
        skillLabel: cloze.focus,
        prompt: cloze.prompt,
        sentenceTemplate: cloze.display,
        options: choice.options || undefined,
        correctAnswer: choice.correctAnswer,
        explanation: cloze.explanation,
        extensions: {
          contextCloze: true,
          blankId: cloze.blankId,
          gapIndex: cloze.gapIndex,
          answers: cloze.answers,
          inputMode: cloze.inputMode,
          completedSentence: cloze.completed,
        },
      });
    }
  } else if (nodeType === "listening") {
    const lines = listeningLinesForSlot(bank, slot);
    for (let i = 0; i < TARGET_BANK; i += 1) {
      const line = lines[i % lines.length];
      const seed = seed0 + slot * 131 + i * 13;
      if (i % 2 === 0) {
        const picture = buildListenPictureOptions(bank.vocab, seed, i);
        if (picture) {
          push({
            id: qid(lessonId, i + 1),
            type: "listening_choice",
            skillLabel: "Nghe và chọn hình",
            prompt: "Nghe và chọn hình đúng.",
            options: picture.options,
            correctAnswer: picture.correctAnswer,
            explanation: `${picture.target.en} nghĩa là ${picture.target.vi}.`,
            extensions: {
              modality: "listening",
              choicePresentation: "picture",
              slot,
              focus: focusListen,
              ttsText: picture.target.en,
              gradingTarget: picture.target.en,
              targetMeaning: picture.target.vi,
            },
            ttsText: picture.target.en,
            required: i < 2,
          });
        } else {
          const wrongs = otherListening(bank, line, seed, 3);
          const { options, correctAnswer } = mcOptions4(line, wrongs, seed, { mode: "text" });
          const correctText = options.find((o) => o.id === correctAnswer)?.text;
          push({
            id: qid(lessonId, i + 1),
            type: "listening_choice",
            skillLabel: "Nghe & chọn",
            prompt: `Nghe — ${focusListen} (mục ${i + 1})`,
            options,
            correctAnswer,
            explanation: `Bạn vừa nghe: «${line}».`,
            extensions: {
              modality: "listening",
              slot,
              focus: focusListen,
              ttsText: correctText,
              gradingTarget: correctText,
            },
            ttsText: correctText,
            required: i < 2,
          });
        }
      } else {
        const built = buildListenFill(line, {
          vocab: bank.vocab,
          listening: bank.listening,
          phrases: bank.phrases,
          seed,
        });
        if (!built) continue;
        const { options, correctAnswer } = mcOptions4(built.gapWord, built.distractors, seed, { mode: "text" });
        push({
          id: qid(lessonId, i + 1),
          type: "listening_fill",
          skillLabel: "Nghe và chọn từ còn thiếu",
          prompt: "Nghe và chọn từ còn thiếu.",
          sentenceTemplate: built.displaySentence,
          options,
          correctAnswer,
          explanation: built.explanation,
          extensions: {
            modality: "listening",
            listenFill: true,
            slot,
            focus: focusListen,
            ttsText: built.transcript,
            gradingTarget: built.transcript,
            gapIndex: built.gapIndex,
            gapWord: built.gapWord,
            transcript: built.transcript,
            meaning: built.meaning,
          },
          ttsText: built.transcript,
        });
      }
    }
    const spoken = lines[0];
    const dictated = buildListenDictation(spoken, {
      meaning: meaningForTranscript(spoken, bank.phrases),
      partNumber: part?.partNumber,
    });
    if (dictated) {
      questions.splice(2, 0, {
        id: qid(lessonId, 80),
        type: "listening_dictation",
        skillLabel: "Nghe và nhập lại câu",
        prompt: "Nghe và nhập lại câu.",
        correctAnswer: dictated.transcript,
        explanation: dictated.meaning ? `Nghĩa: ${dictated.meaning}` : "Gõ lại đúng câu đã nghe.",
        extensions: {
          modality: "listening",
          listenDictation: true,
          slot,
          ttsText: dictated.transcript,
          gradingTarget: dictated.transcript,
          transcript: dictated.transcript,
          meaning: dictated.meaning,
          hintMode: dictated.hintMode,
          wordCount: dictated.wordCount,
        },
        ttsText: dictated.transcript,
      });
    }
  } else if (nodeType === "speaking") {
    const lines = speakingLinesForSlot(bank, slot);
    for (let i = 0; i < TARGET_BANK; i += 1) {
      const target = lines[i % lines.length];
      push({
        id: qid(lessonId, i + 1),
        type: i % 5 === 4 ? "pronunciation" : "speaking",
        skillLabel: "Luyện nói",
        prompt: `Nói lại (${focusSpeak}): «${target}»`,
        speakTarget: target,
        minScore: 65,
        explanation: `Target: ${target}`,
        extensions: {
          modality: "speaking",
          slot,
          focus: focusSpeak,
          speakTarget: target,
          ttsText: target,
        },
        required: i < 2,
      });
    }
  } else if (nodeType === "story") {
    for (let i = 0; i < TARGET_BANK; i += 1) {
      const seed = seed0 + i * 19;
      if (i < 3) {
        const s = bank.stories[i % bank.stories.length];
        const wrongs = [...s.wrong];
        while (wrongs.length < 3) wrongs.push(pick(bank.distractors, seed + wrongs.length));
        const { options, correctAnswer } = mcOptions4(s.a, wrongs, seed, { mode: "text" });
        push({
          id: qid(lessonId, i + 1),
          type: "story_comprehension",
          skillLabel: "Story",
          prompt: `${s.q} (đoạn ${i + 1})`,
          storyText: s.text,
          options,
          correctAnswer,
          explanation: `Story «${topic}».`,
          extensions: { modality: "story", storyText: s.text, ttsText: s.text },
          required: i === 0,
        });
      } else if (i < 7) {
        const p = bank.phrases[i % bank.phrases.length];
        const prepared = prepareEnToViMeaning({
          stimulus: p.en,
          correct: p.vi,
          pool: (bank.phrases || []).map((item) => item.vi),
          seed,
        });
        const saved = pushMeaningChoice(push, { lessonId, n: i + 1, seed, prepared });
        if (!saved) {
          const wrongs = otherVi(bank, p.vi, seed, 3);
          const { options, correctAnswer } = mcOptions4(p.vi, wrongs, seed, { mode: "text" });
          push({
            id: qid(lessonId, i + 1),
            type: "multiple_choice",
            skillLabel: "Chọn nghĩa đúng",
            prompt: `"${p.en}" nghĩa là gì?`,
            options,
            correctAnswer,
            explanation: `«${p.en}» nghĩa là «${p.vi}».`,
            extensions: { meaningChoice: true, meaningDirection: "en-to-vi", ttsText: p.en },
          });
        }
      } else {
        const v = bank.vocab[i % bank.vocab.length];
        const wrongs = otherVocab(bank, v.en, seed, 3);
        const { options, correctAnswer } = mcOptions4(v.en, wrongs, seed, {
          mode: "image",
          emojiFor,
        });
        push({
          id: qid(lessonId, i + 1),
          type: "vocabulary_choice",
          skillLabel: "Story vocab",
          prompt: `«${v.vi}» là từ nào?`,
          options,
          correctAnswer,
          explanation: `${v.en} = ${v.vi}.`,
        });
      }
    }
    const dialogue = buildDialogueResponse(part?.partNumber, seed0);
    if (dialogue) {
      const { options, correctAnswer } = mcOptions4(dialogue.reply, dialogue.distractors, seed0, {
        mode: "text",
      });
      questions.splice(1, 0, {
        id: qid(lessonId, 84),
        type: "dialogue_response",
        skillLabel: "Chọn câu đáp",
        prompt: "Chọn câu đáp để hoàn thành hội thoại.",
        options,
        correctAnswer,
        explanation: dialogue.explanation,
        extensions: {
          dialogueResponse: true,
          blankId: dialogue.blankId,
          situation: dialogue.situation,
          lines: dialogue.lines,
          followUp: dialogue.followUp,
          reply: dialogue.reply,
        },
      });
    }
  } else if (nodeType === "test") {
    for (let i = 0; i < TARGET_BANK; i += 1) {
      const seed = seed0 + i * 41;
      if (i < 3) {
        const v = bank.vocab[i % bank.vocab.length];
        const wrongs = otherVocab(bank, v.en, seed, 3);
        const { options, correctAnswer } = mcOptions4(v.en, wrongs, seed, {
          mode: "image",
          emojiFor,
        });
        push({
          id: qid(lessonId, i + 1),
          type: "vocabulary_choice",
          skillLabel: "Test — từ vựng",
          prompt: `[Test] «${v.vi}»?`,
          options,
          correctAnswer,
          explanation: `${v.en} = ${v.vi}.`,
          required: true,
        });
      } else if (i < 6) {
        const g = bank.grammar[i % bank.grammar.length];
        const { options, correctAnswer } = padGrammarTo4(g, bank, seed);
        push({
          id: qid(lessonId, i + 1),
          type: "multiple_choice",
          skillLabel: "Test — ngữ pháp",
          prompt: `[Test] ${g.prompt}`,
          options,
          correctAnswer,
          explanation: g.explanation,
          required: true,
        });
      } else if (i < 9) {
        const p = bank.phrases[i % bank.phrases.length];
        const extras = otherVocab(bank, p.words[0], seed, 3);
        push({
          id: qid(lessonId, i + 1),
          type: "word_order",
          skillLabel: "Test — câu",
          prompt: `[Test] Sắp xếp: «${p.vi}»`,
          ...wordOrderFields(p, extras),
          required: true,
        });
      } else {
        const line = bank.listening[i % bank.listening.length];
        const wrongs = otherListening(bank, line, seed, 3);
        const { options, correctAnswer } = mcOptions4(line, wrongs, seed, { mode: "text" });
        const correctText = options.find((o) => o.id === correctAnswer)?.text;
        push({
          id: qid(lessonId, i + 1),
          type: "listening_choice",
          skillLabel: "Test — nghe",
          prompt: `[Test] Nghe và chọn đúng`,
          options,
          correctAnswer,
          explanation: line,
          extensions: { modality: "listening", ttsText: correctText, gradingTarget: correctText },
          ttsText: correctText,
          required: true,
        });
      }
    }
  } else if (nodeType === "review") {
    for (let i = 0; i < 3; i += 1) {
      const v = bank.vocab[i % bank.vocab.length];
      const wrongs = otherVocab(bank, v.en, seed0 + i, 3);
      const { options, correctAnswer } = mcOptions4(v.en, wrongs, seed0 + i, {
        mode: "image",
        emojiFor,
      });
      push({
        id: qid(lessonId, i + 1),
        type: "vocabulary_choice",
        skillLabel: "Ôn tập",
        prompt: `[Review] «${v.vi}»`,
        options,
        correctAnswer,
        explanation: `${v.en} = ${v.vi}.`,
        extensions: { modality: "review" },
      });
    }
  } else {
    const { options, correctAnswer } = mcOptions4("OK", ["No", "Maybe", "Skip"], seed0, {
      mode: "text",
    });
    push({
      id: qid(lessonId, 1),
      type: "multiple_choice",
      skillLabel: "Beego",
      prompt: topic,
      options,
      correctAnswer,
      explanation: "Default",
    });
  }

  return questions;
}

export function getListenFocusLabel(partNumber, listenSlot) {
  return slotFocus(partNumber, listenSlot, "listen");
}

export function getSpeakFocusLabel(partNumber, speakSlot) {
  return slotFocus(partNumber, speakSlot, "speak");
}

export const NORMAL_LESSON_MIN_EXERCISES = 10;
export const GENERATED_BANK_SIZE = TARGET_BANK;
export const CHOICE_OPTION_COUNT = CHOICE_COUNT;
