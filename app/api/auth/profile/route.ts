import { NextResponse, type NextRequest } from "next/server";
import pool from "@/lib/db";
import { ensureUserProfileColumns } from "@/lib/users/ensure-user-profile-columns";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";

function parseDob(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "__invalid__";
  const d = new Date(s + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "__invalid__";
  return s;
}

export async function PATCH(request: NextRequest) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    let body: { date_of_birth?: string | null };
    try {
      body = (await request.json()) as { date_of_birth?: string | null };
    } catch {
      return NextResponse.json({ success: false, message: "Invalid JSON." }, { status: 400 });
    }

    await ensureUserProfileColumns();

    if ("date_of_birth" in body) {
      const dob = parseDob(body.date_of_birth);
      if (dob === "__invalid__") {
        return NextResponse.json(
          { success: false, message: "Ngày sinh cần định dạng YYYY-MM-DD." },
          { status: 400 }
        );
      }
      await pool.query(`UPDATE users SET date_of_birth = ? WHERE id = ?`, [dob, user.id]);
    }

    const [out] = await pool.query(
      `SELECT id, name, email, phone, avatar_url, date_of_birth FROM users WHERE id = ? LIMIT 1`,
      [user.id]
    );
    return NextResponse.json({ success: true, data: (out as object[])[0] || null });
  } catch (err) {
    console.error("[auth/profile] PATCH", err);
    return NextResponse.json({ success: false, message: "Could not update profile." }, { status: 500 });
  }
}
