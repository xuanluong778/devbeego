#!/usr/bin/env node
/**
 * Runtime security regression checks against production base URL.
 */
const BASE = process.env.BEEGO_REGRESSION_BASE || "https://beego.vn";

const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { res, json };
}

async function main() {
  {
    const { res } = await fetchJson("/api/progress", {
      headers: { Authorization: "Bearer fake-token-phase2" },
    });
    record("fake_bearer_progress_401", res.status === 401, `status=${res.status}`);
  }

  {
    const { res } = await fetchJson("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer fake-token-phase2" },
      body: JSON.stringify({ lesson_id: 1, score: 100, user_id: 999999 }),
    });
    record("progress_idor_bearer_401", res.status === 401, `status=${res.status}`);
  }

  {
    const { res, json } = await fetchJson("/api/questions?limit=1");
    const hasLeak =
      json?.data?.questions?.[0]?.correct_option != null ||
      json?.data?.[0]?.correct_option != null;
    record("questions_no_auth_or_no_leak", res.status === 401 || !hasLeak, `status=${res.status} leak=${hasLeak}`);
  }

  {
    const { res } = await fetchJson("/api/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer fake-token-phase2" },
      body: JSON.stringify({ title: "x" }),
    });
    record("lessons_post_not_admin", res.status === 401 || res.status === 403, `status=${res.status}`);
  }

  {
    const { res, json } = await fetchJson("/api/billing/google-play", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer fake-token-phase2" },
      body: JSON.stringify({
        purchase_token: "fake-token",
        product_id: "beego_pro_monthly",
        package_name: "vn.beego.app",
      }),
    });
    record(
      "play_billing_forgery_blocked",
      res.status === 401 || json?.code === "VERIFY_REQUIRED" || res.status === 502,
      `status=${res.status} code=${json?.code}`
    );
  }

  {
    const { res, json } = await fetchJson("/api/review/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word_id: 1, answer_type: "easy", isCorrect: true }),
    });
    record(
      "review_tamper_unauth",
      res.status === 401 || res.status === 403 || res.status === 400,
      `status=${res.status} code=${json?.code}`
    );
  }

  {
    const { res, json } = await fetchJson("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer fake-token-phase2" },
      body: JSON.stringify({ word: "testspam", vietnamese_meaning: "x" }),
    });
    record("vocabulary_post_not_admin", res.status === 401 || res.status === 403, `status=${res.status}`);
  }

  {
    let voiceBlocked = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch("http://116.118.45.72:3031/", { signal: ctrl.signal }).catch(() => null);
      clearTimeout(t);
      voiceBlocked = !res || res.status >= 400;
    } catch {
      voiceBlocked = true;
    }
    record("voice_3031_not_public", voiceBlocked, voiceBlocked ? "unreachable/blocked" : "exposed");
  }

  {
    const res = await fetch(`${BASE}/`, { method: "HEAD" });
    const hsts = res.headers.get("strict-transport-security");
    const xcto = res.headers.get("x-content-type-options");
    record("nginx_security_headers", Boolean(hsts && xcto), `hsts=${Boolean(hsts)} xcto=${xcto}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log("\nSECURITY_REGRESSION=" + (failed.length ? "FAIL" : "PASS"));
  console.log("FAILED=" + failed.map((f) => f.name).join(",") || "none");
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
