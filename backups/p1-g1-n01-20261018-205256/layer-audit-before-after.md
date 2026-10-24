# Audit lớp nội dung P1-G1 (dev.beego.vn)

## Runtime
- Domain: https://dev.beego.vn
- Container: beego-web (image beego-app:latest)
- P1_CONTENT_REVISION trước sửa: p1g1-r4
- P1_CONTENT_REVISION sau sửa: p1g1-r5

## Bảng guest API trước sửa (đã đo)

| lesson | nguồn → mix → API q | Ghi chú |
|--------|---------------------|---------|
| n01 | builder 6 → mix integrated 6 → API 6 | Không còn 12; rút gọn r4 |
| n02 | 6 | |
| n03–n05,n07,n09–n10,n13 | 7 | |
| n06,n08,n11,n14 | 8 | |
| n12 | 6 | |
| n15 | 10 (checkpoint, không integrated mix) | |
| n16 | 10 review | |

## Nơi số câu “giảm”
1. **Thiết kế builder** `integrated-p1-builder.js` cố ý chỉ sinh 6–8 câu/bài (không còn 12 hoạt động).
2. **Không phải cache**: guest API không dùng mix session DB; fingerprint integrated truyền đủ bank.
3. **ENRICHED 4 câu** (`lesson-content-enriched.js`) **không được merge** vì < NORMAL_LESSON_MIN_EXERCISES (10).
4. **Resume**: user đã trả lời một phần → UI nhảy `startIndex`; còn lại ~3 câu trong tổng 6 → cảm giác “bài chỉ có 3 câu”. Thanh tiến độ chỉ %.
5. **Không xóa** attempts/progress khi nâng r5; revision mới bắt đầu bộ hoạt động mới, lịch sử cũ giữ nguyên.

## Sau nâng cấp n01
- Giữ nguyên id/đáp án a01–a06
- Thêm a07 (hội thoại nghe), a08 (nghĩa), a09 (mẫu câu), a10 (kết bài)
- Tổng kỳ vọng API guest: **10** hoạt động, rev **p1g1-r5**

wrote audit md
