"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LearnHeader from "./LearnHeader";
import BeegoLearningPath from "./BeegoLearningPath";
import BeegoMascotBubble from "./BeegoMascotBubble";
import LearnRightPanel from "./LearnRightPanel";
import LessonStartSheet from "./LessonStartSheet";
import { useActiveLearnSection } from "./useActiveLearnSection";
import {
  findCurrentSection,
  getMascotMessage,
  loadLearningPath,
} from "@/lib/beego/learning-path";
import { buildDailyMissions, MISSION_STATUS } from "@/lib/beego/daily-missions";
import { readOnboardingProfile } from "@/lib/beego/onboarding-storage";
import { isTestNode } from "@/lib/beego/learning-path-build";

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
  const [sheet, setSheet] = useState({ open: false, node: null, kind: "lesson" });

  const learnRootRef = useRef(null);
  const headerRef = useRef(null);
  const sectionRefs = useRef(new Map());

  const pathData = useMemo(() => loadLearningPath(dash), [dash]);
  const activeSectionId = useActiveLearnSection(pathData.sections, sectionRefs);
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

  useEffect(() => {
    let cancelled = false;
    setDashLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/dashboard", { cache: "no-store", credentials: "same-origin" });
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.success) setDash(json.data);
      } catch {
        /* fallback mock path */
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = learnRootRef.current;
    const header = headerRef.current;
    if (!root || !header) return;

    const syncOffset = () => {
      const height = header.getBoundingClientRect().height;
      const offset = Math.max(Math.ceil(height) + 16, 120);
      root.style.setProperty("--beego-learn-header-offset", `${offset}px`);
    };

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(header);
    return () => observer.disconnect();
  }, [activeSectionId, guideOpen]);

  const handleNodeClick = useCallback((node) => {
    setSheet({ open: true, node, kind: resolveSheetKind(node) });
  }, []);

  const closeSheet = useCallback(() => {
    setSheet({ open: false, node: null, kind: "lesson" });
  }, []);

  const streak = Number(dash?.streak ?? 7);
  const honeyPoints = Number(dash?.xp_total ?? 1250);

  return (
    <div className="beego-learn" ref={learnRootRef}>
      <LearnHeader
        ref={headerRef}
        section={activeSection}
        userName={userName}
        onGuideClick={() => setGuideOpen((v) => !v)}
      />

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
            <BeegoMascotBubble message={mascotMessage} />
            <BeegoLearningPath
              sections={pathData.sections}
              onNodeClick={handleNodeClick}
              onSectionRef={registerSectionRef}
            />
          </div>

          <LearnRightPanel
            sections={pathData.sections}
            streak={streak}
            honeyPoints={honeyPoints}
            missionsDone={missionsDone}
            missionsTotal={missions.length}
            loading={dashLoading}
          />
        </div>
      </div>

      <LessonStartSheet
        open={sheet.open}
        node={sheet.node}
        sheetKind={sheet.kind}
        onClose={closeSheet}
      />
    </div>
  );
}
