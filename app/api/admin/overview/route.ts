import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { getAdminOverview } from "@/lib/admin/users-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminUser(request, "dashboard.read");
  if (admin instanceof NextResponse) return admin;
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden. Admin access only." }, { status: 403 });
  }
  try {
    const data = await getAdminOverview();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to load overview." }, { status: 500 });
  }
}
