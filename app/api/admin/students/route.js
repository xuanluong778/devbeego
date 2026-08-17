import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { requireAdminUser } from "@/lib/admin/require-admin";

export async function GET(request) {
  try {
    const currentUser = await requireAdminUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access only." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim().toLowerCase();
    const onlineOnly = searchParams.get("online") === "1";
    const exportAll = searchParams.get("all") === "1";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(5, Number(searchParams.get("limit") || 12)));
    const offset = (page - 1) * limit;
    const onlineClause = onlineOnly
      ? " AND EXISTS (SELECT 1 FROM user_sessions sx WHERE sx.user_id = u.id AND sx.expires_at > NOW())"
      : "";

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM users u
       WHERE (? = '' OR LOWER(u.name) LIKE CONCAT('%', ?, '%') OR LOWER(u.email) LIKE CONCAT('%', ?, '%'))
       ${onlineClause}`,
      [q, q, q]
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const [rows] = await pool.query(
      `SELECT 
          u.id,
          u.name,
          u.email,
          u.created_at,
          MAX(s.created_at) AS last_login_at,
          SUM(CASE WHEN s.expires_at > NOW() THEN 1 ELSE 0 END) AS active_sessions,
          COUNT(s.id) AS login_count
       FROM users u
       LEFT JOIN user_sessions s ON s.user_id = u.id
       WHERE (? = '' OR LOWER(u.name) LIKE CONCAT('%', ?, '%') OR LOWER(u.email) LIKE CONCAT('%', ?, '%'))
       ${onlineClause}
       GROUP BY u.id, u.name, u.email, u.created_at
       ORDER BY u.created_at DESC
       ${exportAll ? "" : "LIMIT ? OFFSET ?"}`,
      exportAll ? [q, q, q] : [q, q, q, limit, offset]
    );

    const [statRows] = await pool.query(
      `SELECT
        COUNT(*) AS total_students,
        SUM(
          CASE 
            WHEN DATE(u.created_at) = CURDATE() THEN 1
            ELSE 0
          END
        ) AS registered_today
       FROM users u
       WHERE (? = '' OR LOWER(u.name) LIKE CONCAT('%', ?, '%') OR LOWER(u.email) LIKE CONCAT('%', ?, '%'))
       ${onlineClause}`,
      [q, q, q]
    );

    const [activeRows] = await pool.query(
      `SELECT COUNT(DISTINCT s.user_id) AS active_now
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
         AND (? = '' OR LOWER(u.name) LIKE CONCAT('%', ?, '%') OR LOWER(u.email) LIKE CONCAT('%', ?, '%'))`,
      [q, q, q]
    );

    return NextResponse.json({
      success: true,
      data: rows,
      stats: {
        total_students: Number(statRows[0]?.total_students || 0),
        active_now: Number(activeRows[0]?.active_now || 0),
        registered_today: Number(statRows[0]?.registered_today || 0),
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch students." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const currentUser = await requireAdminUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access only." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const userId = Number(body.user_id || 0);
    const revokeAllOnline = body.revoke_all_online === true;

    if (revokeAllOnline) {
      const [result] = await pool.query("DELETE FROM user_sessions WHERE expires_at > NOW()");
      return NextResponse.json({
        success: true,
        message: "Revoked all online sessions successfully.",
        data: { revoked_sessions: Number(result.affectedRows || 0) },
      });
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "user_id is required." },
        { status: 400 }
      );
    }

    const [result] = await pool.query("DELETE FROM user_sessions WHERE user_id = ?", [userId]);

    return NextResponse.json({
      success: true,
      message: "Revoked sessions successfully.",
      data: { revoked_sessions: Number(result.affectedRows || 0) },
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, message: "Failed to revoke user sessions." },
      { status: 500 }
    );
  }
}
