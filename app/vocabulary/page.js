"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import VocabularyGrid from "@/components/vocabulary/VocabularyGrid";
import VocabularyCard from "@/components/vocabulary/VocabularyCard";
import VocabularyPager from "@/components/vocabulary/VocabularyPager";
import VocabularyTabFilters from "@/components/vocabulary/VocabularyTabFilters";
import VocabularyDashboardHeader from "@/components/vocabulary/VocabularyDashboardHeader";
import VocabularyActionCards from "@/components/vocabulary/VocabularyActionCards";
import VocabularyTopicChips from "@/components/vocabulary/VocabularyTopicChips";
import VocabularyLoadingGrid from "@/components/vocabulary/VocabularyLoadingGrid";
import VocabularyEmptyState from "@/components/vocabulary/VocabularyEmptyState";
import VocabularyErrorState from "@/components/vocabulary/VocabularyErrorState";
import VocabularyToast from "@/components/vocabulary/VocabularyToast";
import TopicPickerModal from "@/components/vocabulary/TopicPickerModal";
import { getBookmarkIds } from "@/lib/vocabulary/bookmarks";
import VocabularyStudySession from "@/components/vocabulary/VocabularyStudySession";
import VocabularyPracticeModePicker from "@/components/vocabulary/VocabularyPracticeModePicker";
import VocabularyPracticeSession from "@/components/vocabulary/VocabularyPracticeSession";
import VocabularyAssignmentsPanel from "@/components/vocabulary/VocabularyAssignmentsPanel";
import { resolveTopicChipsFromApi } from "@/lib/vocabulary/dashboard-config";
import { mergeGuestStatsIntoDashboard } from "@/lib/vocabulary/guest-srs";
import { fetchStudySessionWords, fetchPracticeSession, fetchDistractorPool } from "@/lib/vocabulary/study-session";
import "./vocabulary.css";

const PAGE_SIZE = 12;
const DEFAULT_LEVEL = "beginner";

function readUrlState() {
  if (typeof window === "undefined") {
    return { keyword: "", topic: "", tab: "all" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    keyword: String(params.get("q") || "").trim(),
    topic: String(params.get("topic") || "").trim(),
    tab: String(params.get("tab") || "all").trim() || "all",
  };
}

function writeUrlState({ keyword, topic, tab }) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (keyword) params.set("q", keyword);
  if (topic) params.set("topic", topic);
  if (tab && tab !== "all") params.set("tab", tab);
  const qs = params.toString();
  const next = qs ? `/vocabulary?${qs}` : "/vocabulary";
  window.history.replaceState(null, "", next);
}

export default function VocabularyPage() {
  const [keyword, setKeyword] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [items, setItems] = useState([]);
  const [topics, setTopics] = useState([]);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "info" });
  const [reloadKey, setReloadKey] = useState(0);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionWords, setSessionWords] = useState([]);
  const [sessionDistractorPool, setSessionDistractorPool] = useState([]);
  const [sessionMode, setSessionMode] = useState("learn");
  const [sessionKey, setSessionKey] = useState("");
  const [sessionLoading, setSessionLoading] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceWords, setPracticeWords] = useState([]);
  const [practicePool, setPracticePool] = useState([]);
  const [practiceMode, setPracticeMode] = useState("flashcard");
  const [practiceKey, setPracticeKey] = useState("");

  const topicChips = useMemo(() => resolveTopicChipsFromApi(topics), [topics]);

  useEffect(() => {
    const state = readUrlState();
    setKeyword(state.keyword);
    setSelectedTopic(state.topic);
    setActiveTab(state.tab);
    const onPop = () => {
      const s = readUrlState();
      setKeyword(s.keyword);
      setSelectedTopic(s.topic);
      setActiveTab(s.tab);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const syncUrl = useCallback(
    (patch) => {
      writeUrlState({
        keyword: patch.keyword ?? keyword,
        topic: patch.topic ?? selectedTopic,
        tab: patch.tab ?? activeTab,
      });
    },
    [keyword, selectedTopic, activeTab]
  );

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/vocabulary/stats", { cache: "no-store", credentials: "same-origin" });
      const json = await res.json();
      if (res.ok && json.success) {
        let data = json.data || null;
        if (data && !data.authenticated) {
          data = mergeGuestStatsIntoDashboard(data);
        }
        setStats(data);
      }
    } catch {
      setStats(null);
    }
    setStatsLoading(false);
  }, []);

  const loadTopics = useCallback(async () => {
    try {
      const res = await fetch(`/api/vocabulary/topics?level=${encodeURIComponent(DEFAULT_LEVEL)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok && json.success) setTopics(json.data || []);
      else setTopics([]);
    } catch {
      setTopics([]);
    }
  }, []);

  useEffect(() => {
    void loadTopics();
    void loadStats();
  }, [loadTopics, loadStats]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setLoadError("");
      setAuthRequired(false);
      const levelQuery = `&level=${encodeURIComponent(DEFAULT_LEVEL)}`;
      const topicQuery = selectedTopic ? `&topic=${encodeURIComponent(selectedTopic)}` : "";
      const keywordQuery = keyword ? `&q=${encodeURIComponent(keyword)}` : "";
      const tabQuery = activeTab !== "all" ? `&study_filter=${encodeURIComponent(activeTab)}` : "";
      const bookmarkQuery =
        activeTab === "saved" ? `&bookmark_ids=${encodeURIComponent(getBookmarkIds().join(","))}` : "";
      try {
        const res = await fetch(
          `/api/vocabulary?page=${page}&limit=${PAGE_SIZE}${levelQuery}${topicQuery}${keywordQuery}${tabQuery}${bookmarkQuery}`,
          { cache: "no-store", credentials: "same-origin" }
        );
        const json = await res.json();
        if (res.ok && json.success) {
          setItems(json.data || []);
          setTotal(Number(json.pagination?.total || 0));
          setAuthRequired(Boolean(json.auth_required));
        } else {
          setItems([]);
          setTotal(0);
          setLoadError(json.message || "Không tải được danh sách từ vựng. Vui lòng thử lại.");
        }
      } catch {
        setItems([]);
        setTotal(0);
        setLoadError("Lỗi kết nối đến máy chủ. Vui lòng tải lại trang.");
      }
      setLoading(false);
    }
    load();
  }, [page, selectedTopic, keyword, activeTab, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [keyword, selectedTopic, activeTab]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function listenWord(item) {
    const audio = new Audio(item.audio_url);
    audio.play().catch(() => {
      const utterance = new SpeechSynthesisUtterance(item.word);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  function listenSentence(item) {
    const sentenceAudio = item.example_audio_url || "";
    if (sentenceAudio) {
      const audio = new Audio(sentenceAudio);
      audio.play().catch(() => {
        const utterance = new SpeechSynthesisUtterance(item.example_sentence || "");
        utterance.lang = "en-US";
        utterance.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });
    } else {
      const utterance = new SpeechSynthesisUtterance(item.example_sentence || "");
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }

  function handleKeywordChange(value) {
    setKeyword(value);
    syncUrl({ keyword: value });
  }

  function handleTopicSelect(topic) {
    setSelectedTopic(topic);
    syncUrl({ topic });
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    syncUrl({ tab });
  }

  function clearFilters() {
    setKeyword("");
    setSelectedTopic("");
    setActiveTab("all");
    writeUrlState({ keyword: "", topic: "", tab: "all" });
  }

  const startStudySession = useCallback(
    async (mode) => {
      setSessionLoading(true);
      try {
        const { words, empty } = await fetchStudySessionWords({
          mode,
          topic: selectedTopic,
          level: DEFAULT_LEVEL,
        });
        if (!words.length) {
          setToast({
            message: empty
              ? "Không có từ phù hợp để bắt đầu phiên học. Thử đổi bộ lọc hoặc chủ đề."
              : "Không tải được từ cho phiên học.",
            type: "error",
          });
          return;
        }
        setSessionMode(mode);
        setSessionWords(words);
        const pool = await fetchDistractorPool({
          level: DEFAULT_LEVEL,
          topic: selectedTopic,
          seedWords: words,
          limit: 48,
        });
        setSessionDistractorPool(pool);
        setSessionKey(`${mode}-${Date.now()}`);
        setSessionOpen(true);
      } catch {
        setToast({ message: "Lỗi khi mở phiên học. Thử lại.", type: "error" });
      } finally {
        setSessionLoading(false);
      }
    },
    [selectedTopic]
  );

  function closeStudySession() {
    setSessionOpen(false);
    setSessionWords([]);
    setSessionDistractorPool([]);
    void loadStats();
    setReloadKey((k) => k + 1);
  }

  async function startDeepStudyForWord(item) {
    setSessionLoading(true);
    try {
      const pool = await fetchDistractorPool({
        level: DEFAULT_LEVEL,
        topic: item.topic || selectedTopic,
        seedWords: [item, ...items.filter((row) => row.id !== item.id)],
        limit: 48,
      });
      setSessionMode("deep");
      setSessionWords([item]);
      setSessionDistractorPool(pool);
      setSessionKey(`deep-${item.id}-${Date.now()}`);
      setSessionOpen(true);
    } catch {
      setToast({ message: "Không tải được đáp án. Thử lại.", type: "error" });
    } finally {
      setSessionLoading(false);
    }
  }

  function restartStudySession() {
    if (sessionMode === "deep" && sessionWords.length === 1) {
      setSessionKey(`deep-${sessionWords[0].id}-${Date.now()}`);
      return;
    }
    void startStudySession(sessionMode);
  }

  const startPracticeSession = useCallback(
    async (modeId) => {
      setSessionLoading(true);
      try {
        const { words, pool, empty } = await fetchPracticeSession({
          practiceMode: modeId,
          topic: selectedTopic,
          level: DEFAULT_LEVEL,
        });
        if (!words.length) {
          const msg =
            modeId === "weak_words"
              ? "Bạn chưa có từ yếu nào. Hãy học thêm rồi quay lại!"
              : empty
              ? "Không có từ phù hợp. Thử đổi chủ đề hoặc bộ lọc."
              : "Không tải được từ cho phiên luyện tập.";
          setToast({ message: msg, type: "error" });
          return;
        }
        setPracticeMode(modeId);
        setPracticeWords(words);
        setPracticePool(pool);
        setPracticeKey(`${modeId}-${Date.now()}`);
        setPracticeOpen(true);
      } catch {
        setToast({ message: "Lỗi khi mở phiên luyện tập. Thử lại.", type: "error" });
      } finally {
        setSessionLoading(false);
      }
    },
    [selectedTopic]
  );

  function closePracticeSession() {
    setPracticeOpen(false);
    setPracticeWords([]);
    setPracticePool([]);
    void loadStats();
    setReloadKey((k) => k + 1);
  }

  function restartPracticeSession() {
    void startPracticeSession(practiceMode);
  }

  const topicLabel = selectedTopic || "Tất cả chủ đề";

  return (
    <main className="beego-vocab-page vocab-dash-page">
      <VocabularyToast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: "", type: "info" })}
      />

      <div className="vocab-dash-inner">
        <VocabularyDashboardHeader stats={stats} loading={statsLoading} />

        <VocabularyAssignmentsPanel />

        <VocabularyActionCards
          stats={stats}
          loading={statsLoading}
          activeFilter={activeTab}
          onSelectFilter={handleTabChange}
          onStartSession={startStudySession}
          sessionLoading={sessionLoading}
        />

        <VocabularyPracticeModePicker
          stats={stats}
          loading={statsLoading}
          onSelectMode={startPracticeSession}
          sessionLoading={sessionLoading}
        />

        <section className="vocab-dash-toolbar" aria-label="Tìm kiếm và lọc">
          <div className="vocab-dash-searchRow">
            <span className="vocab-dash-searchIcon" aria-hidden>
              🔍
            </span>
            <input
              type="search"
              className="vocab-dash-search"
              placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt…"
              value={keyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
            />
            <button type="button" className="vocab-dash-moreTopics" onClick={() => setTopicModalOpen(true)}>
              {topicLabel} ▾
            </button>
          </div>

          <VocabularyTabFilters activeTab={activeTab} onChange={handleTabChange} disabled={loading} />

          <VocabularyTopicChips
            chips={topicChips}
            selectedTopic={selectedTopic}
            onSelect={handleTopicSelect}
            disabled={loading}
          />
        </section>

        <section className="vocab-dash-results" aria-live="polite">
          {!loading && loadError ? (
            <VocabularyErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
          ) : null}

          {loading ? <VocabularyLoadingGrid count={PAGE_SIZE} /> : null}

          {!loading && !loadError && !items.length ? (
            <VocabularyEmptyState
              filter={activeTab}
              authRequired={authRequired}
              onClearFilters={clearFilters}
            />
          ) : null}

          {!loading && !loadError && items.length > 0 ? (
            <>
              <div className="vocab-dash-resultsHead">
                <p>
                  Hiển thị <strong>{items.length}</strong> / {total.toLocaleString("vi-VN")} từ
                </p>
              </div>
              <VocabularyGrid
                items={items}
                className="vocab-dash-grid"
                renderItem={(item) => (
                  <VocabularyCard
                    key={item.id}
                    item={item}
                    onListenWord={listenWord}
                    onListenSentence={listenSentence}
                    onDeepStudy={startDeepStudyForWord}
                  />
                )}
              />
              <VocabularyPager
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              />
            </>
          ) : null}
        </section>
      </div>

      <TopicPickerModal
        open={topicModalOpen}
        topics={topics}
        selectedTopic={selectedTopic}
        onClose={() => setTopicModalOpen(false)}
        onSelect={handleTopicSelect}
      />

      {sessionOpen && sessionWords.length ? (
        <VocabularyStudySession
          words={sessionWords}
          distractorPool={sessionDistractorPool}
          mode={sessionMode}
          sessionKey={sessionKey}
          onClose={closeStudySession}
          onComplete={() => {
            void loadStats();
          }}
          onRestart={restartStudySession}
        />
      ) : null}

      {practiceOpen && practiceWords.length ? (
        <VocabularyPracticeSession
          words={practiceWords}
          pool={practicePool}
          practiceMode={practiceMode}
          sessionKey={practiceKey}
          onClose={closePracticeSession}
          onComplete={() => {
            void loadStats();
          }}
          onRestart={restartPracticeSession}
        />
      ) : null}
    </main>
  );
}
