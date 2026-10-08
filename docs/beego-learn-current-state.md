# Báo Cáo Hiện Trạng Tab Học & Trình Làm Bài (Beego Learn System)

> **Tệp tài liệu:** `docs/beego-learn-current-state.md`  
> **Hệ thống:** Beego.vn (Nền tảng học tiếng Anh)  
> **Phân hệ:** Tab Học (`/` - `HomePage` / `LearnPage`) & Trình làm bài (`/learn/lesson/[lessonId]`)  
> **Ngày lập:** Tháng 10/2026  
> **Trạng thái xác minh:** Đã đối soát 100% qua mã nguồn thực tế và kiểm thử tự động.

---

## 1. TỔNG QUAN HỆ THỐNG VÀ KIẾN TRÚC KỸ THUẬT

Tab **"Học"** là trung tâm học tập chính của ứng dụng Beego, được định tuyến tại trang chủ (`/`), tải component `LearnPage.jsx` và mở trình làm bài độc lập tại `/learn/lesson/[lessonId]`.

### 1.1. Stack công nghệ chính
- **Framework:** Next.js (App Router), React 18/19.
- **Styling:** Vanilla CSS hiện đại, CSS Custom Properties (`--beego-learn-*`), CSS Modules cho các khối độc lập (`LessonAiConversation.module.css`). Tệp CSS chính: `app/beego-learn.css` và `app/beego-lesson-player.css`. Không dùng Tailwind.
- **Tối ưu render & cuộn:**
  - `useVirtualLearnSections.js`: Virtualization bằng `IntersectionObserver`, chỉ gắn DOM các cửa (Section) nằm trong hoặc sát viewport.
  - `useScrollToActiveNode.js`: Tự động cuộn mượt đến bài học đang mở (`active`).
  - `ResizeObserver`: Đồng bộ chiều cao sticky header động (`--beego-learn-header-offset`).
- **Âm thanh & Tương tác giọng nói:**
  - `speechSynthesis` (Web Speech API) và `playLessonTts` (`adapters/lesson-tts.js`).
  - `SpeechRecognition` / `webkitSpeechRecognition` client-side (`adapters/lesson-speech.js`).
  - Hệ thống cổng chặn âm thanh (`createPanelActivityGate`) ngăn chồng âm, dừng ngay khi chuyển câu/thoát bài.
- **Sự kiện & Đồng bộ tiến độ:**
  - `LEARNING_PATH_UPDATED_EVENT`: Custom DOM Event đồng bộ tức thì giữa trình làm bài, bản đồ học và các widget thống kê.

---

## 2. KIẾN TRÚC LỘ TRÌNH HỌC (LEARNING PATH ARCHITECTURE)

### 2.1. Cấu trúc Giáo trình chuẩn hóa
- **Phân cấp:** 8 Phần học (Parts), trải dài từ A0 (Mất gốc) đến B1+.
- **Blueprint 16 Node mỗi Cửa (`GATE_NODE_BLUEPRINT`):** Mỗi Cửa (Gate) tương ứng một chủ đề giao tiếp, gồm đúng 16 bài học khép kín:
  1. `Node 01 (vocabulary)`: 20 từ vựng cốt lõi (+15 XP, +20 Honey).
  2. `Node 02 (sentence_patterns)`: 5 mẫu câu ứng dụng (+12 XP, +15 Honey).
  3. `Node 03 (grammar)`: Ngữ pháp chủ đề (+14 XP, +18 Honey).
  4. `Nodes 04 - 08 (listening)`: 5 bài luyện nghe phản xạ đa tầng (+10 XP, +12 Honey/bài).
  5. `Nodes 09 - 13 (speaking)`: 5 bài luyện nói với AI Beego (+12 XP, +15 Honey/bài).
  6. `Node 14 (story)`: Đọc - nghe ngữ cảnh câu chuyện (+18 XP, +22 Honey).
  7. `Node 15 (test - Boss Node)`: Bài kiểm tra tổng hợp vượt cửa (+30 XP, +50 Honey).
  8. `Node 16 (review)`: Bài ôn tập lặp lại ngắt quãng (SRS) (+12 XP, +15 Honey).

### 2.2. Kiểm tra mở khóa tuần tự (Sequential Unlock & Security)
- **Client-side:** Node khóa hiển thị ổ khóa xám, chặn tương tác mở sheet.
- **Server-side (`completeLessonForUser`):** Kiểm tra nghiêm ngặt bài học trước đó trong CSDL; từ chối và trả mã lỗi `LESSON_LOCKED` nếu gửi request vượt cấp.
- **Idempotency:** Hoàn thành lại bài đã qua không cộng thưởng dồn XP/Honey ảo.

---

## 3. CƠ SỞ DỮ LIỆU VÀ CÁC API ENDPOINTS

### 3.1. Bảng cơ sở dữ liệu (MySQL InnoDB)
| Tên bảng | Dữ liệu quản lý |
| :--- | :--- |
| `user_lesson_progress` | Tiến độ từng bài: `user_id`, `lesson_id`, `status` (`active`/`completed`), `score`, `xp_awarded`, `honey_awarded`, `completed_at`. |
| `user_stats` | Thống kê tổng hợp: `xp_total`, `honey_total`, `current_streak`, `best_streak`, `active_lesson_id`, `placement_start_lesson_id`. |
| `user_learn_daily_settings` | Cấu hình mục tiêu ngày: `daily_goal_xp` (mặc định 30 XP), `timezone` (`Asia/Ho_Chi_Minh`), `streak_freeze_ready`. |
| `user_learn_daily_progress` | Tiến độ theo ngày: `progress_date`, `goal_xp`, `xp_earned`, `lessons_completed`, `goal_completed_at`, `streak_applied`. |
| `user_learn_exercise_attempts` | Lịch sử từng lần trả lời câu hỏi: `lesson_id`, `question_id`, `is_correct`, `skill_label`, `difficulty`, `answer`. |
| `user_learn_srs` & `user_learn_mistakes` | Dữ liệu Spaced Repetition và ngân hàng lỗi sai phục vụ ôn tập cá nhân hóa. |
| `user_learn_achievements` | Huy hiệu đã mở khóa và tiến độ nhiệm vụ. |
| `user_learn_chat_sessions` & `turns` | Lịch sử phiên hội thoại AI, câu sửa lỗi, giải thích tiếng Việt, gợi ý phát âm. |
| `user_placement_results` | Kết quả bài kiểm tra đầu vào: điểm số, trình độ ước tính, bài đề xuất. |

### 3.2. Hệ thống API Routes chính
- `GET /api/learning-path`: Trả về toàn bộ cây lộ trình học, tiến độ, streak, mục tiêu ngày.
- `POST /api/learning-path/complete`: Hoàn thành bài học, tính thưởng, mở khóa node kế tiếp.
- `GET /api/learn/lesson?lessonId=...`: Lấy nội dung câu hỏi bài học (hỗ trợ Adaptive Lesson Mix).
- `POST /api/learn/exercise-result`: Chấm điểm từng câu phía server, lưu vết attempt và trả kết quả/giải thích sau khi nộp.
- `POST /api/learn/placement`: Khởi tạo và chấm bài kiểm tra xếp lớp (Placement Test).
- `GET /api/learn/recommendations`: Lấy 3 bài học đề xuất trong ngày ("Dành cho bạn hôm nay").
- `GET /api/learn/analytics`: Tính toán chỉ số chính xác %, biểu đồ 7 ngày, điểm mạnh và điểm yếu.
- `GET /api/learn/achievements`: Quản lý danh mục thành tích và mở khóa huy hiệu.
- `POST /api/learn/chat/session` & `/api/learn/chat/turn`: Phiên thực hành đàm thoại với trợ lý AI sau bài học.

---

## 4. HIỆN TRẠNG CÁC DẠNG BÀI TRONG TRÌNH LÀM BÀI (LESSON PLAYER)

### 4.1. Nhóm 9 dạng bài hiện có trong mã nguồn
Trong `lib/beego/learn/normalize-lesson-exercises.js` và `components/beego/lesson-player/ExerciseRenderer.jsx`, hệ thống đang hỗ trợ chính thức **9 dạng bài**:

1. **`multiple_choice`**: Trắc nghiệm 4 phương án chuẩn (1 đúng + 3 sai), xáo trộn ngẫu nhiên.
2. **`vocabulary_choice`**: Chọn nghĩa từ vựng có hỗ trợ hiển thị thẻ hình ảnh/icon grid.
3. **`word_order`**: Sắp xếp từ ngữ thành câu hoàn chỉnh bằng ngân hàng từ (Word Bank).
4. **`fill_blank`**: Chọn từ phù hợp điền vào câu khuyết.
5. **`listening_choice`**: Nghe phát âm và chọn phương án đúng tương ứng.
6. **`listening_fill`**: Nghe phát âm và chọn từ điền vào vị trí khuyết của câu.
7. **`speaking`**: Luyện nói câu mẫu, chấm điểm phát âm qua Web Speech Recognition.
8. **`pronunciation`**: Luyện phát âm từ đơn lẻ, tính điểm % độ khớp âm thanh.
9. **`story_comprehension`**: Đọc đoạn văn/câu chuyện ngắn và trả lời câu hỏi đọc hiểu.

### 4.2. Trạng thái kiểm thử nội dung
- Script kiểm thử `node --import ./scripts/register-alias.mjs scripts/audit-learn-content-v3.mjs`:
  - **Số bài học kiểm toán:** 128/128 bài.
  - **Bài học thông thường:** 120/120 bài có đúng 10 câu hỏi.
  - **Tỷ lệ 4 lựa chọn:** 100% (912/912 câu dạng lựa chọn có đúng 4 phương án).
  - **Rò rỉ đáp án (Hint Leak):** 0 câu bị lộ đáp án trong nhãn/alt.
  - **Kết quả:** `CONTENT_AUDIT_V3=PASS`.

---

## 5. BẢNG PHÂN LOẠI HIỆN TRẠNG (GAP ANALYSIS)

| Hạng mục | Hiện trạng mã nguồn | Đánh giá | Hướng xử lý |
| :--- | :--- | :--- | :--- |
| **Kiến trúc Lộ trình & Shell** | 8 phần, blueprint 16 node/cửa, header dính, 2 cột desktop, 1 cột mobile. | **Đã tốt** | **Giữ nguyên 100%**. |
| **Quy tắc Nghiệp vụ** | Streak giờ VN, Daily Goal XP, Honey Point, 3 tim, khóa mở tuần tự. | **Đã tốt** | **Giữ nguyên 100%**. |
| **Bảo mật & Server Grading** | Chấm điểm câu hỏi phía server qua `/api/learn/exercise-result`, CSRF check. | **Đã tốt** | **Giữ nguyên 100%**. |
| **Đàm thoại AI** | `LessonAiConversation.jsx` hỗ trợ micro, TTS, sửa lỗi ngữ pháp tiếng Việt. | **Đã tốt** | **Giữ nguyên 100%**. |
| **Virtualization & Hiệu năng** | `useVirtualLearnSections` render theo viewport bằng IntersectionObserver. | **Đã tốt** | **Giữ nguyên 100%**. |
| **Số lượng dạng bài tập** | Đang có **9 dạng bài** trong `SUPPORTED_EXERCISE_TYPES` và `ExerciseRenderer`. | **Đã có nhưng thiếu** | **Mở rộng thêm 3 dạng bài để đủ chuẩn 12 dạng**. |
| **Dọn dẹp âm thanh (Audio Cleanup)** | Có token gate trong AI chat nhưng cần bảo đảm dập tắt TTS/STT ngay khi bấm Next/Exit ở trình làm bài. | **Đã có nhưng thiếu** | **Gia cố hàm dọn dẹp khi đổi câu/thoát bài**. |
| **Tính năng ngoài phạm vi** | Whisper server, Redis cache, Offline Service Worker, Bảng xếp hạng tuần, Khiên băng Streak. | **Chưa có / Ngoài phạm vi** | **TUYỆT ĐỐI KHÔNG triển khai** (tuân thủ nghiêm ngặt nguyên tắc 17). |

---

## 6. DANH SÁCH 12 DẠNG BÀI MỤC TIÊU & ĐỀ XUẤT 3 DẠNG MỚI

Nhằm đạt đúng mục tiêu 12 dạng bài học mà không phá vỡ schema hay ngân hàng bài hiện tại:
- **9 dạng bài hiện tại:** `multiple_choice`, `vocabulary_choice`, `word_order`, `fill_blank`, `listening_choice`, `listening_fill`, `speaking`, `pronunciation`, `story_comprehension`.
- **3 dạng bài bổ sung đề xuất:**
  1. **`matching_pairs` (Ghép cặp từ - nghĩa):** Nối 4 cặp thẻ từ vựng tiếng Anh với nghĩa tiếng Việt tương ứng.
  2. **`true_false` (Đúng hay Sai):** Đọc ngữ cảnh/câu nhận định và chọn `True` hoặc `False`.
  3. **`dialogue_completion` (Hoàn thành hội thoại):** Tình huống 2 nhân vật (A nói trước, B khuyết câu đối đáp cần chọn phương án phù hợp).

---

## 7. NGUYÊN TẮC AN TOÀN TRONG NÂNG CẤP

1. **Bảo toàn công việc chưa commit:** Giữ nguyên các thay đổi người dùng đang thực hiện trong working tree.
2. **Cô lập phạm vi:** Chỉ sửa đổi bên trong tab Học (`components/beego/learn/`, `components/beego/lesson-player/`, `lib/beego/learn/`, `app/beego-lesson-player.css`). Tuyệt đối không can thiệp vào các tab khác, thanh điều hướng toàn cục, auth hay theme.
3. **Không tạo hệ thống thứ hai:** Không viết thêm engine chấm điểm, tiến độ hay TTS trùng lặp. Tái sử dụng luồng submit và event `LEARNING_PATH_UPDATED_EVENT` hiện có.
4. **Hỗ trợ tiếp cận (A11y) & An toàn thông tin:** Không để lộ đáp án qua thuộc tính `alt`, `aria-label` trước khi chấm; hỗ trợ điều khiển bàn phím đầy đủ.
5. **Không tự commit hay deploy:** Mọi thay đổi đều được kiểm thử cục bộ và báo cáo rõ ràng trước người dùng.
