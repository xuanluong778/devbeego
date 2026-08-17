/** Beego vocabulary illustration — semantic prompts + style-aware metadata. */
import { resolveImageDisambiguation } from "./image-disambiguation.js";
import { resolveVocabularyImage } from "./image-resolver.js";
import { resolveEffectiveImageStyle, stylePromptGuide } from "./image-styles.js";

function cleanText(value, max = 240) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function meaningOf(row) {
  return cleanText(row?.vietnamese_meaning || row?.meaning || "");
}

function topicOf(row) {
  return cleanText(row?.topic || "");
}

function exampleOf(row) {
  return cleanText(row?.example_sentence || "");
}

function exampleViOf(row) {
  return cleanText(row?.example_sentence_vi || "");
}

function posOf(row) {
  return String(row?.part_of_speech || "other").toLowerCase();
}

/**
 * @param {object} row vocabulary row
 * @returns {string}
 */
export function buildSemanticHint(row) {
  const word = cleanText(row?.word);
  const meaning = meaningOf(row);
  const topic = topicOf(row);
  const example = exampleOf(row);
  const exampleVi = exampleViOf(row);
  const pos = posOf(row);
  const { visualFocus, disambiguationNote } = resolveImageDisambiguation(row);

  return [
    `English word: "${word}" (${pos}).`,
    `Vietnamese meaning: "${meaning}".`,
    `Topic: "${topic || "general"}".`,
    example ? `Example EN: "${example}".` : "",
    exampleVi ? `Example VI: "${exampleVi}".` : "",
    disambiguationNote,
    `Visual focus: ${visualFocus}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * @param {object} row vocabulary row
 * @returns {string}
 */
export function buildImagePrompt(row) {
  const word = cleanText(row?.word);
  const meaning = meaningOf(row);
  const topic = topicOf(row);
  const example = exampleOf(row);
  const exampleVi = exampleViOf(row);
  const pos = posOf(row);
  const style = resolveEffectiveImageStyle(row);
  const { visualFocus, disambiguationNote } = resolveImageDisambiguation(row);
  const styleGuide = stylePromptGuide(style) || stylePromptGuide("cartoon");

  const context = [
    `Educational vocabulary image for SaaS English learning app.`,
    `Word: "${word}" (${pos}).`,
    `Must match Vietnamese meaning: "${meaning}" — NOT other senses of the English word.`,
    `Topic: "${topic}".`,
    example ? `Context sentence: "${example}".` : "",
    exampleVi ? `Vietnamese context: "${exampleVi}".` : "",
    disambiguationNote,
    `Depict: ${visualFocus}.`,
  ]
    .filter(Boolean)
    .join(" ");

  if (pos === "verb") {
    return `${context} Composition: one friendly character clearly performing the action. ${styleGuide}`;
  }
  if (pos === "adjective") {
    return `${context} Composition: visual state/emotion expressing the adjective. ${styleGuide}`;
  }
  if (pos === "noun" || pos.includes("noun")) {
    return `${context} Composition: ONE clear subject centered, isolated, easy to recognize. ${styleGuide}`;
  }
  return `${context} Composition: simple metaphorical scene for the concept. ${styleGuide}`;
}

/**
 * @param {object} row
 * @returns {object}
 */
export function buildVocabularyImageMetadata(row) {
  const style = resolveEffectiveImageStyle(row);
  const resolved = resolveVocabularyImage({ ...row, image_style: style });

  return {
    semantic_hint: buildSemanticHint(row),
    image_prompt: buildImagePrompt(row),
    image_style: style,
    image_url: resolved.image_url,
    image_source: resolved.image_source,
    image_status: resolved.image_url ? "pending" : "hidden",
  };
}
