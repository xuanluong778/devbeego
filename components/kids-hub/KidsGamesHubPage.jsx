"use client";

import { useState } from "react";
import Link from "next/link";
import { KIDS_VOCAB_LESSONS } from "@/lib/kids-vocabulary/curriculum";
import { shuffle } from "@/lib/kids-vocabulary/utils";
import ListenChooseGame from "@/components/kids-vocabulary/ListenChooseGame";
import DragDropGame from "@/components/kids-vocabulary/DragDropGame";
import MemoryMatchGame from "./MemoryMatchGame";
import SpellingGame from "./SpellingGame";
import SpeakToUnlockGame from "./SpeakToUnlockGame";
import { addStars } from "@/lib/kids-hub/rewards";
import hubStyles from "./KidsHub.module.css";
import kvStyles from "@/components/kids-vocabulary/KidsVocabulary.module.css";

const GAME_LIST = [
  { id: "listen", icon: "👂", title: "Nghe chọn", desc: "Nghe từ · chọn hình" },
  { id: "drag", icon: "🧩", title: "Kéo thả", desc: "Kéo từ vào hình" },
  { id: "memory", icon: "🃏", title: "Ghép thẻ", desc: "Memory match" },
  { id: "spelling", icon: "✏️", title: "Đánh vần", desc: "Kéo chữ thành từ" },
  { id: "speak", icon: "🎙", title: "Nói mở khóa", desc: "Speak to unlock" },
];

export default function KidsGamesHubPage() {
  const [active, setActive] = useState(null);
  const sampleWords = shuffle(KIDS_VOCAB_LESSONS.flatMap((l) => l.words)).slice(0, 6);

  function finishGame() {
    addStars(5, "game");
    setActive(null);
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
          <h1>🎮 Chơi game</h1>
          <p style={{ fontWeight: 800, margin: 0 }}>Học qua trò chơi vui!</p>
        </header>

        {!active ? (
          <div className={hubStyles.gameGrid}>
            {GAME_LIST.map((g) => (
              <button key={g.id} type="button" className={hubStyles.gameCard} onClick={() => setActive(g.id)}>
                <div className={hubStyles.gameCardIcon}>{g.icon}</div>
                <strong>{g.title}</strong>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, opacity: 0.85 }}>{g.desc}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className={hubStyles.card}>
            <button type="button" className={`${kvStyles.bigBtn} ${kvStyles.bigBtnGhost}`} onClick={() => setActive(null)}>
              ← Chọn game khác
            </button>
            <div style={{ marginTop: "1rem" }}>
              {active === "listen" ? (
                <ListenChooseGame words={sampleWords} maxRounds={4} onComplete={finishGame} />
              ) : null}
              {active === "drag" ? <DragDropGame words={sampleWords} onComplete={finishGame} /> : null}
              {active === "memory" ? <MemoryMatchGame onComplete={finishGame} /> : null}
              {active === "spelling" ? <SpellingGame onComplete={finishGame} /> : null}
              {active === "speak" ? <SpeakToUnlockGame onComplete={finishGame} /> : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
