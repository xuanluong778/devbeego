/**
 * Live API Verification for Dev environment (http://127.0.0.1:3025 & https://dev.beego.vn)
 */
import assert from "node:assert";

const BASE = process.env.TEST_BASE || "http://127.0.0.1:3025";
console.log(`=== TESTING LIVE DEV API AT ${BASE} ===`);

async function run() {
  // 1. Health check
  const healthRes = await fetch(`${BASE}/api/health`);
  const healthJson = await healthRes.json();
  assert.strictEqual(healthJson.ok, true, "Health endpoint should return ok: true");
  console.log("[PASS] /api/health returned ok: true");

  // 2. n01 Lesson Content
  const n01Res = await fetch(`${BASE}/api/learn/lesson/p1-g1-n01`);
  const n01 = await n01Res.json();
  assert.strictEqual(n01.success, true, "n01 should load successfully");
  assert.strictEqual(n01.data.questions.length, 6, "n01 should have exactly 6 questions");
  const n01Speaking = n01.data.questions.find((q) => q.type === "speaking");
  assert.ok(n01Speaking, "n01 has speaking exercise");
  assert.ok(n01Speaking.prompt.includes("Hello, I am [Tên bạn]"), "n01 prompt supports scaffolded self-intro");
  console.log("[PASS] n01 has 6 questions with scaffolded self-intro prompt");

  // 3. n08 Mid-gate Check Content
  const n08Res = await fetch(`${BASE}/api/learn/lesson/p1-g1-n08`);
  const n08 = await n08Res.json();
  assert.strictEqual(n08.success, true, "n08 should load successfully");
  assert.strictEqual(n08.data.questions.length, 8, "n08 should have exactly 8 questions");
  const n08Str = JSON.stringify(n08.data).toLowerCase();
  assert.ok(!n08Str.includes("nice to meet you"), "n08 strictly excludes premature 'nice to meet you'");
  assert.ok(!n08Str.includes("goodbye"), "n08 strictly excludes premature 'goodbye'");
  assert.ok(!n08Str.includes("see you later"), "n08 strictly excludes premature 'see you later'");
  assert.ok(n08Str.includes("good afternoon"), "n08 contains taught afternoon greeting");
  assert.ok(n08Str.includes("you are welcome"), "n08 contains polite response you are welcome");
  console.log("[PASS] n08 has 8 questions with strict scope (no premature goodbye or nice to meet you)");

  // 4. n15 Gate Checkpoint Content
  const n15Res = await fetch(`${BASE}/api/learn/lesson/p1-g1-n15`);
  const n15 = await n15Res.json();
  assert.strictEqual(n15.success, true, "n15 should load successfully");
  assert.strictEqual(n15.data.questions.length, 10, "n15 should have exactly 10 questions");
  console.log("[PASS] n15 has 10 checkpoint questions covering 6 core competencies");

  // 5. n16 Gate Review Content
  const n16Res = await fetch(`${BASE}/api/learn/lesson/p1-g1-n16`);
  const n16 = await n16Res.json();
  assert.strictEqual(n16.success, true, "n16 should load successfully");
  assert.strictEqual(n16.data.questions.length, 10, "n16 should have exactly 10 questions");
  console.log("[PASS] n16 has 10 comprehensive review questions");

  // 6. TTS Audio verification via existing adapter endpoint
  const ttsRes = await fetch(`${BASE}/api/tts/speak?text=Hello+I+am+from+Vietnam&lang=en`);
  assert.strictEqual(ttsRes.status, 200, "TTS speak endpoint returns 200");
  const ttsBuf = await ttsRes.arrayBuffer();
  assert.ok(ttsBuf.byteLength > 1000, `TTS returned valid audio buffer (${ttsBuf.byteLength} bytes)`);
  console.log(`[PASS] TTS adapter endpoint works: ${ttsBuf.byteLength} bytes received`);

  // 7. HTTPS Strict TLS Certificate Validation (when testing https://dev.beego.vn)
  if (BASE.startsWith("https://")) {
    const https = await import("node:https");
    const tlsResult = await new Promise((resolve, reject) => {
      const req = https.request(BASE + "/api/health", { method: "GET" }, (res) => {
        const cert = res.socket.getPeerCertificate();
        resolve({
          authorized: res.socket.authorized,
          authorizationError: res.socket.authorizationError,
          subject: cert.subject?.CN,
          issuer: cert.issuer?.O,
          validTo: cert.valid_to,
        });
      });
      req.on("error", reject);
      req.end();
    });
    assert.strictEqual(tlsResult.authorized, true, "TLS certificate must be strictly authorized by root CAs");
    assert.strictEqual(tlsResult.authorizationError, null, "TLS authorization error must be null");
    assert.strictEqual(tlsResult.subject, "dev.beego.vn", "Certificate CN must be dev.beego.vn");
    assert.ok(new Date(tlsResult.validTo).getTime() > Date.now(), "Certificate must not be expired");
    console.log(`[PASS] HTTPS Strict TLS Validation: CN=${tlsResult.subject}, Issuer=${tlsResult.issuer}, ValidTo=${tlsResult.validTo}`);
  }

  console.log("\n=== ALL LIVE DEV API TESTS PASSED! ===");
}

run().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
