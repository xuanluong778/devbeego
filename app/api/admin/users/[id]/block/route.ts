import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdminUser } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";

export async function POST(
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
  if (userId === admin.id) {
    return NextResponse.json({ success: false, message: "Cannot block yourself." }, { status: 400 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { block?: boolean };
    const block = body.block !== false;
    await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [block ? 0 : 1, userId]);
    if (block) {
      await pool.query("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
    }
    return NextResponse.json({
      success: true,
      message: block ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.",
    });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to update account status." }, { status: 500 });
  }
}
