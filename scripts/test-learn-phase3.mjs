#!/usr/bin/env node
/**
 * Phase 3 — multi-activity lesson content types + Phase 1–2 regression.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BEEGO_TEST_BASE || "https://beego.vn";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TYPE_SAMPLES = [
  ["p1-g1-n01", "vocabulary"],
  ["p1-g1-n03", "grammar"],
  ["p1-g1-n04", "listening"],
  ["p1-g1-n09", "speaking"],
  ["p1-g1-n14", "story"],
  ["p1-g1-n15", "test"],
  ["p1-g1-n16", "review"],
];

async function fetchLesson(id) {
  const res = await fetch(`${BASE}/api/learn/lesson/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function exerciseTypes(questions) {
  return (questions || []).map((q) => q.type);
}

async function main() {
  const results = [];
  for (const [id, expectedType] of TYPE_SAMPLES) {
    const { status, json } = await fetchLesson(id);
    const d = json?.data;
    const ok =
      status === 200 &&
      d?.type === expectedType &&
      Array.isArray(d?.questions) &&
      d.questions.length > 0;
    results.push({
      id,
      expectedType,
      ok,
      types: exerciseTypes(d?.questions),
    });
  }

  const playerOk = results.every((r) => r.ok);
  const speakingOk = results.find((r) => r.id === "p1-g1-n09")?.types?.includes("speaking");
  const listeningOk =
    results.find((r) => r.id === "p1-g1-n04")?.types?.includes("listening_choice") ||
    results.find((r) => r.id === "p1-g1-n04")?.types?.includes("listening_fill");
  const storyOk = results.find((r) => r.id === "p1-g1-n14")?.types?.includes("story_comprehension");

  console.log("ACTIVITY_TYPES=" + results.map((r) => `${r.id}:${r.expectedType}:${r.types.join("+")}`).join("; "));
  console.log(
    "PLAYER_TEST=" +
      (playerOk && speakingOk && listeningOk && storyOk ? "PASS" : "FAIL") +
      ` allNodes=${playerOk} speaking=${!!speakingOk} listening=${!!listeningOk} story=${!!storyOk}`
  );

  const p2 = spawnSync("node", ["scripts/test-learn-phase2.mjs"], { cwd: root, encoding: "utf8" });
  console.log("PHASE_1_2_REGRESSION=" + (p2.status === 0 ? "PASS" : "FAIL"));
  if (p2.status !== 0 && p2.stdout) console.log(p2.stdout);

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);
  console.log("OTHER_TABS_REGRESSION=" + (vocab.status < 500 && home.status < 500 ? "PASS" : "FAIL"));

  console.log("REUSED_EXISTING_ENGINES=playBeegoAudio(/api/tts/speak);browser-patient-speech;client-pronunciation-eval(scoreText)");
  console.log("CONTENT_SOURCE=GET /api/learn/lesson/[lessonId] + ExerciseRenderer");

  const pass = playerOk && speakingOk && listeningOk && storyOk && p2.status === 0 && vocab.status < 500;
  console.log("BUILD=see npm run build");
  console.log("PHASE_3=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_3=FAIL");
  process.exit(1);
});
