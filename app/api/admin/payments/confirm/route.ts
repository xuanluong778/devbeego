import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { ensurePaymentsTable } from "@/lib/payments/ensure-payments-table";
import { upgradeUserPlanFromBankTransfer } from "@/lib/subscriptions/subscription-service";
import { normalizeBillingPeriod } from "@/lib/billing/plan-pricing";
import { requireSystemOwner } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentRow = {
  id: number;
  user_id: number;
  plan: "pro" | "vip";
  billing_period?: string | null;
  status: string;
};

export async function POST(request: NextRequest) {
  try {
    const admin = await requireSystemOwner(request);
    if (admin instanceof NextResponse) return admin;
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access only." },
        { status: 403 }
      );
    }

    let body: { paymentId?: number | string };
    try {
      body = (await request.json()) as { paymentId?: number | string };
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
    }

    const paymentId = Number(body.paymentId);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return NextResponse.json(
        { success: false, message: "paymentId is required." },
        { status: 400 }
      );
    }

    await ensurePaymentsTable();

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        `SELECT id, user_id, plan, billing_period, status
         FROM payments
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [paymentId]
      );

      const payment = (rows as PaymentRow[])[0];
      if (!payment) {
        await conn.rollback();
        return NextResponse.json({ success: false, message: "Payment not found." }, { status: 404 });
      }

      if (payment.status === "admin_confirmed") {
        await conn.commit();
        return NextResponse.json({
          success: true,
          data: { message: "Đã xác nhận trước đó." },
        });
      }

      if (payment.status !== "user_confirmed") {
        await conn.rollback();
        return NextResponse.json(
          {
            success: false,
            message: "Chỉ xác nhận được sau khi học viên đã bấm “Tôi đã chuyển khoản”.",
          },
          { status: 400 }
        );
      }

      const plan = payment.plan === "vip" ? "vip" : "pro";
      const billingPeriod = normalizeBillingPeriod(payment.billing_period);

      await upgradeUserPlanFromBankTransfer(Number(payment.user_id), plan, billingPeriod);

      await conn.query(
        `UPDATE payments
         SET status = 'admin_confirmed', confirmed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [paymentId]
      );

      await conn.commit();
      return NextResponse.json({
        success: true,
        data: { message: "Đã nâng cấp tài khoản." },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[admin/payments/confirm] POST", err);
    return NextResponse.json(
      { success: false, message: "Could not confirm payment." },
      { status: 500 }
    );
  }
}
