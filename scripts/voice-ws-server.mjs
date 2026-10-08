/**
 * Low-latency voice gateway: PCM16 16kHz uplink, streaming STT, debounced partial LLM,
 * streaming chat + OpenAI TTS PCM downlink (binary prefix 0x02).
 *
 * Run: npm run voice-ws  |  npm run voice-ws:dev
 *
 * Env: VOICE_WS_PORT, AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, OPENAI_API_KEY, OPENAI_CHAT_MODEL
 *
 * --- WebSocket event protocol (JSON unless noted) ---
 *
 * Client → Server:
 *   { "type": "recognition_start", "requestId": 123 }
 *   { "type": "recognition_end", "requestId": 123 }
 *   { "type": "interrupt", "requestId": 123, "reason": "barge_in" | "client" }
 *   Binary: raw pcm_s16le mono 16000 Hz (uplink mic)
 *
 * Server → Client:
 *   { "type": "hello", "useAzure", "pcmHz", "channels", "encoding", "hasOpenAi" }
 *   { "type": "recognition_started", "requestId": 123 }
 *   { "type": "partial_transcript", "requestId": 123, "text": "..." }
 *   { "type": "final_transcript", "requestId": 123, "text": "..." }
 *   { "type": "ai_stream", "requestId": 123, "token": "...", "speculative": true|false }
 *   { "type": "ai_speculative_done", "requestId": 123 }
 *   { "type": "ai_done", "requestId": 123, "text": "full assistant reply" }
 *   { "type": "interrupt", "requestId": 123, "reason": "..." }
 *   { "type": "interrupt_ack", "requestId": 123, "reason": "..." }
 *   { "type": "tts_end", "requestId": 123 }
 *   { "type": "error", "requestId": 123, "message": "..." }
 *   Binary downlink: 0x02 + uint32le requestId + pcm_s16le mono 24000 Hz (OpenAI TTS pcm chunks)
 *
 * Example (browser):
 *   ws.send(JSON.stringify({ type: "recognition_start" }));
 *   ws.send(pcmUint8Array);
 *   ws.send(JSON.stringify({ type: "recognition_end" }));
 */

import { createRequire } from "node:module";
import { WebSocketServer } from "ws";

const require = createRequire(import.meta.url);
const sdk = require("microsoft-cognitiveservices-speech-sdk");

const PORT = Number(process.env.VOICE_WS_PORT || 3031);
const AZURE_KEY = String(process.env.AZURE_SPEECH_KEY || "").trim();
const AZURE_REGION = String(process.env.AZURE_SPEECH_REGION || "").trim();
const USE_AZURE = Boolean(AZURE_KEY && AZURE_REGION);
const OPENAI_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini").trim();
const PARTIAL_DEBOUNCE_MS_RAW = Number(process.env.VOICE_PARTIAL_DEBOUNCE_MS || 160);
const PARTIAL_DEBOUNCE_MS = Math.max(120, Math.min(200, Number.isFinite(PARTIAL_DEBOUNCE_MS_RAW) ? PARTIAL_DEBOUNCE_MS_RAW : 160));

function nowMs() {
  return Date.now();
}

function safeSend(ws, obj) {
  if (ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(obj));
    } catch (_e) {}
  }
}

function abortAi(ws) {
  try {
    ws.aiAbort?.abort();
  } catch (_e) {}
  ws.aiAbort = null;
  try {
    ws.ttsAbort?.abort();
  } catch (_e2) {}
  ws.ttsAbort = null;
}

function initVoice(ws) {
  if (!ws.voice) {
    ws.voice = {
      memory: [],
      debounce: null,
      lastPartial: "",
      lastSpecText: "",
      lastSpecAt: 0,
      metrics: Object.create(null),
    };
  }
}

function normalizeRequestId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function currentRequestId(ws) {
  return typeof ws.currentRequestId === "number" ? ws.currentRequestId : 0;
}

function isCurrent(ws, requestId) {
  return requestId && requestId === currentRequestId(ws);
}

function sendForRequest(ws, requestId, obj) {
  // Always attach requestId for correlation; client may ignore stale.
  safeSend(ws, { requestId, ...obj });
}

function metricOnce(ws, requestId, key, extra = {}) {
  initVoice(ws);
  const rid = normalizeRequestId(requestId);
  if (!rid) return;
  const mk = `${rid}:${key}`;
  if (ws.voice.metrics[mk]) return;
  ws.voice.metrics[mk] = true;
  sendForRequest(ws, rid, { type: "metrics", key, at: nowMs(), ...extra });
}

function toArrayBuffer(buf) {
  if (buf instanceof ArrayBuffer) return buf;
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
}

function disposeSession(ws) {
  initVoice(ws);
  clearTimeout(ws.voice.debounce);
  ws.voice.debounce = null;
  const s = ws.session;
  if (!s) return;
  s.accepting = false;
  s.preRoll = [];
  s.preRollBytes = 0;
  if (s.recognizer) {
    try {
      s.recognizer.stopContinuousRecognitionAsync(
        () => {
          try {
            s.recognizer.close();
          } catch (_e) {}
        },
        () => {
          try {
            s.recognizer.close();
          } catch (_e2) {}
        }
      );
    } catch (_e) {
      try {
        s.recognizer.close();
      } catch (_e2) {}
    }
  }
  try {
    s.pushStream?.close?.();
  } catch (_e) {}
  ws.session = null;
}

function flushPreRoll(ws) {
  const s = ws.session;
  if (!s?.pushStream || !s.preRoll?.length) return;
  for (const chunk of s.preRoll) {
    try {
      s.pushStream.write(toArrayBuffer(chunk));
    } catch (_e) {}
  }
  s.preRoll = [];
  s.preRollBytes = 0;
}

function appendPreRoll(ws, data) {
  const s = ws.session;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const max = 2_000_000;
  if (!s.preRoll) s.preRoll = [];
  if (s.preRollBytes + buf.length > max) {
    safeSend(ws, { type: "error", message: "Audio buffer overflow; send recognition_end sooner." });
    return;
  }
  s.preRoll.push(buf);
  s.preRollBytes += buf.length;
}

function handleBinary(ws, data) {
  const s = ws.session;
  if (!s?.active) return;
  if (s.mode === "demo") {
    s.demoBytes += Buffer.isBuffer(data) ? data.length : data.byteLength;
    return;
  }
  if (s.accepting && s.pushStream) {
    try {
      s.pushStream.write(toArrayBuffer(data));
    } catch (_e) {
      safeSend(ws, { type: "error", message: "pushStream.write failed." });
    }
    return;
  }
  appendPreRoll(ws, data);
}

async function streamOpenAIChat({ messages, onToken, signal }) {
  if (!OPENAI_KEY) return;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      stream: true,
      messages,
      max_tokens: 512,
    }),
    signal,
  });
  if (!res.ok || !res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let carry = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (signal.aborted) return;
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const lines = carry.split("\n");
    carry = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) onToken(delta);
      } catch (_e) {}
    }
  }
}

function sendTtsBinaryChunk(ws, requestId, chunkU8) {
  if (ws.readyState !== 1) return;
  const rid = normalizeRequestId(requestId);
  const out = new Uint8Array(1 + 4 + chunkU8.length);
  out[0] = 0x02;
  out[1] = rid & 0xff;
  out[2] = (rid >>> 8) & 0xff;
  out[3] = (rid >>> 16) & 0xff;
  out[4] = (rid >>> 24) & 0xff;
  out.set(chunkU8, 5);
  ws.send(out);
}

async function streamOpenAITts({ text, ws, requestId, signal }) {
  if (!OPENAI_KEY || !text?.trim()) return;
  const body = {
    model: "tts-1",
    input: String(text).slice(0, 4096),
    voice: "alloy",
    response_format: "pcm",
    stream: true,
  };
  let res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, stream: undefined }),
      signal,
    });
  }
  if (!res.ok) return;
  if (!res.body) {
    const ab = await res.arrayBuffer();
    if (signal.aborted) return;
    const u8 = new Uint8Array(ab);
    const first = 2048;
    const later = 8192;
    for (let i = 0; i < u8.length; ) {
      if (signal.aborted) break;
      const chunkSize = i === 0 ? first : later;
      const slice = u8.subarray(i, Math.min(i + chunkSize, u8.length));
      sendTtsBinaryChunk(ws, requestId, slice);
      if (i === 0) metricOnce(ws, requestId, "tts_first_chunk");
      i += chunkSize;
    }
    return;
  }
  const reader = res.body.getReader();
  let firstSent = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (signal.aborted) break;
    if (done) break;
    if (!value?.length) continue;
    // Optimize chunking: send small first chunk then larger.
    const u8 = value;
    if (!firstSent && u8.length > 2048) {
      sendTtsBinaryChunk(ws, requestId, u8.subarray(0, 2048));
      metricOnce(ws, requestId, "tts_first_chunk");
      sendTtsBinaryChunk(ws, requestId, u8.subarray(2048));
      firstSent = true;
      continue;
    }
    sendTtsBinaryChunk(ws, requestId, u8);
    if (!firstSent) {
      metricOnce(ws, requestId, "tts_first_chunk");
      firstSent = true;
    }
  }
}

async function runSpeculativeLlm(ws, requestId, partialText) {
  if (!OPENAI_KEY) return;
  const t = String(partialText || "").trim();
  if (t.length < 4) return;
  if (!isCurrent(ws, requestId)) return;
  abortAi(ws);
  sendForRequest(ws, requestId, { type: "interrupt", reason: "new_partial" });
  const ac = new AbortController();
  ws.aiAbort = ac;
  const messages = [
    {
      role: "system",
      content:
        "You are a concise English tutor. The learner may still be speaking—reply in at most 2 short sentences; do not repeat their words verbatim if they might change.",
    },
    ...ws.voice.memory.slice(-8),
    { role: "user", content: t },
  ];
  try {
    await streamOpenAIChat({
      messages,
      signal: ac.signal,
      onToken: (tok) => {
        if (!isCurrent(ws, requestId) || ac.signal.aborted) return;
        metricOnce(ws, requestId, "llm_first_token_spec", { speculative: true });
        sendForRequest(ws, requestId, { type: "ai_stream", token: tok, speculative: true });
      },
    });
    if (isCurrent(ws, requestId)) sendForRequest(ws, requestId, { type: "ai_speculative_done" });
  } catch (_e) {
    if (!ac.signal.aborted && isCurrent(ws, requestId)) {
      sendForRequest(ws, requestId, { type: "ai_speculative_done" });
    }
  }
}

async function runFinalPipeline(ws, requestId, userText) {
  const final = String(userText || "").trim();
  if (!final) return;
  if (!isCurrent(ws, requestId)) return;
  abortAi(ws);
  clearTimeout(ws.voice.debounce);
  ws.voice.debounce = null;
  sendForRequest(ws, requestId, { type: "interrupt", reason: "final_cycle" });

  if (!OPENAI_KEY) {
    sendForRequest(ws, requestId, {
      type: "ai_done",
      text: "Set OPENAI_API_KEY on the voice server for streaming tutor replies and TTS.",
    });
    sendForRequest(ws, requestId, { type: "tts_end" });
    return;
  }

  const ac = new AbortController();
  ws.aiAbort = ac;
  const messages = [
    {
      role: "system",
      content:
        "You are a friendly English tutor. Keep answers under 5 short sentences. Correct small mistakes gently and ask one follow-up when natural.",
    },
    ...ws.voice.memory,
    { role: "user", content: final },
  ];
  let acc = "";
  try {
    await streamOpenAIChat({
      messages,
      signal: ac.signal,
      onToken: (tok) => {
        if (!isCurrent(ws, requestId) || ac.signal.aborted) return;
        acc += tok;
        metricOnce(ws, requestId, "llm_first_token", { speculative: false });
        sendForRequest(ws, requestId, { type: "ai_stream", token: tok, speculative: false });
      },
    });
  } catch (_e) {
    if (!acc) acc = "Sorry, I could not complete that reply.";
  }

  if (!isCurrent(ws, requestId)) return;
  ws.voice.memory.push({ role: "user", content: final });
  ws.voice.memory.push({ role: "assistant", content: acc });
  while (ws.voice.memory.length > 20) ws.voice.memory.splice(0, ws.voice.memory.length - 20);

  sendForRequest(ws, requestId, { type: "ai_done", text: acc });

  const ttsAc = new AbortController();
  ws.ttsAbort = ttsAc;
  try {
    await streamOpenAITts({ text: acc, ws, requestId, signal: ttsAc.signal });
  } catch (_e) {}
  if (isCurrent(ws, requestId)) sendForRequest(ws, requestId, { type: "tts_end" });
}

function startDemoSession(ws) {
  disposeSession(ws);
  abortAi(ws);
  const session = {
    active: true,
    accepting: true,
    mode: "demo",
    demoBytes: 0,
    pushStream: null,
    recognizer: null,
    preRoll: [],
    preRollBytes: 0,
  };
  ws.session = session;
  const requestId = currentRequestId(ws);
  sendForRequest(ws, requestId, { type: "recognition_started" });
  sendForRequest(ws, requestId, {
    type: "partial_transcript",
    text: "(demo) Send mic PCM, then release — add Azure + OpenAI keys for full quality.",
  });
}

function startAzureSession(ws) {
  disposeSession(ws);
  abortAi(ws);
  const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(format);
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_KEY, AZURE_REGION);
  speechConfig.speechRecognitionLanguage = "en-US";
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

  const session = {
    active: true,
    accepting: false,
    mode: "azure",
    pushStream,
    recognizer,
    preRoll: [],
    preRollBytes: 0,
  };
  ws.session = session;
  const requestId = currentRequestId(ws);

  recognizer.recognizing = (_s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizingSpeech) {
      const text = e.result.text || "";
      if (text) {
        if (!isCurrent(ws, requestId)) return;
        sendForRequest(ws, requestId, { type: "partial_transcript", text });
        metricOnce(ws, requestId, "stt_first_partial");
        initVoice(ws);
        ws.voice.lastPartial = text;
        clearTimeout(ws.voice.debounce);
        ws.voice.debounce = setTimeout(() => {
          ws.voice.debounce = null;
          const t2 = String(ws.voice.lastPartial || "").trim();
          const now = nowMs();
          const changed = t2 !== ws.voice.lastSpecText;
          const enoughGap = now - (ws.voice.lastSpecAt || 0) >= 240;
          if (t2.length >= 4 && changed && enoughGap && isCurrent(ws, requestId)) {
            ws.voice.lastSpecText = t2;
            ws.voice.lastSpecAt = now;
            void runSpeculativeLlm(ws, requestId, t2);
          }
        }, PARTIAL_DEBOUNCE_MS);
      }
    }
  };

  recognizer.recognized = (_s, e) => {
    if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
      const text = e.result.text || "";
      if (!isCurrent(ws, requestId)) return;
      sendForRequest(ws, requestId, { type: "final_transcript", text });
      metricOnce(ws, requestId, "stt_final");
      clearTimeout(ws.voice.debounce);
      ws.voice.debounce = null;
      if (text.trim()) void runFinalPipeline(ws, requestId, text.trim());
    }
  };

  recognizer.canceled = (_s, e) => {
    const details = e.errorDetails || "recognition canceled";
    safeSend(ws, { type: "error", message: details });
  };

  recognizer.sessionStopped = () => {
    safeSend(ws, { type: "session_stopped" });
  };

  recognizer.startContinuousRecognitionAsync(
    () => {
      session.accepting = true;
      flushPreRoll(ws);
      if (isCurrent(ws, requestId)) sendForRequest(ws, requestId, { type: "recognition_started" });
    },
    (err) => {
      if (isCurrent(ws, requestId)) {
        sendForRequest(ws, requestId, { type: "error", message: err?.message || String(err) });
      }
      disposeSession(ws);
    }
  );
}

function handleRecognitionStart(ws, requestId) {
  initVoice(ws);
  abortAi(ws);
  ws.currentRequestId = requestId;
  ws.voice.lastSpecText = "";
  ws.voice.lastSpecAt = 0;
  metricOnce(ws, requestId, "client_listen_start");
  sendForRequest(ws, requestId, { type: "interrupt", reason: "recognition_start" });
  if (USE_AZURE) {
    startAzureSession(ws);
  } else {
    startDemoSession(ws);
  }
}

function handleRecognitionEnd(ws, requestId) {
  const s = ws.session;
  if (!s?.active) {
    sendForRequest(ws, requestId, { type: "final_transcript", text: "" });
    return;
  }
  s.accepting = false;

  if (s.mode === "demo") {
    const seconds = (s.demoBytes / 2) / 16000;
    sendForRequest(ws, requestId, {
      type: "partial_transcript",
      text: `(demo) ~${seconds.toFixed(1)}s audio captured`,
    });
    const finalText =
      seconds < 0.12
        ? ""
        : `(Demo) Configure AZURE_SPEECH_KEY + AZURE_SPEECH_REGION for live STT; OPENAI_API_KEY for LLM+TTS. ~${seconds.toFixed(
            1
          )}s audio.`;
    sendForRequest(ws, requestId, { type: "final_transcript", text: finalText });
    if (finalText.trim()) void runFinalPipeline(ws, requestId, finalText.trim());
    disposeSession(ws);
    return;
  }

  try {
    s.pushStream?.close?.();
  } catch (_e) {}

  s.recognizer?.stopContinuousRecognitionAsync(
    () => {
      try {
        s.recognizer?.close();
      } catch (_e) {}
      ws.session = null;
      safeSend(ws, { type: "session_stopped" });
    },
    () => {
      try {
        s.recognizer?.close();
      } catch (_e) {}
      ws.session = null;
      safeSend(ws, { type: "session_stopped" });
    }
  );
}

const wss = new WebSocketServer({ port: PORT, host: "0.0.0.0" });

wss.on("connection", (ws) => {
  initVoice(ws);
  ws.currentRequestId = 0;
  safeSend(ws, {
    type: "hello",
    useAzure: USE_AZURE,
    pcmHz: 16000,
    channels: 1,
    encoding: "pcm_s16le",
    hasOpenAi: Boolean(OPENAI_KEY),
  });

  ws.on("message", (data, isBinary) => {
    if (isBinary) {
      handleBinary(ws, data);
      return;
    }
    let msg;
    try {
      msg = JSON.parse(String(data));
    } catch (_e) {
      return;
    }
    const t = msg?.type;
    if (t === "interrupt") {
      const requestId = normalizeRequestId(msg?.requestId) || currentRequestId(ws);
      abortAi(ws);
      sendForRequest(ws, requestId, { type: "interrupt_ack", reason: String(msg.reason || "client") });
      return;
    }
    if (t === "client_partial_transcript") {
      const requestId = normalizeRequestId(msg?.requestId);
      const text = String(msg?.text || "");
      if (!requestId) return;
      // Browser STT skips recognition_start — adopt requestId from client.
      ws.currentRequestId = requestId;
      initVoice(ws);
      if (text) {
        sendForRequest(ws, requestId, { type: "partial_transcript", text });
        initVoice(ws);
        ws.voice.lastPartial = text;
        clearTimeout(ws.voice.debounce);
        ws.voice.debounce = setTimeout(() => {
          ws.voice.debounce = null;
          const t2 = String(ws.voice.lastPartial || "").trim();
          const now = nowMs();
          const changed = t2 !== ws.voice.lastSpecText;
          const enoughGap = now - (ws.voice.lastSpecAt || 0) >= 240;
          if (t2.length >= 4 && changed && enoughGap && isCurrent(ws, requestId)) {
            ws.voice.lastSpecText = t2;
            ws.voice.lastSpecAt = now;
            void runSpeculativeLlm(ws, requestId, t2);
          }
        }, PARTIAL_DEBOUNCE_MS);
      }
      return;
    }
    if (t === "client_final_transcript") {
      const requestId = normalizeRequestId(msg?.requestId);
      if (!requestId) return;
      ws.currentRequestId = requestId;
      initVoice(ws);
      const text = String(msg?.text || "").trim();
      sendForRequest(ws, requestId, { type: "final_transcript", text });
      clearTimeout(ws.voice?.debounce);
      if (text) void runFinalPipeline(ws, requestId, text);
      return;
    }
    if (t === "recognition_start") {
      const requestId = normalizeRequestId(msg?.requestId);
      if (!requestId) {
        safeSend(ws, { type: "error", message: "requestId is required for recognition_start" });
        return;
      }
      handleRecognitionStart(ws, requestId);
      return;
    }
    if (t === "recognition_end") {
      const requestId = normalizeRequestId(msg?.requestId) || currentRequestId(ws);
      handleRecognitionEnd(ws, requestId);
      return;
    }
  });

  ws.on("close", () => {
    abortAi(ws);
    disposeSession(ws);
  });
});

wss.on("listening", () => {
  // eslint-disable-next-line no-console
  console.log(
    `[voice-ws] ws://0.0.0.0:${PORT} | Azure STT=${USE_AZURE ? "on" : "off"} | OpenAI=${OPENAI_KEY ? "on" : "off"}`
  );
});
