import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/require-admin";
import { upgradeUserPlanFromBankTransfer } from "@/lib/subscriptions/subscription-service";

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
    const body = (await request.json().catch(() => ({}))) as { plan?: string; billing_period?: string };
    const plan = body.plan === "vip" ? "vip" : "pro";
    const billingPeriod = body.billing_period === "yearly" ? "yearly" : "monthly";
    const sub = await upgradeUserPlanFromBankTransfer(userId, plan, billingPeriod);
    return NextResponse.json({
      success: true,
      message: `Đã kích hoạt gói ${plan.toUpperCase()} cho user #${userId}.`,
      data: sub,
    });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to activate plan." }, { status: 500 });
  }
}
