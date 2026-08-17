import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { getAdminUserDetail } from "@/lib/admin/users-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdminUser(request);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden. Admin access only." }, { status: 403 });
  }
  const userId = Number(params.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ success: false, message: "Invalid user id." }, { status: 400 });
  }
  try {
    const data = await getAdminUserDetail(userId);
    if (!data) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to load user." }, { status: 500 });
  }
}
