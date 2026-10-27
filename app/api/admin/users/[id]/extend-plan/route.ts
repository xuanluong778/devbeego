import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { ensureSubscriptionTables } from "@/lib/subscriptions/subscription-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdminUser(request, "students.plan");
  if (admin instanceof NextResponse) return admin;
  if (!admin) {
    return NextResponse.json({ success: false, message: "Forbidden. Admin access only." }, { status: 403 });
  }
  const userId = Number(params.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ success: false, message: "Invalid user id." }, { status: 400 });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { days?: number; plan?: string };
    const days = Math.min(365, Math.max(1, Number(body.days || 30)));
    const plan = body.plan === "vip" ? "vip" : body.plan === "pro" ? "pro" : null;
    await ensureSubscriptionTables();
    if (plan) {
      await pool.query(
        `UPDATE subscriptions SET
           plan = ?,
           expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL ? DAY),
           subscribed_at = COALESCE(subscribed_at, NOW()),
           updated_at = NOW()
         WHERE user_id = ?`,
        [plan, days, userId]
      );
    } else {
      await pool.query(
        `UPDATE subscriptions SET
           expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL ? DAY),
           updated_at = NOW()
         WHERE user_id = ?`,
        [days, userId]
      );
    }
    return NextResponse.json({
      success: true,
      message: `Đã gia hạn ${days} ngày cho user #${userId}.`,
    });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to extend plan." }, { status: 500 });
  }
}
