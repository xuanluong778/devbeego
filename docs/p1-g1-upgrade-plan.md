# Kế Hoạch Nâng Cấp Giáo Trình Phần 1 · Cửa 1 (Beego Learn Upgrade Plan)

> **Tệp tài liệu:** `docs/p1-g1-upgrade-plan.md`  
> **Dự án:** [dev.beego.vn](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn)  
> **Phạm vi:** Phần 1 (A0: Làm quen / Mất gốc tiếng Anh) · Cửa 1 (Chủ đề: Chào hỏi, Làm quen & Quê quán)  
> **Mã bài học giữ nguyên:** `p1-g1-n01` đến `p1-g1-n16` (16 bài học)  
> **Phiên bản nội dung đề xuất:** `p1g1-r4` (nâng cấp từ `p1g1-r3`)  
> **Trạng thái:** BÁO CÁO THIẾT KẾ & DUYỆT NỘI DUNG (Chưa sửa mã nguồn nghiệp vụ, chưa deploy)  
> **Ngày cập nhật:** 18/10/2026

---

## MỤC LỤC
1. [Xác Minh Kỹ Thuật & Khảo Sát Hiện Trạng Toàn Diện](#1-xác-minh-kỹ-thuật--khảo-sát-hiện-trạng-toàn-diện)
   - 1.1. Bằng chứng độc lập về cách ly môi trường Dev và Production
   - 1.2. Hiện trạng mã nguồn thực tế Cửa 1 & Bất cập sư phạm
   - 1.3. Khảo sát dữ liệu thực tế trong cơ sở dữ liệu Dev
   - 1.4. Quy trình bảo mật thông tin xác thực cơ sở dữ liệu
2. [Cấu Trúc & Luồng Tiến Độ Cửa 1 Chuẩn Hóa](#2-cấu-trúc--luồng-tiến-độ-cửa-1-chuẩn-hóa)
   - 2.1. Phân bổ 16 bài học theo tiến trình sư phạm
   - 2.2. Thời lượng vừa sức (5–8 phút/bài) & Cơ chế đan xen
   - 2.3. Quy tắc mở khóa tuần tự: `n15` → `n16` → `p2-g1-n01`
   - 2.4. Nguyên tắc đánh giá kỹ năng Nói / Phát âm
3. [Ma Trận Nâng Cấp 16 Bài Học Chi Tiết](#3-ma-trận-nâng-cấp-16-bài-học-chi-tiết)
4. [Quy Tắc Ôn Tập Truy Hồi & Spaced Repetition](#4-quy-tắc-ôn-tập-truy-hồi--spaced-repetition)
5. [Chiến Lược Tương Thích Tiến Độ Cũ & Versioning Câu Hỏi](#5-chiến-lược-tương-thích-tiến-độ-cũ--versioning-câu-hỏi)
6. [Danh Sách Tệp Cần Sửa Đổi & Thiết Kế Kỹ Thuật](#6-danh-sách-tệp-cần-sửa-đổi--thiết-kế-kỹ-thuật)
7. [Nội Dung Mẫu Duyệt Trước: n01, n08, n15](#7-nội-dung-mẫu-duyệt-trước-n01-n08-n15)
8. [Checklist Kiểm Thử, Điểm Chưa Xác Minh & Kế Hoạch Rollback](#8-checklist-kiểm-thử-điểm-chưa-xác-minh--kế-hoạch-rollback)

---

## 1. XÁC MINH KỸ THUẬT & KHẢO SÁT HIỆN TRẠNG TOÀN DIỆN

### 1.1. Bằng chứng độc lập về cách ly môi trường Dev và Production
Để đảm bảo an toàn tuyệt đối trước khi chỉnh sửa giáo trình, việc cách ly giữa Dev và Production đã được kiểm chứng độc lập trên 3 lớp kỹ thuật (không chỉ dựa vào phân giải IP):

1. **Lớp Routing Nginx (Reverse Proxy):**
   - Tệp cấu hình Nginx đang kích hoạt: `/etc/nginx/fastpanel2-available/dev_beego_vn_usr/dev.beego.vn.conf`
   - Khối `server` chỉ lắng nghe trên `server_name dev.beego.vn www.dev.beego.vn;` và chuyển tiếp proxy nội bộ:
     - `location /` → `proxy_pass http://127.0.0.1:3025;` (Container `beego-web`)
     - `location /voice` → `proxy_pass http://127.0.0.1:3031;` (Container `beego-voice-gateway`)
     - `location /voice-learn` → `proxy_pass http://127.0.0.1:3033;` (Container `beego-voice-gateway-learn`)
   - Trên máy chủ này, toàn bộ vhost cũ cho `beego.vn` chỉ còn dạng tệp sao lưu `.bak-20261009-call`, không có bất kỳ cấu hình Nginx nào chuyển tiếp traffic tới domain production. Domain `beego.vn` trỏ hoàn toàn về VPS mới tại IP `160.22.122.33`.
2. **Lớp Mạng & Kết nối Container (Docker Network Topology):**
   - Cụm Compose `/var/www/beego_vn_usr/data/docker/beego/docker-compose.yml` khởi tạo mạng bridge nội bộ riêng biệt `beego_net`.
   - Ứng dụng web (`beego-web`) và các worker giao tiếp với database qua hostname nội bộ `DB_HOST: mysql` (`beego-mysql`) và `REDIS_URL: redis://redis:6379` (`beego-redis`).
   - Cổng MySQL và Redis đưa ra ngoài host được bind nghiêm ngặt tại `127.0.0.1:3307` và `127.0.0.1:6399` (chỉ cục bộ trên máy dev, không mở ra mạng ngoài).
3. **Lớp Lưu Trữ (Volume Mounts):**
   - Database sử dụng Docker named volume `beego_mysql_data` nằm tại `/var/lib/docker/volumes/beego_beego_mysql_data/_data`.
   - Redis sử dụng Docker named volume `beego_redis_data`.
   - Không tồn tại bất kỳ bind-mount chia sẻ thư mục hay cơ sở dữ liệu nào với máy chủ production.
- **Kết luận:** **Môi trường Dev hoàn toàn cô lập về định tuyến, mạng container và cơ sở dữ liệu.**

---

### 1.2. Hiện trạng mã nguồn thực tế Cửa 1 & Bất cập sư phạm

Dẫn chứng mã nguồn tại:
- [lib/beego/learn/p1-g1-plan.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/p1-g1-plan.js)
- [lib/beego/learn/integrated-lesson.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/integrated-lesson.js)
- [lib/beego/learn/lesson-content-generate.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/lesson-content-generate.js)
- [lib/beego/learn/get-lesson-exercise.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/get-lesson-exercise.js)
- [lib/beego/learning-path-schema.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learning-path-schema.js)

#### Các bất cập sư phạm & kỹ thuật đã kiểm chứng:
1. **Ép khung 12 hoạt động / 13 câu cho cả 14 bài thường (`n01` – `n14`):**
   - Trong [lesson-content-generate.js:L393-L397](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/lesson-content-generate.js#L393-L397), hàm `isIntegratedNodeType()` kích hoạt cho toàn bộ 14 bài thường.
   - Mỗi bài đều bị ép tạo đúng 13 câu hỏi (chọn hình, chọn nghĩa, 2 bài ghép, xếp câu, điền từ nghe, chép chính tả, dịch Anh-Việt, dịch Việt-Anh, điền tình huống, chọn câu đáp, đọc to, đọc đoạn văn).
   - Hậu quả: Thời lượng bài kéo dài 12–15 phút, gây quá tải cho người mất gốc A0; do thiếu từ vựng tương ứng nên hệ thống phải dùng các từ phụ lặp đi lặp lại để nhồi đủ số lượng hoạt động.
2. **Thiếu hoàn toàn mục tiêu "Nói mình đến từ đâu":**
   - Cửa 1 có mục tiêu chuẩn là chào hỏi, giới thiệu tên, hỏi thăm sức khỏe, nói quê quán và kết thúc hội thoại.
   - Trong code hiện tại của `p1-g1-plan.js`, **hoàn toàn không có từ `from`, `Vietnam` hay câu `Where are you from? / I am from Vietnam`**.
   - Ngược lại, kịch bản Gia sư AI Learn Call ([learn-call-topics.js:L51-L61](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/learn-call-topics.js#L51-L61)) lại có sẵn facet `home` để hỏi học viên về nơi ở, tạo ra sự đứt gãy giữa bài học trên lộ trình và thực hành với AI Tutor.
3. **Bài học trùng lặp 100% (Zero New Items):**
   - Bài `n11` (Hỏi sức khỏe buổi sáng) có `newItems: []`, lặp lại y nguyên `How are you? I am fine` và `Good morning`.
   - Bài `n12` (Hẹn gặp lại) có `newItems: []`, lặp lại y nguyên `Goodbye. See you later`.
4. **Kho hình ảnh nghèo nàn dẫn đến hiển thị vô lý:**
   - Mảng `PICTURES` trong `p1-g1-plan.js` chỉ có 4 từ: `name`, `morning`, `night`, `thanks`.
   - Ở bài `n08` (Tạm biệt bạn), hoạt động nghe chọn hình lại hiển thị hình chữ `name` (tên); bài `n06` (Cảm ơn) và `n07` (Xin lỗi) đều dùng chung hình `thanks`.
5. **Bài ôn tập `n16` cực kỳ sơ sài:**
   - Bài `n16` chỉ có đúng **3 câu trắc nghiệm từ đơn** (`xin chào`, `tạm biệt`, `cảm ơn`), không có bất kỳ câu hỏi nào về mẫu câu hay tình huống giao tiếp.

---

### 1.3. Khảo sát dữ liệu thực tế trong cơ sở dữ liệu Dev
Dữ liệu khảo sát trực tiếp từ `beego-mysql` trên máy chủ dev ngày 18/10/2026:
- Bảng `user_lesson_progress`: Tổng cộng **22 bản ghi**. Trong đó bài `p1-g1-n01` có 4 người dùng hoàn thành; các bài `n02` đến `n16` có 1 người dùng hoàn thành.
- Bảng `user_learn_exercise_attempts`: Tổng cộng **265 bản ghi**. Trong đó 224 bản ghi có `content_revision = NULL` (từ các đợt phát triển trước), 2 bản ghi có `content_revision = 'p1g1-r3'`.
- Bảng `user_learn_mistakes`: Tổng cộng **176 bản ghi**.
  - Đang tồn tại song song 2 định dạng `question_id`: định dạng cũ `p1-g1-n01-q1` và định dạng mới `p1-g1-n13-a05`.
  - Nếu sửa bài mà thay đổi quy ước đặt ID, hàm `getLessonExerciseByRef` không tải được bài tập cũ, tạo ra các lỗi mồ côi (orphaned open mistakes) không thể hoàn thành trong tính năng "Ôn lỗi sai".

---

### 1.4. Quy trình bảo mật thông tin xác thực cơ sở dữ liệu
Trong quá trình vận hành trước đây, thông tin cấu hình chứa mật khẩu database đã từng xuất hiện trong log tiến trình. Nhằm tuân thủ nguyên tắc bảo mật:
- **Nguyên tắc:** Tuyệt đối không in, không sao chép lại giá trị mật khẩu cũ hay mật khẩu mới vào tài liệu kế hoạch, mã nguồn Git hoặc log chat.
- **Quy trình xoay vòng mật khẩu (Password Rotation Plan):**
  1. Sinh chuỗi mật khẩu ngẫu nhiên có độ dài tối thiểu 32 ký tự an toàn.
  2. Thực hiện cập nhật mật khẩu trực tiếp trong MySQL:
     `ALTER USER 'beego_app'@'%' IDENTIFIED BY '...'; FLUSH PRIVILEGES;`
  3. Cập nhật biến môi trường `MYSQL_PASSWORD` và `DB_PASSWORD` trong tệp bí mật cục bộ `/var/www/beego_vn_usr/data/docker/beego/.env.docker` (tệp đã được thêm vào `.gitignore`).
  4. Khởi động lại cụm Docker: `docker compose down && docker compose up -d`.
  5. Kiểm tra kết nối ứng dụng qua `/api/health` đảm bảo trạng thái bình thường.

---

## 2. CẤU TRÚC & LUỒNG TIẾN ĐỘ CỬA 1 CHUẨN HÓA

### 2.1. Phân bổ 16 bài học theo tiến trình sư phạm
Thay vì dàn trải 14 bài tích hợp giống hệt nhau, Cửa 1 được cơ cấu lại theo tiến trình học tập ngôn ngữ tự nhiên (Scaffolded → Retrieval → Expansion → Mid-check → Guided Application → Targeted Remediation → Narrative → Guided Roleplay → Autonomous Production → Gate Check → Consolidation):

```
[n01 - n05]: Học có hỗ trợ (Scaffolded Learning)
   ├── n01: Chào hỏi & Tự giới thiệu tên (Hello, Hi, I am, name)
   ├── n02: Hỏi tên & Giới thiệu lịch sự (What is your name?, My name is)
   ├── n03: Chào theo thời điểm (Good morning, Good afternoon, day)
   ├── n04: Hỏi thăm sức khỏe & Phản hồi (How are you?, I am fine, thank you, good)
   └── n05: Xuất thân & Quê quán (Where are you from?, I am from, Vietnam)
          │
[n06]: Ôn truy hồi ngắt quãng (Retrieval Practice) — Kích hoạt trí nhớ 5 bài đầu
          │
[n07]: Mở rộng ngữ cảnh xã giao (Expansion) — Lịch sự & Xin phép (Excuse me, please, sorry)
          │
[n08]: Kiểm tra giữa cửa (Mid-Gate Checkpoint) — Đánh giá 7 bài nền tảng
          │
[n09 - n10]: Vận dụng có hướng dẫn (Guided Application)
   ├── n09: Giới thiệu người thứ ba (This is my friend [name], He is, She is)
   └── n10: Đón tiếp & Chào mừng (Welcome to [class/Vietnam], Please sit here)
          │
[n11]: Củng cố điểm yếu (Targeted Remediation) — Tập trung các lỗi hay sai từ n01-n10
          │
[n12]: Câu chuyện ngữ cảnh (Connected Narrative / Story) — Đọc & nghe câu chuyện hoàn chỉnh
          │
[n13]: Hội thoại tương tác có hướng dẫn (Guided Roleplay) — Small talk 4 lượt thoại
          │
[n14]: Tự giới thiệu trọn vẹn (Personal Production) — Giới thiệu bản thân & Rời đi (I have to go now, Goodbye)
          │
[n15]: Vượt cửa (Gate Evaluation / Mastery Checkpoint) — Đạt ≥ 80% để mở n16
          │
[n16]: Củng cố toàn diện Cửa 1 (Consolidation & Transition) — Hoàn thành để mở p2-g1-n01
```

---

### 2.2. Thời lượng vừa sức (5–8 phút/bài) & Cơ chế đan xen
- **Số lượng bài tập:** Rút gọn từ 13 câu xuống **6 – 8 câu trọng tâm** cho mỗi bài học thường.
- **Thời lượng:** Đạt chuẩn **5 – 8 phút/bài**, vừa sức với học viên mới bắt đầu, không gây nản chí.
- **Nguyên tắc đan xen (Interleaved Modalities):** Trong 6–8 câu, học viên được luân chuyển tự nhiên:
  `Nghe nhận diện (Audio)` → `Hiểu nghĩa & Ngữ cảnh (Choice/Cloze)` → `Tái tạo câu (Word Order/Translation)` → `Nói phản xạ (Speaking)`.
- Không nhồi nhét các bài tập không liên quan đến mục tiêu trọng tâm của bài.

---

### 2.3. Quy tắc mở khóa tuần tự: `n15` → `n16` → `p2-g1-n01`
Hệ thống tuân thủ chặt chẽ luồng tiến độ sư phạm:
1. **Bài `p1-g1-n15` (Vượt cửa - Gate Checkpoint):**
   - Đóng vai trò bài đánh giá năng lực toàn diện Cửa 1 gồm 10 câu hỏi chuẩn hóa bao quát 6 mục tiêu giao tiếp.
   - **Điều kiện đạt:** Điểm số bài làm đạt từ **80% trở lên** (tối thiểu 8/10 câu đúng, dựa trên server-derived score từ `user_learn_exercise_attempts`).
   - **Đạt `n15` (score ≥ 80%):** Hệ thống ghi nhận hoàn thành bài 15 (`status = 'completed'`) và **mở khóa bài `p1-g1-n16`** (`status = 'active'`).
   - **Chưa đạt `n15` (score < 80%):**
     - Tại `completeLessonForUser` ([lib/beego/learning-path-progress.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learning-path-progress.js)), API chặn ghi nhận hoàn thành nếu điểm bài kiểm tra vượt cửa dưới ngưỡng 80%. Bài 15 giữ nguyên trạng thái `active`, bài 16 vẫn ở trạng thái `locked`.
     - Hệ thống phản hồi thông điệp khích lệ sư phạm: *«Bạn đạt X/10 câu. Để vượt cửa, bạn cần đạt tối thiểu 8/10 câu (80%). Hãy luyện tập thêm ở bài củng cố n11 để ôn lại các điểm còn yếu, sau đó làm lại bài kiểm tra nhé!»*.
     - Học viên có thể bấm vào bài `p1-g1-n11` (Củng cố điểm yếu) hoặc làm lại trực tiếp bài `p1-g1-n15`.
2. **Bài `p1-g1-n16` (Củng cố toàn cửa & Chuyển tiếp):**
   - Bài ôn tập Spaced Repetition tổng kết toàn diện và kích hoạt trí nhớ dài hạn trước khi bước sang Phần 2.
   - **Hoàn thành `n16`:** Hệ thống tự động **mở khóa bài đầu tiên của Phần 2 (`p2-g1-n01`)** trên bản đồ học.
   - Đảm bảo học viên nắm vững toàn bộ kỹ năng giao tiếp nền tảng trước khi bước vào học ngữ pháp thì Hiện tại đơn ở Cửa 2.

---

### 2.4. Nguyên tắc đánh giá kỹ năng Nói / Phát âm
Trong môi trường học tập số, việc đánh giá kỹ năng Nói cần tuân thủ ranh giới kỹ thuật rõ ràng:
1. **Hoạt động Nói trong Lesson Player (`type: 'speaking'`):**
   - Được thiết kế nhằm mục đích **tạo thói quen mở khẩu hình và luyện tập phát âm phản xạ**.
   - Trình duyệt sử dụng Web SpeechRecognition chuyển âm thanh thành văn bản (text transcript).
   - **Quy tắc sư phạm:** **Tuyệt đối KHÔNG dùng độ khớp chuỗi ký tự transcript hoặc câu hỏi trắc nghiệm để kết luận học viên đã "phát âm chuẩn bản xứ" hay "thành thạo kỹ năng nói".**
   - Đánh giá trong bài chỉ ghi nhận: Học viên đã thực hiện phát âm câu mẫu (participation & effort), khuyến khích người học không ngại nói.
2. **Đánh giá phát âm chuyên sâu (Mastery Assessment):**
   - Chỉ được thực hiện qua tính năng **Learn Call (Gia sư AI)** có tích hợp công nghệ Azure Speech Pronunciation Assessment (chấm điểm theo 4 tiêu chí: Độ chính xác âm vị Accuracy, Độ trôi chảy Fluency, Độ trọn vẹn Completeness và Ngữ điệu Prosody) đã được tích hợp trong gateway.

---

## 3. MA TRẬN NÂNG CẤP 16 BÀI HỌC CHI TIẾT

> **Quy ước ma trận:**
> - Giữ nguyên 16 `lessonId` hiện có.
> - `nodeType` giữ nguyên theo `GATE_NODE_BLUEPRINT` để tương thích toàn hệ thống.
> - Số câu thiết kế từ 6 – 8 câu (bài thường), 10 câu (bài kiểm tra / củng cố).

| Mã bài | Nhãn Blueprint | Vai trò sư phạm | Mục tiêu giao tiếp cụ thể | Kiến thức mới (New Items) | Kiến thức ôn truy hồi (Review Items) | Số câu & Thời lượng | Chuỗi hoạt động đan xen | Điều kiện hoàn thành | Đầu ra năng lực (Can-do A0) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`p1-g1-n01`** | `vocabulary` | **Học có hỗ trợ** *(Scaffolded)* | Chào hỏi ban đầu và xưng tên mình | `Hello`, `Hi`, `I am`, `name` | *(Khởi đầu lộ trình)* | 6 câu · 5 phút | Nghe chọn hình → Chọn nghĩa → Ghép từ → Xếp câu xưng tên → Dịch câu chào → Luyện nói câu xưng tên | Hoàn thành đủ 6 câu, đúng ≥ 60% | Tự tin nói: *"Hello, I am [Tên]."* |
| **`p1-g1-n02`** | `sentence_patterns` | **Học có hỗ trợ** *(Scaffolded)* | Hỏi tên người đối diện và nói tên trang trọng | `What is your name?`, `My name is` | `Hello`, `I am`, `name` | 6 câu · 5 phút | Nghe điền `name` → Xếp câu hỏi tên → Dịch câu hỏi → Thoại đáp tên → Luyện nói câu tên mình | Hoàn thành đủ 6 câu, đúng ≥ 60% | Hỏi được *"What is your name?"* và đáp *"My name is..."* |
| **`p1-g1-n03`** | `grammar` | **Học có hỗ trợ** *(Scaffolded)* | Chào theo thời điểm (Sáng / Chiều) | `Good morning`, `Good afternoon`, `day` | `Hello`, `Hi`, `My name is` | 7 câu · 6 phút | Nghe chọn hình buổi sáng → Chọn nghĩa `morning` → Xếp câu chào sáng → Điền ngữ cảnh chiều → Dịch câu chào | Hoàn thành đủ 7 câu, đúng ≥ 60% | Phản xạ chào chuẩn *"Good morning!"* và *"Good afternoon!"* |
| **`p1-g1-n04`** | `listening` (slot 1) | **Học có hỗ trợ** *(Scaffolded)* | Hỏi thăm sức khỏe và đáp lại chân thành | `How are you?`, `I am fine`, `thank you`, `good` | `Good morning`, `Hello`, `I am` | 7 câu · 6 phút | Nghe chép chính tả câu hỏi sức khỏe → Chọn nghĩa `fine` → Thoại hỏi đáp sức khỏe → Dịch câu cảm ơn → Nói nhắc lại | Hoàn thành đủ 7 câu, đúng ≥ 60% | Hỏi *"How are you?"* và đáp *"I am fine, thank you."* |
| **`p1-g1-n05`** | `listening` (slot 2) | **Học có hỗ trợ** *(Scaffolded)* | **[Mục tiêu mới]** Nói và hỏi về quê quán / xuất thân | `Where are you from?`, `I am from`, `Vietnam`, `from` | `What is your name?`, `I am`, `You` | 7 câu · 6 phút | Nghe chọn từ thiếu `from` → Ghép cặp địa danh → Xếp câu hỏi quê quán → Dịch câu *"Tôi đến từ Việt Nam"* → Thoại xuất thân | Hoàn thành đủ 7 câu, đúng ≥ 60% | Hỏi *"Where are you from?"* và trả lời *"I am from Vietnam."* |
| **`p1-g1-n06`** | `listening` (slot 3) | **Ôn truy hồi** *(Retrieval Practice)* | Kích hoạt trí nhớ 5 bài đầu: Tên, Chào hỏi, Sức khỏe, Xuất xứ | *(Không có từ mới - `newItems: []`)* | `Hello`, `My name is`, `How are you?`, `I am from Vietnam` | 8 câu · 6 phút | Nghe điền không gợi ý → Dịch phản xạ nhanh → Tráo thứ tự các tình huống ghép nối chào + hỏi tên + quê | Hoàn thành đủ 8 câu, đúng ≥ 70% | Tự truy hồi và ghép nối thông tin cá nhân mà không cần trợ giúp |
| **`p1-g1-n07`** | `listening` (slot 4) | **Mở rộng** *(Expansion)* | Lịch sự xã giao: Xin phép trước khi hỏi, Cảm ơn & Xin lỗi | `Excuse me`, `please`, `sorry`, `welcome` | `Where are you from?`, `Thank you`, `What is your name?` | 7 câu · 6 phút | Điền ngữ cảnh bắt chuyện `Excuse me` → Phân biệt `sorry` vs `excuse me` → Thoại lịch sự khi được giúp → Dịch câu xã giao | Hoàn thành đủ 7 câu, đúng ≥ 60% | Biết dùng *"Excuse me..."* để bắt chuyện và *"Thank you / You're welcome"* |
| **`p1-g1-n08`** | `listening` (slot 5) | **Kiểm tra giữa cửa** *(Mid-Gate Check)* | Đánh giá tổng hợp 7 bài nền tảng đầu tiên | *(Kiểm tra toàn bộ n01–n07)* | `Hello`, `Name`, `Health`, `Origin`, `Politeness` | 8 câu · 7 phút | Trắc nghiệm nhanh 4 kỹ năng (Nghe nhận diện, sắp xếp câu, chọn câu đáp, dịch nghĩa) | **Đạt ≥ 75%** (nếu dưới 75% gợi ý ôn lại n06) | Đạt chuẩn phản xạ cho nửa đầu Cửa 1 |
| **`p1-g1-n09`** | `speaking` (slot 1) | **Vận dụng có hướng dẫn** *(Application)* | Giới thiệu người thứ ba (Bạn bè, đồng nghiệp) | `This is my friend`, `friend`, `He is`, `She is` | `My name is`, `I am from`, `Nice to meet you` | 7 câu · 6 phút | Nghe nhận diện giới thiệu bạn → Xếp câu giới thiệu bạn Mai → Dịch câu giới thiệu xuất xứ của bạn → Luyện nói câu giới thiệu | Hoàn thành đủ 7 câu, đúng ≥ 60% | Tự tin giới thiệu người đi cùng: *"This is my friend, Nam. He is from Vietnam."* |
| **`p1-g1-n10`** | `speaking` (slot 2) | **Vận dụng có hướng dẫn** *(Application)* | Chào đón người mới đến và thể hiện sự hiếu khách | `Welcome to`, `meet`, `Nice to meet you` | `This is my friend`, `Hello`, `Vietnam` | 7 câu · 6 phút | Nghe chép chính tả câu chào đón → Thoại đáp lại lời làm quen *"Nice to meet you too"* → Dịch câu chào mừng → Nói câu chào đón | Hoàn thành đủ 7 câu, đúng ≥ 60% | Biết nói *"Welcome to Vietnam!"* và đáp *"Nice to meet you!"* |
| **`p1-g1-n11`** | `speaking` (slot 3) | **Củng cố điểm yếu** *(Remediation)* | Khắc phục các lỗi sai phổ biến từ `user_learn_mistakes` (n01–n10) | *(Không có từ mới - `newItems: []`)* | Các mục kiến thức có `mastery_score < 70%` hoặc có trong danh sách lỗi sai | 8 câu · 6 phút | Bài tập biến thể của các câu học viên đã làm sai: sửa lỗi sắp xếp từ, phân biệt từ gây nhầm lẫn | Hoàn thành đủ 8 câu, giải quyết các mục lỗi sai mở | Xóa các lỗ hổng kiến thức trước khi bước vào các bài tình huống phức tạp |
| **`p1-g1-n12`** | `speaking` (slot 4) | **Câu chuyện ngữ cảnh** *(Narrative/Story)* | Đọc và nghe câu chuyện bạn mới đến lớp học ngoại ngữ | `new`, `student`, `class`, `together` | `Hello`, `My name is`, `Where are you from?`, `This is my friend` | 6 câu · 6 phút | Đọc đoạn văn hội thoại 3 người → Trả lời câu hỏi đọc hiểu ý chính → Nghe điền câu then chốt của câu chuyện | Hoàn thành đủ 6 câu, đúng ≥ 70% | Nghe hiểu và đọc hiểu văn bản hội thoại ngắn liên hoàn |
| **`p1-g1-n13`** | `speaking` (slot 5) | **Hội thoại hướng dẫn** *(Roleplay)* | Thực hành cuộc trò chuyện 4 lượt thoại hoàn chỉnh | `How is it going?`, `Good to see you`, `And you?` | `Hi`, `How are you?`, `I am fine`, `Where are you from?` | 7 câu · 6 phút | Đọc tình huống hội thoại từng bước → Chọn câu đáp tương ứng cho từng lượt thoại → Luyện nói lượt thoại của mình | Hoàn thành đủ 7 câu, đúng ≥ 70% | Tự tin tham gia hội thoại 2 chiều gồm chào hỏi, hỏi thăm và hỏi quê quán |
| **`p1-g1-n14`** | `story` | **Tự giới thiệu & Kết thúc** *(Personal Production)* | Tự nói thông tin bản thân và xin phép rời đi lịch sự | `I have to go now`, `Goodbye`, `See you later`, `take care` | `I am`, `from Vietnam`, `Thank you`, `Nice to meet you` | 8 câu · 7 phút | Tự ghép câu giới thiệu đầy đủ của mình → Học cách kết thúc lịch thiệp: *"I have to go now. Thank you, goodbye!"* → Luyện nói câu tạm biệt | Hoàn thành đủ 8 câu, đúng ≥ 70% | Hoàn thành bài nói cá nhân: Chào → Giới thiệu tên & quê → Cảm ơn & Xin phép rời đi |
| **`p1-g1-n15`** | `test` | **Kiểm tra vượt cửa** *(Gate Checkpoint)* | Đánh giá độc lập toàn bộ 6 năng lực giao tiếp Cửa 1 | *(Toàn bộ kiến thức Cửa 1)* | 14 bài học trước (`n01` – `n14`) | 10 câu · 8 phút | Bài kiểm tra tổng hợp 10 câu chuẩn hóa bao quát 6 năng lực cốt lõi | **Đạt ≥ 80%** (8/10 câu) → **Mở khóa n16** (Chưa đạt: làm lại n15) | Đủ điều kiện vượt qua bài kiểm tra chuẩn hóa Cửa 1 |
| **`p1-g1-n16`** | `review` | **Củng cố toàn cửa & Chuyển tiếp** *(Consolidation)* | Ôn tập Spaced Repetition củng cố dài hạn và chuẩn bị Phần 2 | *(Không có từ mới - `newItems: []`)* | Tổng hợp toàn bộ mẫu câu Cửa 1 theo thuật toán trí nhớ ngắt quãng | 10 câu · 8 phút | 10 câu trắc nghiệm tổng hợp thông minh quét qua các điểm trọng tâm của Cửa 1 | **Hoàn thành 10 câu** → **Mở khóa Phần 2 (`p2-g1-n01`)** | Khắc sâu trí nhớ dài hạn, sẵn sàng bước sang Phần 2 (Thì Hiện tại đơn) |

---

## 4. QUY TẮC ÔN TẬP TRUY HỒI & SPACED REPETITION

Trong thiết kế mới, các bài ôn tập (`p1-g1-n06`, `p1-g1-n11`, `p1-g1-n16`) tuân thủ nghiêm ngặt nguyên lý khoa học thần kinh về trí nhớ (Retrieval Practice & Spaced Repetition):
1. **Cho phép bài ôn không có kiến thức mới (`newItems: []`):**
   - Không ép buộc bài ôn phải có từ vựng mới. Giá trị của bài ôn là **buộc não bộ truy xuất thông tin đã học** từ trí nhớ dài hạn.
2. **Thuật toán chọn câu hỏi ôn tập thông minh:**
   - Dựa vào 3 tiêu chí trong CSDL: **Mục kiến thức (Knowledge Item)**, **Lịch đến hạn (Forgetting Curve / Due Date)** dựa trên `last_practiced_at`, và **Kết quả ghi nhớ thực tế (Recall Accuracy)** dựa trên `user_learn_mistakes`.
3. **Phân định minh bạch giữa Ôn cách quãng cá nhân hóa và Ôn tập tổng kết (Comprehensive Review):**
   - **Chế độ Ôn cá nhân hóa ngắt quãng (`mode = 'personalized'`):** Kích hoạt khi học viên có lỗi sai thực tế (`status = 'open'` trong `user_learn_mistakes`) hoặc có kỹ năng bị giảm độ nhớ theo đường cong quên (`last_practiced_at` quá hạn hoặc `mastery_score < 55` trong `user_learn_skill_mastery`). Hệ thống ưu tiên truy hồi đúng các câu hỏi học viên đang yếu.
   - **Chế độ Ôn tổng kết Cửa (`mode = 'gate_curriculum'`):** Khi học viên là tài khoản mới, khách, hoặc không có kỹ năng nào đến hạn quên, hệ thống phục vụ ngân hàng 10 câu ôn tập chuẩn hóa quét qua toàn bộ các mẫu câu Cửa 1. Lúc này hệ thống **gọi đúng bản chất là «Ôn tập tổng kết Cửa 1 (Gate Comprehensive Review)»** và ghi nhận rõ trạng thái cá nhân hóa chưa được kích hoạt do chưa phát sinh chu kỳ quên.

---

## 5. CHIẾN LƯỢC TƯƠNG THÍCH TIẾN ĐỘ CŨ & VERSIONING CÂU HỎI

### 5.1. Versioning nội dung: `P1_CONTENT_REVISION = "p1g1-r4"`
- Nâng hằng số phiên bản trong mã nguồn:
  ```javascript
  export const P1_CONTENT_REVISION = "p1g1-r4";
  ```
- Mọi lượt làm bài mới sẽ được ghi vào `user_learn_exercise_attempts` với `content_revision = 'p1g1-r4'`.

### 5.2. Bảo toàn tiến độ và không làm gián đoạn người dùng
1. **Người dùng đã hoàn thành bài (`completed`):**
   - Bản ghi trong `user_lesson_progress` vẫn giữ nguyên `status = 'completed'`.
   - Vị trí trên bản đồ học không bị xáo trộn hay khóa lại.
   - Khi học viên vào học lại (Replay), hệ thống sẽ nạp nội dung mới `p1g1-r4` để trải nghiệm phiên bản cải tiến mà không bị trừ điểm thưởng cũ.
2. **Người dùng đang học dở dang (`active` / có attempts dở dang):**
   - Khi học viên mở lại bài học mà trước đó đã có attempts thuộc phiên bản cũ (`content_revision` cũ hoặc `mix_fingerprint` đã thay đổi):
   - **Xử lý minh bạch (Tuyệt đối không âm thầm reset):**
     - Hệ thống không âm thầm tráo câu hỏi khiến học viên bối rối.
     - API `/api/learn/lesson/[lessonId]` trả về cờ `contentUpdated: true` và `versionNotice: "Bài học đã được nâng cấp lên phiên bản mới tinh gọn hơn (5–8 phút). Bạn sẽ làm quen với nội dung cập nhật mới!"`.
     - Trên giao diện `LessonPlayer.jsx`, hiển thị thông báo ngắn gọn thân thiện giúp học viên nắm bắt việc thay đổi nội dung.
     - Toàn bộ các attempt dở dang cũ trong `user_learn_exercise_attempts` vẫn được lưu trữ làm dữ liệu lịch sử trong CSDL, không bị xóa.
     - Phiên làm bài sẽ nạp danh sách câu hỏi mới của `p1g1-r4` để học viên hoàn thành trọn vẹn các câu hỏi bắt buộc mới, tránh lỗi `REQUIRED_QUESTIONS_SKIPPED` khi nộp hoàn thành bài.
3. **Cơ chế tham chiếu ID câu hỏi (Question Referencing & Alias Mapping):**
   - Để tránh việc các bản ghi lỗi cũ trong `user_learn_mistakes` (dạng `${lessonId}-aXX` hoặc `${lessonId}-qXX`) bị lỗi `400 UNKNOWN_EXERCISE` khi tải phiên "Ôn lỗi sai", hàm `getLessonExerciseByRef` ([lib/beego/learn/get-lesson-exercise.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/get-lesson-exercise.js)) sẽ được bổ sung cơ chế fallback/alias mapping:
     - Nếu câu hỏi yêu cầu thuộc phiên bản cũ, hệ thống sẽ tra cứu bảng `P1_QUESTION_ALIAS_MAP` để map về câu hỏi tương đương trong phiên bản `p1g1-r4`.
     - Nếu câu hỏi cũ thuộc dạng bài tập đã được tinh giản (không còn mục câu tương đương), hệ thống tự động đánh dấu trạng thái bản ghi lỗi là `resolved` với lý do `deprecated_in_r4`, ngăn chặn hoàn toàn lỗi mồ côi (orphaned open mistakes) không thể xóa.

---

## 6. DANH SÁCH TỆP CẦN SỬA ĐỔI & THIẾT KẾ KỸ THUẬT

Khi bước vào giai đoạn triển khai, các tệp sau sẽ được chỉnh sửa có kiểm soát:

| STT | Đường dẫn tệp | Vai trò và nội dung thay đổi dự kiến |
| :--- | :--- | :--- |
| 1 | [lib/beego/learn/p1-g1-plan.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/p1-g1-plan.js) | - Nâng `P1_CONTENT_REVISION = "p1g1-r4"`.<br>- Mở rộng ngân hàng tranh ảnh `PICTURES` (bổ sung `vietnam`, `friend`, `welcome`, `evening`).<br>- Viết lại 14 bài học theo cấu trúc 6–8 câu/bài vừa sức, bổ sung mục tiêu quê quán (`Where are you from? / I am from Vietnam`). |
| 2 | [lib/beego/learn/lesson-content-generate.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/lesson-content-generate.js) | - Cập nhật `P1_CHECKPOINT_BANK` đồng bộ với các từ mới (quê quán, lịch sự).<br>- Điều chỉnh hàm `p1CheckpointQuestions()` cho bài `n15` (10 câu toàn diện) và bài `n16` (10 câu ôn tập Spaced Repetition thông minh). |
| 3 | [lib/beego/learn/get-lesson-exercise.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/get-lesson-exercise.js) | - Bổ sung mapping xử lý tương thích ngược cho các ID câu hỏi cũ trong `user_learn_mistakes`. |
| 4 | [lib/beego/learn/integrated-story-vi.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/integrated-story-vi.js) | - Bổ sung các đoạn văn tiếng Việt tương ứng cho bài đọc hiểu `n12` và các câu chuyện ngữ cảnh mới. |
| 5 | [lib/beego/learn/lesson-topic-banks.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/lesson-topic-banks.js) | - Đồng bộ ngân hàng từ vựng chung của Phần 1 (bổ sung từ khóa `from`, `Vietnam`, `city`, `evening`). |
| 6 | [lib/beego/learning-path-progress.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learning-path-progress.js) | - Đảm bảo logic mở khóa chặt chẽ: Đạt `n15` (≥ 80%) mới mở `n16`; hoàn thành `n16` mở tiếp `p2-g1-n01`. |

---

## 7. NỘI DUNG MẪU DUYỆT TRƯỚC: n01, n08, n15

Dưới đây là đặc tả chi tiết từng câu hỏi của 3 bài tiêu biểu đại diện cho 3 giai đoạn: **Khởi đầu (`n01`)**, **Đánh giá giữa cửa (`n08`)** và **Vượt cửa (`n15`)** để duyệt trước khi code:

### 7.1. Bài Mẫu: `p1-g1-n01` (Chào và xưng tên — Học có hỗ trợ · 6 câu · 5 phút)
- **Mục tiêu:** Học viên nhận biết và tự tin nói được câu chào và tên mình: *"Hello, I am [Tên]."*

1. **Câu 1 (`listening_choice` - Nghe và chọn hình):**
   - *Âm thanh phát:* "name"
   - *Prompt:* "Nghe và chọn hình ảnh biểu thị 'tên gọi'."
   - *Lựa chọn:* [A. Hình thẻ tên (name), B. Hình mặt trời mọc (morning), C. Hình mặt trăng (night), D. Hình bàn tay cảm ơn (thanks)]
   - *Đáp án đúng:* A
   - *Giải thích:* "'name' có nghĩa là 'tên gọi'."
2. **Câu 2 (`multiple_choice` - Chọn nghĩa từ):**
   - *Prompt:* "Từ 'Hello' trong tiếng Anh có nghĩa là gì?"
   - *Lựa chọn:* [A. Xin chào, B. Tạm biệt, C. Cảm ơn, D. Xin lỗi]
   - *Đáp án đúng:* A
   - *Giải thích:* "'Hello' là lời chào thân thiện khi gặp mặt."
3. **Câu 3 (`matching_pairs` - Ghép cặp từ):**
   - *Prompt:* "Ghép từ tiếng Anh với nghĩa tiếng Việt tương ứng."
   - *Các cặp:* `Hello` ↔ `Xin chào`, `name` ↔ `tên`, `I` ↔ `tôi`, `you` ↔ `bạn`
   - *Đáp án đúng:* Ghép đúng 4 cặp tương ứng.
4. **Câu 4 (`word_order` - Sắp xếp câu):**
   - *Prompt:* "Sắp xếp thành câu: «Xin chào, tôi là Beego.»"
   - *Ngân hàng từ:* `["Hello,", "I", "am", "Beego.", "you", "name"]`
   - *Đáp án đúng:* `["Hello,", "I", "am", "Beego."]`
   - *Giải thích:* "Cấu trúc xưng tên: Hello, I am + [Tên]."
5. **Câu 5 (`translation` - Dịch câu):**
   - *Prompt:* "Dịch sang tiếng Anh: «Tôi là Beego.»"
   - *Ngân hàng từ:* `["I", "am", "Beego", "Hello", "is", "my"]`
   - *Đáp án đúng:* `["I", "am", "Beego"]`
   - *Giải thích:* "'I am Beego' nghĩa là 'Tôi là Beego'."
6. **Câu 6 (`speaking` - Luyện nói phản xạ):**
   - *Câu mẫu hỗ trợ:* "Hello. I am [Tên bạn]." (Ví dụ: *"Hello, I am Nam."*, *"Hello, I am Linh."*, hoặc *"Hello, I am Beego."*)
   - *Prompt:* "Bấm micro và thử tự giới thiệu tên của bạn nhé! (Câu mẫu: «Hello, I am [Tên bạn]»)"
   - *Chấp nhận mở rộng:* Chấp nhận tên thật của học viên (ví dụ: *"Hello, I am Nam"*, *"Hi, I am Mai"*, *"I am Linh"*). Lỗi mic/nhận dạng giọng nói không tính là sai kiến thức, không trừ tim/điểm.
   - *Đánh giá nỗ lực:* Khuyến khích mở khẩu hình và tập phản xạ tự tin nói tên mình.

---

### 7.2. Bài Mẫu: `p1-g1-n08` (Kiểm tra giữa cửa — Mid-Gate Check · 8 câu · 7 phút)
- **Mục tiêu:** Đánh giá độc lập 7 bài nền tảng đầu tiên (`n01` – `n07`). **Chỉ kiểm tra kiến thức đã dạy trước đó (Chào hỏi, Tên, Buổi trong ngày, Sức khỏe, Quê quán, Lịch sự xã giao). Tuyệt đối không dùng cụm từ của các bài sau như «Nice to meet you» hay lời tạm biệt «Goodbye / See you later».**
- **Quy tắc chấm ở server:** Chấm độc lập theo phiên làm bài mới nhất của revision `p1g1-r4`; không cộng dồn đáp án đúng từ các lần thử trước; đạt ≥ 75% (tối thiểu 6/8 câu).

1. **Câu 1 (`listening_choice` - Nghe nhận diện):**
   - *Âm thanh phát:* "Good morning. How are you?"
   - *Prompt:* "Nghe và chọn câu đối thoại chính xác."
   - *Lựa chọn:* [A. Good morning. How are you?, B. Good night. How are you?, C. Good morning. What is your name?, D. Hello. What is your name?]
   - *Đáp án đúng:* A
2. **Câu 2 (`multiple_choice` - Ngữ cảnh xuất xứ):**
   - *Prompt:* "Khi ai đó hỏi: «Where are you from?», câu trả lời đúng là:"
   - *Lựa chọn:* [A. I am from Vietnam., B. My name is Vietnam., C. I am fine, thank you., D. Good morning, Vietnam.]
   - *Đáp án đúng:* A
   - *Giải thích:* "'Where are you from?' hỏi về quê quán, trả lời bằng 'I am from + [Nơi chốn]'."
3. **Câu 3 (`word_order` - Sắp xếp câu xuất xứ):**
   - *Prompt:* "Sắp xếp thành câu: «Bạn đến từ đâu?»"
   - *Ngân hàng từ:* `["Where", "are", "you", "from?", "is", "name"]`
   - *Đáp án đúng:* `["Where", "are", "you", "from?"]`
4. **Câu 4 (`listening_fill` - Nghe điền từ thiếu):**
   - *Âm thanh phát:* "Excuse me, what is your name?"
   - *Sentence template:* "____ me, what is your name?"
   - *Lựa chọn:* [A. Excuse, B. Thank, C. Sorry, D. Please]
   - *Đáp án đúng:* A
   - *Giải thích:* "Dùng 'Excuse me' trước khi hỏi thông tin người khác."
5. **Câu 5 (`dialogue_response` - Phản hồi lời cảm ơn lịch sự):**
   - *Tình huống:* "Khi bạn giúp đỡ ai đó và họ nói: «Thank you!», câu đáp lại lịch sự đã học là:"
   - *Lựa chọn:* [A. You are welcome!, B. Good night!, C. My name is Beego., D. I am from Vietnam.]
   - *Đáp án đúng:* A
   - *Giải thích:* "'You are welcome!' dùng để đáp lại lời cảm ơn (Không có gì / Rất sẵn lòng)."
6. **Câu 6 (`word_order` - Sắp xếp câu sức khỏe):**
   - *Prompt:* "Sắp xếp thành câu: «Tôi khỏe, cảm ơn bạn.»"
   - *Ngân hàng từ:* `["I", "am", "fine,", "thank", "you.", "Where", "from"]`
   - *Đáp án đúng:* `["I", "am", "fine,", "thank", "you."]`
7. **Câu 7 (`translation` - Dịch câu hỏi sức khỏe):**
   - *Prompt:* "Dịch sang tiếng Anh: «Bạn khỏe không?»"
   - *Ngân hàng từ:* `["How", "are", "you", "What", "is", "name"]`
   - *Đáp án đúng:* `["How", "are", "you"]`
   - *Giải thích:* "'How are you?' nghĩa là 'Bạn khỏe không?'."
8. **Câu 8 (`multiple_choice` - Lời chào theo thời điểm buổi chiều):**
   - *Tình huống:* "Gặp đồng nghiệp vào lúc 2 giờ chiều, bạn chào:"
   - *Lựa chọn:* [A. Good afternoon!, B. Good morning!, C. Good night!, D. Excuse me!]
   - *Đáp án đúng:* A
   - *Giải thích:* "'Good afternoon!' là lời chào buổi chiều (từ sau 12h trưa đến chiều tối)."

---

### 7.3. Bài Mẫu: `p1-g1-n15` (Vượt cửa — Gate Checkpoint · 10 câu · 8 phút)
- **Mục tiêu:** Bài kiểm tra tổng hợp vượt cửa chuẩn hóa, bao quát đủ 6 mục tiêu cốt lõi của Cửa 1.
- **Tiêu chuẩn vượt cửa:** Đạt tối thiểu **8/10 câu (≥ 80%)** để mở khóa bài `n16`.

1. **Câu 1 (`multiple_choice` - Lời chào theo thời điểm):**
   - *Prompt:* "Gặp đối tác vào lúc 9 giờ sáng, bạn chào thế nào?"
   - *Lựa chọn:* [A. Good morning!, B. Good evening!, C. Good night!, D. Goodbye!]
   - *Đáp án đúng:* A
2. **Câu 2 (`word_order` - Sắp xếp câu hỏi tên):**
   - *Prompt:* "Sắp xếp thành câu hỏi tên: «Bạn tên gì?»"
   - *Đáp án đúng:* `["What", "is", "your", "name?"]`
3. **Câu 3 (`dialogue_response` - Phản hồi câu hỏi sức khỏe):**
   - *Tình huống:* "John hỏi: «How are you today?». Bạn trả lời:"
   - *Lựa chọn:* [A. I am fine, thank you. And you?, B. My name is John., C. I am from Vietnam., D. Nice to meet you.]
   - *Đáp án đúng:* A
4. **Câu 4 (`listening_choice` - Nghe hiểu xuất xứ):**
   - *Âm thanh phát:* "I am from Vietnam."
   - *Prompt:* "Người nói đến từ đâu?"
   - *Lựa chọn:* [A. Việt Nam, B. Nước Anh, C. Nước Mỹ, D. Singapore]
   - *Đáp án đúng:* A
5. **Câu 5 (`word_order` - Sắp xếp câu xuất xứ):**
   - *Prompt:* "Sắp xếp thành câu: «Tôi đến từ Việt Nam.»"
   - *Đáp án đúng:* `["I", "am", "from", "Vietnam."]`
6. **Câu 6 (`multiple_choice` - Giới thiệu người thứ ba):**
   - *Prompt:* "Để giới thiệu bạn của mình tên là Mai, bạn nói:"
   - *Lựa chọn:* [A. This is my friend, Mai., B. My name is Mai., C. Where is Mai from?, D. What is your name, Mai?]
   - *Đáp án đúng:* A
7. **Câu 7 (`dialogue_response` - Chào mừng người mới):**
   - *Tình huống:* "Có bạn học sinh mới đến lớp. Bạn nói:"
   - *Lựa chọn:* [A. Welcome to our class!, B. I have to go now., C. Good night!, D. Sorry, excuse me.]
   - *Đáp án đúng:* A
8. **Câu 8 (`listening_fill` - Nghe điền từ kết thúc):**
   - *Âm thanh phát:* "I have to go now. Goodbye!"
   - *Sentence template:* "I have to ____ now. Goodbye!"
   - *Lựa chọn:* [A. go, B. see, C. meet, D. am]
   - *Đáp án đúng:* A
9. **Câu 9 (`translation` - Dịch câu rời đi lịch sự):**
   - *Prompt:* "Dịch sang tiếng Anh: «Tôi phải đi bây giờ.»"
   - *Đáp án đúng:* `["I", "have", "to", "go", "now"]`
10. **Câu 10 (`dialogue_response` - Hội thoại tổng hợp kết thúc):**
    - *Tình huống:* "Bạn vừa hoàn thành cuộc trò chuyện làm quen và phải rời đi. Bạn nói:"
    - *Lựa chọn:* [A. Thank you. See you later!, B. What is your name?, C. Where are you from?, D. Good morning!]
    - *Đáp án đúng:* A

---

## 8. CHECKLIST KIỂM THỬ, ĐIỂM CHƯA XÁC MINH & KẾ HOẠCH ROLLBACK

### 8.1. Checklist kiểm thử toàn diện (Test Verification Checklist)
> **Lưu ý:** Không ghi PASS khi chưa chạy kiểm thử thực tế. Tất cả các mục dưới đây được đặt ở trạng thái chờ thực thi:

- [ ] **Chưa chạy (Chờ kiểm tra):** Kiểm tra tính nhất quán của bộ sinh bài học `p1-g1-n01` đến `n16` qua script `node --import ./scripts/register-alias.mjs`: đảm bảo không phát sinh lỗi cú pháp hay `contentGaps`.
- [ ] **Chưa chạy (Chờ kiểm tra):** Kiểm tra kích thước bài học: xác nhận bài thường có từ 6–8 câu, bài kiểm tra/củng cố có 10 câu, thời lượng làm bài ước tính đạt 5–8 phút.
- [ ] **Chưa chạy (Chờ kiểm tra):** Kiểm tra tính chính xác của hàm `checkAnswer` cho 100% câu hỏi trong `p1-g1-plan.js`: đáp án đúng phải trả về `true`, mọi distractor phải trả về `false`.
- [ ] **Chưa chạy (Chờ kiểm tra):** Kiểm tra API `POST /api/learn/exercise-result`: nộp thử câu hỏi mới của `p1g1-r4`, xác nhận ghi nhận đúng `content_revision = 'p1g1-r4'` trong `user_learn_exercise_attempts`.
- [ ] **Chưa chạy (Chờ kiểm tra):** Kiểm tra API `POST /api/learning-path/complete`:
  - Hoàn thành bài `n15` với điểm ≥ 80% → xác nhận bài `n16` mở khóa (`status = 'active'`).
  - Làm bài `n15` với điểm < 80% → xác nhận bài `n16` vẫn ở trạng thái khóa (`status = 'locked'`).
  - Hoàn thành bài `n16` → xác nhận bài `p2-g1-n01` mở khóa.
- [ ] **Chưa chạy (Chờ kiểm tra):** Kiểm tra tương thích dữ liệu cũ: xác nhận tài khoản đã hoàn thành Cửa 1 không bị mất trạng thái `completed`, không bị trừ XP/Honey, và chế độ Replay hoạt động trơn tru.
- [ ] **Chưa chạy (Chờ kiểm tra):** Kiểm tra tính năng "Ôn lỗi sai" (`buildPersonalizedReviewSession`): nộp thử câu hỏi sai cũ, xác nhận hệ thống không bị crash `UNKNOWN_EXERCISE`.
- [ ] **Chưa chạy (Chờ kiểm tra):** Kiểm tra giao diện người dùng thực tế trên trình duyệt (`dev.beego.vn`): xác nhận giao diện mobile hiển thị dock "Học tiếp" mượt mà, màn hình hoàn thành bài hiển thị lời khen luân phiên.

---

### 8.2. Danh sách các điểm chưa xác minh / Cần rà soát khi code
1. **Âm thanh TTS cho từ vựng mới:** Cần xác nhận các từ vựng mới bổ sung (`Vietnam`, `from`, `afternoon`, `evening`) có phát âm chuẩn xác qua Web Speech API / Vbee TTS hay không.
2. **Hình ảnh trực quan cho từ mới:** Cần kiểm tra xem trong thư mục `public/` hoặc hệ thống icon đã có hình ảnh đại diện phù hợp cho các thẻ tranh từ mới (`vietnam`, `friend`, `welcome`, `evening`) chưa.
3. **Tương thích kịch bản Gia sư AI Learn Call:** Cần chạy script test mô phỏng `scripts/test-learn-call-gateway.mjs` với facet `home` để xác nhận AI Tutor nhận diện mượt mà câu trả lời *"I am from Vietnam"*.

---

### 8.3. Phương án Rollback an toàn (Safe Rollback Strategy)
Nếu có bất kỳ trục trặc nghiêm trọng nào sau khi triển khai thử nghiệm:
1. **Rollback mã nguồn bằng đúng Git Commit trước thay đổi:**
   - Git commit an toàn hiện tại là commit: [`f8e5e4f`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn) (*feat(learn): Cải tiến UX/UI tab Học, bổ sung ket-qua.md và tài liệu deploy*).
   - Thực hiện lệnh khôi phục mã nguồn:
     ```bash
     git reset --hard f8e5e4f
     ```
2. **Khôi phục Container Docker:**
   - Re-build lại image từ commit cũ:
     ```bash
     docker compose -f /var/www/beego_vn_usr/data/docker/beego/docker-compose.yml build beego-web
     docker compose -f /var/www/beego_vn_usr/data/docker/beego/docker-compose.yml up -d beego-web
     ```
3. **Bảo toàn dữ liệu học tập:**
   - **Tuyệt đối KHÔNG xóa, không truncate bất kỳ bảng cơ sở dữ liệu nào.**
   - Mọi bản ghi tiến độ trong `user_lesson_progress`, `user_stats`, `user_learn_exercise_attempts` và `user_learn_mistakes` được giữ nguyên vẹn 100%.
