# Icon 3D cửa 1 Beego

Chỉ đổi phần trình bày của 17 nút bài học trong cửa `c50-g01` và nút Gọi gia sư AI hiện có. Không sửa catalog, ID/thứ tự bài, khóa/mở, tiến độ, XP, Honey, auth hay dữ liệu tài khoản. Không commit/push hoặc deploy production.

## File thay đổi

- `components/beego/learn/LessonNode.jsx`: chỉ thêm nhận diện artwork cửa 1, huy hiệu và tên bài khóa.
- `components/beego/learn/LearningNodeIcon.jsx`: ảnh trang trí/lazy-load/fallback SVG và huy hiệu riêng.
- `components/beego/learn/GateCallButton.jsx`: ảnh gấu cho đúng section cửa 1, giữ target/click/disabled/auth cũ.
- `app/beego-learn.css`: CSS artwork/trạng thái/kích thước/giảm chuyển động, giới hạn ở cửa 1.
- `lib/beego/learn/gate-01-icons.js`: mapping lessonId cố định và mapping riêng nút tính năng.
- `public/uploads/lesson-icons/gate-01/`: manifest, 19 PNG gốc, 19 WebP tối ưu.
- `scripts/optimize-gate-01-icons.py`: tái tạo asset từ gói gốc.
- `scripts/test-gate-01-icons.mjs`: kiểm tra mapping, catalog, asset, 49 cửa khác và không mutate path.
- `scripts/test-gate-01-icons-browser.mjs`: kiểm tra UI có mock API, không sửa dữ liệu.
- `docs/beego-gate-01-icons.md` và `docs/screenshots/gate-01-icons-*.png`: báo cáo, mapping và ảnh kiểm tra.

Trước khi sửa, git chỉ có gói `docs/beego-icon-cua-1/` chưa được track. Gói đó giữ nguyên; các file cấu hình tự sinh khi chạy Next đã được khôi phục và cache preview tạm đã được dọn.

## Mapping

Mapping chạy theo lessonId trong `lib/beego/learn/gate-01-icons.js`, đã đối chiếu cả manifest và catalog thực tế. Bản hiển thị dùng cùng tên với đuôi `.webp`; PNG gốc vẫn được giữ.

| lessonId | Tên bài | PNG gốc |
| --- | --- | --- |
| `g01l01` | Chào lần đầu | `01-chao-lan-dau.png` |
| `g01l02` | Nói tên | `02-noi-ten.png` |
| `g01l03` | Hỏi tên | `03-hoi-ten.png` |
| `g01l04` | Ôn lời chào | `04-on-loi-chao.png` |
| `g01l05` | Gặp giáo viên | `05-gap-giao-vien.png` |
| `g01l06` | Gặp bạn mới | `06-gap-ban-moi.png` |
| `g01l07` | Chào buổi sáng | `07-chao-buoi-sang.png` |
| `g01l08` | Ôn vai giao tiếp | `08-on-vai-giao-tiep.png` |
| `g01l09` | Giới thiệu bạn | `09-gioi-thieu-ban.png` |
| `g01l10` | Nhờ nhắc lại | `10-nho-nhac-lai.png` |
| `g01l11` | Đánh vần tên | `11-danh-van-ten.png` |
| `g01l12` | Ôn hội thoại | `12-on-hoi-thoai.png` |
| `g01l13` | Cảm ơn | `13-cam-on.png` |
| `g01l14` | Xin lỗi | `14-xin-loi.png` |
| `g01l15` | Tạm biệt | `15-tam-biet.png` |
| `g01l16` | Tự giới thiệu | `16-tu-gioi-thieu.png` |
| `g01exam` | Thi vượt cửa | `17-thi-vuot-cua.png` |

Nút tính năng của section `c50-g01` dùng `19-gau-goi-gia-su-ai.webp` (gốc `19-gau-goi-gia-su-ai.png`). Giữ nguyên target từ `pickGateCallTarget` và các điều kiện truy cập. Không tạo lessonId tính năng. `18-gia-su-ai.png/.webp` được lưu cùng gói nhưng không được hiển thị.

Không dùng `section.gateNumber === 1`: catalog thực tế có giá trị đó ở nhiều cửa. 49 cửa còn lại tiếp tục dùng SVG và trạng thái cũ.

## Hiển thị và ảnh

- Icon bài học 62px; bài hiện tại/bài thi 66px; gấu gọi AI 68px, `object-fit: contain`, kích thước cố định; nút 80px trên mobile 360px và 390px.
- Hoàn thành/skipped giữ ảnh nội dung, thêm ✓ góc ngoài. Bài khóa giữ ảnh màu dịu và thêm ổ khóa; luôn có tên bài. Bài hiện tại có viền sáng và nhún 2px; tắt khi `prefers-reduced-motion: reduce`.
- `alt=""`, `aria-hidden="true"`, lazy-load và decode async. Giữ button, click, focus, aria-label, tooltip và sheet cũ.
- Nếu WebP lỗi, gỡ img và dùng SVG cũ, không đổi src/retry gây vòng lặp. Có kiểm tra sau hydration cho ảnh lỗi trước khi React gắn onError.
- Giữ nguyên 19 PNG 1254×1254 RGBA và manifest trong `public/uploads/lesson-icons/gate-01/`. Tạo 19 WebP 320×320 lossless, giữ alpha và từng pixel của bản PNG đã resize bằng LANCZOS. Đủ độ phân giải cho icon 62–68px trên DPR 3–4. PNG gốc giữ nguyên. Tổng PNG 22.118.647 bytes → WebP 1.164.918 bytes (giảm 94,73%).
- Đã xác minh toàn bộ 19 WebP decode RGBA khớp từng pixel với PNG đã resize 320px: không có mất mát thêm do nén. Giữ rõ lông/viền, không crop. Bỏ opacity 0,78 và saturate 0,45 gây nhạt ở bài khóa; trạng thái khóa vẫn thể hiện qua nền dịu và huy hiệu ổ khóa.

Tạo lại ảnh: `python3 scripts/optimize-gate-01-icons.py` (Pillow).

## Kiểm thử

```sh
node --import ./scripts/register-alias.mjs scripts/test-gate-01-icons.mjs
node --import ./scripts/register-alias.mjs scripts/test-ai-call-access.mjs
```

Kiểm thử browser dùng Chromium/Playwright bên ngoài, không thêm thư viện runtime. Các trạng thái lấy từ builder/catalog thật và mock API trong browser; không ghi tiến độ hoặc mở cuộc gọi thật:

```sh
BEEGO_TEST_BASE_URL=http://127.0.0.1:3099 \
node --import ./scripts/register-alias.mjs scripts/test-gate-01-icons-browser.mjs
```

Nếu Playwright/Chromium chưa nằm trong đường dẫn mặc định, đặt `BEEGO_PLAYWRIGHT_MODULE` tới module Playwright và `BEEGO_CHROMIUM_PATH` tới executable.

Các kiểm tra: đủ 16 bài + bài thi và ảnh gấu; mapping/tên/thứ tự; ảnh decode; kích thước/viewport 360px, 390px và desktop 1024px; huy hiệu không che ảnh; trạng thái khóa/đang học/hoàn thành; bài thi đang học/hoàn thành; focus/Enter/tooltip; giảm chuyển động; WebP bài học và gấu lỗi fallback một lần; nút AI dùng đúng lesson/section cũ và còn kiểm tra auth; cửa khác giữ SVG. Kiểm tra ảnh xác nhận cả 19 WebP còn alpha trong suốt/đục và PNG giống byte với bản gốc.

Kết quả: **PASS** cho cả preview và URL dev, ở 360px, 390px và desktop 1024px, không có lỗi JavaScript. Hai trường hợp ảnh lỗi (bài học/AI) chỉ gửi một request lỗi rồi chuyển SVG. Đã xác nhận click AI gửi `lessonId=g01l05&sectionId=c50-g01` trong fixture tương ứng và vẫn đi qua kiểm tra auth.

Đối chiếu trước/sau trên URL dev: 17 nút cửa 2 giữ nguyên từng markup, kích thước, màu, tên truy cập và khóa. Lookup artwork của toàn bộ 49 cửa còn lại đều trả null. Cả 19 URL WebP public trả HTTP 200 và giống byte với asset nguồn; `/api/health` trả `ok=true`.

Ảnh kiểm tra: [mobile 360px](screenshots/gate-01-icons-360.png), [mobile 390px](screenshots/gate-01-icons-390.png), [so sánh PNG/WebP ở DPR 3](screenshots/gate-01-icons-quality-3x.png).

## Xem bản dev

URL: https://dev.beego.vn/ (tab Học, cửa 1). Chỉ cập nhật service web của môi trường dev sau khi build/kiểm thử đạt; không thay service voice, database hoặc production.

Build thông thường của repository gặp lỗi `next/font` với phản hồi Google Fonts. Bản build dev dùng lại các font WOFF2 thật trong bản đang chạy qua dữ liệu font cục bộ tạm thời, không đổi `app/layout.js`, cấu hình font hoặc Dockerfile của repository. File phục vụ font cuối cùng phải là asset `/_next/static/media/*.woff2`, không phải đường dẫn tạm.

## Tinh chỉnh nút Gọi gia sư AI

Nút cửa 1 đang mở có nền xanh lá tươi theo màu Beego, highlight ở trên, viền xanh và đế đổ bóng rõ hơn. Gấu hiển thị 68px trong nút 80px, nhô lên 4px kèm bóng riêng; ảnh nguồn WebP 320px lossless giữ nét lông/viền ở DPR 3–4. Chữ tên nút đậm hơn, màu xanh đậm dễ đọc. Nút khóa vẫn giữ giao diện dịu và ổ khóa; các nút bài học và cửa khác không đổi. Hover/tap và prefers-reduced-motion tiếp tục dùng cơ chế có sẵn.

Đã xác minh bản dev ở 360px/390px: nền xanh, nút 80px, ảnh 68px/nguồn 320px, bóng nổi; bài học khác và trạng thái khóa giữ nguyên. [Ảnh nút mới](screenshots/ai-call-green-390.png).

## Tăng độ rõ toàn bộ cửa 1

Ảnh bài học tăng từ 48–52px lên 62–66px, gấu AI lên 68px, các nút đều 80px. Mỗi ảnh nhô nhẹ lên và có bóng riêng; đế nút thêm highlight và bóng 3D. Huy hiệu đưa ra góc ngoài thêm 4px, khoảng cách tên bài 14px để không che hình/tên. Bài khóa hiển thị ảnh đủ màu và độ đậm, vẫn giữ nền dịu, ổ khóa và điều kiện khóa cũ. Không sửa mapping, thứ tự, tiến độ, XP, Honey hoặc auth.

Kiểm tra bản ảnh 320px trên dev: PASS tại 360px, 390px và desktop 1024px, đủ 17 ảnh bài học/bài thi và ảnh gấu 68px; ảnh khóa opacity 1, huy hiệu không che ảnh. Fallback bài học/AI chỉ lỗi một request rồi dùng SVG. Cả 19 URL WebP khớp byte với nguồn mới; health healthy.
