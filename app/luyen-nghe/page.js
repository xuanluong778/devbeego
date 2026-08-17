"use client";

import ListeningSessionMain, { ListeningSessionAside } from "@/components/listening/ListeningSession";
import { useListeningSession } from "@/components/listening/useListeningSession";

export default function LuyenNghePage() {
  const session = useListeningSession();

  return (
    <div className="ln-page">
      <div className="ln-root">
        <header className="ln-header">
          <div className="ln-header__text">
            <p className="ln-header__eyebrow">Beego Listening</p>
            <h1 className="ln-header__title">Luyện nghe 5 phút</h1>
            <p className="ln-header__desc">
              Nghe đoạn hội thoại ngắn, trả lời câu hỏi và theo dõi tiến độ trong 5 phút.
            </p>
          </div>
        </header>

        <div className="ln-layout">
          <main className="ln-main">
            <ListeningSessionMain session={session} />
          </main>
          <div className="ln-asideWrap ln-desktopOnly">
            <ListeningSessionAside session={session} />
          </div>
        </div>
      </div>
    </div>
  );
}
