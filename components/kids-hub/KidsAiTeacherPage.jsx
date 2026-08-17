"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { speakEnglish } from "@/lib/kids-vocabulary/browser-tts";
import { listenKidEnglishOnce } from "@/lib/kids-hub/speech-listen";
import { evaluatePronunciation } from "@/lib/client-pronunciation-eval";
import { KIDS_AI_SCENARIOS, KIDS_SAFETY_NOTE, kidAiFeedback } from "@/lib/kids-hub/ai-teacher";
import { recordPronunciationScore } from "@/lib/kids-hub/rewards";
import hubStyles from "./KidsHub.module.css";
import kvStyles from "@/components/kids-vocabulary/KidsVocabulary.module.css";

export default function KidsAiTeacherPage() {
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [listening, setListening] = useState(false);
  const scenario = KIDS_AI_SCENARIOS[idx];

  const speakSlow = useCallback((text) => {
    void speakEnglish(text, { rate: 0.68 });
  }, []);

  useEffect(() => {
    setFeedback("");
  }, [idx]);

  useEffect(() => {
    if (scenario) speakSlow(scenario.targetEn);
  }, [scenario, speakSlow]);

  async function trySpeak() {
    if (!scenario || listening) return;
    setListening(true);
    setFeedback("🐝 Cô Beego đang nghe con…");
    try {
      const heard = await listenKidEnglishOnce();
      const ev = evaluatePronunciation(heard, scenario.targetEn, {
        isSentence: scenario.targetEn.includes(" "),
      });
      recordPronunciationScore(ev.score);
      const fb = kidAiFeedback({ target: scenario.targetEn, heard, score: ev.score });
      setFeedback(fb.vi);
    } catch {
      setFeedback("Chưa nghe rõ — con nói to và chậm nhé!");
    } finally {
      setListening(false);
    }
  }

  return (
    <main className={hubStyles.wrap}>
      <div className={hubStyles.inner}>
        <div className={hubStyles.topBar}>
          <Link href="/kids" className={hubStyles.homeLink}>
            ← Beego Kids
          </Link>
        </div>

        <header className={hubStyles.pageHeader}>
          <span style={{ fontSize: "3rem" }}>🐝</span>
          <h1>Cô Beego</h1>
          <p style={{ fontWeight: 800, margin: 0 }}>Nói chậm · Vui · Câu ngắn</p>
        </header>

        <div className={hubStyles.card}>
          <p style={{ fontWeight: 900, fontSize: "1.1rem", textAlign: "center" }}>{scenario.promptVi}</p>
          <p style={{ textAlign: "center", fontWeight: 800, color: "#555" }}>{scenario.hintVi}</p>
          <div className={kvStyles.row} style={{ justifyContent: "center" }}>
            <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnPrimary}`} onClick={() => speakSlow(scenario.targetEn)}>
              🔊 Cô đọc mẫu
            </button>
            <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnPrimary}`} onClick={trySpeak} disabled={listening}>
              {listening ? "Đang nghe…" : "🎙 Con nói thử"}
            </button>
          </div>
          {feedback ? (
            <p className={`${kvStyles.feedback} ${kvStyles.feedbackGood}`} style={{ marginTop: "1rem" }}>
              {feedback}
            </p>
          ) : null}
          <div className={kvStyles.row} style={{ justifyContent: "center", marginTop: "1rem" }}>
            {idx > 0 ? (
              <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnGhost}`} onClick={() => setIdx((i) => i - 1)}>
                ← Trước
              </button>
            ) : null}
            {idx < KIDS_AI_SCENARIOS.length - 1 ? (
              <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnPrimary}`} onClick={() => setIdx((i) => i + 1)}>
                Tiếp →
              </button>
            ) : null}
          </div>
        </div>

        <p className={hubStyles.safetyNote}>{KIDS_SAFETY_NOTE}</p>
        <p style={{ textAlign: "center", fontSize: "0.82rem", fontWeight: 700, opacity: 0.75 }}>
          Chỉ học theo bài có sẵn — không chat tự do.
        </p>
      </div>
    </main>
  );
}
