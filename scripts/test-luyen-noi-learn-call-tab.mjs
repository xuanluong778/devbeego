/**
 * Structural check: /luyen-noi reuses Learn Call, not the old speaking UI.
 * node scripts/test-luyen-noi-learn-call-tab.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const root = resolve(import.meta.dirname, "..");
const page = readFileSync(resolve(root, "app/luyen-noi/page.js"), "utf8");
const tab = readFileSync(resolve(root, "components/beego/learn/LearnCallSpeakingTab.jsx"), "utf8");
const nav = readFileSync(resolve(root, "lib/beego/nav.js"), "utf8");

assert(page.includes("LearnCallSpeakingTab"), "luyen-noi page mounts LearnCallSpeakingTab");
assert(!page.includes("AiCallLayout"), "luyen-noi page does not mount old AiCallLayout");
assert(!page.includes("SpeakingRoom"), "luyen-noi page does not mount old SpeakingRoom");
assert(tab.includes('from "@/components/beego/lesson-player/LearnLessonCall"'), "tab reuses LearnLessonCall");
assert(tab.includes("listSpeakingTabTopics"), "tab lists every Học topic for the picker");
assert(tab.includes("Chưa mở") || tab.includes("locked"), "locked topics are shown as not yet open");
assert(tab.includes("autoCheck"), "tab opens prepare via autoCheck, not an automatic session POST");
assert(!tab.includes('method: "POST"'), "tab itself does not start sessions");
assert(nav.includes('label: "Luyện nói"') && nav.includes('href: SPEAKING_PATH') && nav.includes('"🎙️"'), "bottom nav keeps Luyện nói name/icon");

for (const gone of [
  "components/speaking",
  "components/ai-call",
  "components/voice-call",
  "app/luyen-noi/lessons.css",
  "app/luyen-noi/lessons-mockup.css",
]) {
  assert(!existsSync(resolve(root, gone)), `old unused path removed: ${gone}`);
}

console.log("PASS luyen-noi learn-call tab");
