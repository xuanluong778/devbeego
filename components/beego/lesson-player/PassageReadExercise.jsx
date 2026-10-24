"use client";

import { useEffect, useRef, useState } from "react";
import { playLessonTts, stopLessonTts } from "@/lib/beego/learn/adapters/lesson-tts";
import { alignAzureWords, errorLabelVi } from "@/lib/beego/learn/passage-word-marks";

const MAX_MS = 30_000;
const TARGET_RATE = 16000;

function encodeWav(samples) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function downsample(input, inRate, outRate) {
  if (outRate === inRate) return input;
  const ratio = inRate / outRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j += 1) {
      sum += input[j];
      count += 1;
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function sentenceTokens(row) {
  if (Array.isArray(row?.tokens) && row.tokens.length) return row.tokens;
  return String(row?.text || "")
    .split(/(\s+)/)
    .filter((part) => part.length)
    .map((text) => ({ text, ipa: "" }));
}

export default function PassageReadExercise({ exercise, lessonId, onAnswerChange, feedback }) {
  const sentences = Array.isArray(exercise?.extensions?.passageSentences)
    ? exercise.extensions.passageSentences
    : [];
  const [showVi, setShowVi] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [elapsed, setElapsed] = useState(0);
  const [micLabel, setMicLabel] = useState("Micro chưa bật");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [picked, setPicked] = useState(null);
  const recRef = useRef(null);
  const startedRef = useRef(0);
  const tickRef = useRef(0);
  const phaseRef = useRef("idle");
  const scoreLock = useRef(false);
  const attemptKeyRef = useRef("");
  const wavRef = useRef(null);
  const scoreGen = useRef(0);
  const playGen = useRef(0);

  const setPhaseBoth = (next) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => () => {
    playGen.current += 1;
    stopLessonTts();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    recRef.current?.cancel?.();
    clearInterval(tickRef.current);
  }, [blobUrl]);

  const play = async (rate) => {
    const token = ++playGen.current;
    stopLessonTts();
    for (const row of sentences) {
      if (token !== playGen.current || phaseRef.current === "recording") return;
      await playLessonTts({ text: row.text, lang: "en-US", rate });
    }
  };

  const submitScore = async (wav) => {
    if (!wav || scoreLock.current || feedback) return;
    scoreLock.current = true;
    const gen = scoreGen.current;
    setPhaseBoth("scoring");
    setError("");
    setMicLabel("Đang chấm phát âm…");
    if (!attemptKeyRef.current) {
      attemptKeyRef.current = (crypto.randomUUID?.() || `p${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    }
    try {
      const body = new FormData();
      body.set("lessonId", lessonId);
      body.set("questionId", exercise.id);
      body.set("attemptKey", attemptKeyRef.current);
      body.set("audio", wav, "passage.wav");
      const res = await fetch("/api/learn/passage-score", { method: "POST", body, credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (gen !== scoreGen.current) return;
      if (!res.ok || !json?.success) {
        setPhaseBoth("score-error");
        setError(json?.message || "Không chấm được. Bản ghi vẫn còn, hãy gửi lại.");
        return;
      }
      setResult(json.data);
      setPhaseBoth("result");
      setMicLabel("Đã chấm");
      onAnswerChange?.({
        submitted: true,
        passed: Boolean(json.data?.passed),
        score: json.data?.pronunciationScore,
        passageAttemptId: json.data?.attemptKey,
        softPass: true,
        feedbackVi: json.data?.feedbackVi || "",
      });
    } catch {
      if (gen !== scoreGen.current) return;
      setPhaseBoth("score-error");
      setError("Lỗi mạng khi gửi audio. Bản ghi vẫn còn, hãy gửi lại.");
    } finally {
      scoreLock.current = false;
    }
  };

  const stopRecording = async (reason) => {
    const rec = recRef.current;
    if (!rec || phaseRef.current !== "recording") return;
    clearInterval(tickRef.current);
    recRef.current = null;
    phaseRef.current = "stopping";
    const captured = await rec.stop();
    setMicLabel("Micro đã tắt");
    if (reason === "interrupt") {
      setError("Ghi âm bị gián đoạn. Hãy ghi lại.");
      setPhaseBoth("idle");
      return;
    }
    if (!captured || captured.peak < 0.02 || captured.samples.length < TARGET_RATE / 2) {
      setError("Không nghe thấy giọng nói. Hãy đọc gần micro rồi ghi lại.");
      setPhaseBoth("idle");
      return;
    }
    const wav = encodeWav(captured.samples);
    wavRef.current = wav;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(URL.createObjectURL(wav));
    setError("");
    await submitScore(wav);
  };

  const startRecording = async () => {
    if (feedback || phaseRef.current === "scoring" || phaseRef.current === "arming") return;
    scoreGen.current += 1;
    scoreLock.current = false;
    attemptKeyRef.current = "";
    wavRef.current = null;
    setError("");
    setResult(null);
    setPicked(null);
    playGen.current += 1;
    stopLessonTts();
    onAnswerChange?.(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không cho ghi âm.");
      return;
    }
    setPhaseBoth("arming");
    setMicLabel("Đang xin quyền micro…");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      setPhaseBoth("idle");
      setMicLabel("Micro bị từ chối");
      setError(err?.name === "NotAllowedError" ? "Bạn chưa cho phép micro." : "Không mở được micro.");
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    let peak = 0;
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const down = downsample(input, ctx.sampleRate, TARGET_RATE);
      chunks.push(down);
      for (let i = 0; i < input.length; i += 8) peak = Math.max(peak, Math.abs(input[i]));
    };
    source.connect(processor);
    processor.connect(ctx.destination);
    startedRef.current = Date.now();
    setElapsed(0);
    setPhaseBoth("recording");
    setMicLabel("Đang ghi");
    recRef.current = {
      cancel() {
        try { processor.disconnect(); source.disconnect(); stream.getTracks().forEach((t) => t.stop()); ctx.close(); } catch { /* ignore */ }
      },
      stop() {
        this.cancel();
        const length = chunks.reduce((n, c) => n + c.length, 0);
        const samples = new Float32Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          samples.set(chunk, offset);
          offset += chunk.length;
        }
        return { samples, peak };
      },
    };
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedRef.current;
      setElapsed(ms);
      if (ms >= MAX_MS) void stopRecording("limit");
    }, 250);
  };

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && phaseRef.current === "recording") void stopRecording("interrupt");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const flatTokens = sentences.flatMap((row, sentenceIndex) =>
    sentenceTokens(row).map((token, tokenIndex) => ({ ...token, sentenceIndex, tokenIndex }))
  );
  const marks = result?.words ? alignAzureWords(flatTokens, result.words) : null;
  let flatCursor = 0;

  return (
    <div className="beego-passage">
      <div className="beego-passage__toolbar">
        <button type="button" onClick={() => play(1)} disabled={phase === "recording" || phase === "scoring"}>Nghe mẫu</button>
        <button type="button" onClick={() => play(0.75)} disabled={phase === "recording" || phase === "scoring"}>Nghe chậm</button>
        <button type="button" onClick={() => setShowVi((v) => !v)} aria-pressed={showVi}>
          {showVi ? "Ẩn nghĩa" : "Hiện nghĩa"}
        </button>
      </div>
      <p className="beego-passage__accent">Phiên âm Anh–Mỹ (CMU). Nghe mẫu cùng giọng en-US.</p>
      <div className="beego-passage__text">
        {sentences.map((row, sentenceIndex) => {
          const tokens = sentenceTokens(row);
          return (
            <div className="beego-passage__sentence" key={`${row.text}-${sentenceIndex}`}>
              <p className="beego-passage__en" lang="en">
                {tokens.map((token, tokenIndex) => {
                  const mark = marks ? marks[flatCursor] : null;
                  const mine = flatCursor;
                  flatCursor += 1;
                  if (/^\s+$/.test(token.text) || !/[A-Za-z]/.test(token.text)) {
                    return <span key={`${sentenceIndex}-${tokenIndex}`}>{token.text}</span>;
                  }
                  const bad = mark?.status === "bad";
                  return (
                    <span key={`${sentenceIndex}-${tokenIndex}`}>
                      {tokenIndex > 0 ? " " : null}
                      <button
                        type="button"
                        className={bad ? "beego-passage__word beego-passage__word--bad" : "beego-passage__word"}
                        onClick={() => setPicked({ token, mark, index: mine })}
                      >
                        {token.text}
                      </button>
                    </span>
                  );
                })}
              </p>
              {row.ipa ? <p className="beego-passage__ipa" lang="en-fonipa">{row.ipa}</p> : null}
              {showVi && row.vi ? <p className="beego-passage__vi">{row.vi}</p> : null}
            </div>
          );
        })}
      </div>
      {picked ? (
        <div className="beego-passage__hint">
          <p><strong>{picked.token.text}</strong>{picked.token.ipa ? ` · ${picked.token.ipa}` : ""}</p>
          {picked.mark?.status === "bad" || picked.mark?.status === "ok" ? (
            <>
              <p>{errorLabelVi(picked.mark.error)}</p>
              {picked.mark.accuracy != null ? <p>Độ khớp từ (Azure): {picked.mark.accuracy}/100</p> : null}
              {Array.isArray(picked.mark.phonemes) && picked.mark.phonemes.length ? (
                <p>
                  Âm Azure: {picked.mark.phonemes.map((phone) => (
                    phone.accuracy == null ? phone.phoneme : `${phone.phoneme} ${phone.accuracy}`
                  )).join(" · ")}
                </p>
              ) : null}
            </>
          ) : (
            <p>Chưa có kết quả chấm cho từ này. IPA trên là phiên âm từ điển, chưa phải lỗi.</p>
          )}
          <p>Nghe mẫu chậm, rồi đọc riêng từ này trước khi đọc lại cả đoạn.</p>
        </div>
      ) : null}
      <p className="beego-passage__note">Nghỉ lấy hơi vẫn đang ghi. Bấm Dừng khi đọc xong.</p>
      <p className="beego-passage__meta">
        {micLabel} · {formatTime(elapsed)} / 00:30
      </p>
      <div className="beego-passage__actions">
        {phase !== "recording" ? (
          <button type="button" className="beego-passage__rec" onClick={startRecording} disabled={!!feedback || phase === "scoring" || phase === "arming"}>
            {phase === "result" || phase === "score-error" ? "Ghi lại" : "Ghi âm"}
          </button>
        ) : (
          <button type="button" className="beego-passage__stop" onClick={() => stopRecording("user")}>Dừng</button>
        )}
        <button type="button" onClick={() => blobUrl && new Audio(blobUrl).play()} disabled={!blobUrl || phase === "recording"}>Nghe lại</button>
        {phase === "score-error" ? (
          <button type="button" onClick={() => wavRef.current && submitScore(wavRef.current)} disabled={phase === "scoring"}>
            Gửi lại bản ghi
          </button>
        ) : null}
        {phase === "scoring" ? <span className="beego-passage__scoring">Đang chấm…</span> : null}
      </div>
      {error ? <p className="beego-passage__error">{error}</p> : null}
      {result ? (
        <div className="beego-passage__result">
          <p>Điểm tổng (Azure): <strong>{result.pronunciationScore}/100</strong> {result.passed ? "— đạt" : "— chưa đạt 60"}</p>
          <ul>
            {result.accuracyScore != null ? <li>Phát âm: {result.accuracyScore}</li> : null}
            {result.fluencyScore != null ? <li>Trôi chảy: {result.fluencyScore}</li> : null}
            {result.completenessScore != null ? <li>Đọc đầy đủ: {result.completenessScore}</li> : null}
            {result.prosodyScore != null ? <li>Ngữ điệu: {result.prosodyScore}</li> : null}
          </ul>
          {result.feedbackVi ? <p>{result.feedbackVi}</p> : null}
          {result.summary ? (
            <p>Lần thử: {result.summary.attempts} · Gần nhất: {result.summary.latest ?? "—"} · Tốt nhất: {result.summary.best ?? "—"}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
