import crypto from "crypto";
import pool from "@/lib/db";

let ready = false;

export async function ensureOAuthAppTables() {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_app_links (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      provider VARCHAR(32) NOT NULL DEFAULT 'google',
      state_hash VARCHAR(128) NOT NULL,
      redirect_uri VARCHAR(512) NOT NULL,
      platform VARCHAR(32) NOT NULL DEFAULT 'android',
      device_id VARCHAR(128) NULL,
      next_path VARCHAR(512) NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_oauth_state (state_hash),
      KEY idx_oauth_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS oauth_native_codes (
      code_hash VARCHAR(128) NOT NULL PRIMARY KEY,
      access_token VARCHAR(128) NOT NULL,
      refresh_token VARCHAR(255) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_onc_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  for (const sql of [
    "ALTER TABLE oauth_app_links ADD COLUMN device_id VARCHAR(128) NULL",
    "ALTER TABLE oauth_app_links ADD COLUMN next_path VARCHAR(512) NULL",
  ]) {
    try {
      await pool.query(sql);
    } catch {
      /* exists */
    }
  }
  ready = true;
}

export function hashOAuthValue(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

export async function saveAndroidOAuthState({ state, redirectUri, deviceId, nextPath }) {
  await ensureOAuthAppTables();
  const stateHash = hashOAuthValue(state);
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await pool.query(
    `INSERT INTO oauth_app_links
       (provider, state_hash, redirect_uri, platform, device_id, next_path, expires_at)
     VALUES ('google', ?, ?, 'android', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       redirect_uri = VALUES(redirect_uri),
       device_id = VALUES(device_id),
       next_path = VALUES(next_path),
       expires_at = VALUES(expires_at),
       used_at = NULL`,
    [stateHash, redirectUri, deviceId || null, nextPath || null, expires]
  );
}

export async function consumeAndroidOAuthState(state) {
  await ensureOAuthAppTables();
  const stateHash = hashOAuthValue(state);
  const [rows] = await pool.query(
    `SELECT id, device_id, next_path FROM oauth_app_links
     WHERE state_hash = ? AND platform = 'android'
       AND expires_at > NOW() AND used_at IS NULL
     LIMIT 1`,
    [stateHash]
  );
  const row = rows[0];
  if (!row) return null;
  await pool.query(`UPDATE oauth_app_links SET used_at = NOW() WHERE id = ?`, [row.id]);
  return {
    deviceId: row.device_id ? String(row.device_id) : null,
    nextPath: row.next_path ? String(row.next_path) : "/",
  };
}

/** One-time code (2 min) for native app to exchange tokens without putting them in URL long-term. */
export async function issueNativeAuthCode({ accessToken, refreshToken, userId }) {
  await ensureOAuthAppTables();
  const code = crypto.randomBytes(32).toString("hex");
  const codeHash = hashOAuthValue(code);
  const expires = new Date(Date.now() + 2 * 60 * 1000);
  await pool.query(
    `INSERT INTO oauth_native_codes
       (code_hash, access_token, refresh_token, user_id, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [codeHash, accessToken, refreshToken, userId, expires]
  );
  return code;
}

export async function exchangeNativeAuthCode(code) {
  await ensureOAuthAppTables();
  const codeHash = hashOAuthValue(code);
  const [rows] = await pool.query(
    `SELECT access_token, refresh_token, user_id FROM oauth_native_codes
     WHERE code_hash = ? AND expires_at > NOW() AND used_at IS NULL
     LIMIT 1`,
    [codeHash]
  );
  const row = rows[0];
  if (!row) return null;
  await pool.query(`UPDATE oauth_native_codes SET used_at = NOW() WHERE code_hash = ?`, [codeHash]);
  return {
    access_token: String(row.access_token),
    refresh_token: String(row.refresh_token),
    user_id: Number(row.user_id),
  };
}
