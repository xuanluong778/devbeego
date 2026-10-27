import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { ensurePaymentsTable } from "@/lib/payments/ensure-payments-table";
import { requireSystemOwner } from "@/lib/admin/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await requireSystemOwner(request);
    if (admin instanceof NextResponse) return admin;
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access only." },
        { status: 403 }
      );
    }

    await ensurePaymentsTable();

    const { searchParams } = new URL(request.url);
    const rawQ = String(searchParams.get("q") || "").trim();
    const q = rawQ.toLowerCase();

    const [rows] = await pool.query(
      `SELECT
         p.id,
         p.user_id,
         u.name,
         u.email,
         p.plan,
         p.billing_period,
         p.amount,
         p.transfer_content,
         p.status,
         p.created_at,
         p.updated_at,
         p.confirmed_at
       FROM payments p
       INNER JOIN users u ON u.id = p.user_id
       WHERE p.status IN ('user_confirmed', 'admin_confirmed')
         AND (
           ? = ''
           OR LOWER(u.email) LIKE CONCAT('%', ?, '%')
           OR LOWER(u.name) LIKE CONCAT('%', ?, '%')
           OR LOWER(IFNULL(p.transfer_content, '')) LIKE CONCAT('%', ?, '%')
         )
       ORDER BY
         CASE WHEN p.status = 'user_confirmed' THEN 0 ELSE 1 END,
         p.updated_at DESC
       LIMIT 200`,
      [q, q, q, q]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("[admin/payments] GET error", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch payments." },
      { status: 500 }
    );
  }
}