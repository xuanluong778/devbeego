/**
 * Learn lesson chat — OpenAI adapter.
 * Reuses provider + sanitize + model router + JSON postprocess helpers.
 * Does NOT call generateLessonsChatReply (keeps Luyện nói prompt/behavior untouched).
 */

import { getSettingSync } from "@/lib/runtime-settings/cache";
import { openaiChatCompletions } from "@/lib/ai/providers/openai";
import { MODEL_TIER, resolveLessonsChatTier, resolveModelForTier } from "@/lib/ai/model-router";
import { sanitizeHistory } from "@/lib/ai/utils/sanitize-history";
import { sanitizeUserInput } from "@/lib/ai/services/lessons-chat.service";
import { finalizeLessonsChatPayload } from "@/lib/ai/postprocess/lessons-reply-quality";
import { getLearnLessonTutorSystemPrompt } from "@/lib/ai/prompts/learn-lesson-tutor";
import { getLearnLessonChatTimeoutMs } from "@/lib/beego/learn/learn-lesson-chat-flags";

function parseJsonContent(content) {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return {
      reply: String(parsed.reply || "").trim(),
      corrected_sentence: String(parsed.corrected_sentence || "").trim(),
      ipa: String(parsed.ipa || "").trim(),
      pronunciation_tip: String(parsed.pronunciation_tip || "").trim(),
      mistakes_explanation: String(parsed.mistakes_explanation || "").trim(),
    };
  } catch {
    return null;
  }
}

function safeBlockedPromptReply() {
  return {
    reply: "Let's practice this lesson. Can you say one short English sentence about the topic?",
    corrected_sentence: "",
    ipa: "",
    pronunciation_tip: "Speak slowly and clearly.",
    mistakes_explanation: "Hãy gửi một câu tiếng Anh bình thường để luyện theo bài học.",
  };
}

async function openaiChatCompletionsWithTimeout(opts, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      openaiChatCompletions(opts),
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({ ok: false, error: "timeout", data: null });
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * @param {{
 *   message: string,
 *   history?: Array<{ role: string, content: string }>,
 *   lessonContext: object,
 *   vipPriority?: boolean,
 * }} params
 */
export async function generateLearnLessonChatReply({
  message,
  history = [],
  lessonContext,
  vipPriority = false,
}) {
  const apiKey = getSettingSync("OPENAI_API_KEY") || "";
  if (!apiKey) {
    return { ok: false, code: "AI_UNAVAILABLE", payload: null };
  }

  const userInput = sanitizeUserInput(message);
  if (!userInput) {
    return { ok: true, code: "BLOCKED", payload: safeBlockedPromptReply() };
  }

  const cleanHistory = sanitizeHistory(history).map((item) => ({
    role: item.role,
    content: item.content,
  }));

  const tier = vipPriority
    ? MODEL_TIER.STANDARD
    : resolveLessonsChatTier({
        message: userInput,
        historyLength: cleanHistory.length,
      });
  const model = resolveModelForTier(tier);
  const max_tokens = vipPriority ? 650 : 500;
  const timeoutMs = getLearnLessonChatTimeoutMs();

  const systemPrompt = getLearnLessonTutorSystemPrompt(lessonContext);
  const messages = [
    { role: "system", content: systemPrompt },
    ...cleanHistory,
    { role: "user", content: userInput },
  ];

  const result = await openaiChatCompletionsWithTimeout(
    {
      model,
      temperature: 0.6,
      max_tokens,
      response_format: { type: "json_object" },
      messages,
    },
    timeoutMs
  );

  if (!result.ok) {
    const code = result.error === "timeout" ? "AI_TIMEOUT" : "AI_UNAVAILABLE";
    return { ok: false, code, payload: null };
  }

  const parsed = parseJsonContent(result.data?.content);
  if (!parsed?.reply) {
    return { ok: false, code: "AI_BAD_RESPONSE", payload: null };
  }

  const finalized = finalizeLessonsChatPayload(parsed, userInput, {
    languageSupportMode: "english_vietnamese_help",
  });

  return { ok: true, code: "OK", payload: finalized };
}
