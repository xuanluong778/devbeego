# BEEGO Security Audit — Phase 1 (2026-09-21)

**Git:** branch `main`, HEAD `788d4fc` (pre-fix snapshot); working tree has security patches (not committed per ops policy).  
**Backup:** `/var/www/beego_vn_usr/data/backups/beego.vn.pre-security-audit.20260921_225523.tar.gz` (~8.0M). MySQL dump: run manually on VPS if required (`mysqldump` + `.env.local` creds — not executed in this pass).

---

## BEEGO_SECURITY_AUDIT=COMPLETE_PHASE1

## CRITICAL (found → fixed)

| # | Issue | Fix |
|---|--------|-----|
| C1 | Middleware treated any `Authorization: Bearer *` as authenticated | Edge no longer gates API on bearer; routes use `getSessionUserFromRequest` |
| C2 | `POST /api/progress` accepted arbitrary `user_id` without session | Session user only; Bearer + cookie via shared resolver |
| C3 | Google Play billing granted plans from client token without verification in production | Production returns `502 VERIFY_REQUIRED` until Play Developer API verify is implemented |
| C4 | `POST /api/lessons` unauthenticated content injection | `requireAdminUser` required |

## HIGH (found → fixed or mitigated)

| # | Issue | Fix |
|---|--------|-----|
| H1 | `GET /api/questions` leaked `correct_option` publicly | Auth required; `correct_option` only for admin role |
| H2 | Login / token brute force (no rate limit) | IP rate limit 20/min on `/api/auth/login`, `/api/auth/token` |
| H3 | Public TTS cost abuse | IP rate limit 90/min on `/api/tts/speak` |
| H4 | `requireAdminUser` ignored Bearer (admin API from Android) | Uses `getSessionUserFromRequest` + admin email allowlist |
| H5 | Org classroom `teacher_user_id` IDOR | Non-admin cannot assign arbitrary teacher; defaults to self |
| H6 | Voice WS gateway bound `0.0.0.0:3031` | Default bind `127.0.0.1` (`VOICE_WS_HOST` override); Nginx `/voice` only |

## MEDIUM (remaining / accepted)

- Cookie-session POST APIs: no CSRF token (mitigated by `SameSite=Lax`; XSS remains risk).
- `POST /api/learning-path/complete`: authenticated sequential unlock; no activity proof (XP gaming within path order).
- `POST /api/review/result`: client `isCorrect` drives XP (idempotent attempts).
- `POST /api/vocabulary`: any logged-in user can insert rows (content spam).
- Several voice/lesson routes still cookie-only in handler (Bearer works elsewhere; align over time).
- `/uploads/` public static; ensure no sensitive files uploaded.
- `android/app/google-services.json` on disk (Firebase **client** key — expected in app; not server secret).

## LOW

- Open redirect hardening already uses relative `next` paths on OAuth.
- Public read APIs (quiz, dictionary, listening) — scraping / cost at edge.
- Google Play RTDN Pub/Sub webhook not implemented (renewals/cancellations ops gap, not client forge after C3 fix).

---

## ROOT_CAUSES

1. **Defense in depth missing at middleware** — presence of Bearer header ≠ valid session.  
2. **Legacy API routes** (`progress`, `lessons`, `questions`) predated unified session helper.  
3. **Play Billing stub** trusted env flags instead of Google API.  
4. **No edge rate limits** on auth and TTS.

---

## FIXED (summary)

- `middleware.ts` — API auth delegated to handlers; pages use cookie only.  
- `app/api/progress/route.js`, `lessons/route.js`, `questions/route.js`, `billing/google-play/route.js`.  
- `lib/admin/require-admin.js`, `require-admin.ts`.  
- `lib/org-vocab/service.ts` — teacher assignment.  
- `lib/security/ip-rate-limit.js` + auth/TTS routes.  
- `scripts/voice-ws-gateway.mjs` — localhost bind.

---

## FILES_CHANGED

`middleware.ts`, `app/api/progress/route.js`, `app/api/lessons/route.js`, `app/api/questions/route.js`, `app/api/billing/google-play/route.js`, `app/api/auth/login/route.js`, `app/api/auth/token/route.js`, `app/api/tts/speak/route.js`, `lib/admin/require-admin.js`, `lib/admin/require-admin.ts`, `lib/org-vocab/service.ts`, `lib/security/ip-rate-limit.js`, `scripts/voice-ws-gateway.mjs`, `docs/BEEGO_SECURITY_AUDIT.md`

---

## TEST_RESULTS

| Test | Result |
|------|--------|
| `npm run build` | **PASS** |
| `POST /api/progress` + fake Bearer | **401** |
| `GET /api/questions` no auth | **401** |
| `POST /api/lessons` no auth | **401** |
| `POST /api/billing/google-play` no auth | **401** |
| `GET /api/tts/speak` | **200** |
| `GET /api/health` | **200** |
| Stripe webhook / SePay IPN | **Verified in code review** (unchanged; signatures OK) |
| Android AAB secret scan | **PASS** (prior `verify-android-aab.mjs`) |
| MySQL/Redis listen | **127.0.0.1** (3306, 6379); Next **127.0.0.1:3025** |

---

## REMAINING_RISKS

- Implement **Google Play Developer API** purchase verification + **RTDN** webhook before enabling Play subscriptions in production.  
- Add Redis-backed rate limits for multi-instance PM2.  
- CSRF tokens or strict `Origin` check on cookie POST mutations.  
- Harden `review/result` and vocabulary write paths with server-side scoring where feasible.  
- Nginx: confirm HSTS/CSP headers on `beego.vn` (not all present on sample `curl -I`).

---

## BEEGO_SECURITY_PHASE1=PASS

No open **CRITICAL** or **HIGH** exploitable findings after fixes. Residual items are **MEDIUM/LOW** or operational (Play verify implementation).
