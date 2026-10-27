/**
 * Hosts/origins cho CSRF cookie-session (mở rộng qua env, không đổi UI).
 * ALLOWED_APP_ORIGINS=https://tenant.example.com,https://app.example.com
 */

const BUILTIN_ORIGINS = new Set([
  "https://beego.vn",
  "https://www.beego.vn",
  "https://dev.beego.vn",
  "http://localhost:3025",
  "http://127.0.0.1:3025",
  "http://localhost:3099",
  "http://127.0.0.1:3099",
]);

const BUILTIN_HOSTS = new Set(["beego.vn", "www.beego.vn", "dev.beego.vn", "localhost", "127.0.0.1"]);

let envOriginsCache = null;
let envHostsCache = null;

function loadEnvOrigins() {
  if (envOriginsCache) return envOriginsCache;
  envOriginsCache = new Set();
  envHostsCache = new Set();
  const raw = String(process.env.ALLOWED_APP_ORIGINS || "").trim();
  if (!raw) return envOriginsCache;
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      const u = new URL(trimmed);
      envOriginsCache.add(u.origin);
      envHostsCache.add(u.hostname.toLowerCase());
    } catch {
      /* skip invalid */
    }
  }
  return envOriginsCache;
}

export function isAllowedMutationOrigin(origin) {
  if (!origin) return false;
  if (BUILTIN_ORIGINS.has(origin)) return true;
  return loadEnvOrigins().has(origin);
}

export function isAllowedMutationHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (BUILTIN_HOSTS.has(h)) return true;
  loadEnvOrigins();
  return envHostsCache ? envHostsCache.has(h) : false;
}
