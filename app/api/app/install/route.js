import { NextResponse } from "next/server";
import { readOfficialApkStatus } from "@/lib/beego/install-apk-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = readOfficialApkStatus();
  return NextResponse.json({ success: true, data });
}
