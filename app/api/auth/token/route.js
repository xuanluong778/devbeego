import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureUsersAuthColumns } from "@/lib/auth/ensure-verification-schema";
import { verifyPassword } from "@/lib/auth";
import { normalizePhoneForStorage, phoneLoginCandidates } from "@/lib/phone-vn";
import { findUserByEmail } from "@/lib/auth/find-user-by-identifier";
import { ensureUserSessionsTable } from "@/lib/auth/ensure-session-schema";
import { syncLoginMeta } from "@/lib/auth/user-role";
import { createAppSession } from "@/lib/auth/app-session";
import { loadUserPayload } from "@/lib/auth/create-session";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Android / Capacitor login — returns Bearer access + refresh tokens.
 * Web continues to use cookie auth via /api/auth/login.
 */
export async function POST(request) {
  try {
    const rl = await checkRateLimit(request, { key: "auth_token", windowMs: 60_000, max: 20 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const body = await request.json();
    const identifier =
      typeof body.identifier === "string"
        ? body.identifier.trim()
        : typeof body.email === "string"
          ? body.email.trim()
          : "";
    const password = typeof body.password === "string" ? body.password : "";
    const platform = String(body.platform || "android").slice(0, 32);
    const deviceId = body.device_id ? String(body.device_id).slice(0, 128) : null;

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
      if (!candidates.length) {
        return NextResponse.json(
          { success: false, message: "identifier and password are required." },
          { status: 400 }
        );
      }
      const ph = candidates.map(() => "?").join(", ");
      const [rows] = await pool.query(
        `SELECT id, name, email, phone, password_hash, is_active
         FROM users
         WHERE TRIM(REPLACE(REPLACE(CONCAT(IFNULL(phone, '')), ' ', ''), '-', '')) IN (${ph})
         LIMIT 1`,
        candidates
      );
      user = rows[0];
    }

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ success: false, message: "Invalid email or password." }, { status: 401 });
    }
    if (Number(user.is_active) === 0) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    await syncLoginMeta(user.id, user.email);
    const session = await createAppSession(user.id, {
      platform,
      deviceId,
      userAgent: request.headers.get("user-agent"),
    });
    const payload = await loadUserPayload(user.id);

    return NextResponse.json({
      success: true,
      message: "Login successful.",
      data: {
        user: payload,
        ...session,
      },
    });
  } catch (err) {
    console.error("[auth/token]", err);
    return NextResponse.json({ success: false, message: "Failed to issue token." }, { status: 500 });
  }
}
