/**
 * Learn Call integration check against a real gateway + LLM/TTS workers + Azure STT.
 * Needs an isolated Redis (REDIS_URL) and gateway port (VOICE_WS_PORT); see learn-call-test-env.mjs.
 * Learner audio is synthetic (OpenAI TTS resampled to 16 kHz), not a microphone.
 * Synthetic user ids only; no database writes. Does not print secrets.
 *
 * Usage: REDIS_URL=redis://127.0.0.1:6397 VOICE_WS_PORT=3134 VOICE_LLM_QUEUE=… VOICE_TTS_QUEUE=… \
 *   node --import ./scripts/register-alias.mjs scripts/test-learn-call-integration.mjs [scenario…]
 */
import fs from "node:fs";
import os from "node:os";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import WebSocket from "ws";
import { Queue } from "bullmq";
import { loadLearnCallTestEnv } from "./learn-call-test-env.mjs";
import {
  learnAiCallClockKey,
  learnAiCallContextKey,
  learnAiCallGateKey,
  learnAiCallSessionKey,
} from "../lib/beego/learn/ai-call-access.js";
import { learnCallContextFromLesson, learnCallTranscriptUnclear } from "../lib/beego/learn/learn-call-tutor.js";
import { getLessonContentById } from "../lib/beego/learn/get-lesson-content.js";

const env = loadLearnCallTestEnv();
const port = env.wsPort;
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const llmQueue = new Queue(process.env.VOICE_LLM_QUEUE || "voice-llm", { connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) });
const ttsQueue = new Queue(process.env.VOICE_TTS_QUEUE || "voice-tts", { connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) });
const only = new Set(process.argv.slice(2));
const clipDir = process.env.LEARN_CALL_CLIP_DIR || `${os.tmpdir()}/learn-call-it-clips`;
const lesson = getLessonContentById("g01l01");
const results = [];
const metrics = {};
let uid = 900000300;

function check(scenario, name, ok, detail = undefined) {
  results.push({ scenario, name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
  if (!ok) console.error(`FAIL [${scenario}] ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function clip(text) {
  fs.mkdirSync(clipDir, { recursive: true });
  const file = `${clipDir}/${text.replace(/[^a-z0-9]+/gi, "_")}.pcm16k`;
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice: "nova", response_format: "pcm", input: text }),
  });
  if (!res.ok) throw new Error(`clip source ${res.status}`);
  const raw = Buffer.from(await res.arrayBuffer());
  const input = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
  const outLen = Math.floor((input.length * 2) / 3);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i += 1) out[i] = input[Math.floor((i * 3) / 2)] || 0;
  const buf = Buffer.from(out.buffer, out.byteOffset, out.byteLength);
  fs.writeFileSync(file, buf);
  return buf;
}

async function seed(sid, userId, { maxMinutes = 2, memory = [] } = {}) {
  await redis.set(learnAiCallSessionKey(sid), String(userId), "EX", 600);
  await redis.set(
    learnAiCallContextKey(sid),
    JSON.stringify({
      userId,
      lessonId: lesson.lessonId,
      title: lesson.title,
      objective: lesson.objective,
      ...learnCallContextFromLesson(lesson, { topicTitle: "Chào hỏi", sectionId: "p1-g1" }),
      sectionId: "p1-g1",
      level: 1,
      maxMinutes,
    }),
    "EX",
    600
  );
  for (const item of memory) await redis.lpush(`voice:mem:${sid}`, JSON.stringify(item));
}

function tokenFor(userId, sid, extra = {}) {
  return jwt.sign({ sub: String(userId), plan: "pro", purpose: "learn_ai_call", sid, learnAllow: 1, ...extra }, env.VOICE_JWT_SECRET, {
    expiresIn: 600,
  });
}

function connect(sid, token) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sid)}`);
  const c = { ws, sid, msgs: [], closed: null, t0: Date.now() };
  ws.on("message", (data, isBinary) => {
    const at = Date.now();
    if (isBinary) {
      const b = Buffer.from(data);
      if (b[0] === 0x02) c.msgs.push({ type: "bin", kind: "turn", rid: b.readUInt32LE(1), bytes: b.length - 5, at });
      else if (b[0] === 0x03) c.msgs.push({ type: "bin", kind: "replay", playbackId: b.readUInt32LE(1), rid: b.readUInt32LE(5), bytes: b.length - 9, at });
      return;
    }
    try {
      c.msgs.push({ ...JSON.parse(String(data)), at });
    } catch (_e) {}
  });
  ws.on("close", (code, reason) => {
    c.closed = { code, reason: String(reason || "") };
  });
  ws.on("error", () => {});
  return new Promise((resolve) => {
    ws.once("open", () => resolve(c));
    ws.once("close", () => resolve(c));
  });
}

function waitFor(c, pred, ms, label = "") {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      const found = c.msgs.find(pred);
      if (found) {
        clearInterval(timer);
        resolve(found);
      } else if (Date.now() - start > ms) {
        clearInterval(timer);
        reject(new Error(`timeout ${label}; saw ${c.msgs.map((m) => m.type + (m.requestId ? `#${m.requestId}` : "")).slice(-25).join(",")}`));
      }
    }, 40);
  });
}

function waitClosed(c, ms) {
  const start = Date.now();
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      if (c.closed || Date.now() - start > ms) {
        clearInterval(timer);
        resolve(c.closed);
      }
    }, 40);
  });
}

function send(c, obj) {
  if (c.ws.readyState === 1) c.ws.send(JSON.stringify(obj));
}

function turnBytes(c, rid) {
  return c.msgs.filter((m) => m.type === "bin" && m.kind === "turn" && m.rid === rid).reduce((n, m) => n + m.bytes, 0);
}

async function memory(sid) {
  const raw = await redis.lrange(`voice:mem:${sid}`, 0, -1);
  return raw.map((s) => JSON.parse(s)).reverse();
}

async function assistant(sid, rid) {
  return (await memory(sid)).filter((m) => m.role === "assistant" && Number(m.requestId) === rid);
}

async function jobsFor(queue, sid) {
  const jobs = await queue.getJobs(["completed", "failed", "active", "waiting", "delayed"], 0, 2000);
  return jobs.filter((j) => j && String(j.name).includes(sid));
}

async function ttsText(sid, rid) {
  const jobs = (await jobsFor(ttsQueue, sid)).filter((j) => j.name === `tts-${sid}-${rid}`);
  return { count: jobs.length, text: jobs[0]?.data?.text };
}

async function speak(c, rid, audio, { tailMs = 600 } = {}) {
  send(c, { type: "recognition_start", requestId: rid });
  await waitFor(c, (m) => m.type === "recognition_started" && m.requestId === rid, 10000, `recognition_started#${rid}`);
  const frames = Buffer.concat([Buffer.alloc(3200), audio, Buffer.alloc(Math.round(tailMs * 32))]);
  for (let i = 0; i < frames.length; i += 3200) {
    c.ws.send(frames.subarray(i, i + 3200));
    await sleep(100);
  }
  const endAt = Date.now();
  send(c, { type: "recognition_end", requestId: rid });
  const final = await waitFor(c, (m) => m.type === "final_transcript" && m.requestId === rid, 15000, `final#${rid}`);
  return { final, sttMs: final.at - endAt, endAt };
}

/** Text the learner saw, text sent to TTS and stored text must be the same shaped sentence. */
async function sameText(scenario, c, rid) {
  const done = c.msgs.find((m) => m.type === "ai_done" && m.requestId === rid);
  const tts = await ttsText(c.sid, rid);
  const stored = await assistant(c.sid, rid);
  check(scenario, `rid ${rid}: one stored tutor turn`, stored.length === 1, stored.length);
  check(scenario, `rid ${rid}: one TTS job`, tts.count === 1, tts.count);
  check(scenario, `rid ${rid}: caption == TTS text == stored text`, Boolean(done?.text) && done.text === tts.text && done.text === stored[0]?.content, {
    caption: done?.text,
    tts: tts.text,
    stored: stored[0]?.content,
  });
  return done?.text || "";
}

/** The Learn client ends the call on any Azure error or stt_* interrupt. */
function noSttError(scenario, c) {
  const bad = c.msgs.filter((m) => m.type === "error" || (m.type === "interrupt" && String(m.reason || "").startsWith("stt_")));
  check(scenario, "no Azure error/stt interrupt reached the client", bad.length === 0, bad.map((m) => m.message || m.reason));
}

async function tutorTurn(c, rid, ms = 30000) {
  const done = await waitFor(c, (m) => m.type === "ai_done" && m.requestId === rid, ms, `ai_done#${rid}`);
  const end = await waitFor(c, (m) => m.type === "tts_end" && m.requestId === rid && m.kind !== "replay", ms, `tts_end#${rid}`);
  return { done, end, bytes: turnBytes(c, rid) };
}

/** The client completes a turn on tts_end; audio for that turn arriving later would leave it pending. */
async function noAudioAfterEnd(S, c, rid, end) {
  await sleep(500);
  const after = c.msgs.slice(c.msgs.indexOf(end) + 1).filter((m) => m.type === "bin" && m.kind === "turn" && m.rid === rid);
  check(S, `rid ${rid}: no tutor audio after tts_end`, after.length === 0, { lateFrames: after.length });
}

const scenarios = {
  /** Greeting, ack after tts_end, duplicate/late acks, replay without LLM, clean reconnect, end_call. */
  async lifecycle() {
    const S = "lifecycle";
    const userId = (uid += 1);
    const sid = `it-life-${Date.now()}`;
    await seed(sid, userId);
    const token = tokenFor(userId, sid);
    const c = await connect(sid, token);
    const hello = await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    check(S, "hello: Azure on, lesson context, empty transcript, rid floor 1", hello.useAzure === true && hello.lesson?.lessonId === lesson.lessonId && hello.transcript?.length === 0 && hello.currentRequestId === 1);
    const g = await tutorTurn(c, 1);
    metrics.greetingFirstAudioMs = (c.msgs.find((m) => m.type === "bin" && m.rid === 1)?.at || 0) - c.t0;
    check(S, "greeting has audio before tts_end", g.bytes > 0 && c.msgs.findIndex((m) => m.type === "bin" && m.rid === 1) < c.msgs.indexOf(g.end));
    await noAudioAfterEnd(S, c, 1, g.end);
    check(S, "Learn drops ai_stream tokens", !c.msgs.some((m) => m.type === "ai_stream"));
    check(S, "greeting has at most one question", (g.done.text.match(/\?/g) || []).length <= 1, g.done.text);
    await sameText(S, c, 1);
    check(S, "greeting pending before ack", (await assistant(sid, 1))[0]?.playback === "pending");

    for (const playback of ["complete", "complete", "interrupted", "cancelled", "complete", "interrupted"]) {
      send(c, { type: "playback_ack", kind: "turn", playback, requestId: 1, playbackId: 1 });
    }
    await sleep(600);
    const afterAck = await assistant(sid, 1);
    check(S, "ack after tts_end -> complete; duplicate and later interrupted ack ignored", afterAck.length === 1 && afterAck[0].playback === "complete", afterAck);

    send(c, { type: "repeat_last", requestId: 1 });
    const rs = await waitFor(c, (m) => m.type === "repeat_started", 5000, "repeat_started");
    const re = await waitFor(c, (m) => m.type === "tts_end" && m.kind === "replay", 5000, "replay tts_end");
    const replayBytes = c.msgs.filter((m) => m.type === "bin" && m.kind === "replay" && m.playbackId === rs.playbackId).reduce((n, m) => n + m.bytes, 0);
    check(S, "replay sends the same audio bytes with its own playbackId", rs.playbackId !== 1 && rs.requestId === 1 && replayBytes === g.bytes && re.playbackId === rs.playbackId, {
      playbackId: rs.playbackId,
      replayBytes,
      bytes: g.bytes,
    });
    send(c, { type: "playback_ack", kind: "replay", playback: "interrupted", requestId: 1, playbackId: rs.playbackId });
    await sleep(300);
    check(S, "replay ack does not change the turn", (await assistant(sid, 1))[0]?.playback === "complete");
    check(S, "replay did not call the LLM or TTS again", (await jobsFor(llmQueue, sid)).length === 1 && (await ttsText(sid, 1)).count === 1);

    const clockBefore = JSON.parse(await redis.get(learnAiCallClockKey(sid)));
    c.ws.close(1000, "client");
    await waitClosed(c, 3000);
    await sleep(300);
    const c2 = await connect(sid, token);
    const hello2 = await waitFor(c2, (m) => m.type === "hello", 5000, "hello2");
    check(S, "reconnect: transcript restored with playback state and same caption", hello2.transcript?.length === 1 && hello2.transcript[0].playback === "complete" && hello2.transcript[0].text === g.done.text, hello2.transcript);
    check(S, "reconnect: same deadline, rid floor kept", hello2.callClock?.deadlineAt === clockBefore.deadlineAt && hello2.currentRequestId === 1);
    await sleep(1500);
    check(S, "reconnect: no second greeting", (await jobsFor(llmQueue, sid)).length === 1 && !c2.msgs.some((m) => m.type === "ai_done"));

    send(c2, { type: "end_call" });
    const sum = await waitFor(c2, (m) => m.type === "call_summary", 5000, "summary");
    const ended = await waitFor(c2, (m) => m.type === "call_ended", 5000, "call_ended");
    check(S, "end_call: summary from server, client_end, no score", ended.reason === "client_end" && sum.summary.score === null && sum.summary.pronunciation === "Chưa đánh giá");
    check(S, "summary: 0 learner turns -> not practiced, greeting complete", sum.summary.learnerTurns === 0 && sum.summary.practiced === false && sum.summary.tutorPlayback?.complete === 1, sum.summary);
    check(S, "summary transcript text == caption", sum.summary.transcript?.[0]?.text === g.done.text);
    await waitClosed(c2, 3000);
    const c3 = await connect(sid, token);
    await waitClosed(c3, 3000);
    check(S, "closed session cannot reconnect", Boolean(c3.closed) && !c3.msgs.some((m) => m.type === "hello"), c3.closed);
  },

  /** Azure STT with synthetic speech, user turn stored, reply text consistency, early ack rejected. */
  async recognition() {
    const S = "recognition";
    const userId = (uid += 1);
    const sid = `it-stt-${Date.now()}`;
    await seed(sid, userId);
    const c = await connect(sid, tokenFor(userId, sid));
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    await tutorTurn(c, 1);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 1, playbackId: 1 });

    const said = await speak(c, 2, await clip("My name is Lan. I am a student."), { tailMs: 600 });
    metrics.sttAfterReleaseMs = said.sttMs;
    check(S, "partial transcript arrived before final", c.msgs.some((m) => m.type === "partial_transcript" && m.requestId === 2));
    check(S, "final transcript recognised", /lan/i.test(said.final.text) && /student/i.test(said.final.text), said.final.text);
    const user = (await memory(sid)).filter((m) => m.role === "user");
    check(S, "user turn stored once with requestId", user.length === 1 && user[0].content === said.final.text && Number(user[0].requestId) === 2, user);

    const firstBin = await waitFor(c, (m) => m.type === "bin" && m.kind === "turn" && m.rid === 2, 30000, "audio#2");
    metrics.replyFirstAudioAfterReleaseMs = firstBin.at - said.endAt;
    const early = c.msgs.some((m) => m.type === "tts_end" && m.requestId === 2);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 2, playbackId: 2 });
    await sleep(150);
    const stateEarly = (await assistant(sid, 2))[0]?.playback;
    check(S, "complete ack before tts_end is rejected", early || stateEarly === "pending", { early, stateEarly });
    const r = await tutorTurn(c, 2);
    await noAudioAfterEnd(S, c, 2, r.end);
    await sameText(S, c, 2);
    check(S, "reply uses the learner name", /lan/i.test(r.done.text), r.done.text);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 2, playbackId: 2 });
    await sleep(400);
    check(S, "complete ack after tts_end accepted (not stuck pending)", (await assistant(sid, 2))[0]?.playback === "complete");

    send(c, { type: "recognition_end", requestId: 2 });
    await sleep(1200);
    check(S, "duplicate recognition_end adds nothing", (await memory(sid)).filter((m) => m.role === "user").length === 1 && (await jobsFor(llmQueue, sid)).length === 2);

    const quick = await speak(c, 3, await clip("I like green apples."), { tailMs: 0 });
    metrics.sttNoTailMs = quick.sttMs;
    check(S, "release right after speaking still keeps the words", /apple/i.test(quick.final.text), quick.final.text);
    if (quick.final.text) {
      await tutorTurn(c, 3);
      await sameText(S, c, 3);
    }
    noSttError(S, c);
    send(c, { type: "end_call" });
    const sum = await waitFor(c, (m) => m.type === "call_summary", 5000, "summary");
    check(S, "summary counts learner turns from server", sum.summary.learnerTurns === (quick.final.text ? 2 : 1) && sum.summary.practiced === true, sum.summary.learnerTurns);
  },

  /** Interrupt before audio, interrupt during audio, duplicate worker events. */
  async interrupt() {
    const S = "interrupt";
    const userId = (uid += 1);
    const sid = `it-int-${Date.now()}`;
    await seed(sid, userId);
    const c = await connect(sid, tokenFor(userId, sid));
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");

    // Barge in on the greeting as soon as the first audio arrives.
    await waitFor(c, (m) => m.type === "bin" && m.kind === "turn" && m.rid === 1, 30000, "audio#1");
    send(c, { type: "interrupt", requestId: 1, reason: "barge_in" });
    send(c, { type: "playback_ack", kind: "turn", playback: "interrupted", requestId: 1, playbackId: 1 });
    await waitFor(c, (m) => m.type === "interrupt_ack" && m.requestId === 1, 5000, "interrupt_ack#1");
    await sleep(2500);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 1, playbackId: 1 });
    await sleep(300);
    const g = await assistant(sid, 1);
    check(S, "interrupt during audio -> interrupted, late complete ignored", g.length === 1 && g[0].playback === "interrupted", g);

    // Learner speaks, then cancels while the tutor is still thinking (no audio yet).
    const said = await speak(c, 2, await clip("Hello, my name is Tom."), { tailMs: 600 });
    check(S, "learner turn recognised", /tom/i.test(said.final.text), said.final.text);
    send(c, { type: "interrupt", requestId: 2, reason: "barge_in" });
    send(c, { type: "playback_ack", kind: "turn", playback: "cancelled", requestId: 2, playbackId: 2 });
    await sleep(6000);
    const t2 = await assistant(sid, 2);
    const tts2 = await ttsText(sid, 2);
    check(S, "interrupt before audio -> cancelled, no TTS job, no audio", t2.length <= 1 && (t2.length === 0 || t2[0].playback === "cancelled") && tts2.count === 0 && turnBytes(c, 2) === 0, {
      t2,
      tts: tts2.count,
      bytes: turnBytes(c, 2),
    });

    // Duplicate worker events for a settled turn must not add turns or TTS jobs.
    const pub = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
    const text1 = g[0].content;
    await pub.publish(`voice:chan:${sid}`, JSON.stringify({ type: "llm_done_for_tts", requestId: 1, text: text1, learn: 1 }));
    await pub.publish(`voice:chan:${sid}`, JSON.stringify({ type: "tts_end", requestId: 1 }));
    await sleep(800);
    check(S, "duplicate llm_done_for_tts (old rid) adds no turn and no TTS", (await assistant(sid, 1)).length === 1 && (await ttsText(sid, 1)).count === 1);

    const said3 = await speak(c, 3, await clip("I am ten years old."), { tailMs: 600 });
    check(S, "next learner turn recognised", /ten|10/i.test(said3.final.text), said3.final.text);
    const r3 = await tutorTurn(c, 3);
    const stored3 = await assistant(sid, 3);
    await pub.publish(`voice:chan:${sid}`, JSON.stringify({ type: "llm_done_for_tts", requestId: 3, text: r3.done.text, learn: 1 }));
    await sleep(1500);
    check(S, "duplicate llm_done_for_tts (current rid) adds no turn and no TTS", (await assistant(sid, 3)).length === stored3.length && (await ttsText(sid, 3)).count === 1, {
      turns: (await assistant(sid, 3)).length,
      tts: (await ttsText(sid, 3)).count,
    });
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 3, playbackId: 3 });
    await sleep(300);
    check(S, "turn after duplicates settles complete", (await assistant(sid, 3)).every((m) => m.playback === "complete"));
    await pub.quit();
    noSttError(S, c);

    send(c, { type: "end_call" });
    const sum = await waitFor(c, (m) => m.type === "call_summary", 5000, "summary");
    const p = sum.summary.tutorPlayback || {};
    check(S, "summary keeps interrupted/cancelled/complete apart", p.interrupted === 1 && p.complete === 1 && (p.cancelled === 1 || !sum.summary.transcript.some((t) => t.requestId === 2 && t.role === "assistant")), p);
  },

  /** Socket drops mid-audio, reconnect, then the deadline ends the call. */
  async network() {
    const S = "network";
    const userId = (uid += 1);
    const sid = `it-net-${Date.now()}`;
    await seed(sid, userId);
    const token = tokenFor(userId, sid);
    const c = await connect(sid, token);
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    await waitFor(c, (m) => m.type === "bin" && m.kind === "turn" && m.rid === 1, 30000, "audio#1");
    const endedBeforeDrop = c.msgs.some((m) => m.type === "tts_end" && m.requestId === 1);
    c.ws.terminate();
    await sleep(3000);
    const t1 = await assistant(sid, 1);
    check(S, "drop during audio does not leave the turn pending or complete", t1.length === 1 && (endedBeforeDrop ? t1[0].playback !== "complete" : t1[0].playback === "interrupted"), {
      endedBeforeDrop,
      playback: t1[0]?.playback,
    });
    const c2 = await connect(sid, token);
    const hello2 = await waitFor(c2, (m) => m.type === "hello", 5000, "hello2");
    check(S, "reconnect restores the turn state", hello2.transcript?.[0]?.playback === t1[0]?.playback);
    send(c2, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 1, playbackId: 1 });
    await sleep(400);
    check(S, "ack for audio played on the old socket cannot mark complete", (await assistant(sid, 1))[0]?.playback !== "complete");
    send(c2, { type: "end_call" });
    await waitFor(c2, (m) => m.type === "call_ended", 5000, "call_ended");

    // Audio fully sent (tts_end) but the ack is lost with the socket.
    const sidB = `it-net-b-${Date.now()}`;
    await seed(sidB, userId);
    const tokenB = tokenFor(userId, sidB);
    const b = await connect(sidB, tokenB);
    await waitFor(b, (m) => m.type === "hello", 5000, "helloB");
    await tutorTurn(b, 1);
    b.ws.terminate();
    await sleep(2500);
    check(S, "ack lost after tts_end stays unconfirmed, not complete", (await assistant(sidB, 1))[0]?.playback === "pending");
    const b2 = await connect(sidB, tokenB);
    await waitFor(b2, (m) => m.type === "hello", 5000, "helloB2");
    send(b2, { type: "interrupt", requestId: 1, reason: "barge_in" });
    send(b2, { type: "playback_ack", kind: "turn", playback: "cancelled", requestId: 1, playbackId: 1 });
    await sleep(500);
    check(S, "audio sent on the old socket cannot become 'cancelled before playing'", (await assistant(sidB, 1))[0]?.playback === "pending");
    send(b2, { type: "end_call" });
    const sumB = await waitFor(b2, (m) => m.type === "call_summary", 5000, "summaryB");
    check(S, "summary reports it as unconfirmed", sumB.summary.tutorPlayback?.unconfirmed === 1 && sumB.summary.tutorPlayback?.complete === 0 && sumB.summary.tutorPlayback?.cancelled === 0, sumB.summary.tutorPlayback);
  },

  /** Deadline with a reply still pending and without audio. Seeded memory, no OpenAI call. */
  async deadline() {
    const S = "deadline";
    const userId = (uid += 1);
    const sid = `it-dl-${Date.now()}`;
    await seed(sid, userId, {
      maxMinutes: 0.1,
      memory: [
        { role: "assistant", content: "Hi! What is your name?", requestId: 1, playback: "complete" },
        { role: "user", content: "My name is Lan.", requestId: 2 },
        { role: "assistant", content: "Nice to meet you, Lan.", requestId: 2, playback: "pending" },
      ],
    });
    const token = tokenFor(userId, sid);
    const c = await connect(sid, token);
    const hello = await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    check(S, "hello restores all seeded turns", hello.transcript?.length === 3 && hello.currentRequestId === 2);
    const sum = await waitFor(c, (m) => m.type === "call_summary", 10000, "summary");
    const ended = await waitFor(c, (m) => m.type === "call_ended", 3000, "call_ended");
    const t2 = await assistant(sid, 2);
    check(S, "deadline ends with time_limit and a summary", ended.reason === "time_limit" && sum.reason === "time_limit");
    check(S, "duration clamped to the deadline", sum.summary.durationSeconds <= 6, sum.summary.durationSeconds);
    check(S, "reply never played -> cancelled, not pending", t2[0]?.playback === "cancelled" && sum.summary.tutorPlayback?.cancelled === 1 && sum.summary.tutorPlayback?.unconfirmed === 0, {
      stored: t2[0]?.playback,
      counts: sum.summary.tutorPlayback,
    });
    check(S, "no LLM job queued on resume or at deadline", (await jobsFor(llmQueue, sid)).length === 0);
    await waitClosed(c, 3000);
    const c2 = await connect(sid, token);
    await waitClosed(c2, 3000);
    check(S, "cannot reconnect after the deadline", !c2.msgs.some((m) => m.type === "hello"), c2.closed);
  },

  /** Greeting, name, “and you?”, then the next place question. Real Azure STT and the Learn workers. */
  async acceptance() {
    const S = "acceptance";
    const userId = (uid += 1);
    const sid = `it-accept-${Date.now()}`;
    await seed(sid, userId, { maxMinutes: 3 });
    const c = await connect(sid, tokenFor(userId, sid));
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    const greet = await tutorTurn(c, 1);
    const greetText = await sameText(S, c, 1);
    check(S, "greeting is one whole question", /[.!?]"?$/.test(greetText) && (greetText.match(/\?/g) || []).length === 1, greetText);
    check(S, "greeting does not end on a cut frame", !/\b(?:where do you|tell me your|who do you live)\??$/i.test(greetText), greetText);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 1, playbackId: 1 });

    send(c, { type: "recognition_start", requestId: 2 });
    send(c, { type: "recognition_start", requestId: 3 });
    await waitFor(c, (m) => m.type === "recognition_started" && m.requestId === 3, 10000, "rapid-start");
    const goodAudio = await clip("I'm good.");
    const goodFrames = Buffer.concat([Buffer.alloc(3200), goodAudio, Buffer.alloc(3200 * 6)]);
    for (let i = 0; i < goodFrames.length; i += 3200) {
      c.ws.send(goodFrames.subarray(i, i + 3200));
      await sleep(100);
    }
    send(c, { type: "recognition_end", requestId: 3 });
    const goodFinal = await waitFor(c, (m) => m.type === "final_transcript" && (m.requestId === 2 || m.requestId === 3), 15000, "rapid-final");
    check(S, "only the latest press produces a transcript", goodFinal.requestId === 3, goodFinal);
    check(S, "the replaced press does not get its own transcript", !c.msgs.some((m) => m.type === "final_transcript" && m.requestId === 2));
    check(S, "I'm good is heard as a greeting, not a name", /\bgood\b/i.test(goodFinal.text) && !/\bmy name is\b/i.test(goodFinal.text), goodFinal.text);
    const nameTurn = await tutorTurn(c, 3);
    const nameText = await sameText(S, c, 3);
    check(S, "after I'm good the tutor asks the name", /\bname\b/i.test(nameText) && (nameText.match(/\?/g) || []).length === 1, nameText);
    const nameHints = nameTurn.done.replyHints || [];
    check(S, "name hints match the name question", nameHints.length > 0 && nameHints.every((hint) => hint.facet === "name") && nameHints.every((hint) => !/\byears old\b|\b20\b/i.test(hint.en)), nameHints);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 3, playbackId: 3 });

    const back = await speak(c, 4, await clip("My name is Lan, and you?"));
    check(S, "name and reciprocal question are heard", /\blan\b/i.test(back.final.text) && /\byou\b/i.test(back.final.text), back.final.text);
    const backTurn = await tutorTurn(c, 4);
    const backText = await sameText(S, c, 4);
    check(S, "tutor answers and you, then asks one new question", /\b(?:i'm|i am) (?:beego|emma|james|mina)\b/i.test(backText) && !/\band you\?/i.test(backText) && !/\b\d{1,2}\s+years old\b/i.test(backText) && (backText.match(/\?/g) || []).length === 1, { heard: back.final.text, reply: backText });
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 4, playbackId: 4 });

    const age = await speak(c, 5, await clip("I am twenty."));
    check(S, "age answer is heard", /\b(?:twenty|20)\b/i.test(age.final.text), age.final.text);
    const homeTurn = await tutorTurn(c, 5);
    const homeText = await sameText(S, c, 5);
    check(S, "after age the tutor asks where they live", /\bwhere\b/i.test(homeText) && /\blive|from\b/i.test(homeText), homeText);
    const homeHints = homeTurn.done.replyHints || [];
    check(S, "hints follow the home question, not the age just given", homeHints.length > 0 && homeHints.every((hint) => hint.facet === "home") && homeHints.every((hint) => !/\b20\b|years old/i.test(hint.en)), homeHints);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 5, playbackId: 5 });

    const home = await speak(c, 6, await clip("I live in Hanoi."));
    check(S, "home answer is heard", /\bhanoi\b/i.test(home.final.text), home.final.text);
    const afterHome = await tutorTurn(c, 6);
    const afterText = await sameText(S, c, 6);
    check(S, "tutor does not ask the home question again", !/\bwhere do you live\b/i.test(afterText), afterText);
    check(S, "no second audio stream for the home reply", c.msgs.filter((m) => m.type === "tts_end" && m.requestId === 6 && m.kind !== "replay").length === 1);
    noSttError(S, c);
    send(c, { type: "end_call" });
    await waitFor(c, (m) => m.type === "call_ended", 5000, "call_ended");
  },

  /** Two nonsense utterances. If Azure keeps them unclear, the second reply must offer help. */
  async unclear() {
    const S = "unclear";
    const userId = (uid += 1);
    const sid = `it-unclear-${Date.now()}`;
    await seed(sid, userId, { maxMinutes: 2 });
    const c = await connect(sid, tokenFor(userId, sid));
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    await tutorTurn(c, 1);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 1, playbackId: 1 });
    const first = await speak(c, 2, await clip("xkqzz"));
    if (!String(first.final.text || "").trim()) {
      await sleep(1500);
      check(S, "unrecognized audio does not start a tutor turn", !c.msgs.some((m) => m.type === "ai_done" && m.requestId === 2));
      check(S, "empty transcript asks the learner to try again", c.msgs.some((m) => m.type === "listen_retry" && String(m.notice || "").includes("chưa nghe rõ")), c.msgs.filter((m) => m.type === "listen_retry"));
      console.log(JSON.stringify({ unclearHeard: [first.final.text], stillUnclear: false, note: "Azure returned an empty transcript" }));
      noSttError(S, c);
      send(c, { type: "end_call" });
      await waitFor(c, (m) => m.type === "call_ended", 5000, "call_ended");
      return;
    }
    const firstReply = await tutorTurn(c, 2);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 2, playbackId: 2 });
    const second = await speak(c, 3, await clip("xkqzz"));
    const secondReply = await tutorTurn(c, 3);
    await sameText(S, c, 3);
    const stillUnclear = learnCallTranscriptUnclear(first.final.text) && learnCallTranscriptUnclear(second.final.text);
    check(
      S,
      "a second unclear transcript gets help instead of the same repeat",
      !stillUnclear || !/^could you say that again\??$/i.test(secondReply.done.text.trim()),
      { first: first.final.text, second: second.final.text, reply: secondReply.done.text, stillUnclear }
    );
    console.log(JSON.stringify({ unclearHeard: [first.final.text, second.final.text], stillUnclear, reply: secondReply.done.text, firstReply: firstReply.done.text }));
    noSttError(S, c);
    send(c, { type: "end_call" });
    await waitFor(c, (m) => m.type === "call_ended", 5000, "call_ended");
  },

  /** Learn STT stays en-US so English answers are not forced into Vietnamese. */
  async englishStt() {
    const S = "englishStt";
    const userId = (uid += 1);
    const sid = `it-en-stt-${Date.now()}`;
    await seed(sid, userId, { maxMinutes: 2 });
    const c = await connect(sid, tokenFor(userId, sid));
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    await tutorTurn(c, 1);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 1, playbackId: 1 });
    const said = await speak(c, 2, await clip("I am twenty years old."));
    const heard = String(said.final.text || "");
    console.log(JSON.stringify({ englishHeard: heard }));
    check(
      S,
      "English speech is not transcribed as Vietnamese",
      heard.trim().length > 0 && !/[ăâđêôơưạảãẹẻẽịỉĩọỏõụủũỳỵỷỹ]/i.test(heard) && !/\bmột\b|\bmá\b|\bbây giờ\b/i.test(heard.toLowerCase()),
      heard,
    );
    noSttError(S, c);
    send(c, { type: "end_call" });
    await waitFor(c, (m) => m.type === "call_ended", 5000, "call_ended");
  },

  /** Vietnamese help via English STT phrase, not bilingual AutoDetect. */
  async vietnamese() {
    const S = "vietnamese";
    const userId = (uid += 1);
    const sid = `it-vi-${Date.now()}`;
    await seed(sid, userId, { maxMinutes: 2 });
    const c = await connect(sid, tokenFor(userId, sid));
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    await tutorTurn(c, 1);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 1, playbackId: 1 });
    const said = await speak(c, 2, await clip("Can you explain in Vietnamese please."));
    const heard = String(said.final.text || "");
    console.log(JSON.stringify({ vietnameseHeard: heard }));
    const vi = /vietnamese|tiếng việt|tieng viet|explain/i.test(heard);
    check(S, "Azure en-US STT keeps an English Vietnamese-help line", vi, heard);
    if (heard.trim()) {
      const reply = await tutorTurn(c, 2);
      await sameText(S, c, 2);
      check(S, "tutor explains in Vietnamese then asks in English", /[ăâđêôơưạảãẹẻẽịỉĩọỏõụủũỳỵỷỹấầẩẫậắằẳẵặếềểễệốồổỗộớờởỡợứừửữự]/i.test(reply.done.text) && reply.done.text.includes("?"), reply.done.text);
    }
    noSttError(S, c);
    send(c, { type: "end_call" });
    await waitFor(c, (m) => m.type === "call_ended", 5000, "call_ended");
  },

  /** The call deadline fires while recognition is still open. */
  async micopen() {
    const S = "micopen";
    const userId = (uid += 1);
    const sid = `it-mic-${Date.now()}`;
    await seed(sid, userId, { maxMinutes: 0.15 });
    const c = await connect(sid, tokenFor(userId, sid));
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    send(c, { type: "recognition_start", requestId: 2 });
    await waitFor(c, (m) => m.type === "recognition_started" && m.requestId === 2, 10000, "recognition_started");
    const ended = await waitFor(c, (m) => m.type === "call_ended", 20000, "call_ended");
    check(S, "deadline while the mic is open ends with time_limit", ended.reason === "time_limit", ended.reason);
    const users = (await memory(sid)).filter((item) => item.role === "user");
    check(S, "an open mic at the deadline does not store a learner turn", users.length === 0, users);
  },

  /** Near the deadline the tutor closes; the closing ack ends the call with lesson_complete. */
  async closing() {
    const S = "closing";
    const userId = (uid += 1);
    const sid = `it-close-${Date.now()}`;
    await seed(sid, userId, { maxMinutes: 0.55 });
    const token = tokenFor(userId, sid);
    const c = await connect(sid, token);
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    await tutorTurn(c, 1);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 1, playbackId: 1 });
    await speak(c, 2, await clip("My name is Lan. Nice to meet you."), { tailMs: 600 });
    const r = await tutorTurn(c, 2);
    check(S, "closing turn flagged and has no question", r.done.closing === true && !r.done.text.includes("?"), r.done.text);
    await sameText(S, c, 2);
    check(S, "stored closing flag", (await assistant(sid, 2))[0]?.closing === true);
    noSttError(S, c);
    send(c, { type: "playback_ack", kind: "turn", playback: "complete", requestId: 2, playbackId: 2 });
    const sum = await waitFor(c, (m) => m.type === "call_summary", 5000, "summary");
    const ended = await waitFor(c, (m) => m.type === "call_ended", 3000, "call_ended");
    check(S, "closing ack ends with lesson_complete", ended.reason === "lesson_complete" && sum.summary.closed === true && sum.summary.learnerTurns === 1);
    await waitClosed(c, 3000);
    const c2 = await connect(sid, token);
    await waitClosed(c2, 3000);
    check(S, "cannot reconnect after lesson_complete", !c2.msgs.some((m) => m.type === "hello"), c2.closed);

    const sid2 = `it-close-seed-${Date.now()}`;
    await seed(sid2, userId, {
      memory: [
        { role: "assistant", content: "Hi! What is your name?", requestId: 1, playback: "complete" },
        { role: "user", content: "Lan.", requestId: 2 },
        { role: "assistant", content: "Great job today. Goodbye!", requestId: 2, playback: "pending", closing: true },
      ],
    });
    const c3 = await connect(sid2, tokenFor(userId, sid2));
    const ended3 = await waitFor(c3, (m) => m.type === "call_ended", 5000, "call_ended seeded");
    check(S, "reconnect into a session that already has a closing ends it", ended3.reason === "lesson_complete");
  },

  /** Run only by name, with an LLM worker from before Learn support on the queue. */
  async outdated() {
    const S = "outdated";
    const userId = (uid += 1);
    const sid = `it-old-${Date.now()}`;
    await seed(sid, userId);
    const c = await connect(sid, tokenFor(userId, sid));
    await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    const ended = await waitFor(c, (m) => m.type === "call_ended", 30000, "call_ended");
    check(S, "reply from an old worker ends the call as worker_outdated", ended.reason === "worker_outdated", ended.reason);
    check(S, "no caption, no audio, no stored tutor turn, no TTS job", !c.msgs.some((m) => m.type === "ai_done" || m.type === "bin") && (await assistant(sid, 1)).length === 0 && (await ttsText(sid, 1)).count === 0);
    check(S, "summary still sent", c.msgs.some((m) => m.type === "call_summary"));
  },

  /** Old speaking page path on the same gateway and workers. */
  async legacy() {
    const S = "legacy";
    const userId = (uid += 1);
    const sid = `it-legacy-${Date.now()}`;
    const token = jwt.sign({ sub: String(userId), plan: "trial" }, env.VOICE_JWT_SECRET, { expiresIn: 120 });
    const c = await connect(sid, token);
    const hello = await waitFor(c, (m) => m.type === "hello", 5000, "hello");
    check(S, "hello without lesson or transcript", hello.lesson === null && !("transcript" in hello) && hello.callClock === null);
    await sleep(1500);
    check(S, "no automatic greeting", !c.msgs.some((m) => m.type === "ai_done"));
    send(c, { type: "client_final_transcript", requestId: 1, text: "Hello, how are you today?" });
    const done = await waitFor(c, (m) => m.type === "ai_done" && m.requestId === 1, 30000, "ai_done");
    const legacyEnd = await waitFor(c, (m) => m.type === "tts_end" && m.requestId === 1, 30000, "tts_end");
    await noAudioAfterEnd(S, c, 1, legacyEnd);
    check(S, "ai_stream tokens still forwarded", c.msgs.some((m) => m.type === "ai_stream" && m.requestId === 1));
    check(S, "TTS audio uses 0x02 frames", turnBytes(c, 1) > 0 && !c.msgs.some((m) => m.type === "bin" && m.kind === "replay"));
    const mem = await memory(sid);
    check(S, "memory keeps old {role, content} shape", mem.length === 2 && mem.every((m) => Object.keys(m).sort().join() === "content,role") && mem[1].content === done.text.trim(), mem);
    const job = (await jobsFor(llmQueue, sid))[0];
    check(S, "LLM job has no learn payload", Boolean(job) && !job.data.learn && !job.data.memory.some((m) => m.role === "system"));
    const usage = await redis.hgetall(`voice:usage:daily:${userId}:${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`);
    check(S, "shared usage still counted for old speaking", Number(usage.llm_tokens_in) > 0 && Number(usage.tts_bytes) > 0, usage);
    c.ws.close(1000, "client");
    await waitClosed(c, 3000);
  },
};

if ((await redis.get(learnAiCallGateKey())) !== "1") {
  console.error("Gate key is not open in the test Redis.");
  process.exit(2);
}

for (const [name, run] of Object.entries(scenarios)) {
  if (only.size ? !only.has(name) : name === "outdated") continue;
  const t = Date.now();
  try {
    await run();
  } catch (e) {
    check(name, "scenario completed", false, String(e?.message || e).slice(0, 600));
  }
  metrics[`${name}Ms`] = Date.now() - t;
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, metrics }, null, 1));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} [${r.scenario}] ${r.name}`);
await llmQueue.close();
await ttsQueue.close();
await redis.quit();
process.exit(failed.length ? 1 : 0);
