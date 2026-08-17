"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PronunciationHeader from "./components/PronunciationHeader";
import PronunciationActionCards from "./components/PronunciationActionCards";
import PronunciationFilters from "./components/PronunciationFilters";
import PronunciationLessonCard from "./components/PronunciationLessonCard";
import PronunciationStudio from "./components/PronunciationStudio";
import PronunciationMainTabs from "./components/PronunciationMainTabs";
import IpaPhonemicChart from "./components/IpaPhonemicChart";
import { usePronunciationStudio } from "./hooks/usePronunciationStudio";
import { PASS_SCORE } from "@/lib/pronunciation/drill-catalog";
import {
  buildLessonGroups,
  countRetryWords,
  filterLessonGroups,
  getLessonProgress,
  getTodayLessonGroup,
  getWeakSoundSymbols,
} from "@/lib/pronunciation/lesson-groups";
import {
  getWordScore,
  readLessonProgress,
  readPracticeStats,
  recordPracticeScore,
} from "@/lib/pronunciation/progress-store";

const LIST_PREVIEW = 6;

function findFirstIncompleteIndex(group, progressMap) {
  const idx = group.words.findIndex(
    (w) => getWordScore(progressMap, w.lessonId, w.word) < PASS_SCORE
  );
  return idx >= 0 ? idx : 0;
}

function findFirstWeakDrill(groups, progressMap) {
  for (const g of groups) {
    for (let i = 0; i < g.words.length; i += 1) {
      const w = g.words[i];
      const sc = getWordScore(progressMap, w.lessonId, w.word);
      if (sc > 0 && sc < PASS_SCORE) return { group: g, index: i };
    }
  }
  return null;
}

export default function PronunciationPage() {
  const [loading, setLoading] = useState(true);
  const [progressMap, setProgressMap] = useState({});
  const [stats, setStats] = useState({ streak: 0, avgScore: null, sessionCount: 0 });
  const [filter, setFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [wordIndex, setWordIndex] = useState(0);
  const [listExpanded, setListExpanded] = useState(false);
  const [pageTab, setPageTab] = useState("practice");

  const lessonGroups = useMemo(() => buildLessonGroups(), []);

  useEffect(() => {
    const map = readLessonProgress();
    setProgressMap(map);
    setStats(readPracticeStats(map));
    const today = getTodayLessonGroup(lessonGroups, map);
    setSelectedLessonId(today.id);
    setWordIndex(findFirstIncompleteIndex(today, map));
    setLoading(false);
  }, [lessonGroups]);

  const selectedGroup = useMemo(
    () => lessonGroups.find((g) => g.id === selectedLessonId) || null,
    [lessonGroups, selectedLessonId]
  );

  const selectedDrill = selectedGroup?.words[wordIndex] || null;

  const filteredGroups = useMemo(
    () => filterLessonGroups(lessonGroups, filter, levelFilter, progressMap),
    [lessonGroups, filter, levelFilter, progressMap]
  );

  const visibleGroups = listExpanded ? filteredGroups : filteredGroups.slice(0, LIST_PREVIEW);

  const todayMeta = useMemo(() => {
    const g = getTodayLessonGroup(lessonGroups, progressMap);
    const { done, total } = getLessonProgress(g, progressMap);
    return {
      ipaFocus: g.ipaFocus,
      done,
      total,
      pct: total ? Math.round((done / total) * 100) : 0,
      group: g,
    };
  }, [lessonGroups, progressMap]);

  const weakSounds = useMemo(
    () => getWeakSoundSymbols(lessonGroups, progressMap),
    [lessonGroups, progressMap]
  );

  const retryCount = useMemo(
    () => countRetryWords(lessonGroups, progressMap),
    [lessonGroups, progressMap]
  );

  const practicedCount = useMemo(() => {
    let n = 0;
    lessonGroups.forEach((g) => {
      g.words.forEach((w) => {
        if (getWordScore(progressMap, w.lessonId, w.word) > 0) n += 1;
      });
    });
    return n;
  }, [lessonGroups, progressMap]);

  const studio = usePronunciationStudio(selectedDrill);
  const lastRecordedRef = useRef("");

  useEffect(() => {
    if (studio.phase !== "done" || !studio.result || !selectedDrill) return;
    const key = `${selectedDrill.id}:${studio.result.score}:${studio.result.transcript}`;
    if (lastRecordedRef.current === key) return;
    lastRecordedRef.current = key;
    const { progress, meta } = recordPracticeScore(
      selectedDrill.lessonId,
      selectedDrill.word,
      studio.result.score
    );
    setProgressMap(progress);
    setStats({
      streak: meta.streak,
      avgScore:
        meta.scores.length > 0
          ? Math.round(meta.scores.reduce((a, b) => a + b, 0) / meta.scores.length)
          : null,
      sessionCount: meta.sessionCount,
    });
  }, [studio.phase, studio.result, selectedDrill]);

  const selectLesson = useCallback(
    (group) => {
      setSelectedLessonId(group.id);
      setWordIndex(findFirstIncompleteIndex(group, progressMap));
    },
    [progressMap]
  );

  const canGoNext = Boolean(selectedGroup && wordIndex < selectedGroup.wordCount - 1);

  const goNextWord = useCallback(() => {
    if (!selectedGroup || wordIndex >= selectedGroup.wordCount - 1) return;
    setWordIndex((i) => i + 1);
  }, [selectedGroup, wordIndex]);

  const handleAction = useCallback(
    (actionId) => {
      if (actionId === "today") {
        selectLesson(todayMeta.group);
        return;
      }
      if (actionId === "weak_sound") {
        const hit = findFirstWeakDrill(lessonGroups, progressMap);
        if (hit) {
          setSelectedLessonId(hit.group.id);
          setWordIndex(hit.index);
        } else {
          selectLesson(todayMeta.group);
        }
        return;
      }
      if (actionId === "retry") {
        setFilter("weak");
        const hit = findFirstWeakDrill(lessonGroups, progressMap);
        if (hit) {
          setSelectedLessonId(hit.group.id);
          setWordIndex(hit.index);
        }
      }
    },
    [lessonGroups, progressMap, selectLesson, todayMeta.group]
  );

  return (
    <main className={`pron-page${pageTab === "chart" ? " pron-page--chart" : ""}`}>
      <div className="pron-inner">
        <PronunciationHeader stats={{ ...stats, sessionCount: practicedCount }} loading={loading} />

        <PronunciationMainTabs active={pageTab} onChange={setPageTab} />

        {pageTab === "chart" ? (
          <IpaPhonemicChart />
        ) : (
          <>
            <PronunciationActionCards
              today={todayMeta}
              weakSounds={weakSounds}
              retryCount={retryCount}
              onAction={handleAction}
            />

            <PronunciationFilters
              active={filter}
              level={levelFilter}
              onChange={(id) => {
                setFilter(id);
                setListExpanded(false);
              }}
              onLevelChange={setLevelFilter}
              disabled={loading}
            />

            {loading ? (
              <div className="pron-loading" aria-busy="true">
                <div className="pron-loading__list">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="pron-skeleton pron-skeleton--lesson" />
                  ))}
                </div>
                <div className="pron-skeleton pron-skeleton--room" />
              </div>
            ) : (
              <div className="pron-layout">
                <section className="pron-lessonList" aria-label="Danh sách bài luyện">
                  <h2 className="pron-lessonList__title">Danh sách bài luyện</h2>
                  {filteredGroups.length === 0 ? (
                    <div className="pron-empty">
                      <span aria-hidden>🎧</span>
                      <h3>Chưa có bài phù hợp</h3>
                      <p>Thử đổi bộ lọc hoặc cấp độ.</p>
                      <button
                        type="button"
                        className="pron-empty__btn"
                        onClick={() => {
                          setFilter("all");
                          setLevelFilter("all");
                        }}
                      >
                        Xem tất cả
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="pron-lessonList__items">
                        {visibleGroups.map((g) => (
                          <PronunciationLessonCard
                            key={g.id}
                            group={g}
                            progressMap={progressMap}
                            selected={selectedLessonId === g.id}
                            onSelect={selectLesson}
                          />
                        ))}
                      </div>
                      {filteredGroups.length > LIST_PREVIEW ? (
                        <button
                          type="button"
                          className="pron-lessonList__more"
                          onClick={() => setListExpanded((v) => !v)}
                        >
                          {listExpanded ? "Thu gọn danh sách" : "Xem thêm bài luyện ▾"}
                        </button>
                      ) : null}
                    </>
                  )}
                </section>

                <PronunciationStudio
                  drill={selectedDrill}
                  lessonGroup={selectedGroup}
                  wordIndex={wordIndex}
                  studio={studio}
                  canGoNext={canGoNext}
                  onNext={goNextWord}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
