import { gmailCanonicalEmail, isGmailAddress } from "@/lib/auth/gmail-registration";
import { normalizePhoneE164, phoneLoginCandidates } from "@/lib/phone-vn";

const USER_FIELDS = "id, name, email, phone, password_hash, is_active";

export async function findUserByEmail(pool, email) {
  const raw = String(email || "")
    .trim()
    .toLowerCase();
  if (!raw || !raw.includes("@")) return null;

  const [exact] = await pool.query(`SELECT ${USER_FIELDS} FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1`, [
    raw,
  ]);
  if (exact[0]) return exact[0];

  if (!isGmailAddress(raw)) return null;

  const targetCanonical = gmailCanonicalEmail(raw);
  const [gmailRows] = await pool.query(
    `SELECT ${USER_FIELDS} FROM users
     WHERE email IS NOT NULL
       AND (LOWER(email) LIKE '%@gmail.com' OR LOWER(email) LIKE '%@googlemail.com')
     LIMIT 5000`
  );

  for (const row of gmailRows) {
    if (gmailCanonicalEmail(row.email) === targetCanonical) {
      return row;
    }
  }

  return null;
}

export async function findUserByPhone(pool, phoneRaw) {
  const candidates = [
    ...new Set([
      ...phoneLoginCandidates(phoneRaw),
      ...phoneLoginCandidates(normalizePhoneE164(phoneRaw) || ""),
    ]),
  ].filter(Boolean);
  if (!candidates.length) return null;

  const marks = candidates.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT ${USER_FIELDS}
     FROM users
     WHERE TRIM(REPLACE(REPLACE(CONCAT(IFNULL(phone, '')), ' ', ''), '-', '')) IN (${marks})
        OR phone IN (${marks})
     LIMIT 1`,
    [...candidates, ...candidates]
  );
  return rows[0] || null;
}
