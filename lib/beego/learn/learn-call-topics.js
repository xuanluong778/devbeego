/**
 * Topic practice guides for Learn Call. Lesson vocab is support material; the topic
 * guide keeps the conversation on natural everyday talk instead of one narrow drill
 * (for example a goodbye-only lesson inside “Chào hỏi”).
 */

function facet(id, labelVi, angles, samples) {
  return Object.freeze({
    id,
    labelVi,
    angles: Object.freeze(angles.map((item) => Object.freeze({ ...item }))),
    samples: Object.freeze(samples.map((item) => Object.freeze({ ...item }))),
  });
}

/** Getting-to-know-you practice for greeting topics (Chào hỏi and close variants). */
const GREETING_FACETS = Object.freeze([
  facet(
    "greeting",
    "chào hỏi",
    [
      { easy: "Hello. How are you?", medium: "Hi! How are you today?", hard: "How has your day been so far?" },
    ],
    [
      { en: "I'm fine.", vi: "Tôi khỏe." },
      { en: "I'm good.", vi: "Tôi ổn." },
    ]
  ),
  facet(
    "name",
    "tên",
    [
      { easy: "What's your name?", medium: "What is your name?", hard: "Can you tell me your full name?" },
    ],
    [
      { en: "My name is Lan.", vi: "Tên tôi là Lan." },
      { en: "I'm Minh.", vi: "Tôi là Minh." },
    ]
  ),
  facet(
    "age",
    "tuổi",
    [
      { easy: "How old are you?", medium: "How old are you?", hard: "Do you mind telling me your age?" },
    ],
    [
      { en: "I'm 20.", vi: "Tôi 20 tuổi." },
      { en: "I'm 25 years old.", vi: "Tôi 25 tuổi." },
    ]
  ),
  facet(
    "home",
    "nơi ở",
    [
      { easy: "Where do you live?", medium: "Where do you live?", hard: "Where are you from, and where do you live now?" },
    ],
    [
      { en: "I live in Hanoi.", vi: "Tôi sống ở Hà Nội." },
      { en: "I'm from Da Nang.", vi: "Tôi đến từ Đà Nẵng." },
    ]
  ),
  facet(
    "job",
    "công việc / học tập",
    [
      { easy: "What do you do?", medium: "What do you do?", hard: "What do you do for work or study?" },
    ],
    [
      { en: "I'm a student.", vi: "Tôi là học sinh / sinh viên." },
      { en: "I'm a teacher.", vi: "Tôi là giáo viên." },
    ]
  ),
  facet(
    "hobby",
    "sở thích",
    [
      { easy: "Do you like music?", medium: "What do you like to do?", hard: "What hobby do you enjoy most, and why?" },
    ],
    [
      { en: "I like music.", vi: "Tôi thích nhạc." },
      { en: "I like football.", vi: "Tôi thích bóng đá." },
    ]
  ),
]);

const TOPIC_GUIDES = Object.freeze({
  greetings: Object.freeze({
    key: "greetings",
    match: /chào hỏi|chao hoi|greeting|hello|hi there/i,
    practiceGoal:
      "Practice a natural first meeting: greet, ask name, age, where they live, what they do, a hobby, and only say goodbye when the call is ending.",
    avoidUntilClosing: Object.freeze(["goodbye", "see you later", "bye", "have to go", "say goodbye"]),
    facets: GREETING_FACETS,
  }),
  drinks: Object.freeze({
    key: "drinks",
    match: /đồ uống|do uong|drink|café|cafe|coffee|tea/i,
    practiceGoal: "Practice ordering or talking about everyday drinks in a café or at home.",
    avoidUntilClosing: Object.freeze([]),
    facets: Object.freeze([
      facet("drink", "đồ uống", [{ easy: "Tea or coffee?", medium: "What would you like to drink?", hard: "Why do you prefer that drink?" }], [
        { en: "Tea, please.", vi: "Cho tôi trà." },
        { en: "I like coffee.", vi: "Tôi thích cà phê." },
      ]),
      facet("size", "size", [{ easy: "Small or large?", medium: "What size do you want?", hard: "Would you change size if it is busy?" }], [
        { en: "Small, please.", vi: "Size nhỏ." },
        { en: "Large, please.", vi: "Size lớn." },
      ]),
    ]),
  }),
  family: Object.freeze({
    key: "family",
    match: /gia đình|gia dinh|family/i,
    practiceGoal: "Talk about family members in a short, natural conversation.",
    avoidUntilClosing: Object.freeze([]),
    facets: Object.freeze([
      facet("members", "thành viên", [{ easy: "Do you have a brother?", medium: "Who do you live with?", hard: "Who in your family are you closest to, and why?" }], [
        { en: "I have a sister.", vi: "Tôi có một chị/em gái." },
        { en: "I live with my parents.", vi: "Tôi sống với bố mẹ." },
      ]),
    ]),
  }),
});

const DEFAULT_GUIDE = Object.freeze({
  key: "general",
  match: /.*/,
  practiceGoal: "Practice one everyday conversation that fits this topic, with one idea per turn.",
  avoidUntilClosing: Object.freeze([]),
  facets: Object.freeze([]),
});

/** Resolve the practice guide for a topic title (and optional section id). */
export function learnCallTopicGuide({ topic = "", title = "", sectionId = "" } = {}) {
  const hay = `${topic} ${title} ${sectionId}`;
  for (const guide of Object.values(TOPIC_GUIDES)) {
    if (guide.match.test(hay)) return guide;
  }
  if (/^p1-g1\b/i.test(String(sectionId || ""))) return TOPIC_GUIDES.greetings;
  return DEFAULT_GUIDE;
}

const FACET_HEARD = Object.freeze({
  greeting: /\b(?:i(?:'m| am)\s+(?:fine|good|okay|ok)|hello|hi)\b|khỏe|xin chào/i,
  name: /\b(?:my name is\s+[a-zà-ỹ]{2,}|i(?:'m| am)\s+(?!good\b|fine\b|okay\b|ok\b|well\b|great\b|happy\b|tired\b|sad\b|busy\b|here\b|sorry\b|from\b|a\b|an\b|not\b|very\b|so\b|too\b|just\b|really\b|alright\b|doing\b|feeling\b)[a-zà-ỹ][a-zà-ỹ'-]{1,})/i,
  age: /\b(?:i(?:'m| am)\s+\d{1,2}|\d{1,2}(?:\s*(?:years?\s*old|tuổi))?|(?:twenty|thirty|forty|fifteen|sixteen|seventeen|eighteen|nineteen))\b/i,
  home: /\b(?:i live|i(?:'m| am) from|live in)\b|sống|ở\s+[A-Za-zÀ-Ỵ]/i,
  job: /\b(?:i(?:'m| am) a |i work|student|teacher|doctor|engineer|nurse)\b|học sinh|sinh viên|giáo viên|nhân viên/i,
  hobby: /\b(?:i (?:like|love|enjoy)|my hobby)\b|thích/i,
  drink: /\b(?:tea|coffee|water|juice|milk)\b|trà|cà phê|nước/i,
  size: /\b(?:small|large|medium)\b|nhỏ|lớn/i,
  members: /\b(?:brother|sister|mother|father|parents|family)\b|anh|chị|em|bố|mẹ|gia đình/i,
});

const FACET_ASKED = Object.freeze({
  greeting: /\bhow are you\b/i,
  name: /\b(?:what(?:'s| is) your name|your name)\b/i,
  age: /\bhow old\b/i,
  home: /\bwhere (?:do you live|are you from)\b/i,
  job: /\bwhat do you do\b|\byour (?:job|work)\b/i,
  hobby: /\bdo you like\b|\bwhat do you like\b|\bhobby\b/i,
  drink: /\b(?:drink|tea or|coffee)\b/i,
  size: /\b(?:small or large|what size)\b/i,
  members: /\b(?:brother|sister|family|live with)\b/i,
});

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

/** Facets already answered by the learner or already asked by the tutor in this call. */
export function learnCallCoveredFacets(memory, guide) {
  const facets = Array.isArray(guide?.facets) ? guide.facets : [];
  if (!facets.length) return { answered: [], asked: [], next: null };
  const turns = Array.isArray(memory) ? memory : [];
  const answered = [];
  const asked = [];
  for (const item of turns) {
    const text = String(item?.content || "");
    if (!text.trim()) continue;
    const map = item.role === "user" ? FACET_HEARD : item.role === "assistant" ? FACET_ASKED : null;
    if (!map) continue;
    for (const facet of facets) {
      const re = map[facet.id];
      if (!re || !re.test(text)) continue;
      if (item.role === "user") answered.push(facet.id);
      else asked.push(facet.id);
    }
  }
  const answeredU = unique(answered);
  const askedU = unique(asked);
  const next = facets.find((facet) => !answeredU.includes(facet.id) && !askedU.includes(facet.id)) || null;
  return { answered: answeredU, asked: askedU, next };
}

function normalizeQuestion(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s?'']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The question the learner should answer: the last question, not an earlier acknowledgement. */
function lastTutorQuestion(text) {
  const parts = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (parts[i].includes("?")) return parts[i];
  }
  return "";
}

/** Short reply hints for the current tutor question, with Vietnamese meaning. */
export function learnCallReplyHints(tutorQuestion, { topic = "", title = "", sectionId = "", difficulty = "easy" } = {}) {
  const guide = learnCallTopicGuide({ topic, title, sectionId });
  const q = normalizeQuestion(lastTutorQuestion(tutorQuestion));
  if (!q) return [];
  const level = difficulty === "hard" || difficulty === "medium" ? difficulty : "easy";
  for (const facet of guide.facets || []) {
    const asked = (facet.angles || []).some((angle) => {
      const sample = normalizeQuestion(angle[level] || angle.easy || "");
      if (!sample) return false;
      if (q.includes(sample)) return true;
      const keys = sample.split(/\s+/).filter((word) => word.length >= 4);
      return keys.length > 0 && keys.every((word) => q.includes(word));
    });
    const byId =
      (facet.id === "name" && /\bname\b/.test(q)) ||
      (facet.id === "age" && /\bold\b/.test(q)) ||
      (facet.id === "home" && /\blive|from\b/.test(q)) ||
      (facet.id === "job" && /\bdo you do|job|work\b/.test(q)) ||
      (facet.id === "hobby" && /\blike|hobby|music|football\b/.test(q)) ||
      (facet.id === "greeting" && /\bhow are you\b/.test(q)) ||
      (facet.id === "drink" && /\bdrink|tea|coffee\b/.test(q)) ||
      (facet.id === "size" && /\bsize|small|large\b/.test(q)) ||
      (facet.id === "members" && /\bfamily|brother|sister|live with\b/.test(q));
    if (!asked && !byId) continue;
    return (facet.samples || []).slice(0, 2).map((sample) => ({
      en: sample.en,
      vi: sample.vi,
      facet: facet.id,
    }));
  }
  return [];
}

/** Which practice facet a tutor question belongs to, or "". */
export function learnCallQuestionFacet(text, guide) {
  const q = normalizeQuestion(lastTutorQuestion(text) || text);
  if (!q) return "";
  const facets = Array.isArray(guide?.facets) ? guide.facets : Object.keys(FACET_ASKED).map((id) => ({ id }));
  for (const facet of facets) {
    const re = FACET_ASKED[facet.id];
    if (re && re.test(q)) return facet.id;
  }
  return "";
}

/** Two or three small goals for this topic; not a fixed script of every facet. */
export function learnCallSessionGoals(guide) {
  const ids = (Array.isArray(guide?.facets) ? guide.facets : []).map((facet) => facet.id).filter(Boolean);
  if (guide?.key === "greetings") {
    return ["greeting", "name", ids.includes("home") ? "home" : ids.find((id) => id !== "greeting" && id !== "name")].filter(
      (id, i, list) => id && ids.includes(id) && list.indexOf(id) === i
    ).slice(0, 3);
  }
  if (guide?.key === "drinks") return ids.slice(0, 2);
  return ids.slice(0, 3);
}

/** Angle lines the tutor may pick from (reference only, not a fixed script). */
export function learnCallAngleLines(guide, difficulty = "easy", covered = null) {
  const level = difficulty === "hard" || difficulty === "medium" ? difficulty : "easy";
  const answered = new Set(covered?.answered || []);
  const asked = new Set(covered?.asked || []);
  const lines = [];
  for (const facet of guide?.facets || []) {
    if (answered.has(facet.id) || asked.has(facet.id)) continue;
    for (const angle of facet.angles || []) {
      const q = angle[level] || angle.easy;
      if (q) lines.push(`${facet.labelVi}: ${q}`);
    }
  }
  return lines.slice(0, 6);
}
