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
      { easy: "Are you having a good day?", medium: "How is your day going?", hard: "What has been the best part of your day?" },
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
      { easy: "What should I call you?", medium: "How would you like me to call you?", hard: "How do you introduce yourself to someone new?" },
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
      { easy: "May I ask your age?", medium: "Could you tell me your age?", hard: "Would you be comfortable sharing your age?" },
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
      { easy: "Where do you live?", medium: "Where do you live?", hard: "What do you like about where you live?" },
      { easy: "Is your home near here?", medium: "What is your hometown?", hard: "What do you like about your hometown?", hints: { easy: { en: "Yes, I live nearby.", vi: "Có, tôi sống gần đây." }, medium: { en: "My hometown is Hanoi.", vi: "Quê tôi ở Hà Nội." }, hard: { en: "I like the parks in my hometown.", vi: "Tôi thích các công viên ở quê tôi." } } },
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
      { easy: "Do you work or study?", medium: "What kind of work do you do?", hard: "What do you enjoy about your work or studies?" },
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
      { easy: "What do you do for fun?", medium: "What do you enjoy after work?", hard: "How did you become interested in your hobby?" },
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
      facet("drink", "đồ uống", [{ easy: "Tea or coffee?", medium: "What would you like to drink?", hard: "Why do you prefer that drink?" }, { easy: "Water or juice?", medium: "What do you drink at home?", hard: "How do your drink choices change during the day?", hint: { en: "Water, please.", vi: "Cho tôi nước." } }], [
        { en: "Tea, please.", vi: "Cho tôi trà." },
        { en: "I like coffee.", vi: "Tôi thích cà phê." },
      ]),
      facet("size", "size", [{ easy: "Small or large?", medium: "What size do you want?", hard: "Would you change size if it is busy?" }, { easy: "A small cup?", medium: "Would you like a large cup?", hard: "What size suits you best, and why?", hint: { en: "A small cup, please.", vi: "Cho tôi một cốc nhỏ." } }], [
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
      facet("members", "thành viên", [{ easy: "Do you have a brother?", medium: "Who do you live with?", hard: "Who in your family are you closest to, and why?" }, { easy: "Do you have a sister?", medium: "Who do you spend time with at home?", hard: "What do you enjoy doing together as a family?", hint: { en: "I have a sister.", vi: "Tôi có chị/em gái." } }], [
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
  facets: Object.freeze([
    facet("preference", "ý thích về chủ đề", [{ easy: "Do you like it?", medium: "What do you like about it?", hard: "What interests you most about this topic?" }, { easy: "Is it interesting?", medium: "What interests you about it?", hard: "How has your opinion about it changed?" }], [{ en: "Yes, I like it.", vi: "Có, tôi thích." }]),
    facet("experience", "trải nghiệm", [{ easy: "Is it new to you?", medium: "When did you first try it?", hard: "Can you describe a memorable experience with it?" }], [{ en: "Yes, it is new to me.", vi: "Có, điều này mới với tôi." }]),
    facet("routine", "thói quen", [{ easy: "Do you do it often?", medium: "How often do you do it?", hard: "How does it fit into your daily routine?" }], [{ en: "I do it every day.", vi: "Tôi làm hằng ngày." }]),
  ]),
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

const NON_NAME_ADJECTIVES =
  "good|fine|okay|ok|well|great|happy|tired|sad|busy|here|there|sorry|from|a|an|the|not|very|so|too|just|really|alright|doing|feeling|hungry|thirsty|full|sleepy|ready|sure|bored|cold|hot|warm|sick|ill|late|early|back|home|free|lost|alone|alive|glad|working|living|learning|studying|trying|done|fine|student|teacher|doctor|nurse|engineer|developer|software|technology|worker|yes|yeah|yep|yup|no|nope|nah";

export const NON_NAME_SET = new Set(NON_NAME_ADJECTIVES.split("|"));

const FACET_HEARD = Object.freeze({
  greeting: /\b(?:i(?:'m| am)\s+(?:fine|good|okay|ok)|hello|hi)\b|khỏe|xin chào/i,
  name: new RegExp(
    `\\b(?:my name is\\s+[a-zà-ỹ]{2,}|call me\\s+[a-zà-ỹ]{2,}|tên (?:tôi )?là\\s+[a-zà-ỹ]{2,}|i(?:'m| am)\\s+(?!${NON_NAME_ADJECTIVES}\\b)[a-zà-ỹ][a-zà-ỹ'-]{1,})\\b`,
    "i"
  ),
  age: /\b(?:i(?:'m| am)\s+(?:\d{1,2}|(?:twenty|thirty|forty|fifty)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?|fifteen|sixteen|seventeen|eighteen|nineteen)(?:\s*(?:years?\s*old|tuổi))?|(?:\d{1,2}|(?:twenty|thirty|forty|fifty)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?|fifteen|sixteen|seventeen|eighteen|nineteen)\s*(?:years?\s*old|tuổi)|(?:tuổi\s+(?:của\s+tôi\s+là\s+)?\d{1,2}))\b/i,
  home: /\b(?:i live|i(?:'m| am) from|live in|living in)\b|sống|ở\s+[A-Za-zÀ-Ỵ]/i,
  job: /\b(?:i(?:'m| am) a |i work|student|teacher|doctor|engineer|nurse)\b|học sinh|sinh viên|giáo viên|nhân viên/i,
  hobby: /\b(?:my hobby|i (?:like|love|enjoy) (?!living\b)|music|football|cooking|reading)\b|thích/i,
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
  // Sort chronologically if requestIds are available
  const sorted = [...turns].sort((a, b) => (Number(a?.requestId) || 0) - (Number(b?.requestId) || 0) || (a.role === b.role ? 0 : a.role === "user" ? -1 : 1));
  const answered = [];
  const asked = [];
  let pendingFacet = null;

  for (const item of sorted) {
    const text = String(item?.content || "").trim();
    if (!text) continue;
    if (item.role === "assistant") {
      const qFacet = learnCallQuestionFacet(text, guide);
      if (qFacet) {
        asked.push(qFacet);
        pendingFacet = qFacet;
      }
      continue;
    }
    if (item.role === "user") {
      // A short answer belongs to the current question before broad lexical matching.
      let matchedFacet = null;
      if (pendingFacet === "job" && /\b(?:it|tech|technology|software|student|teacher|engineer|developer|doctor|nurse|work)\b/i.test(text)) {
        matchedFacet = "job";
        answered.push("job");
      }
      for (const facet of matchedFacet ? [] : facets) {
        const re = FACET_HEARD[facet.id];
        if (re && re.test(text)) {
          answered.push(facet.id);
          if (!matchedFacet || facet.id === pendingFacet) matchedFacet = facet.id;
        }
      }
      // Contextual check for short / single-word answers based on pending facet
      if (!matchedFacet && pendingFacet) {
        const cleanWords = text.toLowerCase().replace(/[^a-z0-9à-ỹ\s]/gi, "").trim().split(/\s+/).filter(Boolean);
        if (pendingFacet === "name") {
          const isAdjectiveOrStop = cleanWords.some((w) => NON_NAME_SET.has(w));
          if (!isAdjectiveOrStop && cleanWords.length >= 1 && cleanWords.length <= 3 && !/\d/.test(text)) {
            answered.push("name");
            matchedFacet = "name";
          }
        } else if (pendingFacet === "age") {
          if (/^\s*(?:\d{1,2}|(?:twenty|thirty|forty|fifty|sixty)(?:[-\s]+(?:one|two|three|four|five|six|seven|eight|nine))?|fifteen|sixteen|seventeen|eighteen|nineteen)\s*[.!?]?$/i.test(text)) {
            answered.push("age");
            matchedFacet = "age";
          }
        } else if (pendingFacet === "greeting") {
          if (/^(?:good|fine|ok|okay|great|yes|hi|hello)[.!?]?$/i.test(text)) {
            answered.push("greeting");
            matchedFacet = "greeting";
          }
        }
      }
      if (matchedFacet === pendingFacet) {
        pendingFacet = null;
      }
    }
  }
  const answeredU = unique(answered);
  const askedU = unique(asked);
  const next = learnCallSelectQuestion({ guide, covered: { answered: answeredU, asked: askedU } })?.facet || null;
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

export const LEARN_CALL_HELP_HINTS = Object.freeze([
  { en: "Could you say that again?", vi: "Bạn nhắc lại được không?", facet: "help" },
  { en: "Explain in Vietnamese, please.", vi: "Giải thích bằng tiếng Việt giúp tôi.", facet: "help" },
]);

/** Short reply hints for the current tutor question, with Vietnamese meaning. */
export function learnCallReplyHints(
  tutorQuestion,
  { topic = "", title = "", sectionId = "", difficulty = "easy", pendingIntent = "", currentPractice = null } = {}
) {
  if (currentPractice?.active && currentPractice?.targetPhrase) {
    return [
      { en: currentPractice.targetPhrase, vi: "Thử nói cả câu này", facet: "practice" },
      { en: "Can you say that again?", vi: "Bạn nhắc lại được không?", facet: "help" },
    ];
  }
  const raw = String(tutorQuestion || "").trim();
  if (!raw && !pendingIntent) return [];
  const guide = learnCallTopicGuide({ topic, title, sectionId });
  const q = normalizeQuestion(lastTutorQuestion(raw) || raw);
  const level = difficulty === "hard" || difficulty === "medium" ? difficulty : "easy";

  // 1. First, check if tutorQuestion explicitly asks a specific facet question
  if (q) {
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
      if (asked || byId) {
        const exactAngle = facet.angles.find(a => normalizeQuestion(a[level] || a.easy) === q);
        const exactHint = exactAngle && learnCallAngleHint(facet, exactAngle, level);
        if (exactHint && exactHint !== facet.samples[0]) return [{ ...exactHint, facet: facet.id }];
        const samples = (facet.samples || []).slice(0, 2).map((sample) => ({
          en: sample.en,
          vi: sample.vi,
          facet: facet.id,
        }));
        if (level === "easy" && facet.id === "name") {
          return [{ en: "My name is …", vi: "Tên tôi là …", facet: "name" }, samples[0]].filter(Boolean);
        }
        return samples;
      }
    }
  }

  // 2. Fall back to pendingIntent if tutorQuestion did not contain a matched question
  if (pendingIntent) {
    for (const facet of guide.facets || []) {
      if (facet.id === pendingIntent) {
        return (facet.samples || []).slice(0, 2).map((sample) => ({
          en: sample.en,
          vi: sample.vi,
          facet: facet.id,
        }));
      }
    }
  }
  // When no facet question is determined: give helpful options instead of fabricated answers!
  return [...LEARN_CALL_HELP_HINTS];
}

/** Same idea even when the wording or target id differs. */
export function learnCallQuestionMeaning(text, targetId = "") {
  const q = normalizeQuestion(text);
  if (/how old|your age|may i ask your age|could you tell me your age|mind telling me your age|sharing your age|confirm your age/.test(q)) return "age";
  if (/like your work|like about your job|enjoy about your work|makes your work|like about your work or studies/.test(q)) return "job_enjoy";
  if (/what do you do|work or study|your job|kind of work/.test(q)) return "job";
  if (/like living|like about living|like about where|like about this neighborhood|like about your hometown|change about your neighborhood/.test(q)) return "home_enjoy";
  if (/where do you live|where are you from|live nearby|home near|your hometown|your home/.test(q)) return "home";
  if (/your name|call you|introduce yourself/.test(q)) return "name";
  if (/how are you|good day|your day|day going|day been/.test(q)) return "greeting";
  if (/like music|hobby|for fun|like to do|enjoy after work|become interested/.test(q)) return "hobby";
  if (/like learning english|why are you learning/.test(q)) return "english_learning";
  return targetId || q;
}

/** Which practice facet a tutor question belongs to, or "". */
export function learnCallQuestionFacet(text, guide) {
  const q = normalizeQuestion(lastTutorQuestion(text) || text);
  if (!q) return "";
  const facets = Array.isArray(guide?.facets) ? guide.facets : Object.keys(FACET_ASKED).map((id) => ({ id }));
  for (const f of facets) {
    if ((f.angles || []).some(a => Object.values(a).some(v => typeof v === "string" && q.includes(normalizeQuestion(v))))) return f.id;
  }
  for (const facet of facets) {
    const re = FACET_ASKED[facet.id];
    if (re && re.test(q)) return facet.id;
  }
  return "";
}

/** Two or three small goals for this topic; not a fixed script of every facet. */
export function learnCallSessionGoals(guide, selection = null) {
  const ids = (Array.isArray(guide?.facets) ? guide.facets : []).map((facet) => facet.id).filter(Boolean);
  if (guide?.key === "greetings") {
    if (selection?.id) return ["greeting", "name", selection.id === "classmate" ? "english_learning" : selection.id === "colleague" ? "job" : "home"];
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

/** Stable session selection; no global random state and no learner data in the seed. */
export function learnCallSeed(seed) {
  let h = 2166136261;
  for (const c of String(seed || "default")) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const MEETING_OPENINGS = [
  { id: "neighbor", context: "meeting a new neighbor", spoken: "Hi! I'm your new neighbor. What's your name?", targetId: "name", hint: { en: "My name is …", vi: "Tên tôi là …" }, nextAfterName: "Do you live nearby?" },
  { id: "classmate", context: "meeting a new classmate", spoken: "Hi! I'm in your English class. What's your name?", targetId: "name", hint: { en: "My name is …", vi: "Tên tôi là …" }, nextAfterName: "Do you like learning English?" },
  { id: "colleague", context: "meeting a new colleague", spoken: "Hi! I'm your new colleague. How are you?", targetId: "greeting", hint: { en: "I'm good, thanks.", vi: "Tôi khỏe, cảm ơn." }, nextAfterName: "What do you do?" },
];

export function learnCallSelectOpening({ guide, sessionId = "", difficulty = "easy", previousId = "" } = {}) {
  let candidates = guide?.key === "greetings" ? MEETING_OPENINGS : (guide?.facets || []).flatMap(f =>
    f.angles.map((a, i) => ({ id: `${guide.key}:${f.id}:${i}`, context: guide.practiceGoal,
      spoken: `Hi! ${a[difficulty] || a.easy}`, targetId: f.id,
      hint: learnCallAngleHint(f, a, difficulty), nextAfterName: "" })));
  if (!candidates.length) candidates = [{ id: "general", context: guide?.practiceGoal || "", spoken: "Hi! How are you?", targetId: "greeting", hint: { en: "I'm fine.", vi: "Tôi khỏe." } }];
  const eligible = candidates.filter(v => v.id !== previousId);
  const pool = eligible.length ? eligible : candidates;
  return { ...pool[learnCallSeed(sessionId) % pool.length] };
}

/** Select an unasked content group, preferring a follow-up grounded in the last answer. */
export function learnCallSelectQuestion({ guide, sessionId = "", difficulty = "easy", covered = {}, lastIntent = "", selection = null } = {}) {
  const excluded = new Set([...(covered.answered || []), ...(covered.asked || [])]);
  const meanings = new Set(covered.meanings || []);
  const level = difficulty === "hard" || difficulty === "medium" ? difficulty : "easy";
  const followups = {
    greeting: (guide?.facets || []).find(f => f.id === "name"),
    job: { id: "job_enjoy", labelVi: "điều thích ở công việc", angles: [{ easy: "Do you like your work?", medium: "What do you like about your job?", hard: "What makes your work rewarding?" }], samples: [{ en: "I like my team.", vi: "Tôi thích đội của tôi." }] },
    home: { id: "home_enjoy", labelVi: "nơi ở", angles: [{ easy: "Do you like living there?", medium: "What do you like about living there?", hard: "What would you change about your neighborhood?" }], samples: [{ en: "It's quiet.", vi: "Ở đó yên tĩnh." }] },
    name: { id: selection?.id === "classmate" ? "english_learning" : selection?.id === "colleague" ? "job" : "home", labelVi: "gặp gỡ", angles: [{ easy: selection?.nextAfterName || "Do you live nearby?", medium: selection?.nextAfterName || "Do you live nearby?", hard: selection?.id === "classmate" ? "Why are you learning English?" : selection?.id === "colleague" ? "What do you enjoy about your work?" : "What do you like about this neighborhood?" }], samples: [{ en: selection?.id === "classmate" ? "Yes, I like English." : "Yes, I do.", vi: "Có." }] },
  };
  const usableAngles = (facet) => (facet?.angles || []).filter((angle) => {
    const question = angle[level] || angle.easy || "";
    if (!question) return false;
    const meaning = learnCallQuestionMeaning(question, facet.id);
    return meaning && !meanings.has(meaning);
  });
  const followup = followups[lastIntent];
  const preferred = followup && !excluded.has(followup.id) ? { ...followup, angles: usableAngles(followup) } : null;
  const rest = (guide?.facets || [])
    .filter((facet) => !excluded.has(facet.id) && facet.id !== preferred?.id)
    .map((facet) => ({ ...facet, angles: usableAngles(facet) }))
    .filter((facet) => facet.angles.length);
  const facets = preferred?.angles?.length ? [preferred] : rest;
  if (!facets.length) return null;
  const f = facets[learnCallSeed(`${sessionId}:facet:${excluded.size}`) % facets.length];
  const angle = f.angles[learnCallSeed(`${sessionId}:${f.id}`) % f.angles.length];
  const question = angle[level] || angle.easy;
  return { facet: f, angle, question, hint: learnCallAngleHint(f, angle, difficulty), targetId: f.id, meaning: learnCallQuestionMeaning(question, f.id) };
}

/** A question and its answer frame travel together, including level-specific variants. */
export function learnCallAngleHint(facet, angle, difficulty = "easy") {
  const q = angle?.[difficulty] || angle?.easy || "";
  if (angle?.hints?.[difficulty]) return angle.hints[difficulty];
  const samples = [
    [/who.*live with/i, "I live with my parents.", "Tôi sống với bố mẹ."],
    [/who.*spend time/i, "I spend time with my sister.", "Tôi dành thời gian với chị/em gái."],
    [/do you have a brother/i, "I have a brother.", "Tôi có anh/em trai."],
    [/closest to/i, "I'm closest to my sister because she listens.", "Tôi thân nhất với chị/em gái vì chị/em lắng nghe."],
    [/enjoy doing together/i, "We enjoy cooking together.", "Chúng tôi thích nấu ăn cùng nhau."],
    [/why.*prefer/i, "I prefer tea because it helps me relax.", "Tôi thích trà hơn vì nó giúp tôi thư giãn."],
    [/drink choices change/i, "I drink coffee in the morning and tea at night.", "Tôi uống cà phê buổi sáng và trà buổi tối."],
    [/what.*size.*why|change size/i, "I choose a small cup because I drink slowly.", "Tôi chọn cốc nhỏ vì tôi uống chậm."],
    [/how.*day been/i, "My day has been busy but enjoyable.", "Ngày của tôi bận nhưng vui."],
    [/best part of your day/i, "Lunch with my friends was the best part.", "Ăn trưa với bạn là phần vui nhất."],
    [/hobby.*why/i, "I enjoy cooking because it is relaxing.", "Tôi thích nấu ăn vì nó giúp thư giãn."],
    [/how did you become interested/i, "A friend introduced me to cooking.", "Một người bạn đã giới thiệu tôi với việc nấu ăn."],
    [/what do you enjoy about.*work|what makes.*work/i, "I enjoy helping my team solve problems.", "Tôi thích giúp đội của mình giải quyết vấn đề."],
    [/why are you learning English/i, "I am learning English to talk with people at work.", "Tôi học tiếng Anh để trò chuyện với mọi người ở chỗ làm."],
    [/what do you like.*(?:neighborhood|where you live|living there|hometown)/i, "I like the parks and friendly people.", "Tôi thích các công viên và những người thân thiện."],
    [/what would you change.*neighborhood/i, "I would add more parks.", "Tôi muốn có thêm công viên."],
  ];
  const match = samples.find(([pattern]) => pattern.test(q));
  if (match) return { en: match[1], vi: match[2] };
  return angle?.hint || facet?.samples?.[0] || { en: "Yes, I do.", vi: "Có." };
}
