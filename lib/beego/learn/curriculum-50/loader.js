/**
 * Lazy loader for curriculum-50 gate JSON (on-demand per gate).
 * Slim catalog is loaded once for the learning-path map.
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  CURRICULUM_50_GATE_COUNT,
  CURRICULUM_50_REVISION,
  CURRICULUM_50_SCHEMA,
  parseCurriculum50LessonId,
} from "./constants.js";
import { CURRICULUM_50_SLIM } from "./catalog-slim.js";

const DIR = join(process.cwd(), "lib/beego/learn/curriculum-50");

/** @type {Map<number, object>} */
const gateCache = new Map();

function readJson(fileName) {
  const raw = readFileSync(join(DIR, fileName), "utf8");
  return JSON.parse(raw);
}

/** Slim map metadata — safe for server; prefer catalog-slim.js on client. */
export function getCurriculum50SlimCatalog() {
  return CURRICULUM_50_SLIM;
}

export function loadCurriculum50Gate(gateNumber) {
  const n = Number(gateNumber);
  if (!Number.isFinite(n) || n < 1 || n > CURRICULUM_50_GATE_COUNT) return null;
  if (gateCache.has(n)) return gateCache.get(n);
  const gate = readJson(`gate-${String(n).padStart(2, "0")}.json`);
  gateCache.set(n, gate);
  return gate;
}

export function getCurriculum50LessonRaw(lessonId) {
  const parsed = parseCurriculum50LessonId(lessonId);
  if (!parsed) return null;
  const gate = loadCurriculum50Gate(parsed.gateNumber);
  if (!gate) return null;

  if (parsed.kind === "exam") {
    return {
      kind: "exam",
      gateNumber: parsed.gateNumber,
      gateTitle: gate.title,
      level: gate.level || gate.band || "",
      exam: gate.exam || null,
      contentRevision: CURRICULUM_50_REVISION,
      schema: CURRICULUM_50_SCHEMA,
    };
  }

  const lesson = (gate.lessons || []).find((item) => item.lessonId === parsed.lessonId);
  if (!lesson) return null;
  return {
    kind: "lesson",
    gateNumber: parsed.gateNumber,
    gateTitle: gate.title,
    level: gate.level || gate.band || "",
    lesson,
    contentRevision: CURRICULUM_50_REVISION,
    schema: CURRICULUM_50_SCHEMA,
  };
}

export function clearCurriculum50Caches() {
  gateCache.clear();
}

export function listCurriculum50LessonIdsFromSlim() {
  const slim = getCurriculum50SlimCatalog();
  const ids = [];
  for (const gate of slim.gates || []) {
    for (const lesson of gate.lessons || []) {
      ids.push(lesson.lessonId);
    }
    if (gate.examId) ids.push(gate.examId);
  }
  return ids;
}
