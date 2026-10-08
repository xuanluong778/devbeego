/**
 * AI layer — prompts, providers, routing, services.
 * API routes should import from here (or services/*) only, never embed prompts.
 */

export { generateLessonsChatReply } from "./services/lessons-chat.service";
export { generateLearnLessonChatReply } from "./services/learn-lesson-chat.service";
export { buildFallbackReply } from "./fallback/lessons-chat-fallback";
export { finalizeLessonsChatPayload } from "./postprocess/lessons-reply-quality";
export { sanitizeHistory } from "./utils/sanitize-history";
export {
  translateEnglishToVietnameseViaOpenAI,
  translateEnglishToVietnameseWithFallback,
} from "./services/translate.service";
export { MODEL_TIER, resolveLessonsChatTier, resolveModelForTier, resolveTranslateModel } from "./model-router";
