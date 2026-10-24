# Audit lớp nội dung P1-G1 (dev.beego.vn)

## Runtime
- Domain: https://dev.beego.vn
- Container: beego-web (beego-app:latest)
- Revision trước: p1g1-r4 (API guest n01 = 6 câu)
- Revision sau: p1g1-r5 (n01 kỳ vọng 10 hoạt động)

## Bảng guest API trước sửa
| lesson | API q | mix | rev |
|--------|-------|-----|-----|
| n01 | 6 | integrated | p1g1-r4 |
| n02 | 6 | integrated | p1g1-r4 |
| n03–n05,n07,n09–n10,n13 | 7 | integrated | p1g1-r4 |
| n06,n08,n11,n14 | 8 | integrated | p1g1-r4 |
| n12 | 6 | integrated | p1g1-r4 |
| n15 | 10 | standard | p1g1-r4 |
| n16 | 10 | (review) | p1g1-r4 |

## Nơi số câu bị “cảm giác 3 câu”
1. Builder `integrated-p1-builder` cố ý chỉ 6–8 câu/bài (không còn 12).
2. Không phải cache guest; mix integrated truyền đủ bank.
3. ENRICHED 4 câu không merge (< min 10).
4. Resume: đã làm một phần → còn ~3/6 trên UI; thanh tiến độ chỉ %.

## Sửa n01 (chỉ nâng cấp thêm)
- Giữ nguyên id/đáp án a01–a06
- Thêm a07 hội thoại nghe, a08 nghĩa, a09 mẫu câu, a10 kết bài
- UI: nhãn Hoạt động X/Y + nút Thử lại khi sai
- Không xóa attempts/progress

## Sau deploy (đã đo live)

| Metric | Giá trị |
|--------|---------|
| Container `P1_CONTENT_REVISION` | `p1g1-r5` |
| Guest API `p1-g1-n01` số hoạt động | **10** |
| contentSource | `catalog_generated_v3` |
| contentRevision trên câu | `p1g1-r5` |
| Id gốc a01–a06 | **giữ nguyên** |
| Id mới | a07, a08, a09, a10 |

Thứ tự phát:
1. a07 hội thoại nghe → 2. a08 nghĩa → 3. a09 mẫu câu → 4–9. a01…a06 → 10. a10 kết bài

## Kiểm thử trình duyệt
- `GET /learn/lesson/p1-g1-n01?replay=1` → HTTP **307** (redirect, thường về đăng nhập).
- MCP browser tools không enumerate được trong phiên này; headless screenshot thất bại.
- **Chưa khẳng định UX mobile end-to-end bằng tài khoản test.** Bằng chứng tin cậy hiện tại là **API live 10 hoạt động** + file JSON before/after trong thư mục backup.

## Link học thử mẫu
https://dev.beego.vn/learn/lesson/p1-g1-n01?replay=1
