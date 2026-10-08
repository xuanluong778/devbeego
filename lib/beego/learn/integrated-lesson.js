/**
 * One communicative lesson: twelve activities in a fixed order.
 * Test, review, and placement do not use this builder.
 * A missing asset is recorded as a gap. It is not replaced with another exercise type.
 */

import { getTopicBank } from "@/lib/beego/learn/lesson-topic-banks";
import { buildListenPictureOptions } from "@/lib/beego/learn/listen-picture-choice";
import { prepareEnToViMeaning } from "@/lib/beego/learn/meaning-choice";
import { buildLessonAudioMatchPairs, buildLessonMatchPairs } from "@/lib/beego/learn/match-pairs";
import { buildListenFill } from "@/lib/beego/learn/listen-fill";
import { buildListenDictation, meaningForTranscript } from "@/lib/beego/learn/listen-dictation";
import { buildTranslationExercise } from "@/lib/beego/learn/translation";
import { nodePractice } from "@/lib/beego/learn/integrated-node-practice";
import { integratedNodeContent } from "@/lib/beego/learn/integrated-node-content";

const INTEGRATED_TYPES = new Set([
  "vocabulary",
  "sentence_patterns",
  "grammar",
  "listening",
  "speaking",
  "story",
]);

const OPTION_IDS = ["a", "b", "c", "d"];

export function isIntegratedNodeType(nodeType) {
  return INTEGRATED_TYPES.has(String(nodeType || ""));
}

export function isIntegratedLesson(lesson) {
  return (lesson?.questions || []).some((question) => question?.extensions?.integratedLesson === true);
}

function nodeIndexOf(lessonId, blueprint) {
  const match = String(lessonId || "").match(/-n(\d+)$/);
  if (match) return Number(match[1]);
  return Number(blueprint?.nodeIndex) || 1;
}

function tidy(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceKey(value) {
  return tidy(value)
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "");
}

function rotate(list, offset) {
  const items = list || [];
  if (!items.length) return [];
  const start = Math.abs(Number(offset) || 0) % items.length;
  return items.slice(start).concat(items.slice(0, start));
}

function fourOptions(correctText, distractors, seed) {
  const correct = tidy(correctText);
  const wrongs = [];
  for (const item of distractors || []) {
    const text = tidy(item);
    if (!text || text.toLowerCase() === correct.toLowerCase()) continue;
    if (wrongs.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue;
    wrongs.push(text);
    if (wrongs.length === 3) break;
  }
  if (wrongs.length < 3) return null;
  const bag = [];
  const ordered = [{ text: correct, correct: true }, ...wrongs.slice(0, 3).map((text) => ({ text, correct: false }))];
  const copy = [...ordered];
  let state = Math.abs(Number(seed) || 1);
  while (copy.length) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    bag.push(copy.splice(state % copy.length, 1)[0]);
  }
  const options = bag.map((item, index) => ({ id: OPTION_IDS[index], text: item.text }));
  return { options, correctAnswer: options[bag.findIndex((item) => item.correct)].id };
}

function takeSentence(list, used, read) {
  for (const item of list || []) {
    const text = tidy(read(item));
    const key = sentenceKey(text);
    if (!key || used.has(key)) continue;
    used.add(key);
    return item;
  }
  return null;
}

function activity(question, activityNumber) {
  return {
    ...question,
    extensions: {
      ...(question.extensions || {}),
      integratedLesson: true,
      activity: activityNumber,
    },
  };
}

export function buildIntegratedLessonQuestions({ lessonId, nodeType, part, blueprint }) {
  const partNumber = Number(part?.partNumber) || 1;
  const bank = getTopicBank(partNumber);
  const nodeIndex = nodeIndexOf(lessonId, blueprint);
  const offset = nodeIndex - 1;
  const seed = nodeIndex * 1009 + partNumber * 17;
  const used = new Set();
  const gaps = [];
  const questions = [];
  const idFor = (n) => `${lessonId}-a${String(n).padStart(2, "0")}`;

  const nodeContent = integratedNodeContent(partNumber, nodeIndex);
  const vocab = rotate(bank.vocab, offset);
  const phrases = nodeContent?.phrase ? [nodeContent.phrase, ...rotate(bank.phrases, offset)] : rotate(bank.phrases, offset);
  const listening = [nodeContent?.listen, nodeContent?.dictation, ...rotate(bank.listening, offset + 1)].filter(Boolean);
  const speaking = nodeContent?.speak ? [nodeContent.speak, ...rotate(bank.speaking, offset + 2)] : rotate(bank.speaking, offset + 2);
  const stories = nodeContent?.story ? [nodeContent.story, ...rotate(bank.stories, offset)] : rotate(bank.stories, offset);

  const picture = buildListenPictureOptions(vocab, seed, 0);
  if (!picture) {
    gaps.push({ activity: 1, code: "picture_listening", reason: "Không đủ hình khác nhau cho từ của bài." });
  } else {
    questions.push(
      activity(
        {
          id: idFor(1),
          type: "listening_choice",
          skillLabel: "Nghe và chọn hình",
          prompt: "Nghe và chọn hình đúng.",
          options: picture.options,
          correctAnswer: picture.correctAnswer,
          explanation: `${picture.target.en} nghĩa là ${picture.target.vi}.`,
          extensions: {
            modality: "listening",
            choicePresentation: "picture",
            ttsText: picture.target.en,
            gradingTarget: picture.target.en,
          },
          ttsText: picture.target.en,
        },
        1
      )
    );
  }

  const meaningWord =
    vocab.find((item) => sentenceKey(item?.en) !== sentenceKey(picture?.target?.en)) || vocab[0];
  const meaning = prepareEnToViMeaning({
    stimulus: meaningWord?.en,
    correct: meaningWord?.vi,
    pool: vocab.map((item) => item.vi),
    seed,
  });
  if (meaning?.wrongs?.length >= 3) {
    const choice = fourOptions(meaning.correct, meaning.wrongs, seed + 3);
    if (!choice) {
      gaps.push({ activity: 2, code: "meaning_choice", reason: "Không đủ nghĩa nhiễu khác nhau." });
    } else questions.push(
      activity(
        {
          id: idFor(2),
          type: "multiple_choice",
          skillLabel: "Chọn nghĩa đúng",
          prompt: meaning.prompt,
          options: choice.options,
          correctAnswer: choice.correctAnswer,
          explanation: meaning.explanation,
          extensions: {
            meaningChoice: true,
            meaningDirection: "en-to-vi",
            ttsText: meaning.ttsText || meaningWord?.en || "",
          },
        },
        2
      )
    );
  } else {
    gaps.push({ activity: 2, code: "meaning_choice", reason: "Không đủ nghĩa nhiễu." });
  }

  const textPairs = buildLessonMatchPairs(vocab, seed, 4);
  if (!textPairs) {
    gaps.push({ activity: 3, code: "matching_pairs", reason: "Không đủ cặp từ khác nghĩa." });
  } else {
    questions.push(
      activity(
        {
          id: idFor(3),
          type: "matching_pairs",
          skillLabel: "Ghép từ Anh–Việt",
          prompt: "Ghép từ tiếng Anh với nghĩa tiếng Việt.",
          pairs: textPairs,
          explanation: "Ghép từng từ với đúng một nghĩa.",
        },
        3
      )
    );
  }

  const usedEn = new Set((textPairs || []).map((pair) => sentenceKey(pair.en)));
  const audioVocab = vocab.filter((item) => !usedEn.has(sentenceKey(item.en)));
  const audioPairs = buildLessonAudioMatchPairs(audioVocab.length >= 4 ? audioVocab : vocab, seed + 5, {
    advanced: partNumber >= 5,
    count: 4,
  });
  if (!audioPairs) {
    gaps.push({ activity: 4, code: "audio_match", reason: "Không đủ từ để ghép âm thanh." });
  } else {
    questions.push(
      activity(
        {
          id: idFor(4),
          type: "matching_pairs",
          skillLabel: "Ghép âm thanh với từ",
          prompt: "Nghe và ghép với từ tiếng Anh. Bấm Nghe không bị tính là chọn.",
          pairs: audioPairs,
          extensions: { audioMatch: true },
          explanation: "Nghe rồi chọn từ đúng. Lỗi phát âm thanh không bị tính là trả lời sai.",
        },
        4
      )
    );
  }

  const phrase = takeSentence(phrases, used, (item) => item.en);
  if (!phrase?.words?.length) {
    gaps.push({ activity: 5, code: "word_order", reason: "Không còn câu khác cho thẻ từ." });
  } else {
    const answerWords = [...phrase.words];
    const blocked = new Set(answerWords.map((word) => String(word).toLowerCase()));
    const extras = vocab.map((item) => item.en).filter((word) => word && !blocked.has(String(word).toLowerCase()));
    questions.push(
      activity(
        {
          id: idFor(5),
          type: "word_order",
          skillLabel: "Sắp xếp từ",
          prompt: `Sắp xếp thành câu: «${phrase.vi}»`,
          wordBank: [...answerWords, ...extras].slice(0, Math.max(answerWords.length + 2, 6)),
          correctAnswer: answerWords,
          explanation: phrase.en,
          extensions: { modelSentence: phrase.en, meaning: phrase.vi },
        },
        5
      )
    );
  }

  let fill = null;
  let fillLine = null;
  for (const line of listening) {
    const key = sentenceKey(line);
    if (!key || used.has(key)) continue;
    const built = buildListenFill(line, { vocab, listening, phrases, seed });
    if (!built) continue;
    used.add(key);
    fill = built;
    fillLine = line;
    break;
  }
  if (!fill) {
    gaps.push({ activity: 6, code: "listening_fill", reason: "Không tạo được chỗ trống nghe với đủ từ nhiễu." });
  } else {
    const choice = fourOptions(fill.gapWord, fill.distractors, seed + 11);
    if (!choice) {
      gaps.push({ activity: 6, code: "listening_fill", reason: "Không đủ từ nhiễu khác nhau." });
    } else questions.push(
      activity(
        {
          id: idFor(6),
          type: "listening_fill",
          skillLabel: "Nghe và chọn từ còn thiếu",
          prompt: "Nghe và chọn từ còn thiếu.",
          sentenceTemplate: fill.displaySentence,
          options: choice.options,
          correctAnswer: choice.correctAnswer,
          explanation: fill.explanation,
          extensions: {
            modality: "listening",
            ttsText: fill.transcript,
            gradingTarget: fill.transcript,
            transcript: fill.transcript,
            gapWord: fill.gapWord,
            gapIndex: fill.gapIndex,
            meaning: fill.meaning,
          },
          ttsText: fill.transcript,
        },
        6
      )
    );
  }

  const dictatedLine = takeSentence(
    listening.filter((line) => sentenceKey(line) !== sentenceKey(fillLine)),
    used,
    (line) => line
  );
  const dictated = dictatedLine
    ? buildListenDictation(dictatedLine, {
        meaning: meaningForTranscript(dictatedLine, phrases),
        partNumber,
      })
    : null;
  if (!dictated) {
    gaps.push({ activity: 7, code: "listening_dictation", reason: "Không còn câu khác để nhập lại." });
  } else {
    questions.push(
      activity(
        {
          id: idFor(7),
          type: "listening_dictation",
          skillLabel: "Nghe và nhập lại câu",
          prompt: "Nghe và nhập lại câu.",
          correctAnswer: dictated.transcript,
          explanation: dictated.meaning ? `Nghĩa: ${dictated.meaning}` : "Gõ lại đúng câu đã nghe.",
          extensions: {
            modality: "listening",
            listenDictation: true,
            ttsText: dictated.transcript,
            gradingTarget: dictated.transcript,
            transcript: dictated.transcript,
            meaning: dictated.meaning,
            hintMode: dictated.hintMode,
            wordCount: dictated.wordCount,
          },
          ttsText: dictated.transcript,
        },
        7
      )
    );
  }

  const translationPhrases = [];
  for (const item of phrases) {
    if (translationPhrases.length === 2) break;
    const key = sentenceKey(item.en);
    if (!key || used.has(key)) continue;
    used.add(key);
    translationPhrases.push(item);
  }
  ["vi-to-en", "en-to-vi"].forEach((direction, index) => {
    const source = translationPhrases[index];
    const built = source
      ? buildTranslationExercise(source, direction, {
          partNumber,
          distractors: vocab.map((item) => item.en),
        })
      : null;
    if (!built) {
      gaps.push({ activity: 8, code: `translation_${direction}`, reason: "Không còn câu khác để dịch." });
      return;
    }
    questions.push(
      activity(
        {
          id: idFor(8 + index),
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
            activityPart: index + 1,
          },
        },
        8
      )
    );
  });

  const practice = nodePractice(partNumber, nodeIndex);
  const cloze =
    practice?.cloze && !used.has(sentenceKey(practice.cloze.completed)) ? practice.cloze : null;
  if (!cloze) {
    gaps.push({ activity: 9, code: "context_cloze", reason: "Không có câu điền khác với các câu đã dùng." });
  } else {
    used.add(sentenceKey(cloze.completed));
    const choice =
      cloze.inputMode === "choice"
        ? fourOptions(cloze.answers[0], cloze.distractors, seed + 13)
        : { options: undefined, correctAnswer: cloze.answers[0] };
    if (cloze.inputMode === "choice" && !choice) {
      gaps.push({ activity: 9, code: "context_cloze", reason: "Không đủ từ nhiễu cho chỗ trống." });
    } else questions.push(
      activity(
        {
          id: idFor(10),
          type: "context_cloze",
          skillLabel: cloze.focus,
          prompt: cloze.prompt,
          sentenceTemplate: cloze.display,
          options: choice.options,
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
        },
        9
      )
    );
  }

  const dialogue =
    practice?.dialogue && !used.has(sentenceKey(practice.dialogue.lines.map((line) => line.text).join(" ")))
      ? practice.dialogue
      : null;
  const dialogueText = (dialogue?.lines || []).map((line) => line.text).join(" ");
  if (!dialogue || used.has(sentenceKey(dialogueText))) {
    gaps.push({ activity: 10, code: "dialogue_response", reason: "Không có hội thoại khác với các câu đã dùng." });
  } else {
    used.add(sentenceKey(dialogueText));
    const choice = fourOptions(dialogue.reply, dialogue.distractors, seed + 19);
    if (!choice) {
      gaps.push({ activity: 10, code: "dialogue_response", reason: "Không đủ câu đáp nhiễu." });
    } else questions.push(
      activity(
        {
          id: idFor(11),
          type: "dialogue_response",
          skillLabel: "Chọn câu đáp",
          prompt: "Chọn câu đáp để hoàn thành hội thoại.",
          options: choice.options,
          correctAnswer: choice.correctAnswer,
          explanation: dialogue.explanation,
          extensions: {
            dialogueResponse: true,
            blankId: dialogue.blankId,
            situation: dialogue.situation,
            lines: dialogue.lines,
            followUp: dialogue.followUp,
            reply: dialogue.reply,
          },
        },
        10
      )
    );
  }

  const spoken = takeSentence(speaking, used, (line) => line);
  if (!spoken) {
    gaps.push({ activity: 11, code: "speaking", reason: "Không còn câu khác để đọc thành tiếng." });
  } else {
    questions.push(
      activity(
        {
          id: idFor(12),
          type: "speaking",
          skillLabel: "Đọc thành tiếng",
          prompt: `Đọc thành tiếng: «${spoken}»`,
          speakTarget: spoken,
          minScore: 65,
          explanation: `Câu cần nói: ${spoken}`,
          extensions: { modality: "speaking", speakTarget: spoken, ttsText: spoken },
        },
        11
      )
    );
  }

  const story = stories.find((item) => !used.has(sentenceKey(item?.text))) || null;
  if (!story) {
    gaps.push({ activity: 12, code: "story_comprehension", reason: "Không còn đoạn truyện khác." });
  } else {
    used.add(sentenceKey(story.text));
    const wrongs = [...(story.wrong || [])];
    for (const other of stories) {
      if (wrongs.length >= 3) break;
      if (other.a && other.a !== story.a && !wrongs.includes(other.a)) wrongs.push(other.a);
    }
    const choice = fourOptions(story.a, wrongs, seed + 23);
    if (!choice) {
      gaps.push({ activity: 12, code: "story_comprehension", reason: "Câu hỏi truyện chưa có đủ đáp án nhiễu." });
    } else questions.push(
      activity(
        {
          id: idFor(13),
          type: "story_comprehension",
          skillLabel: "Story",
          prompt: story.q,
          storyText: story.text,
          options: choice.options,
          correctAnswer: choice.correctAnswer,
          explanation: `Đoạn văn trả lời: ${story.a}`,
          extensions: { modality: "story", storyText: story.text },
        },
        12
      )
    );
  }

  return { questions, gaps, nodeType, topicTitle: bank.topicTitle };
}
