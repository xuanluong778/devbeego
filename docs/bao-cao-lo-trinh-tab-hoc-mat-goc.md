# Báo Cáo Đánh Giá Toàn Diện Tab Học & Lộ Trình Tối Ưu Cho Người Mất Gốc Tiếng Anh

> **Tệp tài liệu:** `docs/bao-cao-lo-trinh-tab-hoc-mat-goc.md`  
> **Dự án:** [dev.beego.vn](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn)  
> **Đối tượng trọng tâm:** Người mất gốc tiếng Anh (A0 / Pre-A1)  
> **Ngày lập báo cáo:** 24/10/2026  
> **Mục tiêu:** Đánh giá hiện trạng stack giao diện & tính năng tab Học, phân tích độ bao phủ 5 kỹ năng (Nghe, Nói, Đọc, Viết, Phản xạ), đề xuất lộ trình tối ưu và bảng ưu tiên các hạng mục cần sửa trước.

---

## MỤC LỤC
1. [Chi Tiết Stack Giao Diện & Tính Năng Tab Học](#1-chi-tiết-stack-giao-diện--tính-năng-tab-học)
   - 1.1. Frontend & Kiến trúc UI
   - 1.2. Backend & Data Layer
   - 1.3. AI & Voice Stack
   - 1.4. Danh mục Tính năng Nghiệp vụ Tab Học
2. [Đánh Giá 5 Kỹ Năng: Nghe - Nói - Đọc - Viết - Phản Xạ](#2-đánh-giá-5-kỹ-năng-nghe---nói---đọc---viết---phản-xạ)
   - 2.1. Ma trận hiện trạng 5 kỹ năng trong mã nguồn
   - 2.2. Phân tích chi tiết từng kỹ năng & Lỗ hổng kỹ thuật
3. [Đánh Giá Khách Quan: Điểm Đã Làm Tốt & Điểm Chưa Làm Tốt](#3-đánh-giá-khách-quan-điểm-đã-làm-tốt--điểm-chưa-làm-tốt)
   - 3.1. Những điểm đã làm tốt
   - 3.2. Những điểm bất cập sư phạm & kỹ thuật cần sửa
4. [Lộ Trình Học Tối Ưu Nhất Cho Người Mất Gốc Tiếng Anh](#4-lộ-trình-học-tối-ưu-nhất-cho-người-mất-gốc-tiếng-anh)
   - 4.1. Đặc điểm tâm lý & Rào cản của người mất gốc (A0)
   - 4.2. 5 Giai đoạn vàng theo phương pháp Giàn giáo (Scaffolding)
   - 4.3. Cấu trúc bài học vi mô chuẩn (Microlearning 5–7 phút)
5. [Danh Sách Các Hạng Mục Cần Ưu Tiên Sửa Trước](#5-danh-sách-các-hạng-mục-cần-ưu-tiên-sửa-trước)
   - 5.1. Bảng ưu tiên P0 - P1 - P2
   - 5.2. Kế hoạch hành động cụ thể từng bước

---

## 1. CHI TIẾT STACK GIAO DIỆN & TÍNH NĂNG TAB HỌC

### 1.1. Frontend & Kiến trúc UI
- **Core Framework:** [Next.js 14.2.5](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/package.json#L66) (App Router, kết hợp Server Components và Client Components `"use client"`).
- **Thư viện UI cốt lõi:** [React 18.3.1](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/package.json#L68) & React DOM 18.3.1.
- **Hệ thống Styling (CSS):** Sử dụng 100% Pure Vanilla CSS3 & CSS Modules (không dùng Tailwind/Bootstrap để giảm tải bundle và đạt tốc độ render tối đa):
  - [app/beego-design.css](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/app/beego-design.css): Design System tokens (bảng màu HSL, typography, spacing, border-radius, shadows, hiệu ứng glassmorphism).
  - [app/beego-learn.css](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/app/beego-learn.css): Giao diện Bản đồ lộ trình (`BeegoLearningPath`), Header sticky, nodes zigzag, Bottom Sheet mở bài (`LessonStartSheet`), Dock "Học tiếp" (`LearnContinueDock`), thẻ thành tích/tiến độ.
  - [app/beego-lesson-player.css](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/app/beego-lesson-player.css): Trình phát bài học (`LessonPlayer`), thanh máu/tim (❤️ lives), thanh tiến độ %, 14 loại bài tập, thanh feedback chân màn hình (`LessonFeedbackBar`), màn hình chúc mừng hoàn thành (`LessonCompleteScreen`).
  - [components/beego/lesson-player/LessonAiConversation.module.css](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/lesson-player/LessonAiConversation.module.css): Giao diện bong bóng đàm thoại AI gia sư sau bài học.
  - [app/beego-native.css](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/app/beego-native.css): Tối ưu safe-area cho mobile notch/tai thỏ trên Android/iOS.
- **Mobile Container (Hybrid App):** [Capacitor 6.2.2](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/package.json#L48-L56) đóng gói ứng dụng di động Android:
  - `@capacitor/core`, `@capacitor/android`
  - `@capacitor/haptics`: Rung phản hồi xúc giác khi người học chọn đáp án đúng/sai.
  - `@capacitor/keyboard`: Điều khiển cuộn tự động tránh che bàn phím khi làm bài tập gõ từ.
  - `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/preferences`.
- **Cấu trúc Component chính của Tab Học:**
  - Route chính: `/` trỏ vào [app/page.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/app/page.js) tải [components/beego/learn/LearnPage.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/learn/LearnPage.jsx).
  - [LearnHeader.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/learn/LearnHeader.jsx): Thanh header ghim đầu trang hiển thị thông tin Cửa và Phần hiện tại.
  - [LearnMobileStats.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/learn/LearnMobileStats.jsx): Widget hiển thị chuỗi ngày (Streak 🔥), tiến độ mục tiêu ngày (Daily Goal %), điểm kinh nghiệm (XP ⚡) và Mật ong (Honey 🍯).
  - [BeegoMascotBubble.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/learn/BeegoMascotBubble.jsx): Linh vật Chú ong Beego hoạt hình với lời nhắn động tạo động lực.
  - [LearnContinueDock.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/learn/LearnContinueDock.jsx): Nút CTA ghim đáy màn hình (Sticky CTA) tự động phát hiện bài học đang mở khóa (`active`) để học viên 1 chạm vào học ngay.
  - [BeegoLearningPath.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/learn/BeegoLearningPath.jsx): Lộ trình ảo hóa DOM (`useVirtualLearnSections.js`) cuộn mượt hàng trăm bài học.
  - [LessonStartSheet.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/learn/LessonStartSheet.jsx): Modal trượt từ dưới lên khi chạm vào bài học, hiển thị tóm tắt mục tiêu, thời gian ước tính, phần thưởng và chip kỹ năng.
  - [TodayForYouCard.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/learn/TodayForYouCard.jsx): Gợi ý 3 nhiệm vụ cá nhân hóa mỗi ngày.

---

### 1.2. Backend & Data Layer
- **Runtime:** Node.js v20+ chạy trong container Docker `beego-web`.
- **Cơ sở dữ liệu:**
  - **MySQL 8.0** (`beego-mysql`, truy vấn qua `mysql2` connection pool):
    - Dữ liệu người dùng: `users`, `user_stats`.
    - Dữ liệu bài học & tiến độ: `user_lesson_progress`, `user_learn_exercise_attempts`.
    - Dữ liệu sư phạm chuyên sâu: `user_learn_skill_mastery` (độ thành thạo từng kỹ năng), `user_learn_mistakes` (ngân hàng lỗi sai phục vụ ôn tập lặp lại), `user_learn_daily_progress`.
    - Đánh giá năng lực: `learn_placement_sessions`, `learn_placement_answers`.
    - Hội thoại AI: `learn_lesson_chat_sessions`, `learn_lesson_chat_turns`.
  - **Redis 7.0** (`beego-redis`, qua `ioredis`):
    - Quản lý session WebSocket, khóa phân tán (distributed lock), cache phiên âm IPA, pub/sub thời gian thực.
- **Hàng đợi & Worker nền:**
  - `bullmq`: Điều phối các tác vụ AI Voice, STT/TTS và phân tích dữ liệu học tập ngầm.
  - Worker scripts: `scripts/voice-llm-worker.mjs`, `scripts/voice-tts-worker.mjs`, `scripts/voice-usage-worker.mjs`.
- **API Endpoints chính của Tab Học:**
  - `GET /api/learning-path`: Trả về dữ liệu bản đồ lộ trình và trạng thái mở khóa của học viên.
  - `POST /api/learning-path/complete`: Xác thực hoàn thành bài học, mở khóa bài kế tiếp, cộng XP/Honey/Streak.
  - `GET /api/learn/lesson/[lessonId]`: Lấy dữ liệu bài học (đã lọc bỏ đáp án để chống gian lận client-side).
  - `POST /api/learn/exercise-result`: Chấm điểm từng câu hỏi phía server và ghi nhận lỗi sai vào bảng `user_learn_mistakes`.
  - `GET/POST /api/learn/ai-call/*`: Cấp quyền, khởi tạo phiên đàm thoại giọng nói với Gia sư AI.
  - `GET/POST /api/learn/chat/*`: Giao tiếp văn bản với Gia sư AI sau bài học.
  - `GET /api/tts/speak`: Dịch vụ phát âm từ vựng và câu mẫu.

---

### 1.3. AI & Voice Stack
- **Azure Cognitive Services Speech SDK** (`microsoft-cognitiveservices-speech-sdk` v1.49.0):
  - Speech-to-Text (STT): Nhận diện giọng nói tiếng Anh thời gian thực với độ chính xác cao.
  - Pronunciation Assessment (PA): Phân tích ngữ âm chuyên sâu 4 chỉ số (Độ chính xác âm vị, Độ trôi chảy, Độ hoàn thiện, Điểm tổng thể phát âm).
- **OpenAI API:**
  - Mô hình GPT-4o-mini / GPT-4o: Đóng vai gia sư AI giao tiếp đàm thoại theo ngữ cảnh từng bài học.
  - OpenAI TTS (`tts-1`, PCM 24kHz): Giọng đọc tự nhiên, ngắt nghỉ như người bản xứ trong cuộc gọi AI.
- **Web Speech API:** Nhận dạng giọng nói trên trình duyệt cho các bài tập đọc câu thông thường.
- **Công cụ Ngữ âm tự động:** `arpabet-to-ipa` và `cmu-pronouncing-dictionary` hỗ trợ hiển thị phiên âm quốc tế IPA chuẩn hóa.

---

### 1.4. Danh mục Tính năng Nghiệp vụ Tab Học
1. **Lộ trình học mở khóa tuần tự (Linear Unlock):** Hoàn thành bài trước mới mở bài sau; bảo đảm học viên đi đúng trình tự sư phạm.
2. **Cơ chế Gamification:** Tim (3 lives, sai trừ tim), Điểm kinh nghiệm (XP), Mật ong (Honey) và Chuỗi ngày (Streak).
3. **Chấm điểm bảo mật phía Server:** Trình duyệt không nhận đáp án đúng khi tải bài, tránh việc can thiệp mã nguồn.
4. **Hệ thống theo dõi lỗi sai thông minh (Mistakes Bank):** Tự động thu thập câu làm sai để đưa vào các bài ôn tập định kỳ (`review`).
5. **Gia sư AI Call (Learn Call):** Gọi điện thoại tương tác 2 chiều thời gian thực với AI Tutor Beego.
6. **Kiểm tra xếp lớp (Placement Test):** Giúp học viên có kiến thức nền nhảy cóc đến đúng trình độ.
7. **Lưu vết và tiếp tục làm bài (Resume Session):** Tự động khôi phục câu đang làm dở nếu học viên vô tình thoát app.

---

## 2. ĐÁNH GIÁ 5 KỸ NĂNG: NGHE - NÓI - ĐỌC - VIẾT - PHẢN XẠ

### 2.1. Ma trận hiện trạng 5 kỹ năng trong mã nguồn

| Kỹ năng | Dạng bài tập hiện có trong Code | Mức độ đáp ứng cho người mất gốc | Đánh giá & Khoảng trống lớn nhất |
| :--- | :--- | :---: | :--- |
| **1. NGHE (Listening)** | • `listening_choice` (nghe chọn đáp án)<br>• `matching_pairs` (nghe âm chọn nghĩa tiếng Việt)<br>• Audio qua `/api/tts/speak` (Google TTS proxy) | **55% (Khá)** | • Audio bài tập thường dùng giọng máy TTS thô cứng, thiếu ngữ điệu tự nhiên.<br>• Thiếu bài tập **Nghe chép chính tả (Dictation)** trong bài học hằng ngày.<br>• Thiếu nút chỉnh tốc độ âm thanh (0.75x, 0.85x, 1.0x). |
| **2. NÓI (Speaking)** | • Đọc câu theo mẫu (`speaking`) qua Web Speech API + so từ (`word_match`).<br>• Đọc đoạn văn (`passage_read`) qua Azure PA.<br>• Cuộc gọi gia sư AI (`LearnCallRoom`). | **40% (Chưa đạt)** | • Web Speech API không ổn định trên mobile (hay lỗi mic trên iOS Safari/WebView).<br>• Chấm điểm bài tập thường bằng `word_match` chỉ so chữ, **hoàn toàn không chấm âm vị/ngữ điệu**.<br>• Đọc cả đoạn văn (`passage_read`) là quá dài và quá sức với người mất gốc. |
| **3. ĐỌC (Reading)** | • Đọc câu đơn, hội thoại, đoạn văn ngắn.<br>• Trắc nghiệm đọc hiểu song ngữ kèm IPA. | **70% (Tốt)** | • Giao diện song ngữ Anh-Việt trực quan, có IPA hỗ trợ.<br>• Điểm trừ: Chưa có tính năng "Chạm vào từ bất kỳ để tra nghĩa nhanh" (Tap-to-translate). |
| **4. VIẾT (Writing)** | • Sắp xếp từ (`word_order`) bằng cách bấm chọn thẻ từ.<br>• Điền từ (`fill_blank`) nhưng bị biến thành trắc nghiệm A/B/C/D. | **20% (Rất yếu)** | • **Kỹ năng Viết thực tế gần như bị triệt tiêu** do lạm dụng chọn thẻ từ và trắc nghiệm.<br>• Không có bài tập gõ bàn phím (Typing) rèn chính tả.<br>• Không có bài viết câu tự do được AI phân tích lỗi ngữ pháp. |
| **5. PHẢN XẠ (Reflex)** | • `dialogue_response` (chọn câu đáp lại qua trắc nghiệm).<br>• Cuộc gọi đàm thoại Gia sư AI (`Gate Call`). | **35% (Yếu ở bài thường)** | • Trắc nghiệm hội thoại không tạo được phản xạ thật (người học nhìn chữ đoán mò).<br>• Thiếu bài tập phản xạ tốc độ có đếm ngược thời gian (Timed Reflex: 3-5 giây).<br>• AI Call chỉ nằm ở cuối Cửa (Gate Exam), thiếu phản xạ vi mô (Micro-reflex) mỗi ngày. |

---

### 2.2. Phân tích chi tiết từng kỹ năng & Lỗ hổng kỹ thuật

#### Kỹ năng Nghe (Listening)
- **Điểm sáng:** Dạng bài nghe ghép nghĩa (`matching_pairs`) và nghe chọn đáp án (`listening_choice`) giúp nhận biết âm thanh từ vựng khá tốt.
- **Lỗ hổng:**
  1. Âm thanh trong bài học hằng ngày vẫn gọi qua endpoint `/api/tts/speak` (Google Translate TTS proxy) nên phát âm phẳng, không có ngữ điệu nối âm, nuốt âm của người bản xứ.
  2. Mặc dù component [ListenDictationExercise.jsx](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/lesson-player/ListenDictationExercise.jsx) đã được lập trình, nhưng trong [builder.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/curriculum-50/builder.js#L126-L234) của curriculum-50 lại không đưa bài tập nghe chép chính tả vào bài học 12 câu.

#### Kỹ năng Nói (Speaking)
- **Điểm sáng:** Đã tích hợp Azure Pronunciation Assessment trong `passage_read` và đàm thoại thời gian thực trong `LearnCallRoom`.
- **Lỗ hổng nghiêm trọng:**
  1. **Chấm điểm "ảo" ở bài học thường:** Trong các bài học thường, hàm `buildSpeakItem` cài đặt `gradingMode: "word_match"`. Cơ chế này chỉ dùng Web Speech API nhận diện chuỗi ký tự rồi đo khoảng cách từ. Người học nói tiếng Anh sai âm đuôi, sai trọng âm, nuốt phụ âm nhưng nếu nhận diện ra đúng từ thì hệ thống vẫn chấm điểm tối đa.
  2. **Rào cản thiết bị:** Web Speech API trên mobile (đặc biệt là iOS Safari hoặc WebView bên trong app Android) cực kỳ chập chờn, thường xuyên báo lỗi không bật được mic, khiến học viên bị trừ tim oan uổng.
  3. **Quá tải nhận thức:** Người mất gốc chưa đọc thạo từng từ mà đã bắt đọc cả đoạn văn dài (`passage_read`) 3-4 câu với hàng chục âm khó khiến họ hoảng sợ và bỏ cuộc.

#### Kỹ năng Đọc (Reading)
- **Điểm sáng:** Cung cấp đầy đủ câu tiếng Anh, dịch nghĩa tiếng Việt và phiên âm IPA đi kèm.
- **Lỗ hổng:** Chưa có cơ chế giải thích ngữ pháp tức thì hoặc tra cứu nghĩa từ vựng phát sinh (contextual lookup).

#### Kỹ năng Viết (Writing)
- **Lỗ hổng lớn nhất của hệ thống:**
  1. Bài tập `fill_blank` thay vì yêu cầu người học gõ từ vào ô trống thì lại biến thành bài trắc nghiệm chọn A/B/C/D.
  2. Bài tập `word_order` chỉ là bấm vào các thẻ từ đã in sẵn.
  3. Hậu quả sư phạm: Học viên rơi vào hiện tượng **"Nhận diện thụ động" (Passive Recognition)** — nhìn từ thì hiểu mang máng, nhưng khi cần viết email, tin nhắn hay làm bài kiểm tra thì sai chính tả hoàn toàn vì chưa từng rèn luyện trí nhớ cơ bắp (Muscle Memory) qua bàn phím.

#### Kỹ năng Phản xạ (Reflex)
- **Lỗ hổng:**
  1. Người mất gốc gặp vấn đề nan giải nhất là: **"Nghe tiếng Anh -> Dịch sang tiếng Việt -> Nghĩ câu trả lời tiếng Việt -> Dịch sang tiếng Anh -> Phát âm ra"**. Quá trình này mất 10-15 giây.
  2. Trắc nghiệm tĩnh không giúp xóa bỏ thói quen dịch nhẩm trong đầu.
  3. Tính năng Gia sư AI Call (công cụ luyện phản xạ tốt nhất) lại bị khóa ở tận cuối Cửa hoặc tách riêng ra tab khác, khiến việc rèn phản xạ không diễn ra liên tục hằng ngày.

---

## 3. ĐÁNH GIÁ KHÁCH QUAN: ĐIỂM ĐÃ LÀM TỐT & ĐIỂM CHƯA LÀM TỐT

### 3.1. Những điểm đã làm tốt
1. **Kiến trúc hệ thống chuẩn mực & Hiện đại:** Ứng dụng kết hợp mượt mà giữa Next.js 14 App Router và Capacitor Android. Mã nguồn tổ chức module hóa mạch lạc, có phân tách rõ ràng giữa data layer, domain engine và presentation components.
2. **Hệ thống Gamification lôi cuốn:** Tim, Mật ong, Điểm XP, Chuỗi ngày (Streak) và Daily Goal hoạt động trơn tru, tạo động lực tâm lý mạnh mẽ cho học viên duy trì thói quen học mỗi ngày.
3. **UX Tab Học xuất sắc:** Bản đồ lộ trình dạng zigzag đẹp mắt, linh vật Ong Beego sinh động, lời khen thưởng xoay vòng tích cực ([praise-messages.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/praise-messages.js)), thanh Dock "Học tiếp" ghim đáy màn hình giải quyết triệt để sự bối rối khi tìm bài.
4. **Hạ tầng AI tiên tiến:** Tích hợp thành công cả 3 nền tảng AI hàng đầu thế giới (Azure Speech SDK, OpenAI GPT-4o, OpenAI TTS 24kHz) hoạt động thời gian thực qua WebSocket.
5. **Dữ liệu giáo trình đồ sộ:** Đã biên soạn kho ngữ liệu 50 Cửa (800 bài học) bao quát các chủ đề đời sống từ Pre-A1 đến B1+.

---

### 3.2. Những điểm bất cập sư phạm & kỹ thuật cần sửa
1. **Thiếu chặng khởi đầu "Ngữ âm IPA & Đánh vần":**
   - Bài đầu tiên `g01l01` (hoặc `p1-g1-n01`) lập tức đưa người học vào câu: *"Hello, let me introduce myself to my new classmate"*.
   - Đối với người mất gốc hoàn toàn, các từ như `introduce`, `myself`, `classmate` là quá nặng. Học viên chưa biết cách phát âm âm /eɪ/, âm đuôi /s/, /t/ nên đọc sai, app không nhận diện được và lập tức trừ tim, gây ức chế tâm lý.
2. **Kỹ năng Nói trong bài học thường mang tính "hình thức":**
   - Dùng Web Speech API so khớp từ ngữ, không đo lường được độ chuẩn xác của âm vị hay ngữ điệu.
   - Thường xuyên lỗi kết nối micro trên các trình duyệt di động.
3. **Thời lượng bài học còn quá dài (12 câu / bài):**
   - Người mất gốc có khả năng duy trì tập trung ngắn. Một bài 12 câu tích hợp kéo dài 12–20 phút gây mệt mỏi nhận thức (Cognitive Overload).
4. **Kỹ năng Viết bị triệt tiêu hoàn toàn:**
   - Không có bài gõ phím luyện chính tả, không có bài viết câu tự do có AI sửa lỗi ngữ pháp.
5. **Âm thanh bài tập thường chưa tương xứng với Learn Call:**
   - Bài tập thường vẫn dùng Google TTS proxy giọng máy khô cứng, trong khi Learn Call đã có giọng OpenAI TTS tự nhiên như người thật.
6. **Cơ chế phạt tim quá khắt khe đối với người mất gốc:**
   - 3 tim là quá ít đối với người mới bắt đầu. Khi hết tim, học viên bị chặn lại mà không có phương án cứu trợ hay giải thích chi tiết nguyên nhân sai.

---

## 4. LỘ TRÌNH HỌC TỐI ƯU NHẤT CHO NGƯỜI MẤT GỐC TIẾNG ANH

### 4.1. Đặc điểm tâm lý & Rào cản của người mất gốc (A0 / Pre-A1)
- **Sợ sai và ngại nói:** Rất sợ mở miệng vì phát âm sai, người khác không hiểu.
- **Quên nhanh:** Học từ mới hôm nay, ngày mai quên sạch nếu không có chu kỳ lặp lại ngắt quãng (Spaced Repetition).
- **Thói quen dịch nhẩm:** Mất nhiều thời gian chuyển ngữ qua lại giữa tiếng Việt và tiếng Anh.
- **Nhanh nản lòng:** Nếu bài học dài quá 10 phút hoặc bị phạt lỗi liên tục, tỷ lệ rời bỏ (Drop-off rate) sẽ lên đến trên 80%.

---

### 4.2. 5 Giai đoạn vàng theo phương pháp Giàn giáo (Scaffolding)

```
[Giai đoạn 0: Cung cấp Vũ khí Ngữ âm] (2 - 3 tuần)
  ├── 44 âm IPA chuẩn quốc tế (nguyên âm, phụ âm, cặp âm dễ nhầm)
  ├── Quy tắc bật âm đuôi (/s/, /z/, /t/, /d/) & Trọng âm từ
  └── Bảng chữ cái Alphabet & Đánh vần tên, số đếm cơ bản
         │
[Giai đoạn 1: Xây móng Từ vựng sinh tồn & Cụm từ cốt lõi] (4 - 6 tuần) — Pre-A1 → A1
  ├── 500 từ vựng sinh tồn gắn với Hình ảnh thực tế + Audio bản xứ
  ├── Cụm từ cố định (Lexical Chunks: "I want to...", "Where is...")
  └── Ngữ pháp vô thức qua mẫu câu tình huống (không học công thức khô khan)
         │
[Giai đoạn 2: Luyện tai Thụ cảm & Chép chính tả] (4 - 6 tuần) — A1
  ├── Shadowing (Nói nhại theo ngữ điệu câu ngắn 3-5 từ)
  └── Dictation (Nghe và gõ lại chính tả để rèn trí nhớ cơ bắp)
         │
[Giai đoạn 3: Phản xạ đàm thoại có giàn giáo] (6 - 8 tuần) — A1 → A2
  ├── Timed Reflex Drills (Đồng hồ đếm ngược 3 giây bật câu trả lời)
  └── Micro AI Call (Đàm thoại 1-2 phút với Gia sư AI Beego sau mỗi bài học)
         │
[Giai đoạn 4: Vận dụng tự chủ & Mở rộng ngữ cảnh] (8 - 12 tuần) — A2 → B1
  ├── Kể chuyện (Storytelling), miêu tả tranh, viết tin nhắn/email ngắn
  └── Thảo luận mở với Gia sư AI Beego không cần kịch bản cố định
```

---

### 4.3. Cấu trúc bài học vi mô chuẩn (Microlearning 5–7 phút)
Thay vì ép 12 hoạt động dàn trải, mỗi bài học thường cho người mất gốc chỉ nên gồm **6 đến 8 hoạt động trọng tâm**:
1. **Khởi động nhận diện (1 câu):** Nghe và ghép nghĩa từ vựng trọng tâm (`matching_pairs` - 3 cặp từ mới).
2. **Khắc sâu ngữ nghĩa (1 câu):** Nghe câu hoàn chỉnh và chọn nghĩa tiếng Việt đúng (`listening_choice`).
3. **Luyện viết & Chính tả (1 câu):** Nghe audio và gõ từ vào ô trống (`listening_dictation` hoặc `fill_blank_typing`).
4. **Cấu trúc ngữ pháp (1 câu):** Sắp xếp thẻ từ thành câu hoàn chỉnh (`word_order`).
5. **Luyện phát âm câu (1 câu):** Nghe mẫu bản xứ và đọc lại câu ngắn, AI phân tích âm vị (`speaking_phoneme`).
6. **Phản xạ giao tiếp (1–2 câu):** Tình huống hỏi - đáp nhanh có đếm ngược thời gian hoặc 1 lượt thoại ngắn cùng Chú ong Beego.

---

## 5. DANH SÁCH CÁC HẠNG MỤC CẦN ƯU TIÊN SỬA TRƯỚC

### 5.1. Bảng phân loại mức độ ưu tiên

| Mức độ | Hạng mục công việc | Lý do & Giải pháp kỹ thuật cụ thể | File liên quan |
| :---: | :--- | :--- | :--- |
| **P0** | **1. Thêm Chặng 0: Ngữ âm & IPA trước Cửa 1** | Người mất gốc không thể học câu hoàn chỉnh nếu chưa biết phát âm từ đơn và âm đuôi. Bổ sung Section Cửa 0 gồm 8-10 bài ngắn dạy 44 âm IPA và quy tắc đánh vần. | `lib/beego/learn/curriculum-50/`, `lib/beego/learning-path-catalog.js` |
| **P0** | **2. Tối ưu thời lượng bài học (Rút gọn từ 12 xuống 6–8 câu)** | Bài 12 câu kéo dài 15–20 phút gây nản chí. Cần chỉnh sửa `selectTwelveQuestions` trong `builder.js` chỉ lấy 6-8 câu tinh hoa, bảo đảm thời lượng 5–7 phút/bài. | `lib/beego/learn/curriculum-50/builder.js` |
| **P0** | **3. Nâng cấp bộ chấm Luyện nói & Chống lỗi Mic mobile** | Web Speech API chập chờn trên iOS Safari/WebView. Bổ sung cơ chế thu âm ngắn gửi về API proxy hoặc cơ chế "Bỏ qua khi lỗi mic không bị trừ tim". | `components/beego/lesson-player/ExerciseRenderer.jsx`, `adapters/lesson-speech.js` |
| **P1** | **4. Khôi phục bài tập Gõ bàn phím (Dictation / Typing)** | Kỹ năng Viết đang bị bỏ quên. Đưa `ListenDictationExercise.jsx` vào bài học hằng ngày để học viên gõ từ/câu, rèn trí nhớ cơ bắp và khắc phục lỗi sai chính tả. | `lib/beego/learn/curriculum-50/builder.js`, `components/beego/lesson-player/ListenDictationExercise.jsx` |
| **P1** | **5. Đưa phản xạ Micro AI Call vào bài học hằng ngày** | Không giấu AI Call ở cuối Cửa. Thêm 1 hoạt động đàm thoại 60 giây (2 lượt thoại) cùng Gia sư AI ở cuối mỗi bài học để luyện phản xạ nói tức thì. | `components/beego/lesson-player/LessonAiConversation.jsx`, `lib/beego/learn/learn-lesson-chat.service.js` |
| **P1** | **6. Chuyển đổi Audio bài học sang giọng AI tự nhiên** | Thay thế Google TTS proxy bằng OpenAI TTS hoặc Azure Neural TTS chất lượng cao để học viên nghe rõ ngữ điệu và âm đuôi chuẩn bản xứ. | `app/api/tts/speak/route.js`, `lib/beego/adapters/lesson-tts.js` |
| **P2** | **7. Tính năng Chạm từ tra nghĩa nhanh (Instant Tap-to-Lookup)** | Cho phép chạm vào bất kỳ từ tiếng Anh nào trong câu để mở tooltip giải nghĩa tiếng Việt và nghe phát âm mà không bị gián đoạn tiến trình làm bài. | `components/beego/lesson-player/QuestionRenderer.jsx` |
| **P2** | **8. Cơ chế Cứu tim & Phân tích giải thích lỗi sai sư phạm** | Khi làm sai, hiển thị thẻ giải thích tiếng Việt: "Vì sao chọn đáp án này lại sai? Mẹo nhớ là gì?". Cho phép học viên làm lại câu sai để lấy lại tim. | `components/beego/lesson-player/LessonFeedbackBar.jsx`, `lib/beego/learn/exercise-check.js` |

---

### 5.2. Kế hoạch hành động cụ thể từng bước (Action Plan)

#### Bước 1 (Ngay lập tức - P0):
1. Hiệu chỉnh `builder.js` của curriculum-50: Giảm số lượng câu hỏi từ 12 xuống 6–8 câu cho mỗi bài học thường, loại bỏ các câu trắc nghiệm trùng lặp.
2. Tinh chỉnh `PassageReadExercise` hoặc đưa nó thành hoạt động tùy chọn/thưởng thay vì bài bắt buộc ở cuối bài học đối với Cửa 1–5 (Pre-A1).
3. Thêm cờ cho phép "Thử lại phát âm" hoặc "Bỏ qua bài nói khi micro không hỗ trợ" trên thiết bị di động mà không phạt mất tim.

#### Bước 2 (Tuần tiếp theo - P1):
1. Tích hợp bài tập `ListenDictationExercise` vào cấu trúc bài học để kích hoạt lại kỹ năng Viết.
2. Thiết kế Cửa 0 ("Khởi động Ngữ âm IPA") tích hợp vào đầu bản đồ lộ trình học.
3. Thay thế nguồn phát âm sang giọng đọc tự nhiên chuẩn bản xứ.

#### Bước 3 (Hoàn thiện trải nghiệm - P2):
1. Thêm micro-dialogue 30–60 giây với Gia sư AI Beego ở cuối mỗi bài học.
2. Bổ sung tính năng chạm từ tra nghĩa và thẻ giải thích lỗi sai sư phạm thân thiện với người mất gốc.
