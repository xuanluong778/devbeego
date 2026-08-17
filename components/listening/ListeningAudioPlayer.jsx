"use client";

import { useState } from "react";
import { PLAYBACK_RATES } from "@/lib/listening/constants";
import { useListeningAudio } from "./useListeningAudio";

export default function ListeningAudioPlayer({ audioUrl, ttsText }) {
  const [rate, setRate] = useState(1);
  const audio = useListeningAudio({ audioUrl, ttsText, rate });

  return (
    <section className="ln-player" aria-label="Trình phát audio">
      <div className="ln-player__top">
        <span className={`ln-player__status ln-player__status--${audio.status}`}>
          {audio.statusLabel}
        </span>
        <span className="ln-player__time">
          {audio.formatCurrent} / {audio.formatDuration}
        </span>
      </div>

      <div className="ln-player__main">
        <button
          type="button"
          className="ln-player__play"
          onClick={audio.toggle}
          aria-label={audio.status === "playing" ? "Tạm dừng" : "Phát"}
        >
          <span aria-hidden>{audio.status === "playing" ? "⏸" : "▶"}</span>
        </button>

        <div className="ln-player__track">
          <input
            type="range"
            className="ln-player__range"
            min={0}
            max={100}
            step={0.5}
            value={audio.progressPct}
            onChange={(e) => audio.seek(Number(e.target.value) / 100)}
            aria-label="Tiến độ phát"
          />
        </div>
      </div>

      <div className="ln-player__actions">
        <button type="button" className="ln-player__btn" onClick={audio.replay}>
          Nghe lại
        </button>
        <label className="ln-player__speed">
          <span className="ln-player__speedLabel">Tốc độ</span>
          <select
            className="ln-player__speedSelect"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-label="Tốc độ phát"
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
