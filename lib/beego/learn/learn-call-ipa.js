/**
 * Learn Call IPA helpers. OpenAI TTS voices used for tutors sound American and do not expose an
 * accent switch, so Learn Call IPA is General American (US). Never invent IPA on the client.
 */

import crypto from "node:crypto";

/** Accent used for every Learn Call tutor (OpenAI TTS alloy/nova/onyx/shimmer ≈ US English). */
export const LEARN_CALL_IPA_ACCENT = "us";
export const LEARN_CALL_IPA_ACCENT_LABEL = "Anh-Mỹ (General American)";
export const LEARN_CALL_IPA_MAX_CHARS = 500;
export const LEARN_CALL_IPA_CACHE_TTL_SECONDS = 60 * 60;
export const LEARN_CALL_IPA_REDIS_PREFIX = "voice:learn-call-ipa:";

const VIETNAMESE_OR_LATIN_ACCENT =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
const IPA_SYMBOL = /[ɑɒæʌɔəɚɝɨɪʊɛθðʃʒŋˈˌːʰʷᵻɡ]/;

export function learnCallIpaTextKey(text) {
  return crypto.createHash("sha256").update(String(text || "").trim()).digest("hex").slice(0, 40);
}

export function learnCallIpaCacheKey(text, accent = LEARN_CALL_IPA_ACCENT) {
  return `${LEARN_CALL_IPA_REDIS_PREFIX}${accent}:${learnCallIpaTextKey(text)}`;
}

/** Split spoken English into sentences the learner can match one-by-one with IPA. */
export function learnCallSplitSentences(text) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const parts = raw.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [raw];
  return parts.map((s) => s.trim()).filter(Boolean);
}

export function learnCallCleanIpa(raw) {
  let body = String(raw || "")
    .replace(/^ipa\s*[:=]\s*/i, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!body) return "";
  if (VIETNAMESE_OR_LATIN_ACCENT.test(body)) return "";
  // Reject plain Latin / Vietnamese respelling; keep lines that use real IPA symbols.
  if (!IPA_SYMBOL.test(body)) return "";
  return `/${body}/`;
}

export function learnCallShapeIpaPayload(text, sentences) {
  const source = learnCallSplitSentences(text);
  const list = Array.isArray(sentences) ? sentences : [];
  const out = source.map((line, i) => {
    const row = list[i] || list.find((s) => String(s?.text || "").trim() === line) || {};
    const ipa = learnCallCleanIpa(row.ipa || row.phonetic || "");
    return { text: line, ipa };
  });
  return {
    accent: LEARN_CALL_IPA_ACCENT,
    accentLabel: LEARN_CALL_IPA_ACCENT_LABEL,
    text: String(text || "").replace(/\s+/g, " ").trim(),
    sentences: out,
  };
}

function parseModelJson(content) {
  const raw = String(content || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Ask the chat model for US IPA of each sentence. Returns a shaped payload or throws.
 * Does not touch TTS or the call path; callers should cache the result.
 */
export async function learnCallGenerateIpa(text, { accent = LEARN_CALL_IPA_ACCENT } = {}) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim().slice(0, LEARN_CALL_IPA_MAX_CHARS);
  if (!cleaned) {
    const err = new Error("EMPTY_TEXT");
    err.code = "EMPTY_TEXT";
    throw err;
  }
  if (accent !== LEARN_CALL_IPA_ACCENT) {
    const err = new Error("UNSUPPORTED_ACCENT");
    err.code = "UNSUPPORTED_ACCENT";
    throw err;
  }
  const lines = learnCallSplitSentences(cleaned);

  // Next.js resolves these aliases; kept inside the function so pure helpers stay testable in Node.
  const { openaiChatCompletions } = await import("@/lib/ai/providers/openai");
  const { getSettingSync } = await import("@/lib/runtime-settings/cache");

  const model = String(getSettingSync("OPENAI_CHAT_MODEL") || "gpt-4o-mini").trim() || "gpt-4o-mini";
  const system = [
    "You convert English tutor lines into General American IPA for Vietnamese learners.",
    "Return JSON only: {\"sentences\":[{\"text\":\"...\",\"ipa\":\"/.../\"}]}",
    "Return exactly one object per input sentence, same order and same English wording.",
    "Use real IPA symbols (ə ɪ æ ʌ ʊ θ ð ʃ ʒ ŋ ɑ ɔ) with primary stress ˈ and secondary ˌ.",
    "Put spaces between IPA words. Wrap each ipa value in slashes like /həˈloʊ/.",
    "Never use Latin respelling (/hello/), Vietnamese respelling, Markdown, notes or speaker labels.",
  ].join(" ");

  async function ask(sentenceList) {
    const result = await openaiChatCompletions({
      model,
      temperature: 0,
      max_tokens: Math.min(800, 120 + sentenceList.length * 80),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            `Accent: General American (US). Return exactly ${sentenceList.length} sentence object(s).`,
            ...sentenceList.map((line, i) => `${i + 1}. ${line}`),
          ].join("\n"),
        },
      ],
    });
    if (!result.ok) {
      const err = new Error(result.error || "IPA_PROVIDER_FAILED");
      err.code = "IPA_PROVIDER_FAILED";
      if (result.error === "missing_api_key") err.code = "MISSING_API_KEY";
      throw err;
    }
    return parseModelJson(result.data?.content)?.sentences || [];
  }

  let rows = await ask(lines);
  let shaped = learnCallShapeIpaPayload(cleaned, rows);
  const missing = shaped.sentences.map((s, i) => (!s.ipa ? lines[i] : null)).filter(Boolean);
  if (missing.length) {
    const refill = await ask(missing);
    const byText = new Map(refill.map((row) => [String(row?.text || "").trim(), row]));
    rows = shaped.sentences.map((s) => (s.ipa ? s : byText.get(s.text) || refill.shift() || s));
    shaped = learnCallShapeIpaPayload(cleaned, rows);
  }
  if (!shaped.sentences.length || shaped.sentences.some((s) => !s.ipa)) {
    const err = new Error("IPA_INVALID");
    err.code = "IPA_INVALID";
    throw err;
  }
  return shaped;
}
