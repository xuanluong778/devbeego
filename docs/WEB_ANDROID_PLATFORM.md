# Beego Web + Android Shared Platform

Backup (P0): `data/backups/beego.vn.source.pre-web-android.20260921_112532.tar.gz`  
MySQL: `data/backups/beego_vn.pre-web-android.20260921_112532.sql.gz`

## Port / conflict check

| Port | Status | Decision |
|------|--------|----------|
| 3025 | BUSY (Next beego) | Keep — web app |
| 3001 | BUSY (docker-proxy) | DO NOT use |
| 3031 | FREE | Voice WS gateway |
| 6379 | BUSY Redis (shared) | Reuse for BullMQ voice |

## FILES_CHANGED (planned)

### P0 — Shared core
- `migrations/001_shared_core.sql` — user_stats, user_lesson_progress, schema_migrations
- `lib/db/migrate.js` — versioned runner
- `lib/beego/learning-path-progress.js` — load/complete from MySQL
- `lib/beego/learning-path-build.js` — remove DEMO default
- `lib/beego/learning-path-catalog.js` — DEFAULT_FIRST_LESSON_ID
- `lib/beego/learning-path.js` / mock — real progress merge
- `app/api/learning-path/route.js` + `complete/route.js`
- `app/api/dashboard/route.js` — include active_lesson_id, honey
- Learn UI: remove streak/xp hardcode fallbacks
- ensure subscription + AI quota tables via existing service

### P1 — Auth
- `migrations/002_auth_app_sessions.sql` — platform, refresh, revoke
- `lib/auth/resolve-session-token.ts` — cookie ∥ Bearer
- update get-session-user + ai-entitlement
- `app/api/auth/token/*` — issue/refresh/revoke for Android
- Google OAuth App Links assets

### P2 — Capacitor
- `capacitor.config.ts`, `android/`, native plugins, mobile CSS

### P3 — Voice
- VOICE_WS_PORT=3031, PM2 ecosystem, nginx `/voice` → 3031
- VoiceCall default → `wss://beego.vn/voice`

### P4 — Billing + Push
- Play Billing webhook + entitlement columns
- FCM tokens table + reminder API

## Migration plan

1. Additive CREATE TABLE / ALTER ADD COLUMN only
2. Record in `schema_migrations`
3. Rollback SQL paired in `migrations/rollback/`
4. Never DROP production data
