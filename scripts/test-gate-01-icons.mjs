// Run: node --import ./scripts/register-alias.mjs scripts/test-gate-01-icons.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GATE_01_LESSON_ICON_FILES, getGate01LessonIcon, getGate01CallIcon } from "../lib/beego/learn/gate-01-icons.js";
import { buildLearningPathFromCatalog } from "../lib/beego/learning-path-build.js";
import { getNodeIconType } from "../lib/beego/learning-node-icons.js";
import { pickGateCallTarget } from "../lib/beego/learn/ai-call-access.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "docs/beego-icon-cua-1");
const publicDir = path.join(root, "public/uploads/lesson-icons/gate-01");
const manifest = JSON.parse(fs.readFileSync(path.join(source, "manifest.json"), "utf8"));
const originalManifest = fs.readFileSync(path.join(source, "manifest.json"));
assert.deepEqual(fs.readFileSync(path.join(publicDir, "manifest.json")), originalManifest);

const baseline = buildLearningPathFromCatalog();
const before = JSON.stringify(baseline);
const gate = baseline.sections.find((section) => section.sectionId === "c50-g01");
assert.equal(gate.nodes.length, 17);
assert.deepEqual(Object.keys(GATE_01_LESSON_ICON_FILES), gate.nodes.map((node) => node.lessonId));
for (const node of gate.nodes) {
  const entry = manifest.find((row) => row.id === node.lessonId);
  assert(entry, `Manifest missing ${node.lessonId}`);
  assert.equal(entry.title, node.title);
  assert.equal(GATE_01_LESSON_ICON_FILES[node.lessonId], entry.file);
  const artwork = getGate01LessonIcon(node.lessonId);
  assert.equal(artwork.src, `/uploads/lesson-icons/gate-01/${entry.file.replace(/\.png$/, ".webp")}`);
  assert.equal(artwork.original, `/uploads/lesson-icons/gate-01/${entry.file}`);
}

let pngBytes = 0;
let webpBytes = 0;
for (const { file } of manifest) {
  const original = fs.readFileSync(path.join(source, file));
  assert.deepEqual(fs.readFileSync(path.join(publicDir, file)), original, `Original changed: ${file}`);
  const webp = fs.readFileSync(path.join(publicDir, file.replace(/\.png$/, ".webp")));
  assert.equal(webp.toString("ascii", 0, 4), "RIFF");
  assert.equal(webp.toString("ascii", 8, 12), "WEBP");
  assert(webp.length < original.length / 10, `Unoptimized icon: ${file}`);
  pngBytes += original.length;
  webpBytes += webp.length;
}

const call = getGate01CallIcon(gate);
assert(call.src.endsWith("/19-gau-goi-gia-su-ai.webp"));
assert.equal(pickGateCallTarget(gate)?.lessonId, "g01l01");
const locked = { ...gate, nodes: gate.nodes.map((node) => ({ ...node, status: "locked" })) };
assert.equal(pickGateCallTarget(locked), null);
for (const fakeLessonId of ["g01-ai-call", "ai-call-bear", "g01l17", "__proto__", "constructor", undefined]) {
  assert.equal(getGate01LessonIcon(fakeLessonId), null);
}
for (const section of baseline.sections.slice(1)) {
  // gateNumber is also 1 in these sections: never use it to select artwork.
  assert.equal(getGate01CallIcon(section), null);
  for (const node of section.nodes) {
    assert.equal(getGate01LessonIcon(node.lessonId), null);
    assert.equal(getNodeIconType({ ...node, status: "locked" }), "lock");
    assert.equal(getNodeIconType({ ...node, status: "completed" }), "check");
  }
}
assert.equal(JSON.stringify(baseline), before, "Artwork lookup must not mutate path/progress/rewards");
console.log(`PASS: 17 exact mappings, bear feature icon, 19 original PNGs/WebPs, all 49 other gates, no path mutations. PNG ${pngBytes} bytes → WebP ${webpBytes} bytes.`);
