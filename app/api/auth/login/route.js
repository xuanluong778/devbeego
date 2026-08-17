import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureUsersAuthColumns } from "@/lib/auth/ensure-verification-schema";
import { resolveCookieSecure } from "@/lib/auth/resolve-cookie-secure";
import { generateSessionToken, verifyPassword } from "@/lib/auth";
import { normalizePhoneForStorage, phoneLoginCandidates } from "@/lib/phone-vn";
import { findUserByEmail } from "@/lib/auth/find-user-by-identifier";
import { ensureUserSessionsTable } from "@/lib/auth/ensure-session-schema";
import { syncLoginMeta } from "@/lib/auth/user-role";

const COOKIE_NAME = "session_token";
const SESSION_DAYS = 7;

export async function POST(request) {
  try {
    const body = await request.json();
    const identifier =
      typeof body.identifier === "string"
        ? body.identifier.trim()
        : typeof body.email === "string"
        ? body.email.trim()
        : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: "identifier and password are required." },
        { status: 400 }
      );
    }

    await ensureUsersAuthColumns(pool);
    await ensureUserSessionsTable();
    const normalizedIdentifier = identifier.toLowerCase();
    const isEmail = normalizedIdentifier.includes("@");

    let user;
    if (isEmail) {
      user = await findUserByEmail(pool, normalizedIdentifier);
    } else {
      const cleaned = String(identifier).replace(/[\s\u200B-\u200D\uFEFF-]/g, "");
      const candidates = [
        ...new Set([
          ...phoneLoginCandidates(cleaned),
          ...phoneLoginCandidates(normalizePhoneForStorage(cleaned)),
        ]),
      ].filter(Boolean);
      if (candidates.length === 0) {
        return NextResponse.json(
          { success: false, message: "identifier and password are required." },
          { status: 400 }
        );
      }
      const ph = candidates.map(() => "?").join(", ");
      const [rows] = await pool.query(
        `SELECT id, name, email, phone, password_hash
         FROM users
         WHERE TRIM(REPLACE(REPLACE(CONCAT(IFNULL(phone, '')), ' ', ''), '-', '')) IN (${ph})
         LIMIT 1`,
        candidates
      );
      user = rows[0];
    }

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
      "INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, token, expiresAt]
    );

    await syncLoginMeta(user.id, user.email);

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });

    const cookieSecure = resolveCookieSecure(request);

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure,
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { success: false, message: "Failed to login." },
      { status: 500 }
    );
  }
}
