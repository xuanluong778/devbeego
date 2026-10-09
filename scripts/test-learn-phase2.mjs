#!/usr/bin/env node
/**
 * Phase 2 — lesson content API (HTTP) + Phase 1 regression.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BEEGO_TEST_BASE || "https://beego.vn";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function fetchLesson(id) {
  const res = await fetch(`${BASE}/api/learn/lesson/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function questionFingerprint(questions) {
  return (questions || []).map((q) => `${q.id}:${q.type}:${String(q.prompt || "").slice(0, 48)}`).join("|");
}

async function main() {
  const a = await fetchLesson("p1-g1-n01");
  const b = await fetchLesson("p1-g1-n02");
  const c = await fetchLesson("p1-g1-n03");
  const n04 = await fetchLesson("p1-g1-n04");
  const last = await fetchLesson("p8-g1-n16");
  const bad = await fetchLesson("not-a-lesson");
  const reload = await fetchLesson("p1-g1-n01");

  const d1 = a.json?.data;
  const d2 = b.json?.data;
  const d3 = c.json?.data;

  const threeDistinct =
    a.status === 200 &&
    b.status === 200 &&
    c.status === 200 &&
    d1?.title !== d2?.title &&
    d2?.title !== d3?.title &&
    questionFingerprint(d1?.questions) !== questionFingerprint(d2?.questions) &&
    questionFingerprint(d2?.questions) !== questionFingerprint(d3?.questions);

  const qualityBank =
    (d1?.questions?.length || 0) >= 10 &&
    (d2?.questions?.length || 0) >= 10 &&
    (d3?.questions?.length || 0) >= 10 &&
    ["catalog_generated_v4", "catalog_generated_v3", "catalog_generated_v2", "catalog_generated", "enriched"].includes(d1?.contentSource) &&
    ["catalog_generated_v4", "catalog_generated_v3", "catalog_generated_v2", "catalog_generated", "enriched"].includes(d2?.contentSource) &&
    ["catalog_generated_v4", "catalog_generated_v3", "catalog_generated_v2", "catalog_generated", "enriched"].includes(d3?.contentSource);

  const reloadOk =
    reload.status === 200 &&
    questionFingerprint(reload.json?.data?.questions) === questionFingerprint(d1?.questions);

  const invalidOk = bad.status === 404;
  const catalogOk =
    n04.status === 200 &&
    ["catalog_generated_v4", "catalog_generated_v3", "catalog_generated_v2", "catalog_generated", "enriched"].includes(n04.json?.data?.contentSource) &&
    (n04.json?.data?.questions?.length || 0) >= 10 &&
    last.status === 200;

  console.log("CONTENT_SOURCE=lib/beego/learn/lesson-content-build.js + GET /api/learn/lesson/[lessonId]");
  console.log("LESSON_ID_MAPPING=128 nodes p{part}-g{gate}-n{01..16} from LEARNING_PARTS × GATE_NODE_BLUEPRINT");
  console.log(
    "3_LESSON_CONTENT_TEST=" +
      (threeDistinct && qualityBank ? "PASS" : "FAIL") +
      ` qualityBank=${qualityBank} distinct=${threeDistinct} source=${d1?.contentSource}`
  );
  console.log("MOCK_FALLBACK=fetchLessonForPlayer → loadLessonFallback when API fails");
  console.log("INVALID_LESSON=" + (invalidOk ? "PASS" : "FAIL"));
  console.log("RELOAD_STABLE=" + (reloadOk ? "PASS" : "FAIL"));
  console.log("CATALOG_COVERAGE=" + (catalogOk ? "PASS n04+ p8-g1-n16" : "FAIL"));

  const p1 = spawnSync("node", ["scripts/test-learn-phase1.mjs"], { cwd: root, encoding: "utf8" });
  console.log("PHASE_1_REGRESSION=" + (p1.status === 0 ? "PASS" : "FAIL"));
  if (p1.status !== 0 && p1.stdout) console.log(p1.stdout);

  const vocab = await fetch(`${BASE}/api/vocabulary?page=1&limit=1`);
  const home = await fetch(`${BASE}/`);
  console.log("OTHER_TABS_REGRESSION=" + (vocab.status < 500 && home.status < 500 ? "PASS" : "FAIL"));

  const pass =
    threeDistinct &&
    qualityBank &&
    invalidOk &&
    reloadOk &&
    catalogOk &&
    p1.status === 0 &&
    vocab.status < 500;

  console.log("BUILD=see npm run build");
  console.log("PHASE_2=" + (pass ? "PASS" : "FAIL"));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  console.log("PHASE_2=FAIL");
  process.exit(1);
});
