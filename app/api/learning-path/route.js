import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { getLearningPathForUser } from "@/lib/beego/learning-path-progress";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    const userId = user?.id ?? null;
    if (user && user.is_active !== 1) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    const path = await getLearningPathForUser(userId);
    return NextResponse.json({
      success: true,
      data: path,
      authenticated: Boolean(userId),
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load learning path.${detail}`.trim() },
      { status: 500 }
    );
  }
}
