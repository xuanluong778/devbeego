"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * IPA toggle for the Learn Call caption card. Fetches US IPA only when the learner opens it the
 * first time for a given tutor line; ignores stale responses when the caption changes.
 */
export default function LearnCallIpa({ text, enabled, onExpandedChange }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [lines, setLines] = useState([]);
  const [error, setError] = useState("");
  const cacheRef = useRef(new Map());
  const requestRef = useRef(0);
  const abortRef = useRef(null);
  const textKey = String(text || "").trim();
  // Hide the plain caption only when paired EN+IPA lines are on screen (avoid duplicate English).
  const pairsVisible = Boolean(enabled && open && status === "ready" && lines.length);

  useEffect(() => {
    onExpandedChange?.(pairsVisible);
  }, [pairsVisible, onExpandedChange]);

  useEffect(() => {
    setOpen(false);
    setError("");
    if (!textKey) {
      setStatus("idle");
      setLines([]);
      return;
    }
    const hit = cacheRef.current.get(textKey);
    if (hit?.sentences?.length) {
      setLines(hit.sentences);
      setStatus("ready");
    } else {
      setLines([]);
      setStatus("idle");
    }
  }, [textKey]);

  useEffect(() => {
    if (!enabled && open) setOpen(false);
  }, [enabled, open]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      onExpandedChange?.(false);
    },
    [onExpandedChange]
  );

  const load = useCallback(
    async (force = false) => {
      const current = String(text || "").trim();
      if (!current) return;
      if (!force) {
        const hit = cacheRef.current.get(current);
        if (hit?.sentences?.length) {
          setLines(hit.sentences);
          setStatus("ready");
          setError("");
          return;
        }
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const rid = ++requestRef.current;
      setStatus("loading");
      setError("");
      try {
        const res = await fetch("/api/learn/ai-call/ipa", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: current }),
          signal: controller.signal,
          credentials: "same-origin",
        });
        const json = await res.json().catch(() => ({}));
        if (rid !== requestRef.current) return;
        if (!res.ok || !json?.success || !Array.isArray(json?.data?.sentences)) {
          setStatus("error");
          setError(String(json?.message || "Không tạo được phiên âm."));
          setLines([]);
          return;
        }
        const sentences = json.data.sentences
          .map((row) => ({
            text: String(row?.text || "").trim(),
            ipa: String(row?.ipa || "").trim(),
          }))
          .filter((row) => row.text && row.ipa);
        if (!sentences.length) {
          setStatus("error");
          setError("Không tạo được phiên âm.");
          setLines([]);
          return;
        }
        cacheRef.current.set(current, { sentences, accent: json.data.accent });
        if (cacheRef.current.size > 40) {
          const first = cacheRef.current.keys().next().value;
          cacheRef.current.delete(first);
        }
        setLines(sentences);
        setStatus("ready");
        setError("");
      } catch (err) {
        if (err?.name === "AbortError" || rid !== requestRef.current) return;
        setStatus("error");
        setError("Không tạo được phiên âm.");
        setLines([]);
      }
    },
    [text]
  );

  const onToggle = () => {
    if (!enabled || !textKey) return;
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) void load(false);
      return next;
    });
  };

  if (!enabled || !textKey) return null;

  return (
    <div className={`beego-call-stage__ipa${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="beego-call-stage__ipa-btn"
        aria-pressed={open}
        aria-expanded={open}
        aria-controls={open ? "beego-call-ipa-panel" : undefined}
        onClick={onToggle}
      >
        IPA
      </button>
      {open ? (
        <div className="beego-call-stage__ipa-panel" id="beego-call-ipa-panel" aria-live="polite">
          {status === "loading" ? <p className="beego-call-stage__ipa-status">Đang tải phiên âm…</p> : null}
          {status === "error" ? (
            <div className="beego-call-stage__ipa-error">
              <p>{error || "Không tạo được phiên âm."}</p>
              <button type="button" onClick={() => void load(true)}>
                Thử lại
              </button>
            </div>
          ) : null}
          {status === "ready" && lines.length ? (
            <ul className="beego-call-stage__ipa-list">
              {lines.map((row) => (
                <li key={`${row.text}:${row.ipa}`}>
                  <span className="beego-call-stage__ipa-en">{row.text}</span>
                  <span className="beego-call-stage__ipa-phon">{row.ipa}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
