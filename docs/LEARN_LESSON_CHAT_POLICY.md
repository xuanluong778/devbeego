# Learn lesson chat — quota & policy

## Scope

- **Product:** tab Học only (`/api/learn/chat/*`).
- **Not used by:** Luyện nói (`/api/lessons/chat`), Ai Call, Voice WS.
- **Storage:** `learn_lesson_chat_sessions`, `learn_lesson_chat_turns`, `learn_lesson_chat_usage_daily`.
- **Never writes to:** `lesson_chat_logs`.

## Feature flag (default OFF)

| Env | Default | Meaning |
|-----|---------|---------|
| `LEARN_LESSON_CHAT_ENABLED` | unset / false | API returns `FEATURE_DISABLED` (503) |
| `LEARN_LESSON_CHAT_DAILY_LIMIT` | `30` | Max **successful** AI turns / user / day (Asia/Ho_Chi_Minh). Counted via atomic reserve; refunded on AI timeout/failure; **not** incremented again on idempotent `client_request_id` replay. |
| `LEARN_LESSON_CHAT_TIMEOUT_MS` | `25000` | Upstream OpenAI timeout |
| `LEARN_LESSON_CHAT_RATE_MAX` | `20` | Burst requests / IP / 60s |

Enable: `LEARN_LESSON_CHAT_ENABLED=1` in `.env.local` (or process env) then restart PM2.

## Quota vs Luyện nói

| Counter | Affects Learn chat? | Affects Luyện nói chat? |
|---------|---------------------|-------------------------|
| Pooled daily AI (`incrementPooledAiUsage` / `assertAiFeatureAccess("chat")`) | **No** — not called | Yes |
| `learn_lesson_chat_usage_daily.request_count` | **Yes** | No |

**Policy applied:** Learn chat requires a signed-in active user and Learn daily limit only. It does **not** consume Luyện nói pooled quota and does **not** call `assertLessonsChatAllowed` / `recordPooledAiUsageSuccess`.

Set `LEARN_LESSON_CHAT_DAILY_LIMIT=0` to block all turns while keeping the flag on (useful for staging).

## Session resume and wrap-up

- One session per user and lesson. `POST /api/learn/chat/session` resumes the latest session, including a closed one, and does not start a second chat after wrap-up.
- `GET` by `lesson_id` only reads. It does not create a session. The Learn path sheet shows “Tiếp tục thực hành với AI” or “Xem góp ý với AI” only when that read finds a session and the flag is on.
- `intent: wrap_up` stores `source = wrap_up`, then sets `status = closed`. A second wrap-up does not call the model again. Practice turns after a saved wrap-up are rejected.

## Adaptation

Lesson position and catalog level choose the starting support only. They do not forbid a shorter sentence, and they do not raise the learner's CEFR.

Support (how much modeling and hinting) is stored apart from language complexity (which lesson language to use). Sentence length is not the measure of either one. The tutor does not add grammar that the lesson itself does not use.

If the learner is stuck or asks for an explanation, the next reply simplifies the wording and adds a hint while keeping the same communicative goal. Challenge increases only after stored evidence shows independent, goal-meeting answers in more than one session.

That evidence, the support level, and whether the goal was met live in `learn_lesson_chat_adaptation`. Chat does not write mastery, XP, Honey, or unlock. The client cannot set the support level. Luyện nói prompts are unchanged.

## Device checklist (not yet verified)

Do not mark audio as verified because a headless browser faked speech recognition, or because `GET /api/tts/speak` returned HTTP 200.

On a real phone or computer, with the flag on only in a non-production process:

1. Finish a suitable lesson and open «Thực hành với AI».
2. Tap Micro, speak one English sentence, read the transcript, edit one word, then send. Confirm the sent text is the edited sentence.
3. Hear the AI reply from the speaker. Tap «Nghe lại» and hear it again.
4. Tap «Dừng phát» while the voice is still speaking and confirm the sound stops immediately.
5. Close the panel during playback and confirm the sound stops and the unsent transcript is not sent.
6. If the mic fails, type a sentence and send it.

## Security

- System prompt built **only** on server from lesson catalog + Learn tutor prompt.
- Client cannot supply `system` / `system_prompt`; client `history` is ignored (DB turns only).
- Session ownership: `session.user_id` must match caller.
- Lesson access: lesson must exist and not be `locked` on the user’s learning path.
- CSRF origin check + Redis/IP rate limit + `client_request_id` idempotency.
