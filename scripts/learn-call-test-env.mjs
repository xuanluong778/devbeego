/**
 * Shared env for Learn Call gateway tests.
 * REDIS_URL must come from the shell and must not be the Redis in .env.local.
 * VOICE_WS_PORT selects the test gateway (default 3032).
 */
import fs from "node:fs";

function redisAddress(url) {
  try {
    const u = new URL(url);
    const host = u.hostname === "localhost" || u.hostname === "::1" ? "127.0.0.1" : u.hostname;
    return `${host}:${u.port || "6379"}`;
  } catch {
    return "";
  }
}

export function loadLearnCallTestEnv() {
  const file = {};
  for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    if (!(key in file)) file[key] = t.slice(i + 1).trim();
  }
  const redisUrl = String(process.env.REDIS_URL || "").trim();
  const isolated = redisAddress(redisUrl);
  if (!isolated || isolated === redisAddress(String(file.REDIS_URL || ""))) {
    console.error("REFUSING: set REDIS_URL to an isolated test Redis, not the Redis in .env.local.");
    process.exit(2);
  }
  return {
    ...file,
    REDIS_URL: redisUrl,
    wsPort: Number(process.env.VOICE_WS_PORT || 3032),
  };
}
