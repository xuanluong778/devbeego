/**
 * Smoke: health + CSRF edge (admin mutation without Origin should 403 when cookie present).
 * Run on host: node scripts/test-saas-hardening-smoke.mjs
 * BASE=http://127.0.0.1:3025 node scripts/test-saas-hardening-smoke.mjs
 */
const BASE = process.env.BASE || "http://127.0.0.1:3025";

function ok(label, cond) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exitCode = 1;
    return;
  }
  console.log("OK:", label);
}

const health = await fetch(`${BASE}/api/health`);
ok("health 200", health.status === 200);

const csrfProbe = await fetch(`${BASE}/api/admin/path-templates`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: "session_token=invalid-probe-token",
  },
  body: "{}",
});
ok("admin POST with cookie, no Origin → 403 CSRF", csrfProbe.status === 403);
const csrfJson = await csrfProbe.json().catch(() => ({}));
ok("CSRF code present", csrfJson.code === "CSRF_ORIGIN");

const noCookie = await fetch(`${BASE}/api/admin/path-templates`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
ok(
  "admin POST without cookie not blocked by CSRF edge",
  noCookie.status !== 403 || (await noCookie.json().catch(() => ({}))).code !== "CSRF_ORIGIN"
);

console.log("Done saas hardening smoke (no load test).");
