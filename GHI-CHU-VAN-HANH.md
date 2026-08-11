# Ghi chú vận hành (cập nhật gần nhất: 2026-08-07)

Tài liệu này ghi lại các lỗi đã phát hiện/sửa và các việc còn tồn đọng liên quan
đến pipeline dữ liệu (Supabase + n8n) của saleskpi-web, để phiên làm việc sau
không phải điều tra lại từ đầu.

## 1. Đã sửa: Trang /products không lọc theo team ASM

`src/app/(app)/products/page.tsx` trước đây tính mọi chỉ số (tổng sản lượng,
khách hàng...) trên TOÀN BỘ nhân viên xuất hiện trong bảng sale, kể cả nhân
viên thuộc ASM/nhóm khác dùng chung bảng dữ liệu. Đã sửa: mặc định trang chỉ
tính trên nhân viên có trong bảng "Danh sach nhan vien" (chính là team của ASM
Ngô Hồng Quân - 4 SS: Nguyễn Thị Hằng, Nguyễn Thị Mơ, Nguyễn Văn Mạnh, Phan
Bình Phước + các NVKD của họ). Filter `?ss=`/`?nv=` vẫn hoạt động để lọc sâu
hơn trong team.

## 2. Đã sửa: Đếm gấp đôi khi 1 tháng tồn tại ở cả 2 bảng sale

**Triệu chứng gốc:** Atosiban-BFS tháng 7/2026 hiện 626 lọ trên trang trong
khi thực tế chỉ 313 lọ.

**Nguyên nhân:** `"Du lieu sale tong"` (bảng lịch sử, đã chốt sổ) và
`"Du lieu sale thang hien tai"` (bảng tháng đang chạy) đôi khi CÙNG chứa dữ
liệu của 1 tháng (do lỗi đồng bộ n8n không dọn được tháng cũ khỏi bảng "hien
tai" khi sang tháng mới - xem mục 3). Các trang gộp 2 bảng bằng cách nối thẳng
mảng (`[...tongRes.data, ...hienTaiRes.data]`) nên bị cộng trùng khi có
overlap.

**Đã sửa:** thêm 2 helper dùng chung trong `src/lib/sales-channel.ts`:
- `preferClosedMonthRows(tongRows, hienTaiRows)` - dùng khi query đã lọc sẵn
  đúng 1 tháng cụ thể (`.eq("nam", x).eq("thang", y)`): nếu "sale tong" đã có
  dữ liệu tháng đó thì bỏ hẳn "sale thang hien tai", tránh cộng trùng.
- `mergeSaleRowsByMonth(tongRows, hienTaiRows)` - dùng khi query trải dài
  nhiều tháng (không lọc theo 1 tháng cụ thể): gộp theo từng tháng (rút từ cột
  `ngay`), tháng nào đã có trong "sale tong" thì bỏ dòng tương ứng bên "sale
  thang hien tai".

Đã áp dụng vào 5 chỗ: `products/page.tsx`, `sales/page.tsx`, `kpi/page.tsx`,
`customers/page.tsx` (doanh thu tháng này), `ai-review/actions.ts`
(`getDonHangTrongTuan` - đối chiếu doanh thu khi ASM xác nhận kết quả công
việc tuần).

**Lưu ý:** đây là lớp phòng vệ ở tầng ứng dụng - vẫn nên theo dõi mục 3/4 để
xử lý tận gốc ở tầng đồng bộ dữ liệu.

## 3. Đang theo dõi: Nguồn Google Sheet "sale tháng hiện tại" bị revert về tháng cũ

Ngày 6-7/8/2026 phát hiện bảng `"Du lieu sale thang hien tai"` bị ghi đè qua
lại giữa dữ liệu tháng 8 (đúng) và tháng 7 (cũ) - nguyên nhân là Google Sheet
nguồn ("Đọc sale tháng hiện tại" trong workflow n8n `lsqapixY9MCHPe8R`) chưa
được cập nhật sang tháng 8. Đây là vấn đề dữ liệu nguồn (không phải code/DB) -
user đang tự xử lý phía Google Sheet. Bản vá ở mục 2 đảm bảo dù việc này còn
xảy ra thì báo cáo vẫn không bị đếm sai cho các tháng đã đóng sổ.

## 4. Đang theo dõi: n8n worker không ổn định (hạ tầng, ngoài tầm code)

Workflow đồng bộ sale (`lsqapixY9MCHPe8R`, "Pharma Mới - 03 Đồng Bộ Dữ Liệu
Sale") nhiều lần báo `status: error` với thông điệp *"This execution failed
to be processed too many times... scale up your workers or adjust your worker
settings"* - đây là lỗi hạ tầng n8n (worker quá tải/crash), KHÔNG phải lỗi
logic workflow. Đã quan sát thấy execution báo "error" nhưng dữ liệu vẫn ghi
đúng vào Supabase (false negative ở tầng theo dõi execution của n8n) - nên khi
kiểm tra lỗi n8n, luôn đối chiếu trực tiếp dữ liệu trong Supabase thay vì chỉ
tin vào status hiển thị. Nếu lỗi này lặp lại nhiều, cần báo quản trị hạ tầng
n8n (scale worker), không sửa được từ phía workflow.

## 5. Đã sửa: Workflow "01 Đồng Bộ Danh Sách Nhân Sự" báo TOÀN BỘ nhân sự là "mới" mỗi ngày

**Phát hiện khi:** workflow con "02 Xử Lý Biến Động Nhân Sự"
(`LIovojzsfOzQ2d2s`) báo lỗi Telegram "chat_id is empty" hàng loạt sáng
7/8/2026 khi cố báo "nhân viên mới" cho SS.

**Nguyên nhân thật sự (đã xác nhận qua lịch sử `nhat_ky_thuc_thi_workflow` và
`lich_su_phan_cong_nhan_vien`):** workflow `yayU9tZcguS5ZGnL` ("Pharma Mới -
01 Đồng Bộ Danh Sách Nhân Sự") bị lỗi TỪ NGÀY TẠO (12/7/2026) đến 6/8/2026 -
mỗi lần chạy (mỗi sáng), node Code "Chuẩn hóa và phát hiện biến động" dùng
biến `items` (ngầm định) để đọc danh sách nhân sự hiện có từ node trước đó
("Lấy danh sách nhân sự hiện có"). Trong execution chạy theo lịch
(trigger/production), biến `items` không nhận đúng dữ liệu 34 dòng như mong
đợi (dù node nguồn vẫn trả đúng 34 dòng), khiến `existingMap` gần như rỗng và
TOÀN BỘ nhân sự (kể cả người đã làm nhiều tuần) bị coi là `NEW_EMPLOYEE` mỗi
ngày. Hậu quả: mỗi ngày tạo 34 bản ghi thừa trong `lich_su_phan_cong_nhan_vien`
+ cố gửi Telegram báo "nhân viên mới" cho SS (thất bại vì SS chưa có
`telegram_chat_id`, mục 6).

**Đã sửa:** đổi `const existingRows = items.map(...)` thành
`const existingRows = $('Lấy danh sách nhân sự hiện có').all().map(...)` -
tham chiếu tường minh tên node thay vì biến `items` ngầm định. Đã publish và
verify: chạy production thực tế → `so_dong_bien_dong: 0` (đúng, vì không có
thay đổi nhân sự thật). Trước đó `so_dong_bien_dong: 33/34`.

**Lưu ý kỹ thuật quan trọng cho lần sau:** `update_workflow` của MCP n8n có
thể báo lỗi "additional permissions" cả với thao tác KHÔNG liên quan
credential (vd sửa code 1 node Code) - không phải lúc nào cũng do thiếu quyền
credential như lần sửa workflow 03 trước đó. Khi gặp, thử: (1) yêu cầu user
reconnect n8n connector, (2) nếu vẫn lỗi, có thể do thao tác cụ thể đó bị chặn
dù các thao tác nhỏ khác (vd setNodePosition) vẫn qua được - nên đưa code cho
user dán tay vào n8n UI. **Quan trọng: sau khi user "Save" trong n8n UI, bản
Save đó chỉ là DRAFT - phải bấm "Publish/Activate" (hoặc gọi lại
`publish_workflow`) thì mới thực sự chạy theo lịch.** Đã từng nhầm là đã xong
vì draft có code mới, nhưng `activeVersionId` vẫn trỏ về bản cũ - luôn kiểm
tra `versionId` (draft) khớp `activeVersionId` (đang chạy live) sau khi sửa.

## 6. Còn tồn đọng - CHƯA XỬ LÝ

- **Telegram chat_id trống cho cả 4 SS** (Nguyễn Thị Hằng, Nguyễn Thị Mơ,
  Nguyễn Văn Mạnh, Phan Bình Phước) trong bảng "Danh sach nhan vien" - khiến
  workflow "02 Xử Lý Biến Động Nhân Sự" không gửi được thông báo khi có biến
  động nhân sự thật (NEW_EMPLOYEE/EMPLOYEE_LEFT/TRANSFERRED_SS). Cần: mỗi SS
  nhắn 1 tin cho bot Telegram để lấy chat_id, rồi điền vào cột
  `telegram_chat_id`.
- **~25 bản ghi thừa/nhân viên trong `lich_su_phan_cong_nhan_vien`** (do lỗi ở
  mục 5 gây ra suốt từ 12/7 đến 6/8) - chưa dọn. Không ảnh hưởng báo cáo/KPI
  hiện tại (bảng này không được các trang report dùng trực tiếp), nhưng nên
  dọn để dữ liệu lịch sử phân công sạch. User chưa quyết định có dọn hay để
  nguyên.
- **Google Sheet nguồn "sale tháng hiện tại"** cần được cập nhật sang tháng 8
  - user đang tự xử lý (xem mục 3).
