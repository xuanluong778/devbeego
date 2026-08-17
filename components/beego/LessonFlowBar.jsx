"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LESSON_FLOW_STEPS, getFlowStepIndex } from "@/lib/beego/learning-flow";

export default function LessonFlowBar() {
  const pathname = usePathname();
  const current = getFlowStepIndex(pathname);

  return (
    <div className="beego-lesson-flow" aria-label="Các bước học bài">
      {LESSON_FLOW_STEPS.map((step, i) => {
        const className = `beego-lesson-flow-step ${i < current ? "beego-lesson-flow-step--done" : ""} ${i === current ? "beego-lesson-flow-step--current" : ""}`;
        return (
          <Link key={step.id} href={step.href} className={className}>
            {i < current ? "✓ " : ""}
            {step.label}
          </Link>
        );
      })}
    </div>
  );
}
