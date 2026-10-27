/**
 * Client IP behind reverse proxy.
 * Prefer X-Real-IP (set by nginx), else the first X-Forwarded-For hop.
 * Direct connections without those headers share bucket "unknown".
 */
export function clientIpFromRequest(request) {
  const h = request?.headers;
  const get = (name) => h?.get?.(name) || h?.get?.(name.toLowerCase()) || "";
  const real = String(get("x-real-ip")).trim();
  if (real) return real.split(",")[0].trim();
  const xf = String(get("x-forwarded-for")).trim();
  if (xf) return xf.split(",")[0].trim();
  return "unknown";
}
