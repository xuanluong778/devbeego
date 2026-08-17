/** Lesson flow: Xem → Nghe → Nói → Làm bài → Hoàn thành */

import { LISTENING_PATH, SPEAKING_PATH, isListeningPath, isSpeakingPath } from "@/lib/beego/routes";

export const LESSON_FLOW_STEPS = [
  { id: "view", label: "Xem", href: "/vocabulary" },
  { id: "listen", label: "Nghe", href: LISTENING_PATH },
  { id: "speak", label: "Nói theo", href: SPEAKING_PATH },
  { id: "quiz", label: "Làm bài", href: "/quiz" },
  { id: "done", label: "Hoàn thành", href: "/progress" },
];

export function getFlowStepIndex(pathname) {
  if (isSpeakingPath(pathname)) return 2;
  if (isListeningPath(pathname)) return 1;
  if (pathname.startsWith("/quiz")) return 3;
  if (pathname.startsWith("/progress") || pathname === "/") return 4;
  if (pathname.startsWith("/vocabulary")) return 1;
  return 0;
}
