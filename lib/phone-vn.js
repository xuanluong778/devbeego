/**
 * Chuẩn hóa SĐT Việt Nam để lưu DB và để đăng nhập khớp nhiều dạng nhập (0xx / 84xx / 9 số).
 */

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

/** Dạng lưu E.164: +84 + 9 số (ví dụ 0976086500 → +84976086500). */
export function normalizePhoneE164(raw) {
  const d = digitsOnly(raw);
  if (!d) return "";
  let national = "";
  if (d.startsWith("84") && d.length >= 11) {
    national = d.slice(2);
  } else if (d.startsWith("0") && d.length === 10) {
    national = d.slice(1);
  } else if (d.length === 9 && !d.startsWith("0")) {
    national = d;
  } else {
    return "";
  }
  if (national.length !== 9) return "";
  return `+84${national}`;
}

/** Dạng lưu: 84 + 9 số (ví dụ 0976086500 → 84976086500). */
export function normalizePhoneForStorage(raw) {
  const e164 = normalizePhoneE164(raw);
  if (e164) return e164;
  const d = digitsOnly(raw);
  if (!d) return "";
  if (d.startsWith("84") && d.length >= 10) {
    return d;
  }
  if (d.startsWith("0") && d.length === 10) {
    return `84${d.slice(1)}`;
  }
  if (d.length === 9) {
    return `84${d}`;
  }
  return d;
}

/** Các biến thể dùng cho WHERE phone IN (...) khi đăng nhập. */
export function phoneLoginCandidates(raw) {
  const digits = digitsOnly(raw);
  const out = new Set();
  if (!digits) return [];

  out.add(digits);

  if (digits.length === 10 && digits.startsWith("0")) {
    out.add(`84${digits.slice(1)}`);
    out.add(digits.slice(1));
  }
  if (digits.length === 11 && digits.startsWith("84")) {
    out.add(`0${digits.slice(2)}`);
    out.add(digits.slice(2));
  }
  if (digits.length === 9 && !digits.startsWith("0")) {
    out.add(`0${digits}`);
    out.add(`84${digits}`);
  }

  const canonical = normalizePhoneForStorage(digits);
  if (canonical) out.add(canonical);

  const e164 = normalizePhoneE164(raw);
  if (e164) {
    out.add(e164);
    out.add(e164.slice(1));
    const d84 = digitsOnly(e164);
    if (d84.startsWith("84") && d84.length === 11) {
      out.add(`0${d84.slice(2)}`);
      out.add(d84.slice(2));
    }
  }

  return [...out];
}
