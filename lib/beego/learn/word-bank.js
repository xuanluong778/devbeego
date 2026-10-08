/**
 * Word-bank tokens for word_order.
 * Each tile has its own id, including repeated words.
 * Grading compares exact token-text sequences.
 */

function tokenText(value) {
  if (value && typeof value === "object") return String(value.text ?? "");
  return String(value ?? "");
}

export function tokenizeLessonWords(sentence) {
  const text = String(sentence || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  return text.match(/[A-Za-z](?:\.[A-Za-z])+\.?|[A-Za-z]+(?:['’][A-Za-z]+)?(?:-[A-Za-z]+)*|\d+(?:[.:]\d+)+|\d+/g) || [];
}

export function createWordBank(words) {
  const seen = new Map();
  const tokens = [];
  for (const raw of words || []) {
    const text = String(raw ?? "");
    if (!text) continue;
    const count = (seen.get(text) || 0) + 1;
    seen.set(text, count);
    tokens.push({ id: `w${tokens.length + 1}-${count}`, text });
  }
  return { tokens, placed: [] };
}

export function placeToken(state, id) {
  if (!state?.tokens?.some((token) => token.id === id)) return state;
  if (state.placed.includes(id)) return state;
  return { ...state, placed: [...state.placed, id] };
}

export function returnToken(state, id) {
  if (!state?.placed?.includes(id)) return state;
  return { ...state, placed: state.placed.filter((item) => item !== id) };
}

export function undoWordBank(state) {
  if (!state?.placed?.length) return state;
  return { ...state, placed: state.placed.slice(0, -1) };
}

export function clearWordBank(state) {
  if (!state?.placed?.length) return state;
  return { ...state, placed: [] };
}

export function wordBankAnswerTexts(state) {
  const byId = new Map((state?.tokens || []).map((token) => [token.id, token.text]));
  return (state?.placed || []).map((id) => byId.get(id)).filter((text) => text != null);
}

function sequences(exercise) {
  if (Array.isArray(exercise?.acceptedAnswers) && exercise.acceptedAnswers.length) {
    return exercise.acceptedAnswers;
  }
  const answer = exercise?.correctAnswer;
  if (Array.isArray(answer)) return [answer];
  return [String(answer || "").split(" ").filter(Boolean)];
}

function sameSequence(expected, given) {
  const left = (expected || []).map(tokenText);
  const right = (given || []).map(tokenText);
  if (left.length !== right.length) return false;
  return left.every((word, index) => word === right[index]);
}

export function gradeWordOrder(exercise, answer) {
  const given = Array.isArray(answer) ? answer : [];
  return sequences(exercise).some((expected) => sameSequence(expected, given));
}

export function wordOrderModel(exercise) {
  const stored = String(exercise?.extensions?.modelSentence || exercise?.explanation || "").trim();
  if (stored) return stored;
  const first = sequences(exercise)[0] || [];
  return first.map(tokenText).join(" ");
}

export function wordOrderMeaning(exercise) {
  const stored = String(exercise?.extensions?.meaning || "").trim();
  if (stored) return stored;
  const prompt = String(exercise?.prompt || "");
  const marked = prompt.match(/«([^»]+)»/);
  return marked ? marked[1].trim() : "";
}
