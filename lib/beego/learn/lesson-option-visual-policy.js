/**
 * LessonPlayer visual policy — hide option emoji/images when they leak meaning.
 * Uses prompt / skillLabel / extensions (not type-name alone).
 */

/**
 * @param {object|null|undefined} exercise
 * @returns {{ showOptionVisuals: boolean, compactDecorMascot: boolean, choiceLayout: 'grid'|'default' }}
 */
export function resolveLessonOptionVisualPolicy(exercise) {
  const ext = exercise?.extensions && typeof exercise.extensions === "object" ? exercise.extensions : {};
  const type = String(exercise?.type || "");
  const prompt = String(exercise?.prompt || "");
  const skill = String(exercise?.skillLabel || "");
  const blob = `${prompt}\n${skill}`;
  const options = Array.isArray(exercise?.options) ? exercise.options : [];
  const hasPromptVisual = Boolean(exercise?.imageEmoji || exercise?.imageUrl || ext.promptImage);
  const optionsHaveVisual = options.some((o) => o && (o.imageEmoji || o.imageUrl));
  const optionsHaveText = options.length > 0 && options.every((o) => String(o?.text || "").trim());

  if (ext.choicePresentation === "picture") {
    return {
      showOptionVisuals: true,
      compactDecorMascot: true,
      choiceLayout: "grid",
      pictureChoice: true,
    };
  }

  // Explicit schema overrides
  if (ext.optionVisualMode === "show" || ext.optionVisualMode === "image") {
    return {
      showOptionVisuals: true,
      compactDecorMascot: !hasPromptVisual,
      choiceLayout: type === "vocabulary_choice" ? "grid" : "default",
    };
  }
  if (ext.optionVisualMode === "hide" || ext.optionVisualMode === "text") {
    return {
      showOptionVisuals: false,
      compactDecorMascot: !hasPromptVisual,
      choiceLayout: "default",
    };
  }
  if (ext.modality === "image_recognition" || ext.task === "image_recognition") {
    return {
      showOptionVisuals: true,
      compactDecorMascot: false,
      choiceLayout: "grid",
    };
  }

  // Image recognition / pick-the-picture
  if (/nhận diện|chọn hình|hình nào|pictogram|what do you see|look at (the )?picture|nhìn hình/i.test(blob)) {
    return {
      showOptionVisuals: true,
      compactDecorMascot: false,
      choiceLayout: "grid",
    };
  }

  // Meaning → choose word/text: option emoji correlates with meaning (leak)
  const isMeaningChoice =
    /nghĩa là|nghĩa là gì|chọn nghĩa|chọn từ nghĩa|means what|what does\b.+\bmean/i.test(blob) ||
    (/chọn từ|pick the word|choose the word/i.test(prompt) && /«[^»]+»|"[^"]+"/.test(prompt));

  if (isMeaningChoice) {
    return {
      showOptionVisuals: false,
      compactDecorMascot: !hasPromptVisual,
      choiceLayout: "default",
    };
  }

  // Text answer selection (MC / fill / listening choice) — text is sufficient; hide option art
  if (
    optionsHaveText &&
    optionsHaveVisual &&
    /multiple_choice|fill_blank|listening_choice|listening_fill|story_comprehension/i.test(type)
  ) {
    return {
      showOptionVisuals: false,
      compactDecorMascot: !hasPromptVisual,
      choiceLayout: "default",
    };
  }

  // vocabulary_choice with text answers + option art, but not image-recognition:
  // keep visuals only when prompt visual is the teaching stimulus (intro-by-image)
  if (type === "vocabulary_choice" && optionsHaveText && optionsHaveVisual && !hasPromptVisual) {
    // Alphabet / letter tiles (symbol equals the answer letter) — keep
    if (/alphabet|chữ cái|letter/i.test(blob)) {
      return {
        showOptionVisuals: true,
        compactDecorMascot: true,
        choiceLayout: "grid",
      };
    }
    // Default vocab grid without prompt image often leaks via emoji — hide
    return {
      showOptionVisuals: false,
      compactDecorMascot: true,
      choiceLayout: "default",
    };
  }

  // New-word intro with dedicated prompt image — keep option visuals if author attached them
  if (/từ vựng mới|new word|introduce/i.test(skill) && hasPromptVisual) {
    return {
      showOptionVisuals: true,
      compactDecorMascot: false,
      choiceLayout: type === "vocabulary_choice" ? "grid" : "default",
    };
  }

  // Text MC / fill without prompt image → compact decorative mascot
  if (
    /multiple_choice|fill_blank|listening_choice|listening_fill|story_comprehension|word_order/i.test(
      type
    ) &&
    !hasPromptVisual
  ) {
    return {
      showOptionVisuals: optionsHaveVisual && !optionsHaveText,
      compactDecorMascot: true,
      choiceLayout: "default",
    };
  }

  return {
    showOptionVisuals: optionsHaveVisual,
    compactDecorMascot: !hasPromptVisual,
    choiceLayout: type === "vocabulary_choice" && optionsHaveVisual ? "grid" : "default",
  };
}
