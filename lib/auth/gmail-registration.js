/** Chính sách đăng ký Gmail — chặn dot-trick và alias +tag. */

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export function isGmailAddress(email) {
  const parts = String(email || "")
    .trim()
    .toLowerCase()
    .split("@");
  if (parts.length !== 2) return false;
  return GMAIL_DOMAINS.has(parts[1]);
}

/** Local part chuẩn Gmail: bỏ dấu chấm, bỏ +alias. */
export function normalizeGmailLocalPart(local) {
  const base = String(local || "").split("+")[0].replace(/\./g, "");
  return base.toLowerCase();
}

/** Email canonical để so trùng (googlemail.com → gmail.com). */
export function gmailCanonicalEmail(email) {
  const raw = String(email || "").trim().toLowerCase();
  const at = raw.lastIndexOf("@");
  if (at <= 0) return raw;
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (!GMAIL_DOMAINS.has(domain)) return raw;
  const canonDomain = "gmail.com";
  return `${normalizeGmailLocalPart(local)}@${canonDomain}`;
}

/**
 * Kiểm tra email trước khi đăng ký / gửi OTP.
 * Gmail: không cho local part chứa '.' hoặc '+'.
 */
export function validateRegistrationEmail(email) {
  const raw = String(email || "").trim().toLowerCase();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return { ok: false, message: "Email không hợp lệ." };
  }

  const at = raw.lastIndexOf("@");
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);

  if (!GMAIL_DOMAINS.has(domain)) {
    return { ok: true, email: raw };
  }

  if (local.includes(".")) {
    return {
      ok: false,
      message:
        "Gmail có dấu chấm (.) không được dùng để đăng ký. Vui lòng nhập địa chỉ Gmail gốc, ví dụ: tenban@gmail.com thay vì te.n.ban@gmail.com.",
    };
  }

  if (local.includes("+")) {
    return {
      ok: false,
      message: "Gmail alias (dấu +) không được dùng để đăng ký. Vui lòng dùng địa chỉ Gmail chính.",
    };
  }

  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i.test(local)) {
    return { ok: false, message: "Địa dạng Gmail không hợp lệ." };
  }

  return { ok: true, email: `${local}@${domain === "googlemail.com" ? "gmail.com" : domain}` };
}

/** So trùng email, kể cả biến thể dot-trick Gmail đã tồn tại trong DB. */
export async function findDuplicateRegistrationEmail(pool, email) {
  const raw = String(email || "").trim().toLowerCase();
  const validation = validateRegistrationEmail(raw);

  if (!isGmailAddress(raw)) {
    if (!validation.ok) {
      return { duplicate: false, validation };
    }
    const [exact] = await pool.query("SELECT id, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [
      validation.email,
    ]);
    if (exact.length > 0) {
      return { duplicate: true, validation, existing: exact[0] };
    }
    return { duplicate: false, validation };
  }

  const targetCanonical = gmailCanonicalEmail(raw);

  if (validation.ok) {
    const [exact] = await pool.query("SELECT id, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1", [
      validation.email,
    ]);
    if (exact.length > 0) {
      return { duplicate: true, validation, existing: exact[0] };
    }
  }

  const [gmailRows] = await pool.query(
    `SELECT id, email FROM users
     WHERE email IS NOT NULL
       AND (LOWER(email) LIKE '%@gmail.com' OR LOWER(email) LIKE '%@googlemail.com')
     LIMIT 5000`
  );

  for (const row of gmailRows) {
    if (gmailCanonicalEmail(row.email) === targetCanonical) {
      return { duplicate: true, validation, existing: row };
    }
  }

  return { duplicate: false, validation };
}
