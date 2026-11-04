import { NON_NAME_SET } from "./learn-call-topics.js";
/** Personal data is reported by the learner, never inferred from tutor speech or STT confidence. */
const UNITS = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
export function learnCallNumbers(text) {
  const tokens = String(text || '').toLowerCase().replace(/-/g, ' ').match(/\d+(?:\.\d+)?|[a-z]+/g) || [];
  const found = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^\d/.test(t)) found.push(Number(t));
    else if (TENS.includes(t)) {
      let n = TENS.indexOf(t) * 10;
      const u = UNITS.indexOf(tokens[i + 1]);
      if (u > 0 && u < 10) { n += u; i++; }
      found.push(n);
    } else if (UNITS.includes(t)) found.push(UNITS.indexOf(t));
  }
  return found;
}
export function learnCallPersonalCorrection(text) {
  return /^(?:no\b|not\b|actually\b|i meant\b)|không phải|tôi nói|ý (?:tôi|em) là/i.test(String(text || '').trim());
}
export function learnCallAge(text) {
  const ns = [...new Set(learnCallNumbers(text))];
  if (ns.length !== 1 || ns[0] < 1 || ns[0] > 120 || /\bor\b|maybe|perhaps|not sure|không chắc/i.test(text)) return null;
  return ns[0];
}
export function learnCallPersonalTurn(text, intent = '') {
  const raw = String(text || '');
  if (/years? old|\btuổi\b|\bi(?:'m| am)\s+(?:\d{1,3}|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|fifteen|sixteen|seventeen|eighteen|nineteen)\b/i.test(raw)) return 'age';
  if (/my name is|call me|tên (?:tôi|em)/i.test(raw)) return 'name';
  if (intent === 'age' || intent === 'name') return intent;
  if (/\b(?:my|i earn|i weigh|i am|i'm)\b.*\d|\b(?:salary|weight|height|phone number)\b/i.test(raw)) return 'number';
  return '';
}
export function learnCallName(text) {
  const value = String(text || '').trim().replace(/^(?:(?:no|actually)[, ]+|i meant\s+|i said\s+)*/i, '')
    .replace(/^(?:my name is|call me|i am|i'm|tên (?:tôi|em) (?:là)?)[, ]*/i, '')
    .replace(/[, ]+and you.*$/i, '').replace(/[.!?]+$/, '').trim();
  const words = value.toLowerCase().split(/\s+/);
  if (!value || words.length > 4 || words.some(w => NON_NAME_SET.has(w)) || /\bor\b|maybe|not sure|không chắc|[0-9?]/i.test(value)) return null;
  if (!/^[\p{L} '-]+$/u.test(value)) return null;
  return value;
}
/** Exclude personal quotations from model memory/highlights; conversation transcript remains an audit trail. */
export function learnCallPersonalTurnIds(memory) {
  const ids = new Set();
  let pending = '';
  let lastPersonal = '';
  const turns = [...(memory || [])].sort((a,b) => (Number(a.requestId)||0) - (Number(b.requestId)||0) || (a.role === b.role ? 0 : a.role === "user" ? -1 : 1));
  for (const item of turns) {
    if (item.role === 'assistant') {
      pending = /how old|your age/i.test(item.content) ? 'age' : /your (?:full )?name/i.test(item.content) ? 'name' : '';
    } else if (item.role === 'user') {
      const field = learnCallPersonalTurn(item.content, pending) || (learnCallPersonalCorrection(item.content) ? lastPersonal : '');
      if (field) { ids.add(item); lastPersonal = field; }
      pending = '';
    }
  }
  return ids;
}

export function learnCallPersonalAssistantTurn(text) {
  const raw = String(text || '');
  return /your name is/i.test(raw) || (learnCallNumbers(raw).length > 0 && /years? old|\byou(?: are|'re)\b|your age/i.test(raw));
}
