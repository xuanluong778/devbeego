const TZ = "Asia/Ho_Chi_Minh";

/** Hiển thị datetime DB (UTC-neutral wall) theo giờ Việt Nam. */
export function formatDateTimeVi(value: unknown): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("vi-VN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const VIETNAM_TZ_LABEL = "Giờ Việt Nam (UTC+7)";
