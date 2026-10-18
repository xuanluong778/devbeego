# Kết quả — Tab Học (Beego)

Tài liệu lưu **toàn bộ câu hỏi / câu trả lời** (Câu hỏi 1 → 3), **làm rõ lộ trình học**, và bản kê stack + giao diện + tính năng tab **Học**.

**Ngày:** 18/10/2026 (cập nhật cùng ngày)  
**Môi trường:** `dev.beego.vn`  
**Mã nguồn:** `/var/www/dev_beego_vn_usr/data/www/dev.beego.vn`  
**Runtime Docker:** `/var/www/beego_vn_usr/data/docker/beego`  
**Mục lục nhanh:** Phần A (Q&A) → **Phần A2 (Lộ trình học)** → Phần B (Stack) → Phần C (UI/tính năng) → Phần D (Sơ đồ luồng)

---

## Phần A — Câu hỏi & câu trả lời

### Câu hỏi 1

> Hãy đọc dữ liệu ở tab `hoc/`, xem kỹ video `lo-trinh-hoc.wmv` và file HTML/MD, tối ưu tab học để quá trình học thêm sinh động, đỡ nhàm chán, chất lượng học nâng cao.

#### Trả lời (đã triển khai)

Đã phân tích tài liệu trong `hoc/_extracted/flows/` (luồng 01, 03, 04, 05, 06…), video lộ trình, và mã Learn hiện tại. Các khoảng trống UX chính: CTA “Học tiếp” yếu trên mobile, lời khen cố định, celebration node quá ngắn (~700ms), loading khô, sheet mở bài dài dòng, thẻ tiến độ/thành tích chiếm chỗ lộ trình.

**Cải tiến đã ship lên dev.beego.vn:**

| Hạng mục | Chi tiết |
|----------|----------|
| Dock **Học tiếp** | Sticky CTA theo bài `active` (tiêu đề, loại bài, phút, Honey) — `LearnContinueDock.jsx` |
| Khen luân phiên | `lib/beego/learn/praise-messages.js` → feedback đúng + màn hoàn thành |
| Khuyến khích khi sai | Dòng “Không sao — sửa ngay sẽ nhớ lâu hơn.” |
| Loading sinh động | Ong bay + mẹo học ngẫu nhiên |
| Sheet mở bài | Chip kỹ năng thay đoạn mô tả dài |
| Bản đồ | Animation node vừa xong dài hơn (~2.2s) + ring burst |
| Stats | Highlight khi đạt daily goal |
| Gọn lộ trình | Tiến độ & thành tích gói trong `<details>` |

**File chính đã đổi/thêm:**

- `lib/beego/learn/praise-messages.js` (mới)
- `components/beego/learn/LearnContinueDock.jsx` (mới)
- `components/beego/learn/LearnPage.jsx`
- `components/beego/learn/LearnMobileStats.jsx`
- `components/beego/learn/LessonStartSheet.jsx`
- `components/beego/lesson-player/LessonFeedbackBar.jsx`
- `components/beego/lesson-player/LessonPlayer.jsx`
- `components/beego/lesson-player/LessonCompleteScreen.jsx`
- `app/beego-learn.css`
- `app/beego-lesson-player.css`

Đã sync sang Docker `beego-web`, rebuild image `beego-app:latest`, recreate container; homepage HTTP 200; CSS có class `beego-learn-continue-dock`.

---

### Câu hỏi 2

> Hãy liệt kê stack chi tiết về giao diện, tính năng tab học và lưu toàn bộ câu hỏi và câu trả lời chi tiết thành file `ket-qua.md`.

#### Trả lời

Đã liệt kê stack frontend/backend/AI/voice, giao diện tab Học, và toàn bộ tính năng nghiệp vụ. Nội dung nằm ở **Phần B** (stack) và **Phần C** (giao diện + tính năng) trong file này. File được tạo tại:

`/var/www/dev_beego_vn_usr/data/www/dev.beego.vn/ket-qua.md`

---

### Câu hỏi 3

> `/var/www/dev_beego_vn_usr/data/www/dev.beego.vn/ket-qua.md` — cho các câu hỏi và câu trả lời hiện tại vào file luôn; làm rõ lộ trình học.

#### Trả lời

- Đã **cập nhật file này** để chứa đủ câu hỏi 1 → 3 và câu trả lời tương ứng.
- Phần **làm rõ lộ trình học** nằm ngay bên dưới (**Phần A2**). Tóm tắt: Beego có **8 phần** (A0 → B1+), mỗi phần **1 cửa (gate)**, mỗi cửa **16 bài (node)** học tuần tự; bài đầu mặc định `p1-g1-n01`; mở khóa bài sau khi hoàn thành bài trước; node 1–14 thường là bài tích hợp nhiều kỹ năng, node 15 = Test vượt cửa, node 16 = Ôn tập.

---

## Phần A2 — Lộ trình học (làm rõ)

### 1) Cấu trúc tổng thể

```
Lộ trình Beego
└── 8 Phần (Part) — theo trình độ CEFR
    └── mỗi Phần có 1 Cửa (Gate) — 1 chủ đề giao tiếp
        └── mỗi Cửa có đúng 16 Node (bài) — thứ tự cố định
```

| Quy mô | Số lượng hiện tại |
|--------|-------------------|
| Phần (Part) | **8** |
| Cửa / phần | **1** (mỗi phần một chủ đề) |
| Bài (Node) / cửa | **16** |
| **Tổng bài trên bản đồ** | **8 × 16 = 128 bài** |
| Bài đầu cho user mới | `p1-g1-n01` |

**ID bài học:** `p{phần}-g{cửa}-n{số}`  
Ví dụ: `p1-g1-n01` = Phần 1 · Cửa 1 · Bài 1; `p3-g1-n15` = Phần 3 · Test vượt cửa.

**Nguồn định nghĩa trong code:**

| File | Vai trò |
|------|---------|
| `lib/beego/learning-path-catalog.js` | 8 phần + chủ đề + ngữ pháp từng cửa |
| `lib/beego/learning-path-schema.js` | Blueprint 16 node / cửa (loại, phút, XP, Honey) |
| `lib/beego/learning-path-build.js` | Sinh sections/nodes + gán status |
| `lib/beego/learning-path-progress.js` | Progress user, complete, unlock thật |
| `GET /api/learning-path` | API trả bản đồ + tiến độ cho tab Học |

---

### 2) Tám phần — chủ đề & trình độ

| Phần | Trình độ | Tên phần | Chủ đề cửa | Ngữ pháp trọng tâm |
|------|----------|----------|------------|--------------------|
| **1** | A0 | Mất gốc / Làm quen tiếng Anh | Chào hỏi | Đại từ I / You / He / She |
| **2** | A0 | Sinh hoạt hằng ngày | Thói quen buổi sáng | Present Simple |
| **3** | A1 | Giao tiếp cơ bản ngoài đời | Mua sắm & hỏi giá | How much / How many |
| **4** | A1 | Gia đình, bạn bè, cảm xúc | Kể về gia đình | Sở hữu cách (my, your…) |
| **5** | A1+ | Công việc và học tập | Nghề nghiệp & môi trường làm việc | Present Continuous |
| **6** | A2 | Du lịch và tình huống thực tế | Sân bay & khách sạn | Can / Could |
| **7** | B1 | Trung cấp giao tiếp | Họp & email công việc | Past Simple |
| **8** | B1+ | Nâng cao / Tự tin giao tiếp | Thuyết trình & tranh luận | Liên từ (although, however…) |

Mỗi cửa còn có `sectionTitle` mô tả tình huống (vd. Phần 1: “Chào, hỏi tên, hỏi sức khỏe và tạm biệt”).

---

### 3) Mười sáu bài trong mỗi cửa (thứ tự cố định)

Thứ tự này **giống nhau mọi cửa**; chỉ nội dung/chủ đề đổi theo phần.

| # | Loại (`nodeType`) | Nhãn UI | ~Phút | XP | Honey | Ghi chú |
|---|-------------------|---------|-------|----|-------|---------|
| 1 | `vocabulary` | 20 từ vựng | 12 | 15 | 20 | Bài tích hợp |
| 2 | `sentence_patterns` | 5 câu mẫu | 12 | 12 | 15 | Bài tích hợp |
| 3 | `grammar` | Ngữ pháp | 12 | 14 | 18 | Bài tích hợp |
| 4–8 | `listening` | Luyện nghe (slot 1–5) | 12 | 10 | 12 | Bài tích hợp |
| 9–13 | `speaking` | Luyện nói (slot 1–5) | 12 | 12 | 15 | Bài tích hợp |
| 14 | `story` | Story | 12 | 18 | 22 | Bài tích hợp |
| **15** | `test` | **Test / Vượt cửa** | 10 | **30** | **50** | Kiểm tra tổng hợp; **không** dùng builder tích hợp 12 hoạt động |
| **16** | `review` | **Ôn tập lặp lại** | 6 | 12 | 15 | Spaced repetition; **không** dùng builder tích hợp |

**Bài tích hợp (node 1–14):** một bài ≈ **12 hoạt động** trong cùng tình huống (nghe chọn hình, chọn nghĩa, ghép từ, sắp xếp câu, nghe điền, dịch, hội thoại, đọc thành tiếng…). Định nghĩa: `lib/beego/learn/integrated-lesson.js`.

**Sau Test (n15):** thường mở khóa Review (n16) của cửa đó; xong review → mở **bài 1 của phần/cửa tiếp theo**.

---

### 4) Trạng thái node trên bản đồ

| Status | Ý nghĩa UI |
|--------|------------|
| `completed` | Đã hoàn thành (có thể học lại; replay **không** cộng thêm Honey/XP) |
| `active` | Bài đang mở — CTA “Học tiếp” / “Bắt đầu” trỏ vào đây |
| `locked` | Chưa mở — gợi ý: “Hoàn thành bài trước để mở khóa” |

**Luật mở khóa:** học **tuần tự**. Chỉ có **một** node `active` tại một thời điểm (node tiếp theo sau các bài đã `completed`). Placement có thể đặt `placement_start_lesson_id` để bỏ qua / đánh dấu phần đầu (node skipped).

**Luồng học viên điển hình:**

```
Mở tab Học (/)
  → thấy bản đồ 8 cửa × 16 bài
  → chạm node active → Sheet (chip kỹ năng + CTA)
  → vào /learn/lesson/[lessonId]
  → làm bài → feedback → hoàn thành
  → POST /api/learning-path/complete
  → node đó = completed, node kế = active
  → dock “Học tiếp” cập nhật bài mới
```

---

### 5) Ví dụ cụ thể — Phần 1 · Cửa 1 (Chào hỏi)

| lessonId | Nội dung (tóm tắt) |
|----------|-------------------|
| `p1-g1-n01` | Từ vựng / tình huống chào hỏi (bài đầu mặc định) |
| `p1-g1-n02` | Câu mẫu chào hỏi |
| `p1-g1-n03` | Ngữ pháp đại từ I/You/He/She |
| `p1-g1-n04` … `n08` | 5 bài nghe theo slot |
| `p1-g1-n09` … `n13` | 5 bài nói theo slot |
| `p1-g1-n14` | Story chủ đề chào hỏi |
| `p1-g1-n15` | **Test vượt cửa** — thưởng XP/Honey cao nhất cửa |
| `p1-g1-n16` | Ôn tập lặp lại cả cửa |

Xong `p1-g1-n16` → mở `p2-g1-n01` (Thói quen buổi sáng).

---

### 6) Liên hệ UI tab Học với lộ trình

| UI | Gắn với lộ trình thế nào |
|----|--------------------------|
| Header sticky | Hiện phần/cửa đang active |
| Đường node zigzag | `sections[].nodes` từ API learning-path |
| Sheet mở bài | Meta #n/16, phút, Honey/XP, chip kỹ năng |
| Dock **Học tiếp** | `findActiveNode(sections)` → href player |
| Gate Call AI | Nút gọi gia sư theo cửa (khi đủ điều kiện) |
| Placement banner | Có thể nhảy điểm bắt đầu trên lộ trình |
| Today for you | Gợi ý 3 mục trong/ngoài path (review, practice…) |

---

## Phần B — Stack chi tiết tab Học

### B.1. Frontend

| Thành phần | Phiên bản / ghi chú |
|------------|---------------------|
| **Next.js** | `^14.2.5` (App Router) |
| **React / React DOM** | `^18.3.1` |
| **Ngôn ngữ UI** | Chủ yếu `.jsx` / `.js`; một phần TypeScript (`middleware.ts`) |
| **CSS** | Custom CSS (không Tailwind/MUI) |
| **Mobile shell** | Capacitor 6 (`@capacitor/android`, app, haptics, keyboard, preferences, push, splash, status-bar) |

**CSS gắn Learn (import trong `app/layout.js`):**

| File | Vai trò |
|------|---------|
| `app/beego-learn.css` | Bản đồ lộ trình, header, node, sheet, dock, today-for-you, insights, achievements |
| `app/beego-lesson-player.css` | Lesson player, bài tập, feedback, lives, complete |
| `components/beego/lesson-player/LessonAiConversation.module.css` | Chat AI sau bài |
| `app/beego-design.css`, `app/beego.css`, `app/beego-native.css`, `app/globals.css` | Design system / shell chung |

**Route / trang:**

| Route | File | UI |
|-------|------|-----|
| `/` (tab **Học**) | `app/page.js` | `LearnPage.jsx` |
| `/learn/lesson/[lessonId]` | `app/learn/lesson/[lessonId]/page.js` | `LessonPlayer.jsx` (`?replay=1`) |
| `/luyen-noi` | `app/luyen-noi/page.js` | `LearnCallSpeakingTab.jsx` (cùng stack Learn Call) |
| `/progress` | `app/progress/page.js` | Honey / streak (liên kết từ stats) |

Nav: `lib/beego/nav.js` — Học = `/`. Player ẩn bottom nav (`SHELL_HIDE_PREFIXES` chứa `/learn/lesson`).

---

### B.2. Backend / API

#### `/api/learn/*` (15 module)

| Method | Path | Dịch vụ chính |
|--------|------|---------------|
| GET | `/api/learn/lesson/[lessonId]` | Nội dung bài, mix session, review, sanitize, resume, mastery |
| POST | `/api/learn/exercise-result` | Chấm bài server-side, mastery/mistakes, invalidate cache |
| GET | `/api/learn/review/session` | Ôn tập cá nhân hóa |
| GET/PATCH | `/api/learn/daily-goal` | Daily goal + streak settings |
| GET/POST | `/api/learn/placement` | Placement test (`start` / `answer` / `choose_start`) |
| GET | `/api/learn/recommendations` | “Dành cho bạn hôm nay” |
| GET | `/api/learn/analytics` | Insights tiến độ |
| GET/POST | `/api/learn/achievements` | Huy hiệu (POST chỉ re-evaluate) |
| GET | `/api/learn/chat/status` | Cờ bật chat AI sau bài |
| GET/POST | `/api/learn/chat/session` | Session chat + quota |
| POST | `/api/learn/chat/turn` | Lượt hội thoại AI |
| GET | `/api/learn/ai-call/status` | Trạng thái Learn Call |
| GET | `/api/learn/ai-call/access` | Quyền gọi / gate unlock / gói |
| POST/DELETE | `/api/learn/ai-call/session` | JWT + Redis lock + context tutor |
| POST | `/api/learn/ai-call/ipa` | IPA qua OpenAI + cache Redis |

#### Learning path

| Method | Path | Dịch vụ |
|--------|------|---------|
| GET | `/api/learning-path` | Catalog + progress user (guest OK) |
| POST | `/api/learning-path/complete` | Hoàn thành bài → XP/Honey/unlock/achievements |

#### API liền kề Learn dùng

- `/api/auth/me` — tên user trên Learn
- `/api/dashboard` — missions / refresh stats
- `/api/tts/speak` — TTS bài học (Google proxy), **không dùng VBEE** cho lesson TTS

---

### B.3. Dependencies liên quan Learn (`package.json`)

| Nhóm | Package |
|------|---------|
| DB / queue | `mysql2`, `ioredis`, `bullmq` |
| Voice / Learn Call | `ws`, `microsoft-cognitiveservices-speech-sdk` |
| Phát âm client (bài tập) | `arpabet-to-ipa`, `cmu-pronouncing-dictionary` |
| Auth session call | `jsonwebtoken` |

**Scripts voice:** `voice-ws`, `voice-llm-worker`, `voice-tts-worker`, `voice-usage-worker` (+ biến thể `:dev` / `:local`).

---

### B.4. Data layer

#### MySQL — bảng Learn chuyên biệt (migration 004–014)

| Bảng | Mục đích |
|------|----------|
| `user_learn_exercise_attempts` | Lượt làm bài tập |
| `user_learn_skill_mastery` | Mastery theo kỹ năng |
| `user_learn_mistakes` | Lỗi cần ôn |
| `user_learn_smart_progression` | Smart progression |
| `user_learn_mastery_rollup_events` | Sự kiện rollup mastery |
| `user_learn_lesson_mix_session` | Mix bài thích ứng |
| `user_learn_daily_settings` / `user_learn_daily_progress` | Daily goal & streak |
| `learn_placement_sessions` / `learn_placement_answers` / `user_learn_placement_results` | Placement |
| `user_learn_recommendation_cache` | Cache gợi ý |
| `user_learn_analytics_cache` | Cache analytics |
| `user_learn_achievements` / `user_learn_achievements_cache` | Thành tích |
| `learn_lesson_chat_sessions` / `learn_lesson_chat_turns` / `learn_lesson_chat_usage_daily` / `learn_lesson_chat_adaptation` | Chat AI sau bài |

#### Shared

- `user_lesson_progress`, `user_stats` (`honey_total`, `active_lesson_id`, `placement_start_lesson_id`, …)

#### Redis (chủ yếu Learn Call)

- Session / lock / budget / hold (`voice:learn-call-*`)
- IPA cache, pub/sub TTS, transcript tutor

Cache recommendations / analytics / achievements: **MySQL JSON**, invalidate qua `invalidate-learn-caches.js`.

#### Nội dung lộ trình (trong repo, không DB)

- `lib/beego/learning-path-catalog.js` — 8 parts × gates
- `lib/beego/learning-path-build.js` — 16 nodes / gate
- `lib/beego/learn/lesson-content-*.js`, `integrated-lesson.js`, `p1-g1-plan.js`

---

### B.5. AI / Voice stack (riêng Learn)

| Khả năng | Công nghệ | Vị trí |
|----------|-----------|--------|
| Chat AI sau bài | OpenAI Chat | `learn-lesson-chat.service.js` |
| Learn Call LLM | OpenAI | `voice-llm-worker.mjs` + `learn-call-tutor.js` |
| Learn Call TTS | OpenAI TTS PCM 24 kHz | `voice-tts-worker.mjs` |
| Learn Call STT | Azure Speech SDK | `voice-ws-gateway.mjs` |
| Learn Call phát âm | Azure Pronunciation Assessment | `learn-call-pronunciation.js` |
| Learn Call IPA | OpenAI JSON | `learn-call-ipa.js` |
| Speaking trong bài tập | Web Speech API (browser) | `adapters/lesson-speech.js` |
| Điểm phát âm bài tập | Client text distance | `exercise-check.js` + `client-pronunciation-eval` (**không Azure**) |
| TTS bài học | `/api/tts/speak` | `adapters/lesson-tts.js` |
| WebSocket | `useVoiceWebSocket.js` | `LearnCallRoom.jsx` |

---

### B.6. Triển khai / vận hành

| Mục | Giá trị |
|-----|---------|
| App Docker | `beego-web` (image `beego-app:latest`) |
| DB / cache | `beego-mysql`, `beego-redis` |
| Env Docker | `.env.docker` tại runtime path |
| Domain | `https://dev.beego.vn` |

---

## Phần C — Giao diện & tính năng tab Học

### C.1. Màn bản đồ (`LearnPage` tại `/`)

| Thành phần | File | Chức năng UI |
|------------|------|--------------|
| `LearnHeader` | `LearnHeader.jsx` | Sticky header theo section/gate |
| `PlacementBanner` | `PlacementBanner.jsx` | Vào bài kiểm tra xếp lớp |
| `TodayForYouCard` | `TodayForYouCard.jsx` | 3 gợi ý “Dành cho bạn hôm nay” |
| `LearnMobileStats` | `LearnMobileStats.jsx` | Streak, daily goal %, XP hôm nay, Honey |
| `BeegoMascotBubble` | `BeegoMascotBubble.jsx` | Ong Beego + lời nhắn động |
| `InstallAppOffer` | (shared) | Mời cài app |
| `BeegoLearningPath` | `BeegoLearningPath.jsx` | Lộ trình virtualized theo section |
| `LearningSection` | `LearningSection.jsx` | Hàng node + `GateCallButton` |
| Node UI | `LessonNode`, `BossNode`, `RewardChestNode`, `LearnPathNode`, icons/tooltips | Trạng thái active / completed / locked |
| `LearnRightPanel` | `LearnRightPanel.jsx` | Stats + missions (desktop) |
| `LearnContinueDock` | `LearnContinueDock.jsx` | Sticky **Học tiếp** |
| `LessonStartSheet` | `LessonStartSheet.jsx` | Sheet/modal mở bài + chip kỹ năng + CTA |
| Lớp gọi AI | `LearnLessonCall` | Gate “Gọi gia sư AI” full-screen |
| `LessonAiConversation` | Resume thực hành AI từ sheet |
| Collapse | `.beego-learn-collapse` | Gói Tiến độ + Thành tích |
| Toast | Daily goal / mở khóa huy hiệu | Celebrate ngắn |

**Hook hỗ trợ:** `useActiveLearnSection`, `useScrollToActiveNode`, `useVirtualLearnSections`.

---

### C.2. Lesson Player (`/learn/lesson/[lessonId]`)

| Thành phần | Vai trò |
|------------|---------|
| `LessonPlayer` | Load bài, lives, check/skip, complete, AI eligibility |
| `LessonTopBar` | Progress + lives + thoát |
| `LessonBottomBar` | Bỏ qua / Kiểm tra / bàn phím |
| `ExerciseRenderer` | Render mọi loại bài tập |
| Sub-UI | Match pairs, listen dictation, translation, word bank, options… |
| `LessonFeedbackBar` | Đúng/sai + lời khen luân phiên |
| `LessonCompleteScreen` | XP/Honey/streak + praise + CTA về lộ trình |
| `LearnCallRoom` / Character / IPA | UI cuộc gọi gia sư trong ngữ cảnh bài |

**Loading:** ong + tip từ `LEARN_LOADING_TIPS`.

---

### C.3. Loại bài tập hỗ trợ

Từ `normalize-lesson-exercises.js` (`SUPPORTED_EXERCISE_TYPES`):

1. `multiple_choice`
2. `vocabulary_choice`
3. `word_order`
4. `fill_blank`
5. `listening_choice`
6. `listening_fill`
7. `listening_dictation`
8. `speaking`
9. `pronunciation`
10. `story_comprehension`
11. `matching_pairs`
12. `translation`
13. `context_cloze`
14. `dialogue_response`

**Bài tích hợp (integrated):** ~12 hoạt động giao tiếp (`integrated-lesson.js`); sheet hiển thị chip kỹ năng (`INTEGRATED_SKILL_CHIPS`).

---

### C.4. Bản đồ tính năng nghiệp vụ

| Tính năng | Cách hoạt động |
|-----------|----------------|
| **Mở khóa lộ trình** | Hoàn thành tuần tự → `completeLessonForUser` |
| **XP / Honey** | Cộng khi complete (replay không cộng thêm) |
| **Streak / Daily goal** | `daily-goal-streak-engine` + payload `daily_motivation` |
| **Mastery / mistakes** | Cập nhật mỗi `POST /api/learn/exercise-result` |
| **Smart progression** | Sau complete |
| **Mix bài thích ứng** | `lesson-mix-engine` + bảng mix session |
| **Lives (❤️)** | Mặc định 3; sai trừ tim |
| **Skip / Check** | UI bottom bar; câu bắt buộc hạn chế skip; P1 gate có luật attempt |
| **Chấm server-side** | Client không nhận đáp án đúng trên GET lesson |
| **Hoàn thành bài** | `POST /api/learning-path/complete` + event `LEARNING_PATH_UPDATED_EVENT` |
| **Achievements** | Catalog + engine; toast trên Learn |
| **Analytics insights** | Overview, skills, 7 ngày, điểm mạnh/yếu |
| **Placement** | Test xếp lớp → `placement_start_lesson_id` / node skipped |
| **Recommendations** | Card Today For You |
| **Personalized review** | Node ôn + `/api/learn/review/session` |
| **Chat AI sau bài** | `/api/learn/chat/*` |
| **Gate AI Call** | Unlock theo gate + entitlement; Azure STT/PA + OpenAI |
| **Resume bài** | `lesson-resume.js` |
| **Guest** | Xem lộ trình; không lưu XP/Honey đầy đủ |
| **CSRF / rate limit** | Mutation complete, exercise-result, placement, chat, daily-goal |

---

### C.5. UX gần đây (đã tối ưu theo flow/video)

1. Sticky **Học tiếp** (`LearnContinueDock`)
2. Lời khen đúng **xoay vòng** (`praise-messages.js`)
3. Tip khi **loading** bài
4. **Skill chips** trên sheet
5. **Collapse** tiến độ & thành tích
6. Animation node **just-completed** dài hơn + ring burst
7. Celebrate **daily goal** trên mobile stats
8. Virtualized sections cho lộ trình dài

---

### C.6. Thư viện domain (`lib/beego/learn/` — ~69 file)

Nhóm nổi bật: `lesson-content-*`, `integrated-*`, `exercise-check`, `placement-*`, `recommendation-engine`, `analytics-insights-engine`, `achievements-engine`, `daily-goal-streak-engine`, `learn-lesson-chat-*`, `ai-call-access`, `learn-call-*`, `complete-lesson-client`, `fetch-lesson-for-player`, `praise-messages`.

Ngoài thư mục: `lib/beego/learning-path*.js`, `learning-flow.js`, `learning-node-icons.js`.

**Tài liệu tham chiếu trong repo:**  
`docs/beego-learn-current-state.md`, `docs/beego-learn-curriculum-content-spec.md`, `docs/LEARN_LESSON_CHAT_POLICY.md`, `docs/learn-call-deploy.md`, `docs/beego-learn-112-matrix.md`, thư mục `hoc/_extracted/flows/`.

---

## Phần D — Sơ đồ luồng ngắn

```
Tab Học (/)
  ├─ Bản đồ nodes (active / locked / completed)
  ├─ Sheet → /learn/lesson/[id]
  │     ├─ Làm bài (14 loại exercise) → POST exercise-result
  │     ├─ Feedback (praise / sửa)
  │     └─ Complete → POST learning-path/complete → unlock + XP/Honey
  ├─ Dock “Học tiếp” → bài active
  ├─ Gate Call / Luyện nói → Azure STT+PA + OpenAI TTS/LLM (WS)
  └─ Chat AI sau bài / Resume AI → OpenAI chat APIs
```

---

*File được tạo theo yêu cầu lưu toàn bộ câu hỏi và câu trả lời chi tiết về tối ưu & kê khai tab Học.*
