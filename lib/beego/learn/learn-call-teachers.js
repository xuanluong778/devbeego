// Tutors a learner can pick before a Learn call. `voice` must be one of LEARN_CALL_TTS_VOICES.
export const LEARN_CALL_TTS_VOICES = Object.freeze(["alloy", "nova", "onyx", "shimmer"]);

export const LEARN_CALL_TEACHERS = Object.freeze({
  robot: Object.freeze({
    name: "Robot Beego",
    shortName: "Robot",
    spokenName: "Beego",
    voiceLabel: "Giọng máy",
    voice: "alloy",
    image: "",
  }),
  emma: Object.freeze({
    name: "Cô Emma",
    shortName: "Cô Emma",
    spokenName: "Emma",
    voiceLabel: "Giọng nữ",
    voice: "nova",
    image: "/learn-call/teachers/emma.jpg",
  }),
  james: Object.freeze({
    name: "Thầy James",
    shortName: "Thầy James",
    spokenName: "James",
    voiceLabel: "Giọng nam",
    voice: "onyx",
    image: "/learn-call/teachers/james.jpg",
  }),
  mina: Object.freeze({
    name: "Cô Mina",
    shortName: "Cô Mina",
    spokenName: "Mina",
    voiceLabel: "Giọng nữ",
    voice: "shimmer",
    image: "/learn-call/teachers/mina.jpg",
  }),
});
export const LEARN_CALL_TEACHER_KEYS = Object.freeze(Object.keys(LEARN_CALL_TEACHERS));
export const LEARN_CALL_DEFAULT_TEACHER = "robot";

export function learnCallTeacherId(value) {
  const key = String(value ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEARN_CALL_TEACHERS, key) ? key : LEARN_CALL_DEFAULT_TEACHER;
}

export function learnCallTeacher(value) {
  const id = learnCallTeacherId(value);
  return { id, ...LEARN_CALL_TEACHERS[id] };
}

export function learnCallTtsVoice(value) {
  const voice = String(value ?? "").trim();
  return LEARN_CALL_TTS_VOICES.includes(voice) ? voice : LEARN_CALL_TTS_VOICES[0];
}
