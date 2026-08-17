/**
 * Bài luyện IPA tĩnh — từ, IPA, nghĩa tiếng Việt, target_phoneme.
 * @typedef {{ word: string, ipa: string, vi: string, targetPhoneme?: string, example_sentence?: string }} IpaPracticeWord
 * @typedef {{ id: string, title: string, targetPhoneme?: string, phonemeAudioText?: string, words: IpaPracticeWord[] }} IpaPracticeLesson
 */

import {
  filterWordsByTargetPhoneme,
  validatePronunciationLessons,
} from "@/lib/pronunciation/phoneme-match";
import { getPhonemeAudioFromMap } from "@/lib/pronunciation/pronunciation-audio";

/** @type {IpaPracticeLesson[]} */
const RAW_IPA_PRACTICE_LESSONS = [
  {
    id: "mn-ng",
    title: "Âm /m/-/n/-/ŋ/",
    words: [
      { word: "moon", ipa: "/muːn/", vi: "mặt trăng", targetPhoneme: "/m/" },
      { word: "name", ipa: "/neɪm/", vi: "tên", targetPhoneme: "/n/" },
      { word: "sing", ipa: "/sɪŋ/", vi: "hát", targetPhoneme: "/ŋ/" },
      { word: "think", ipa: "/θɪŋk/", vi: "nghĩ", targetPhoneme: "/ŋ/" },
      { word: "swim", ipa: "/swɪm/", vi: "bơi", targetPhoneme: "/m/" },
      { word: "bank", ipa: "/bæŋk/", vi: "ngân hàng", targetPhoneme: "/ŋ/" },
    ],
  },
  {
    id: "lr",
    title: "Âm /l/-/r/",
    words: [
      { word: "light", ipa: "/laɪt/", vi: "ánh sáng", targetPhoneme: "/l/" },
      { word: "right", ipa: "/raɪt/", vi: "đúng / bên phải", targetPhoneme: "/r/" },
      { word: "lake", ipa: "/leɪk/", vi: "hồ", targetPhoneme: "/l/" },
      { word: "rake", ipa: "/reɪk/", vi: "cái cào", targetPhoneme: "/r/" },
      { word: "fly", ipa: "/flaɪ/", vi: "bay", targetPhoneme: "/l/" },
      { word: "cry", ipa: "/kraɪ/", vi: "khóc", targetPhoneme: "/r/" },
    ],
  },
  {
    id: "diph-ai-oy",
    title: "Âm /eɪ/-/aɪ/-/ɔɪ/",
    words: [
      { word: "day", ipa: "/deɪ/", vi: "ngày", targetPhoneme: "/eɪ/" },
      { word: "train", ipa: "/treɪn/", vi: "tàu hỏa", targetPhoneme: "/eɪ/" },
      { word: "eye", ipa: "/aɪ/", vi: "mắt", targetPhoneme: "/aɪ/" },
      { word: "time", ipa: "/taɪm/", vi: "thời gian", targetPhoneme: "/aɪ/" },
      { word: "boy", ipa: "/bɔɪ/", vi: "cậu bé", targetPhoneme: "/ɔɪ/" },
      { word: "noise", ipa: "/nɔɪz/", vi: "tiếng ồn", targetPhoneme: "/ɔɪ/" },
    ],
  },
  {
    id: "v-f-th",
    title: "Âm /v/-/f/-/θ/",
    words: [
      { word: "voice", ipa: "/vɔɪs/", vi: "giọng nói", targetPhoneme: "/v/" },
      { word: "very", ipa: "/ˈver.i/", vi: "rất", targetPhoneme: "/v/" },
      { word: "fish", ipa: "/fɪʃ/", vi: "cá", targetPhoneme: "/f/" },
      { word: "free", ipa: "/friː/", vi: "miễn phí", targetPhoneme: "/f/" },
      { word: "think", ipa: "/θɪŋk/", vi: "suy nghĩ", targetPhoneme: "/θ/" },
      { word: "three", ipa: "/θriː/", vi: "số ba", targetPhoneme: "/θ/" },
    ],
  },
  {
    id: "s-z-sh",
    title: "Âm /s/-/z/-/ʃ/",
    words: [
      { word: "sun", ipa: "/sʌn/", vi: "mặt trời", targetPhoneme: "/s/" },
      { word: "zoo", ipa: "/zuː/", vi: "sở thú", targetPhoneme: "/z/" },
      { word: "shoe", ipa: "/ʃuː/", vi: "đôi giày", targetPhoneme: "/ʃ/" },
      { word: "measure", ipa: "/ˈmeʒ.ər/", vi: "đo lường", targetPhoneme: "/ʒ/" },
      { word: "ship", ipa: "/ʃɪp/", vi: "con tàu", targetPhoneme: "/ʃ/" },
      { word: "zip", ipa: "/zɪp/", vi: "khóa kéo", targetPhoneme: "/z/" },
    ],
  },
  {
    id: "short-long-vowels",
    title: "Âm /ɪ/-/iː/-/ʊ/-/uː/",
    words: [
      { word: "sit", ipa: "/sɪt/", vi: "ngồi", targetPhoneme: "/ɪ/" },
      { word: "seat", ipa: "/siːt/", vi: "ghế", targetPhoneme: "/iː/" },
      { word: "full", ipa: "/fʊl/", vi: "đầy", targetPhoneme: "/ʊ/" },
      { word: "food", ipa: "/fuːd/", vi: "thức ăn", targetPhoneme: "/uː/" },
      { word: "pool", ipa: "/puːl/", vi: "bể bơi", targetPhoneme: "/uː/" },
      { word: "pull", ipa: "/pʊl/", vi: "kéo", targetPhoneme: "/ʊ/" },
    ],
  },
  {
    id: "ae-ah",
    title: "Âm /æ/-/ʌ/",
    words: [
      { word: "cat", ipa: "/kæt/", vi: "con mèo", targetPhoneme: "/æ/" },
      { word: "hat", ipa: "/hæt/", vi: "cái mũ", targetPhoneme: "/æ/" },
      { word: "cup", ipa: "/kʌp/", vi: "tách", targetPhoneme: "/ʌ/" },
      { word: "love", ipa: "/lʌv/", vi: "yêu", targetPhoneme: "/ʌ/" },
      { word: "run", ipa: "/rʌn/", vi: "chạy", targetPhoneme: "/ʌ/" },
      { word: "black", ipa: "/blæk/", vi: "màu đen", targetPhoneme: "/æ/" },
    ],
  },
  {
    id: "t-d",
    title: "Âm /t/-/d/",
    words: [
      { word: "tea", ipa: "/tiː/", vi: "trà", targetPhoneme: "/t/" },
      { word: "day", ipa: "/deɪ/", vi: "ngày", targetPhoneme: "/d/" },
      { word: "town", ipa: "/taʊn/", vi: "thị trấn", targetPhoneme: "/t/" },
      { word: "down", ipa: "/daʊn/", vi: "xuống", targetPhoneme: "/d/" },
      { word: "door", ipa: "/dɔːr/", vi: "cửa", targetPhoneme: "/d/" },
      { word: "take", ipa: "/teɪk/", vi: "lấy", targetPhoneme: "/t/" },
    ],
  },
  {
    id: "p-b",
    title: "Âm /p/-/b/",
    words: [
      { word: "pen", ipa: "/pen/", vi: "cây bút", targetPhoneme: "/p/" },
      { word: "big", ipa: "/bɪɡ/", vi: "to", targetPhoneme: "/b/" },
      { word: "pray", ipa: "/preɪ/", vi: "cầu nguyện", targetPhoneme: "/p/" },
      { word: "brain", ipa: "/breɪn/", vi: "não", targetPhoneme: "/b/" },
      { word: "spin", ipa: "/spɪn/", vi: "quay", targetPhoneme: "/p/" },
      { word: "best", ipa: "/best/", vi: "tốt nhất", targetPhoneme: "/b/" },
    ],
  },
  {
    id: "phoneme-k",
    title: "Âm /k/",
    targetPhoneme: "/k/",
    phonemeAudioText: "cat",
    words: [
      { word: "cat", ipa: "/kæt/", vi: "con mèo", targetPhoneme: "/k/" },
      { word: "key", ipa: "/kiː/", vi: "chìa khóa", targetPhoneme: "/k/" },
      { word: "cake", ipa: "/keɪk/", vi: "bánh ngọt", targetPhoneme: "/k/" },
      { word: "back", ipa: "/bæk/", vi: "lưng / phía sau", targetPhoneme: "/k/" },
      { word: "school", ipa: "/skuːl/", vi: "trường học", targetPhoneme: "/k/" },
      { word: "clock", ipa: "/klɑːk/", vi: "đồng hồ", targetPhoneme: "/k/" },
    ],
  },
  {
    id: "phoneme-g",
    title: "Âm /ɡ/",
    targetPhoneme: "/ɡ/",
    phonemeAudioText: "gold",
    words: [
      { word: "go", ipa: "/ɡoʊ/", vi: "đi", targetPhoneme: "/ɡ/" },
      { word: "gold", ipa: "/ɡoʊld/", vi: "vàng", targetPhoneme: "/ɡ/" },
      { word: "good", ipa: "/ɡʊd/", vi: "tốt", targetPhoneme: "/ɡ/" },
      { word: "girl", ipa: "/ɡɜːrl/", vi: "cô gái", targetPhoneme: "/ɡ/" },
      { word: "garden", ipa: "/ˈɡɑːrdn/", vi: "khu vườn", targetPhoneme: "/ɡ/" },
      { word: "green", ipa: "/ɡriːn/", vi: "màu xanh lá", targetPhoneme: "/ɡ/" },
    ],
  },
  {
    id: "h-w-j",
    title: "Âm /h/-/w/-/j/",
    words: [
      { word: "hello", ipa: "/həˈloʊ/", vi: "xin chào", targetPhoneme: "/h/" },
      { word: "hot", ipa: "/hɑːt/", vi: "nóng", targetPhoneme: "/h/" },
      { word: "we", ipa: "/wiː/", vi: "chúng ta", targetPhoneme: "/w/" },
      { word: "wine", ipa: "/waɪn/", vi: "rượu vang", targetPhoneme: "/w/" },
      { word: "yes", ipa: "/jes/", vi: "vâng", targetPhoneme: "/j/" },
      { word: "yellow", ipa: "/ˈjel.oʊ/", vi: "màu vàng", targetPhoneme: "/j/" },
    ],
  },
  {
    id: "ch-j",
    title: "Âm /tʃ/-/dʒ/",
    words: [
      { word: "chair", ipa: "/tʃeər/", vi: "ghế", targetPhoneme: "/tʃ/" },
      { word: "cheese", ipa: "/tʃiːz/", vi: "phô mai", targetPhoneme: "/tʃ/" },
      { word: "jeep", ipa: "/dʒiːp/", vi: "xe jeep", targetPhoneme: "/dʒ/" },
      { word: "job", ipa: "/dʒɑːb/", vi: "công việc", targetPhoneme: "/dʒ/" },
      { word: "watch", ipa: "/wɑːtʃ/", vi: "đồng hồ", targetPhoneme: "/tʃ/" },
      { word: "orange", ipa: "/ˈɔːr.ɪndʒ/", vi: "quả cam", targetPhoneme: "/dʒ/" },
    ],
  },
];

function defaultExampleSentence(word) {
  const w = String(word || "").trim();
  const lower = w.toLowerCase();
  if (lower === "hello") return "Hello, how are you?";
  if (lower === "ship") return "The ship is big.";
  if (lower === "think") return "I think so.";
  if (lower === "sing") return "She likes to sing.";
  if (lower === "sit") return "Sit down, please.";
  if (lower === "gold") return "Gold is valuable.";
  if (lower === "girl") return "The girl is happy.";
  if (lower === "go") return "Let's go now.";
  if (lower === "cat") return "The cat is small.";
  if (lower === "day") return "Have a nice day.";
  if (lower === "sheep") return "The sheep is white.";
  if (lower === "chair") return "Sit on the chair.";
  if (lower === "job") return "She has a good job.";
  if (lower === "this") return "This is my book.";
  if (lower === "water") return "I need some water.";
  if (lower === "yes") return "Yes, I agree.";
  if (lower === "red") return "The car is red.";
  return `Practice the word: ${w}.`;
}

function enrichLesson(lesson) {
  const words = filterWordsByTargetPhoneme(lesson.words, lesson.targetPhoneme).map((w) => ({
    ...w,
    example_sentence: w.example_sentence || defaultExampleSentence(w.word),
  }));

  const phonemeAudioText =
    lesson.phonemeAudioText ||
    (lesson.targetPhoneme ? getPhonemeAudioFromMap(lesson.targetPhoneme) : null) ||
    (lesson.targetPhoneme ? words[0]?.word : undefined) ||
    lesson.phonemeAudioText;

  return {
    ...lesson,
    words,
    ...(lesson.targetPhoneme && phonemeAudioText ? { phonemeAudioText } : {}),
  };
}

function sanitizeLessons(lessons) {
  return lessons.map(enrichLesson);
}

/** @type {IpaPracticeLesson[]} */
export const IPA_PRACTICE_LESSONS = sanitizeLessons(RAW_IPA_PRACTICE_LESSONS);

export function validatePronunciationLessonsExport() {
  return validatePronunciationLessons(IPA_PRACTICE_LESSONS);
}

export { validatePronunciationLessons } from "@/lib/pronunciation/phoneme-match";

if (typeof console !== "undefined") {
  validatePronunciationLessonsExport();
}
