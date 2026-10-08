import { NextResponse } from "next/server";
import { isLearnLessonChatEnabled } from "@/lib/beego/learn/learn-lesson-chat-flags";

export const dynamic = "force-dynamic";

/** Public flag probe — no quota, no lesson_chat_logs, no speaking entitlement. */
export async function GET() {
  return NextResponse.json({
    success: true,
    data: { enabled: isLearnLessonChatEnabled() },
  });
}
