/**
 * Browser check for the Learn Call level 1 preview.
 * Uses the isolated preview app and a fake microphone. Does not print the session token.
 */
import fs from "node:fs";
import { spawn } from "node:child_process";
import WebSocket from "ws";

const token = fs.readFileSync("/tmp/beego-call-preview-token", "utf8").trim();
const port = 9228;
const profile = "/tmp/beego-call-chrome";
fs.rmSync(profile, { recursive: true, force: true });
const chrome = spawn(
  "/usr/bin/chromium-browser",
  [
    "--no-sandbox",
    "--disable-gpu",
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "about:blank",
  ],
  { stdio: "ignore" }
);

async function waitJson() {
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch (_e) {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("chromium debug port did not open");
}

await waitJson();
const created = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
const page = await created.json();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.once("open", resolve);
  ws.once("error", reject);
});
let seq = 0;
const pending = new Map();
ws.on("message", (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}
await cdp("Page.enable");
await cdp("Network.enable");
await cdp("Runtime.enable");
const calls = [];
ws.on("message", (raw) => {
  const msg = JSON.parse(String(raw));
  const url = msg.method === "Network.requestWillBeSent" ? msg.params?.request?.url || "" : "";
  if (url.includes("/api/learn/") || url.includes("/api/voice/")) calls.push(`${msg.params.request.method} ${url}`);
});
await cdp("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    window.__micCalls = 0;
    window.__tracks = [];
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async function(constraints) {
      window.__micCalls += 1;
      const stream = await orig(constraints);
      stream.getTracks().forEach((track) => window.__tracks.push(track));
      return stream;
    };
  })();`,
});
await cdp("Network.setCookie", {
  name: "session_token",
  value: token,
  url: "http://127.0.0.1:3118/",
});
await cdp("Page.navigate", { url: "http://127.0.0.1:3118/learn/lesson/p1-g1-n01" });

async function evalValue(expression) {
  const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.result?.value;
}
async function waitText(text, ms = 15000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const found = await evalValue(`document.body.innerText.includes(${JSON.stringify(text)})`);
    if (found) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
async function clickText(text) {
  return evalValue(`(() => {
    const el = [...document.querySelectorAll("button,a")].find((node) => node.textContent.includes(${JSON.stringify(text)}));
    if (!el) return false;
    el.click();
    return true;
  })()`);
}

const complete = await waitText("Gọi AI — thực hành bài vừa học");
const micBefore = await evalValue("window.__micCalls");
const opened = await clickText("Gọi AI — thực hành bài vừa học");
const prepare = await waitText("Bắt đầu");
const micPrepare = await evalValue("window.__micCalls");
const started = await clickText("Bắt đầu");
const live = await waitText("Đang lắng nghe");
const micAfter = await evalValue("window.__micCalls");
const spoke = await clickText("Nói");
await new Promise((r) => setTimeout(r, 800));
const speechNotice = await evalValue("document.body.innerText");
const ended = await clickText("Kết thúc");
await new Promise((r) => setTimeout(r, 400));
const trackStates = await evalValue("window.__tracks.map((track) => track.readyState)");
const back = await waitText("Về lộ trình học");
const body = await evalValue("document.body.innerText.slice(0, 500)");
ws.close();
chrome.kill("SIGTERM");
console.log(JSON.stringify({
  complete,
  opened,
  prepare,
  started,
  live,
  spoke,
  ended,
  back,
  micBefore,
  micPrepare,
  micAfter,
  trackStates,
  speechUnsupported: String(speechNotice || "").includes("không có nhận dạng giọng nói"),
  calls: calls.filter((url) => !url.includes("token=")),
  stillOnLesson: String(body || "").includes("Về lộ trình học"),
}, null, 2));
