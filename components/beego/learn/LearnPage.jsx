"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LearnHeader from "./LearnHeader";
import BeegoLearningPath from "./BeegoLearningPath";
import BeegoMascotBubble from "./BeegoMascotBubble";
import LearnRightPanel from "./LearnRightPanel";
import LearnMobileStats from "./LearnMobileStats";
import LessonStartSheet from "./LessonStartSheet";
import { useActiveLearnSection } from "./useActiveLearnSection";
import { useScrollToActiveNode } from "./useScrollToActiveNode";
import {
  findCurrentSection,
  getMascotMessage,
  loadLearningPath,
} from "@/lib/beego/learning-path";
import { buildDailyMissions, MISSION_STATUS } from "@/lib/beego/daily-missions";
import { readOnboardingProfile } from "@/lib/beego/onboarding-storage";
import { isTestNode } from "@/lib/beego/learning-path-build";
import PlacementBanner from "./PlacementBanner";
import TodayForYouCard from "./TodayForYouCard";
import ProgressInsightsCard from "./ProgressInsightsCard";
import AchievementsCard from "./AchievementsCard";
import LearnContinueDock from "./LearnContinueDock";
import InstallAppOffer from "@/components/beego/InstallAppOffer";
import { LEARNING_PATH_UPDATED_EVENT } from "@/lib/beego/learn/complete-lesson-client";
import LessonAiConversation from "@/components/beego/lesson-player/LessonAiConversation";
import LearnLessonCall from "@/components/beego/lesson-player/LearnLessonCall";

function resolveSheetKind(node) {
  if (node.status === "locked") return "locked";
  if (isTestNode(node)) return "test";
  return "lesson";
}

export default function LearnPage() {
  const [profile, setProfile] = useState(null);
  const [userName, setUserName] = useState("");
  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [sheet, setSheet] = useState({ open: false, node: null, kind: "lesson", anchor: null });
  const [resumeAiLessonId, setResumeAiLessonId] = useState("");
  const [callEnabled, setCallEnabled] = useState(false);
  const [gateCall, setGateCall] = useState(null);
  const [justCompletedId, setJustCompletedId] = useState("");

  const [goalCelebrate, setGoalCelebrate] = useState(false);
  const [achievementToast, setAchievementToast] = useState(null);

  const learnRootRef = useRef(null);
  const mapScrollRef = useRef(0);
  const seenCompletedRef = useRef(null);
  const headerRef = useRef(null);
  const sectionRefs = useRef(new Map());

  const [pathPayload, setPathPayload] = useState(null);
  const pathData = useMemo(() => loadLearningPath(pathPayload), [pathPayload]);
  const activeSectionId = useActiveLearnSection(
    pathData.sections,
    sectionRefs,
    pathData.currentSectionId
  );
  const activeSection = useMemo(
    () =>
      pathData.sections.find((s) => s.sectionId === activeSectionId) ||
      findCurrentSection(pathData),
    [pathData, activeSectionId]
  );
  const mascotMessage = useMemo(
    () => getMascotMessage(pathData.sections, Number(dash?.streak ?? 0)),
    [pathData.sections, dash]
  );

  const missions = useMemo(
    () => buildDailyMissions(profile, dashLoading ? null : dash),
    [profile, dash, dashLoading]
  );
  const missionsDone = missions.filter((m) => m.status === MISSION_STATUS.COMPLETED).length;

  const registerSectionRef = useCallback((sectionId, el) => {
    if (el) sectionRefs.current.set(sectionId, el);
    else sectionRefs.current.delete(sectionId);
  }, []);

  useScrollToActiveNode(pathData.sections, true);

  useEffect(() => {
    let cancel = false;
    fetch("/api/learn/ai-call/status", { cache: "no-store", credentials: "same-origin" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancel) setCallEnabled(Boolean(json?.data?.enabled));
      })
      .catch(() => {
        if (!cancel) setCallEnabled(false);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const ids = [];
    for (const section of pathData.sections || []) {
      for (const node of section.nodes || []) {
        if (node.status === "completed") ids.push(node.lessonId);
      }
    }
    if (!seenCompletedRef.current) {
      seenCompletedRef.current = new Set(ids);
      return;
    }
    const fresh = ids.find((id) => !seenCompletedRef.current.has(id));
    seenCompletedRef.current = new Set(ids);
    if (!fresh) return;
    setJustCompletedId(fresh);
    const timer = window.setTimeout(() => setJustCompletedId(""), 2200);
    return () => window.clearTimeout(timer);
  }, [pathData]);

  const openGateCall = useCallback((target) => {
    mapScrollRef.current = window.scrollY;
    setGateCall(target);
  }, []);

  const closeGateCall = useCallback(() => {
    setGateCall(null);
    const top = mapScrollRef.current;
    window.requestAnimationFrame(() => window.scrollTo(0, top));
  }, []);

  useEffect(() => {
    const load = () => setProfile(readOnboardingProfile());
    load();
    window.addEventListener("beego:onboarding", load);
    return () => window.removeEventListener("beego:onboarding", load);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && json.success) {
          setUserName(json.data?.name || "");
        }
      } catch {
        /* guest */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLearningPath = useCallback(async (opts = {}) => {
    const { refreshDashboard = false } = opts;
    try {
      const fetches = [
        fetch("/api/learning-path", { cache: "no-store", credentials: "same-origin" }),
      ];
      if (refreshDashboard) {
        fetches.push(fetch("/api/dashboard", { cache: "no-store", credentials: "same-origin" }));
      }
      const [pathRes, dashRes] = await Promise.all(fetches);
      const pathJson = await pathRes.json().catch(() => null);
      if (pathRes.ok && pathJson?.success && pathJson.data) {
        setPathPayload(pathJson.data);
        const p = pathJson.data.progress;
        if (p) {
          setDash((prev) => ({
            ...(prev || {}),
            xp_total: Number(p.xp_total ?? prev?.xp_total ?? 0),
            honey_total: Number(p.honey_total ?? 0),
            streak: Number(p.streak ?? prev?.streak ?? 0),
            active_lesson_id: p.active_lesson_id,
            xp_today: Number(p.xp_today ?? prev?.xp_today ?? 0),
            daily_goal_xp: Number(p.daily_goal_xp ?? prev?.daily_goal_xp ?? 30),
            daily_goal_progress_pct: Number(
              p.daily_goal_progress_pct ?? prev?.daily_goal_progress_pct ?? 0
            ),
            daily_goal_completed: Boolean(
              p.daily_goal_completed ?? prev?.daily_goal_completed ?? false
            ),
          }));
        }
        const dm = pathJson.data.daily_motivation;
        if (dm && !dm.guest) {
          setDash((prev) => ({
            ...(prev || {}),
            streak: Number(dm.streak ?? prev?.streak ?? 0),
            xp_today: Number(dm.xp_today ?? 0),
            daily_goal_xp: Number(dm.daily_goal_xp ?? 30),
            daily_goal_progress_pct: Number(dm.daily_goal_progress_pct ?? 0),
            daily_goal_completed: Boolean(dm.daily_goal_completed),
          }));
          if (dm.daily_goal_just_completed || dm.daily_goal_completed) {
            try {
              const key = `beego:daily-goal-celebrate:${dm.progress_date || ""}`;
              if (dm.daily_goal_just_completed && !sessionStorage.getItem(key)) {
                sessionStorage.setItem(key, "1");
                setGoalCelebrate(true);
                window.setTimeout(() => setGoalCelebrate(false), 3200);
              }
            } catch {
              /* ignore */
            }
          }
        }
      }
      if (refreshDashboard && dashRes) {
        const dashJson = await dashRes.json().catch(() => null);
        if (dashRes.ok && dashJson?.success) setDash(dashJson.data);
      }
    } catch {
      /* guest empty path */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setDashLoading(true);
    (async () => {
      await refreshLearningPath({ refreshDashboard: true });
      if (!cancelled) setDashLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLearningPath]);

  const showAchievementToast = useCallback((list) => {
    if (!Array.isArray(list) || !list.length) return;
    const first = list[0];
    setAchievementToast(first);
    window.setTimeout(() => setAchievementToast(null), 2800);
  }, []);

  useEffect(() => {
    const onPathUpdated = (ev) => {
      const detail = ev?.detail;
      const dm = detail?.daily_motivation || detail?.path?.daily_motivation;
      if (dm?.daily_goal_just_completed) {
        try {
          const key = `beego:daily-goal-celebrate:${dm.progress_date || ""}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            setGoalCelebrate(true);
            window.setTimeout(() => setGoalCelebrate(false), 3200);
          }
        } catch {
          /* ignore */
        }
      }
      const unlocked = detail?.achievements_unlocked;
      if (Array.isArray(unlocked) && unlocked.length) {
        showAchievementToast(unlocked);
      }
      void refreshLearningPath({ refreshDashboard: false });
    };
    window.addEventListener(LEARNING_PATH_UPDATED_EVENT, onPathUpdated);
    return () => window.removeEventListener(LEARNING_PATH_UPDATED_EVENT, onPathUpdated);
  }, [refreshLearningPath, showAchievementToast]);

  useEffect(() => {
    const root = learnRootRef.current;
    const header = headerRef.current;
    if (!root || !header) return;

    const syncOffset = () => {
      const height = header.getBoundingClientRect().height;
      const offset = Math.max(Math.ceil(height) + 16, 100);
      root.style.setProperty("--beego-learn-header-offset", `${offset}px`);
    };

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(header);
    return () => observer.disconnect();
  }, [activeSectionId, guideOpen]);

  const handleNodeClick = useCallback((node) => {
    let anchor = null;
    try {
      const el = document.querySelector(`[data-lesson-id="${CSS.escape(node.lessonId)}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        anchor = { top: r.top, left: r.left, width: r.width, height: r.height };
      }
    } catch {
      /* ignore */
    }
    setSheet({ open: true, node, kind: resolveSheetKind(node), anchor });
  }, []);

  const closeSheet = useCallback(() => {
    setSheet({ open: false, node: null, kind: "lesson", anchor: null });
  }, []);

  const streak = Number(dash?.streak ?? 0);
  const honeyPoints = Number(dash?.honey_total ?? dash?.xp_total ?? 0);
  const xpToday = Number(dash?.xp_today ?? 0);
  const dailyGoalXp = Number(dash?.daily_goal_xp ?? 30);
  const dailyGoalPct = Number(dash?.daily_goal_progress_pct ?? 0);
  const dailyGoalCompleted = Boolean(dash?.daily_goal_completed);

  return (
    <div className="beego-learn beego-learn--has-continue-dock" ref={learnRootRef}>
      <LearnHeader
        ref={headerRef}
        section={activeSection}
        userName={userName}
        onGuideClick={() => setGuideOpen((v) => !v)}
      />

      {goalCelebrate ? (
        <div className="beego-learn-goal-toast" role="status">
          🎯 Daily Goal đạt rồi! Giữ streak và học tiếp ngày mai.
        </div>
      ) : null}

      {achievementToast ? (
        <div className="beego-achievement-toast" role="status">
          {achievementToast.icon} Mở khóa: {achievementToast.title}
        </div>
      ) : null}

      {guideOpen ? (
        <div className="beego-learn-guide" role="note">
          <p>
            <strong>Lộ trình Beego:</strong> Hoàn thành từng bài theo thứ tự để mở khóa bài tiếp theo,
            rương thưởng và thử thách cuối cụm. Mỗi ngày chỉ cần 5 phút!
          </p>
          <button type="button" onClick={() => setGuideOpen(false)}>
            Đóng
          </button>
        </div>
      ) : null}

      <div className="beego-learn__body">
        <div className="beego-learn__layout">
          <div className="beego-learn__main">
            <PlacementBanner
              onApplied={() => {
                void refreshLearningPath({ refreshDashboard: true });
              }}
            />
            <TodayForYouCard />
            <LearnMobileStats
              streak={streak}
              honeyPoints={honeyPoints}
              xpToday={xpToday}
              dailyGoalXp={dailyGoalXp}
              dailyGoalPct={dailyGoalPct}
              dailyGoalCompleted={dailyGoalCompleted}
              celebrate={goalCelebrate}
              loading={dashLoading}
            />
            <BeegoMascotBubble message={mascotMessage} />
            <InstallAppOffer variant="card" />
            <BeegoLearningPath
              sections={pathData.sections}
              activeSectionId={activeSectionId || pathData.currentSectionId}
              onNodeClick={handleNodeClick}
              onGateCall={openGateCall}
              callEnabled={callEnabled}
              justCompletedId={justCompletedId}
              onSectionRef={registerSectionRef}
            />
            <details className="beego-learn-collapse">
              <summary className="beego-learn-collapse__summary">Tiến độ &amp; thành tích</summary>
              <div className="beego-learn-collapse__body">
                <ProgressInsightsCard />
                <AchievementsCard onToast={showAchievementToast} />
              </div>
            </details>
          </div>

          <LearnRightPanel
            sections={pathData.sections}
            streak={streak}
            honeyPoints={honeyPoints}
            missionsDone={missionsDone}
            missionsTotal={missions.length}
            loading={dashLoading}
            xpToday={xpToday}
            dailyGoalXp={dailyGoalXp}
            dailyGoalPct={dailyGoalPct}
            dailyGoalCompleted={dailyGoalCompleted}
          />
        </div>
      </div>

      <LearnContinueDock sections={pathData.sections} loading={dashLoading} />

      <LessonStartSheet
        open={sheet.open}
        node={sheet.node}
        sheetKind={sheet.kind}
        anchor={sheet.anchor}
        onClose={closeSheet}
        onResumeAi={(lessonId) => {
          closeSheet();
          setResumeAiLessonId(lessonId);
        }}
      />
      {gateCall ? (
        <div className="beego-learn-call-layer" role="dialog" aria-label="Gọi gia sư AI">
          <LearnLessonCall
            lessonId={gateCall.lessonId}
            lessonType={gateCall.lessonType}
            sectionId={gateCall.sectionId}
            autoCheck
            returnLabel="Quay lại bản đồ"
            onDismiss={closeGateCall}
          />
        </div>
      ) : null}
      {resumeAiLessonId ? (
        <LessonAiConversation
          lessonId={resumeAiLessonId}
          onClose={() => setResumeAiLessonId("")}
        />
      ) : null}
    </div>
  );
}
