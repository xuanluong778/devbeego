/**
 * General American IPA from the CMU Pronouncing Dictionary.
 * Unstressed AH (AH0) is ə and unstressed ER (ER0) is ɚ — the dictionary's own stress mark, not a guessed vowel.
 * Sample audio for these passages uses the same accent: en-US.
 */
import { dictionary as cmuDictionary } from "cmu-pronouncing-dictionary";

const ARPABET = {
  AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ",
  B: "b", CH: "tʃ", D: "d", DH: "ð", EH: "e", ER: "ɝ", EY: "eɪ",
  F: "f", G: "g", HH: "h", IH: "ɪ", IY: "i", JH: "dʒ", K: "k",
  L: "l", M: "m", N: "n", NG: "ŋ", OW: "oʊ", OY: "ɔɪ", P: "p",
  R: "r", S: "s", SH: "ʃ", T: "t", TH: "θ", UH: "ʊ", UW: "u",
  V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ",
};

export const PASSAGE_IPA_SOURCE = "CMU Pronouncing Dictionary (General American)";
export const PASSAGE_IPA_ACCENT = "en-US";

const SLAX = new Set(["IH1", "IH2", "EH1", "EH2", "AE1", "AE2", "AH1", "AH2", "UH1", "UH2"]);
const VOWELS = new Set([
  "IY1", "IY2", "IY0", "EY1", "EY2", "EY0", "AA1", "AA2", "AA0",
  "ER1", "ER2", "ER0", "AW1", "AW2", "AW0", "AO1", "AO2", "AO0",
  "AY1", "AY2", "AY0", "OW1", "OW2", "OW0", "OY1", "OY2", "OY0",
  "IH0", "EH0", "AE0", "AH0", "UH0", "UW1", "UW2", "UW0", "UW",
  "IY", "EY", "AA", "ER", "AW", "AO", "AY", "OW", "OY", "UH", "IH", "EH", "AE", "AH",
  ...SLAX,
]);
const O2 = new Set([
  "P R", "T R", "K R", "B R", "D R", "G R", "F R", "TH R",
  "P L", "K L", "B L", "G L", "F L", "S L",
  "K W", "G W", "S W", "S P", "S T", "S K", "HH Y", "R W",
]);
const O3 = new Set(["S T R", "S K L", "T R W"]);

/** Syllable split from Kyle Gorman's CMU syllabifier so stress sits before the syllable onset. */
function syllabify(phones) {
  const mypron = phones.slice();
  const nuclei = [];
  const onsets = [];
  let last = -1;
  mypron.forEach((seg, j) => {
    if (!VOWELS.has(seg)) return;
    nuclei.push([seg]);
    onsets.push(mypron.slice(last + 1, j));
    last = j;
  });
  if (!nuclei.length) return null;
  const codas = [mypron.slice(last + 1)];
  for (let i = 1; i < onsets.length; i += 1) {
    const coda = [];
    if (onsets[i].length > 1 && onsets[i][0] === "R") nuclei[i - 1].push(onsets[i].shift());
    if (onsets[i].length > 2 && onsets[i][onsets[i].length - 1] === "Y") nuclei[i].unshift(onsets[i].pop());
    if (onsets[i].length > 1 && SLAX.has(nuclei[i - 1][nuclei[i - 1].length - 1]) && onsets[i][0] === "S") {
      coda.push(onsets[i].shift());
    }
    let depth = 1;
    if (onsets[i].length > 1) {
      const last2 = onsets[i].slice(-2).join(" ");
      const last3 = onsets[i].slice(-3).join(" ");
      depth = O2.has(last2) ? (O3.has(last3) ? 3 : 2) : 1;
    }
    const moves = Math.max(0, onsets[i].length - depth);
    for (let j = 0; j < moves; j += 1) coda.push(onsets[i].shift());
    codas.splice(i - 1, 0, coda);
  }
  const output = onsets.map((onset, i) => [onset, nuclei[i], codas[i] || []]);
  const flat = output.flat(2);
  if (flat.join(" ") !== mypron.join(" ")) return null;
  return output;
}

function phoneBody(token) {
  const stress = token.match(/[0-9]/)?.[0] || "0";
  const key = token.replace(/[0-9]/g, "");
  let ipa = ARPABET[key];
  if (!ipa) return "";
  if (key === "AH" && stress === "0") ipa = "ə";
  if (key === "ER" && stress === "0") ipa = "ɚ";
  return ipa;
}

export function arpabetToIpa(arpabet) {
  const tokens = String(arpabet || "").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return "";
  const syllables = syllabify(tokens);
  let out = "";
  if (syllables) {
    for (const [onset, nucleus, coda] of syllables) {
      const stress = nucleus.map((phone) => phone.match(/[12]/)?.[0]).find(Boolean) || "";
      if (stress === "1") out += "ˈ";
      else if (stress === "2") out += "ˌ";
      for (const phone of [...onset, ...nucleus, ...coda]) {
        const body = phoneBody(phone);
        if (!body) return "";
        out += body;
      }
    }
  } else {
    for (const token of tokens) {
      const stress = token.match(/[12]/)?.[0] || "";
      const body = phoneBody(token);
      if (!body) return "";
      if (stress === "1") out += `ˈ${body}`;
      else if (stress === "2") out += `ˌ${body}`;
      else out += body;
    }
  }
  return out ? `/${out}/` : "";
}

function lemmaCandidates(rawWord) {
  const word = String(rawWord || "").toLowerCase().replace(/’/g, "'").trim();
  if (!word) return [];
  const out = [word, word.replace(/'/g, "")];
  if (word.endsWith("'s") && word.length > 3) out.push(word.slice(0, -2));
  if (word.endsWith("ies") && word.length > 4) out.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("es") && word.length > 3) out.push(word.slice(0, -2));
  if (word.endsWith("s") && word.length > 3) out.push(word.slice(0, -1));
  if (word.endsWith("ing") && word.length > 5) {
    const base = word.slice(0, -3);
    out.push(base, `${base}e`);
    if (base.length > 2 && base.at(-1) === base.at(-2)) out.push(base.slice(0, -1));
  }
  if (word.endsWith("ied") && word.length > 4) out.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("ed") && word.length > 4) {
    const base = word.slice(0, -2);
    out.push(base, `${base}e`);
    if (base.length > 2 && base.at(-1) === base.at(-2)) out.push(base.slice(0, -1));
  }
  return [...new Set(out.filter(Boolean))];
}

function ipaFromCmu(word) {
  const key = String(word || "").toLowerCase();
  const arpabet = cmuDictionary[key];
  if (!arpabet) return "";
  return arpabetToIpa(arpabet);
}

function demoteStress(body) {
  return String(body || "").replace(/ˈ/g, "ˌ");
}

function joinBodies(bodies) {
  const parts = bodies.filter(Boolean);
  if (!parts.length || parts.length !== bodies.length) return "";
  const firstHasPrimary = parts[0].includes("ˈ");
  return `/${parts
    .map((body, index) => (index > 0 && firstHasPrimary ? demoteStress(body) : body))
    .join("")}/`;
}

/** Closed list: words absent from CMU, built only from CMU entries or a GA Wiktionary line. */
const EXTRA_IPA = {
  // Wiktionary English, accent label GA (also listed: ˈmɪnɪmɪˈzeɪʃən).
  minimization: "/ˈmɪnəmɪˈzeɪʃən/",
};

function cmuBody(word) {
  return ipaFromCmu(word).replace(/^\/|\/$/g, "");
}

function suffixed(stem, suffixBody) {
  const body = cmuBody(stem);
  if (!body) return "";
  return `/${body}${suffixBody}/`;
}

function compounded(words, suffixBody = "") {
  const bodies = words.map((word) => cmuBody(word));
  if (bodies.some((body) => !body)) return "";
  if (suffixBody) bodies.push(suffixBody);
  return joinBodies(bodies);
}

function extraIpa(original, raw) {
  if (EXTRA_IPA[raw]) return EXTRA_IPA[raw];
  if (/^[A-Z]{2,5}$/.test(original)) {
    const letters = original.split("").map((letter) => cmuBody(letter.toLowerCase()));
    if (letters.every(Boolean)) return `/${letters.join(" ")}/`;
  }
  const built = {
    stepbrother: compounded(["step", "brother"]),
    passphrase: compounded(["pass", "phrase"]),
    overpromise: compounded(["over", "promise"]),
    counterargument: compounded(["counter", "argument"]),
    counterexample: compounded(["counter", "example"]),
    soundscape: compounded(["sound", "scape"]),
    patchwriting: compounded(["patch", "writing"]),
    overclaiming: compounded(["over", "claim"], "ɪŋ"),
    overgeneralization: compounded(["over", "generalization"]),
    conciseness: suffixed("concise", "nəs"),
    representativeness: suffixed("representative", "nəs"),
    testable: suffixed("test", "əbəl"),
    walkable: suffixed("walk", "əbəl"),
    searchable: suffixed("search", "əbəl"),
    automatable: suffixed("automate", "əbəl"),
    falsifiable: suffixed("falsify", "əbəl"),
    approver: suffixed("approve", "ɚ"),
    contextualize: suffixed("contextual", "aɪz"),
    distributional: suffixed("distribution", "əl"),
    authorial: suffixed("author", "iəl"),
    generalizability: suffixed("generalize", "əˈbɪləti"),
    reproducibility: suffixed("reproduce", "əˈbɪləti"),
    reframe: joinBodies([(cmuBody("retry").split("ˈ")[0] || ""), cmuBody("frame")]),
    // Spelling pronunciation from CMU "ho" + "ah". No General American dictionary lists this name.
    hoa: compounded(["ho", "ah"]),
  }[raw];
  return built || "";
}

/** Dictionary IPA for one word, or "" when no CMU entry and no checked derivation. */
export function ipaForWord(word) {
  const original = String(word || "").replace(/’/g, "'").trim();
  const raw = original.toLowerCase().replace(/[^a-z'-]/g, "");
  if (!raw && !/^[A-Z]{2,5}$/.test(original)) return "";
  for (const lemma of lemmaCandidates(raw)) {
    const ipa = ipaFromCmu(lemma);
    if (ipa) return ipa;
  }
  if (raw.includes("-")) {
    const parts = raw.split("-").filter(Boolean);
    const pieces = parts.map((part) => ipaForWord(part).replace(/^\/|\/$/g, ""));
    if (pieces.every(Boolean)) return `/${pieces.join(" ")}/`;
  }
  return extraIpa(original, raw);
}

export function displayTokens(text) {
  return String(text || "")
    .split(/(\s+)/)
    .filter((part) => part.length > 0);
}

/**
 * @returns {{ ipa: string, tokens: {text:string, ipa:string}[], missing: string[] }}
 */
const WEAK_FORMS = {
  to: { cons: "tə", vow: "tu" },
  the: { cons: "ðə", vow: "ði" },
  of: { cons: "əv", vow: "əv" },
  for: { cons: "fɚ", vow: "fɚ" },
  and: { cons: "ənd", vow: "ənd" },
  was: { cons: "wəz", vow: "wəz" },
  as: { cons: "əz", vow: "əz" },
};

function startsWithVowel(ipa) {
  const body = String(ipa || "").replace(/^\/|\/$/g, "").replace(/^[ˈˌ]+/, "");
  return /^(ə|ɚ|ɝ|ɑ|æ|ɔ|oʊ|aʊ|aɪ|eɪ|ɔɪ|o|e|i|ɪ|u|ʊ)/.test(body);
}

/** Unstressed function words use their General American weak form except at the end of the sentence. */
function applyWeakForms(tokens) {
  const indexes = [];
  tokens.forEach((token, index) => {
    if (/[A-Za-z]/.test(token.text)) indexes.push(index);
  });
  indexes.forEach((index, order) => {
    const key = tokens[index].text.replace(/[^A-Za-z]/g, "").toLowerCase();
    const rule = WEAK_FORMS[key];
    if (!rule) return;
    const next = tokens[indexes[order + 1]];
    if (!next) return;
    if (order === 0 && (key === "for" || key === "and")) return;
    const body = startsWithVowel(next.ipa) ? rule.vow : rule.cons;
    tokens[index].ipa = `/${body}/`;
  });
}

export function ipaForSentence(text) {
  const tokens = [];
  const missing = [];
  for (const part of displayTokens(text)) {
    if (/^\s+$/.test(part)) continue;
    const spoken = part.replace(/[^A-Za-z'’-]+/g, "").replace(/’/g, "'");
    if (!spoken) {
      tokens.push({ text: part, ipa: "" });
      continue;
    }
    const ipa = ipaForWord(spoken);
    if (!ipa) missing.push(spoken);
    tokens.push({ text: part, ipa });
  }
  if (!missing.length) applyWeakForms(tokens);
  const body = tokens
    .map((token) => token.ipa.replace(/^\/|\/$/g, ""))
    .filter(Boolean)
    .join(" ");
  return {
    ipa: body && !missing.length ? `/${body}/` : "",
    tokens,
    missing,
  };
}
