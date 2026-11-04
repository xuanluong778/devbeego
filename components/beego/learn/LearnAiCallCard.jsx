"use client";

import Link from "next/link";
import { SPEAKING_PATH } from "@/lib/beego/routes";

export default function LearnAiCallCard({ onStartCall, currentTopic = "Chào hỏi và làm quen" }) {
  return (
    <section className="beego-learn-ai-call-card" aria-label="Gọi gia sư AI 1:1">
      <div className="beego-learn-ai-call-card__badge-row">
        <span className="beego-learn-ai-call-card__live-pill">
          <span className="beego-learn-ai-call-card__pulse-dot" aria-hidden="true" />
          TRỰC TUYẾN 24/7
        </span>
        <span className="beego-learn-ai-call-card__tag">Gia sư AI 1:1</span>
      </div>

      <div className="beego-learn-ai-call-card__body">
        <div className="beego-learn-ai-call-card__avatar-wrap" aria-hidden="true">
          <span className="beego-learn-ai-call-card__avatar">🎙️</span>
          <span className="beego-learn-ai-call-card__avatar-bee">🐝</span>
        </div>

        <div className="beego-learn-ai-call-card__text">
          <h2 className="beego-learn-ai-call-card__title">
            Luyện Nói Cùng Gia Sư AI
          </h2>
          <p className="beego-learn-ai-call-card__desc">
            Thực hành phản xạ giao tiếp 1:1 theo chủ đề: <strong>{currentTopic}</strong>. Gia sư AI kiên nhẫn lắng nghe, sửa phát âm và đồng hành không sợ sai!
          </p>
        </div>
      </div>

      <div className="beego-learn-ai-call-card__actions">
        <button
          type="button"
          className="beego-learn-ai-call-card__btn-call"
          onClick={onStartCall}
          aria-label="Bắt đầu gọi gia sư AI"
        >
          <span aria-hidden="true">📞</span> Gọi gia sư AI ngay
        </button>

        <Link
          href={SPEAKING_PATH}
          className="beego-learn-ai-call-card__btn-explore"
          aria-label="Xem tất cả các chủ đề trên tab Luyện nói"
        >
          Xem 50 chủ đề luyện nói →
        </Link>
      </div>
    </section>
  );
}

