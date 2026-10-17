"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listSpeakingTabTopics } from "@/lib/beego/learn/ai-call-access";
import { loadLearningPath } from "@/lib/beego/learning-path";
import LearnLessonCall from "@/components/beego/lesson-player/LearnLessonCall";

/**
 * Tab Luyện nói (/luyen-noi): same Learn Call UI and session APIs as the Học map gate.
 * Lists every Học topic; locked ones stay visible but cannot start a call.
 * Does not start a call or open the mic until the user taps Bắt đầu inside LearnLessonCall.
 */
export default function LearnCallSpeakingTab() {
  const [loading, setLoading] = useState(true);
  const [featureOn, setFeatureOn] = useState(false);
  const [topics, setTopics] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const [statusRes, pathRes] = await Promise.all([
          fetch("/api/learn/ai-call/status", { cache: "no-store", credentials: "same-origin" }),
          fetch("/api/learning-path", { cache: "no-store", credentials: "same-origin" }),
        ]);
        const statusJson = await statusRes.json().catch(() => ({}));
        const pathJson = await pathRes.json().catch(() => ({}));
        if (cancel) return;
        setFeatureOn(Boolean(statusJson?.data?.enabled));
        const path = loadLearningPath(pathRes.ok && pathJson?.success ? pathJson.data : null);
        setTopics(listSpeakingTabTopics(path));
        setSelected(null);
      } catch {
        if (!cancel) setLoadError("Không tải được lộ trình học. Hãy thử lại.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="beego-learn-call-tab" role="status">
        <p className="beego-lesson-call__panel">Đang tải Luyện nói…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="beego-learn-call-tab" role="alert">
        <div className="beego-lesson-call__panel">
          <p>{loadError}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!featureOn) {
    return (
      <div className="beego-learn-call-tab" role="status">
        <div className="beego-lesson-call__panel">
          <p>Tính năng gọi gia sư AI chưa mở trên tài khoản này.</p>
          <Link href="/">Về trang Học</Link>
        </div>
      </div>
    );
  }

  if (!topics.length) {
    return (
      <div className="beego-learn-call-tab" role="status">
        <div className="beego-lesson-call__panel">
          <p>Chưa có chủ đề trên lộ trình học.</p>
          <Link href="/">Vào bản đồ Học</Link>
        </div>
      </div>
    );
  }

  if (!selected) {
    const openCount = topics.filter((item) => !item.locked).length;
    return (
      <div className="beego-learn-call-tab" role="region" aria-label="Chọn chủ đề gọi gia sư AI">
        <div className="beego-lesson-call__panel beego-learn-call-tab__picker">
          <h1 className="beego-learn-call-tab__title">Luyện nói</h1>
          <p>
            Chọn chủ đề để gọi gia sư AI. Cuộc gọi chưa bắt đầu cho đến khi bạn nhấn Bắt đầu.
            {openCount < topics.length
              ? " Chủ đề chưa mở trên bản đồ Học vẫn hiện nhưng chưa gọi được."
              : ""}
          </p>
          <ul className="beego-learn-call-tab__topics">
            {topics.map((item) => {
              const locked = Boolean(item.locked);
              return (
                <li key={item.sectionId}>
                  <button
                    type="button"
                    className={locked ? "beego-learn-call-tab__topic--locked" : undefined}
                    disabled={locked}
                    aria-disabled={locked}
                    aria-label={
                      locked
                        ? `${item.topicTitle || item.sectionId} — chưa mở trên bản đồ Học`
                        : item.topicTitle || item.sectionId
                    }
                    onClick={() => {
                      if (locked || !item.lessonId) return;
                      setSelected(item);
                    }}
                  >
                    <span className="beego-learn-call-tab__topic-title">
                      {item.topicTitle || item.sectionId}
                    </span>
                    {locked ? (
                      <span className="beego-learn-call-tab__topic-state">Chưa mở</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="beego-learn-call-layer" role="dialog" aria-label="Gọi gia sư AI">
      <LearnLessonCall
        key={`${selected.sectionId}:${selected.lessonId}`}
        lessonId={selected.lessonId}
        lessonType={selected.lessonType}
        sectionId={selected.sectionId}
        autoCheck
        returnLabel="Chọn chủ đề khác"
        onDismiss={() => setSelected(null)}
      />
    </div>
  );
}
