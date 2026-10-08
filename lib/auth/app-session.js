import crypto from "crypto";
import pool from "@/lib/db";
import { generateSessionToken } from "@/lib/auth";
import { ensureUserSessionsTable } from "@/lib/auth/ensure-session-schema";

export const SESSION_DAYS = 7;

export function hashRefreshToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

/**
 * Create session for Web (cookie) and/or App (Bearer + refresh).
 */
export async function createAppSession(userId, meta = {}) {
  await ensureUserSessionsTable();
  const platform = String(meta.platform || "web").slice(0, 32);
  const deviceId = meta.deviceId ? String(meta.deviceId).slice(0, 128) : null;
  const userAgent = meta.userAgent ? String(meta.userAgent).slice(0, 512) : null;
  const accessToken = generateSessionToken();
  const refreshRaw = generateRefreshToken();
  const refreshHash = hashRefreshToken(refreshRaw);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  try {
    await pool.query(
      `INSERT INTO user_sessions
         (user_id, token, expires_at, platform, device_id, refresh_token_hash, user_agent, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [userId, accessToken, expiresAt, platform, deviceId, refreshHash, userAgent]
    );
  } catch {
    await pool.query(
      `INSERT INTO user_sessions (user_id, token, expires_at) VALUES (?, ?, ?)`,
      [userId, accessToken, expiresAt]
    );
  }

  return {
    access_token: accessToken,
    refresh_token: refreshRaw,
    expires_at: expiresAt.toISOString(),
    token_type: "Bearer",
    platform,
  };
}

export async function revokeSessionByAccessToken(token) {
  if (!token) return;
  try {
    await pool.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE token = ? LIMIT 1`, [token]);
  } catch {
    await pool.query(`DELETE FROM user_sessions WHERE token = ? LIMIT 1`, [token]);
  }
}

export async function refreshAppSession(refreshToken) {
  const hash = hashRefreshToken(refreshToken);
  let rows;
  try {
    const [r] = await pool.query(
      `SELECT id, user_id, platform, device_id, user_agent
       FROM user_sessions
       WHERE refresh_token_hash = ?
         AND expires_at > NOW()
         AND (revoked_at IS NULL)
       LIMIT 1`,
      [hash]
    );
    rows = r;
  } catch {
    return null;
  }
  const row = rows[0];
  if (!row) return null;

  try {
    await pool.query(`UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?`, [row.id]);
  } catch {
    await pool.query(`DELETE FROM user_sessions WHERE id = ?`, [row.id]);
  }

  return createAppSession(Number(row.user_id), {
    platform: row.platform || "android",
    deviceId: row.device_id,
    userAgent: row.user_agent,
  });
}
