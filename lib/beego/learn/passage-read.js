/**
 * Last Learn activity: one coherent passage, with General American IPA on every sentence.
 */
import { GATE_SCENES } from "./passage-scenes.js";
import { attachGate1Ipa, gate1StoryRows } from "./gate1-stories.js";
import { PASSAGE_IPA_ACCENT, PASSAGE_IPA_SOURCE, ipaForSentence } from "./passage-ipa.js";

function tidy(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function ensurePeriod(value) {
  const text = tidy(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function focusWordsFromPart(part) {
  return (Array.isArray(part?.pairs) ? part.pairs : [])
    .filter((pair) => String(pair?.role || "").toLowerCase() === "focus")
    .map((pair) => tidy(pair.en))
    .filter(Boolean);
}

const INTRO_BIO = [
  { en: "My name is Linh Tran, and I am twenty years old.", vi: "Tên tôi là Linh Tran, và tôi hai mươi tuổi." },
  { en: "I am a student, and I like reading.", vi: "Tôi là học sinh, và tôi thích đọc sách." },
  { en: "I live with my family.", vi: "Tôi sống cùng gia đình." },
];

export function isSelfIntroLesson(meta = {}) {
  const title = tidy(meta.lessonTitle).toLowerCase();
  if (Number(meta.gateNumber) === 1 && Number(meta.lessonNumber) === 1) return true;
  if (title === "tự giới thiệu" || title.includes("giới thiệu bản thân")) return true;
  return false;
}

function modelLine(meta, parts) {
  const fromMeta = tidy(meta?.model?.en);
  if (fromMeta) return { en: ensurePeriod(fromMeta), vi: tidy(meta?.model?.vi) };
  const byOrder = new Map();
  for (const part of parts || []) byOrder.set(Number(part.order) || 0, part);
  const readPart = byOrder.get(4) || byOrder.get(11) || byOrder.get(7);
  const items = Array.isArray(readPart?.items) ? readPart.items : [];
  const source = items.find((item) => tidy(item?.referenceText || item?.text).split(/\s+/).length >= 4) || items[0] || {};
  const en = tidy(source.referenceText || source.text || source.audioScript || "");
  return { en: en ? ensurePeriod(en) : "", vi: tidy(source.translation || "") };
}

function sceneLines(meta) {
  const gate = Number(meta?.gateNumber) || 1;
  const scene = GATE_SCENES[gate] || GATE_SCENES[1];
  const index = Math.max(0, (Number(meta?.lessonNumber) || 1) - 1);
  const lead = scene.leads[index % scene.leads.length];
  return [
    { en: ensurePeriod(lead.en), vi: lead.vi },
    { en: ensurePeriod(scene.close.en), vi: scene.close.vi },
  ];
}

function attachIpa(row) {
  const spoken = ipaForSentence(row.en);
  return {
    text: row.en,
    vi: row.vi || "",
    ipa: spoken.ipa,
    tokens: spoken.tokens,
    missingIpa: spoken.missing,
  };
}

/**
 * @returns {{ id: string, sentences: object[], referenceText: string, focusWords: string[], ipaAccent: string, ipaSource: string }}
 */
export function buildLessonPassage(parts, meta = {}) {
  const byOrder = new Map();
  for (const part of parts || []) byOrder.set(Number(part.order) || 0, part);
  const focusWords = Array.isArray(meta.focusWords) && meta.focusWords.length
    ? meta.focusWords.map((word) => tidy(word)).filter(Boolean)
    : focusWordsFromPart(byOrder.get(1));
  const model = modelLine(meta, parts);
  const gate1Story = gate1StoryRows(meta);
  const rows = [];
  if (gate1Story) {
    rows.push(...gate1Story);
  } else if (isSelfIntroLesson(meta) && model.en) {
    const greetingFirst = /^(hello|hi)\b/i.test(model.en);
    const bio = INTRO_BIO.map((row) => ({ en: ensurePeriod(row.en), vi: row.vi }));
    rows.push(...(greetingFirst ? [model, ...bio] : [...bio, model]));
  } else if (model.en) {
    const [lead, close] = sceneLines(meta);
    rows.push(lead, model, close);
  }

  const seen = new Set();
  const sentences = [];
  for (const row of rows) {
    const key = row.en.toLowerCase();
    if (!row.en || seen.has(key)) continue;
    seen.add(key);
    sentences.push(gate1Story ? attachGate1Ipa(row) : attachIpa(row));
  }

  const idBase = tidy(meta.lessonId) || tidy(byOrder.get(4)?.id).replace(/-part\d+.*$/i, "") || "lesson";
  return {
    id: `${idBase}-passage`,
    sentences,
    referenceText: sentences.map((row) => row.text).join(" "),
    focusWords,
    ipaAccent: PASSAGE_IPA_ACCENT,
    ipaSource: PASSAGE_IPA_SOURCE,
  };
}

export const PASSAGE_PASS_PRONUNCIATION = 60;

function wordList(rows, limit = 4) {
  return rows
    .map((row) => tidy(row?.word))
    .filter(Boolean)
    .slice(0, limit)
    .join(", ");
}

/** Vietnamese comment from Azure word errors only. No invented mistakes. */
export function feedbackFromAzureWords(words = []) {
  const list = Array.isArray(words) ? words : [];
  const content = list.filter((row) => tidy(row?.word) && String(row?.error || "") !== "Insertion");
  if (!content.length && !list.some((row) => String(row?.error) === "Insertion")) {
    return "Azure chưa trả đánh giá từng từ, nên bài này chưa tô từ sai.";
  }
  const clear = content.filter((row) => String(row.error || "None") === "None");
  const unclear = content.filter((row) => row.error === "Mispronunciation");
  const missing = content.filter((row) => row.error === "Omission");
  const extra = list.filter((row) => row.error === "Insertion");
  const bits = [];
  if (clear.length) {
    const sample = wordList(clear, 3);
    bits.push(sample ? `Bạn đọc rõ ${clear.length} từ, trong đó có ${sample}.` : `Bạn đọc rõ ${clear.length} từ.`);
  }
  if (unclear.length) {
    bits.push(`Cần luyện lại: ${wordList(unclear, 6)}. Nghe chậm từng từ đó, rồi đọc lại cả đoạn.`);
  }
  if (missing.length) {
    bits.push(`Bạn bỏ sót: ${wordList(missing, 6)}. Lần sau hãy đọc đủ các từ này.`);
  }
  if (extra.length) {
    bits.push(`Bạn nói thêm: ${wordList(extra, 4)}.`);
  }
  if (!unclear.length && !missing.length && clear.length) {
    bits.push("Các từ Azure đối chiếu đều không bị đánh dấu sai. Giữ nhịp chậm như khi nghe mẫu.");
  }
  return bits.join(" ").slice(0, 580);
}
