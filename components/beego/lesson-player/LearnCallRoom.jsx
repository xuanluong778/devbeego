"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceWebSocket } from "@/hooks/useVoiceWebSocket";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useStreamingTtsPlayer } from "@/hooks/useStreamingTtsPlayer";

export default function LearnCallRoom({ token, sessionId, wsUrl, offer, hints = [], onClose }) {
  const { readyState, lastError, connect, disconnect, sendJson, sendBinary, setOnJsonMessage, setOnBinaryMessage } = useVoiceWebSocket("");
  const player = useStreamingTtsPlayer({ inputSampleRate: 24000 });
  const [phase, setPhase] = useState("connecting");
  const [caption, setCaption] = useState("");
  const [heard, setHeard] = useState("");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState(null);
  const [packageLeft, setPackageLeft] = useState(offer?.limits?.packageRemainingMs);
  const requestRef = useRef(0);
  const dropAudioRef = useRef(false);
  const closedRef = useRef(false);
  const azureRef = useRef(false);
  const listeningRef = useRef(false);
  const ttsPlayingRef = useRef(false);
  const bargeAtRef = useRef(0);
  const playerRef = useRef(player);
  const sendJsonRef = useRef(sendJson);
  const sendBinaryRef = useRef(sendBinary);
  playerRef.current = player;
  sendJsonRef.current = sendJson;
  sendBinaryRef.current = sendBinary;

  const beginListen = useCallback((reason) => {
    if (closedRef.current || !azureRef.current) return;
    const previous = requestRef.current || 1;
    const rid = previous + 1;
    requestRef.current = rid;
    listeningRef.current = true;
    ttsPlayingRef.current = false;
    dropAudioRef.current = false;
    playerRef.current.interrupt();
    sendJsonRef.current({ type: "interrupt", requestId: previous, reason });
    sendJsonRef.current({ type: "recognition_start", requestId: rid });
    setPhase("listening");
    setNotice("");
  }, []);

  const onPcmChunk = useCallback(
    (pcm, { rms }) => {
      if (closedRef.current || !azureRef.current) return;
      if (ttsPlayingRef.current && rms > 0.045 && Date.now() - bargeAtRef.current > 800) {
        bargeAtRef.current = Date.now();
        beginListen("barge_in_rms");
        return;
      }
      if (listeningRef.current) sendBinaryRef.current(pcm);
    },
    [beginListen]
  );

  const { ensureStream, startPcmCapture, stopMic, micError, setMicError } = useVoiceRecorder({ onPcmChunk });

  const releaseMedia = useCallback(() => {
    listeningRef.current = false;
    ttsPlayingRef.current = false;
    playerRef.current.interrupt();
    playerRef.current.close();
  }, []);

  const finish = useCallback(
    (nextPhase, nextNotice) => {
      if (closedRef.current) return;
      closedRef.current = true;
      releaseMedia();
      stopMic();
      disconnect();
      setPhase(nextPhase);
      if (nextNotice) setNotice(nextNotice);
    },
    [disconnect, releaseMedia, stopMic]
  );

  const requestMic = useCallback(async () => {
    setMicError("");
    try {
      await ensureStream();
      await startPcmCapture();
      setPhase("listening");
      setNotice("Micro đã bật. Azure sẽ nghe khi giáo viên nói xong, hoặc khi bạn ngắt lời.");
    } catch (error) {
      const name = String(error?.name || "");
      setPhase("mic");
      setNotice(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Micro chưa được phép. Bấm Cho phép micro để thử lại."
          : "Không mở được micro. Cuộc gọi chưa được tính là hoàn thành."
      );
    }
  }, [ensureStream, setMicError, startPcmCapture]);

  useEffect(() => {
    setOnJsonMessage((msg) => {
      if (!msg || typeof msg !== "object" || closedRef.current) return;
      if (msg.type === "hello") {
        requestRef.current = 1;
        setCaption("");
        if (Number.isFinite(Number(msg.packageQuota?.remainingMs))) setPackageLeft(Number(msg.packageQuota.remainingMs));
        if (!msg.useAzure) {
          finish("error", "Gateway preview chưa bật Azure STT. Cuộc gọi không chuyển sang nhận dạng trình duyệt.");
          return;
        }
        azureRef.current = true;
        requestMic();
        return;
      }
      if (msg.type === "call_summary") {
        setSummary(msg.summary || null);
        return;
      }
      if (msg.type === "call_ended") {
        const reason =
          msg.reason === "feature_disabled"
            ? "Cuộc gọi đã được tắt. Micro và tiếng đã dừng."
            : msg.reason === "package_quota"
            ? "Hết hạn mức gói thử nghiệm. Micro và tiếng đã dừng."
            : msg.reason === "time_limit"
              ? "Hết thời lượng mức 1. Micro và tiếng đã dừng."
              : "Đã dừng micro và tiếng. Kết quả bài học không đổi.";
        if (Number.isFinite(Number(msg.packageQuota?.remainingMs))) setPackageLeft(Number(msg.packageQuota.remainingMs));
        finish("ended", reason);
        return;
      }
      if (msg.type === "error") {
        const message = String(msg.message || "Mất kết nối cuộc gọi.");
        if (message.includes("Chưa có câu")) {
          setNotice(message);
          return;
        }
        listeningRef.current = false;
        finish("error", message);
        return;
      }
      const rid = Number(msg.requestId) || 0;
      if (rid && rid !== requestRef.current) return;
      if (msg.type === "interrupt" || msg.type === "interrupt_ack") {
        dropAudioRef.current = true;
        ttsPlayingRef.current = false;
        playerRef.current.interrupt();
        if (listeningRef.current) setPhase("listening");
        return;
      }
      if (msg.type === "partial_transcript") {
        setHeard(String(msg.text || ""));
        return;
      }
      if (msg.type === "final_transcript") {
        const text = String(msg.text || "").trim();
        if (!text) return;
        setHeard(text);
        listeningRef.current = false;
        sendJsonRef.current({ type: "recognition_end", requestId: rid });
        setPhase("thinking");
        return;
      }
      if (msg.type === "ai_stream") {
        dropAudioRef.current = false;
        setPhase("speaking");
        setCaption((current) => `${current}${msg.token || ""}`);
        return;
      }
      if (msg.type === "ai_done") {
        const text = String(msg.text || "");
        setCaption(text);
        setPhase("speaking");
        return;
      }
      if (msg.type === "tts_end" || msg.type === "repeat_started") {
        ttsPlayingRef.current = false;
        if (msg.type === "tts_end" && azureRef.current && !listeningRef.current && !closedRef.current) {
          beginListen("after_tts");
        }
      }
    });
    setOnBinaryMessage((ab) => {
      if (closedRef.current || dropAudioRef.current) return;
      const u8 = new Uint8Array(ab);
      if (u8.length < 6 || u8[0] !== 0x02) return;
      const rid = u8[1] | (u8[2] << 8) | (u8[3] << 16) | (u8[4] << 24);
      if (rid !== requestRef.current) return;
      ttsPlayingRef.current = true;
      setPhase("speaking");
      playerRef.current.enqueuePcmS16le(u8.subarray(5), 24000);
    });
  }, [beginListen, finish, requestMic, setOnBinaryMessage, setOnJsonMessage]);

  useEffect(() => {
    let url = "";
    try {
      const next = new URL(wsUrl);
      next.searchParams.set("token", token);
      next.searchParams.set("sessionId", sessionId);
      url = next.toString();
    } catch (_e) {
      setPhase("error");
      setNotice("Địa chỉ kết nối thoại không hợp lệ. Cuộc gọi chưa bắt đầu.");
      return undefined;
    }
    connect(url);
    return () => {
      closedRef.current = true;
      listeningRef.current = false;
      playerRef.current.interrupt();
      playerRef.current.close();
      stopMic();
      disconnect();
    };
  }, [connect, disconnect, sessionId, stopMic, token, wsUrl]);

  useEffect(() => {
    if (readyState === "error") {
      finish("error", lastError || "Mất kết nối. Hãy thử lại. Cuộc gọi chưa được tính là hoàn thành.");
    }
  }, [finish, lastError, readyState]);

  const replay = () => {
    if (closedRef.current || readyState !== "open") return;
    dropAudioRef.current = false;
    ttsPlayingRef.current = true;
    setPhase("speaking");
    sendJson({ type: "repeat_last", requestId: requestRef.current });
  };

  const endCall = () => {
    listeningRef.current = false;
    ttsPlayingRef.current = false;
    player.interrupt();
    stopMic();
    sendJson({ type: "end_call" });
    window.setTimeout(() => {
      if (!closedRef.current) {
        finish("ended", "Đã dừng micro và tiếng. Chưa nhận được tổng kết từ phiên.");
      }
    }, 4000);
  };

  const hintList = Array.isArray(hints) ? hints.slice(0, 3) : [];

  return (
    <div className="beego-lesson-call__panel" role="region" aria-label="Cuộc gọi AI mức 1">
      <p>
        <strong>{offer?.title || "Bài học"}</strong>
        {" · "}
        {offer?.limits?.levelLabel || "Mức 1 — Làm quen"}
      </p>
      <p>{offer?.objective || ""}</p>
      {Number.isFinite(Number(packageLeft)) ? (
        <p>Còn lại theo gói, từ server: {Math.max(0, Math.round(Number(packageLeft) / 1000))} giây</p>
      ) : null}
      <p className="beego-lesson-call__phase">
        {phase === "connecting" ? "Đang kết nối…" : null}
        {phase === "listening" ? "Đang lắng nghe bằng Azure" : null}
        {phase === "thinking" ? "Đang suy nghĩ…" : null}
        {phase === "speaking" ? "Giáo viên đang nói" : null}
        {phase === "mic" ? "Lỗi micro" : null}
        {phase === "error" ? "Lỗi kết nối" : null}
        {phase === "ended" ? "Đã kết thúc" : null}
      </p>
      {summary ? (
        <div>
          <p>
            <strong>Tổng kết phiên</strong>
            {summary.lessonTitle ? ` · ${summary.lessonTitle}` : ""}
          </p>
          <p>Thời lượng: {Number.isFinite(summary.durationSeconds) ? `${summary.durationSeconds} giây` : "Chưa đo được"}</p>
          <p>Phát âm: {summary.pronunciation || "Chưa đánh giá"}</p>
          <p>Câu cần sửa: {summary.correctionNote || "Chưa đánh giá"}</p>
          {summary.learnerQuotes?.length ? (
            <p>Bạn đã nói: {summary.learnerQuotes.join(" / ")}</p>
          ) : (
            <p>Chưa có câu nào của bạn trong phiên này.</p>
          )}
          {summary.playedTutorQuotes?.length ? (
            <p>Đã phát hoàn chỉnh: {summary.playedTutorQuotes.join(" / ")}</p>
          ) : null}
          {summary.interruptedTutorQuotes?.length ? (
            <p>Bị ngắt trước khi phát xong: {summary.interruptedTutorQuotes.join(" / ")}</p>
          ) : null}
        </div>
      ) : null}
      {notice || micError ? <p>{notice || micError}</p> : null}
      <p>
        <strong>Phụ đề:</strong> {caption || "…"}
      </p>
      {heard ? (
        <p>
          <strong>Azure nghe được:</strong> {heard}
        </p>
      ) : null}
      {hintList.length ? (
        <ul className="beego-lesson-call__hints">
          {hintList.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}
      {phase === "mic" ? (
        <button type="button" onClick={requestMic}>
          Cho phép micro
        </button>
      ) : null}
      {phase !== "ended" && phase !== "error" ? (
        <>
          <button type="button" onClick={() => beginListen("manual")} disabled={readyState !== "open" || phase === "mic" || phase === "connecting"}>
            Nói
          </button>
          <button type="button" onClick={replay} disabled={readyState !== "open" || !caption}>
            Nghe lại
          </button>
          <button type="button" onClick={() => beginListen("barge_in")} disabled={readyState !== "open"}>
            Ngắt lời
          </button>
          <button type="button" onClick={endCall}>
            Kết thúc
          </button>
        </>
      ) : (
        <button type="button" onClick={onClose}>
          Quay lại bài
        </button>
      )}
    </div>
  );
}
