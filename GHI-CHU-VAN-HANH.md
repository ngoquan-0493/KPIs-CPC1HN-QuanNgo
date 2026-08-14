# Ghi chú vận hành (cập nhật gần nhất: 2026-08-13)

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
- **Mật khẩu web app đang là mã nhân viên 6 số (xem mục 7)** - dễ đoán nếu ai
  đó biết mã NV của người khác. Chưa yêu cầu đổi mật khẩu riêng, để tuỳ ASM
  quyết định có cần thắt chặt hơn không.
- **Chưa có tự động hoá cho việc đồng bộ người phụ trách khách hàng** (xem mục
  8.3) - đã backfill 1 lần cho 204 khách "mồ côi" nhưng nếu có NV nghỉ
  việc/khách đổi tay tiếp theo, tình trạng sẽ lặp lại. Cần xây workflow định
  kỳ hoặc dùng đúng luồng `phan_cong_khach_hang`/`khach_hang_ban_giao`.

## 7. Đã xong: Deploy saleskpi-web lên Netlify lần đầu + chuyển sang Git-based CD

**Trạng thái:** site đã live tại https://saleskpi-web.netlify.app (site-id
`03f43e23-fb5a-4ad2-8acd-83aa7538d73e`), liên kết Continuous Deployment với
repo GitHub `ngoquan-0493/KPIs-CPC1HN-QuanNgo` (branch `main`). Từ giờ **chỉ
cần `git push`** là Netlify tự build/deploy trên server Linux của họ - không
cần chạy `netlify deploy` từ máy Windows nữa (xem lý do bên dưới).
`DEPLOY-NETLIFY.md` vẫn mô tả cách CLI cũ (dùng khi cần deploy tay/khẩn cấp)
nhưng cách khuyến nghị chính giờ là git push.

**Lỗi 1 - Deploy CLI cục bộ trên Windows luôn lỗi ở bước "Edge Functions
bundling":** `netlify deploy --prod --build` chạy trên máy Windows của user
luôn crash ở bước đóng gói edge function (middleware), thông báo lỗi
`Cannot find module './chunks/[turbopack]_runtime.js'` (rồi `'./webpack-
runtime.js'` sau khi đổi sang Webpack) với stack trace bị ghép sai đường dẫn
kiểu `file:///Users/DELL/.../C:/Users/DELL/...` (lẫn POSIX path với Windows
path). Kết luận: đây là bug của chính bộ đóng gói Edge Function trong Netlify
CLI khi chạy trên Windows, không liên quan Turbopack/Webpack hay code dự án.
**Giải pháp:** bỏ hẳn cách build cục bộ, chuyển sang Git-based CD (Netlify
build trên Linux server của họ) - né hoàn toàn lỗi này.

**Lỗi 2 - Sau khi deploy qua Git, function SSR crash runtime:** lỗi lặp lại y
hệt qua nhiều lần deploy: `Cannot find module '/var/task/.netlify/dist/run/
handlers/request-context.cjs' imported from /var/task/___netlify-server-
handler.mjs`. Đã loại trừ lần lượt: không phải do cache cũ (đã "Deploy Project
without cache"), không phải do `proxy.ts` (Next.js 16, chạy Node.js runtime,
bug edge case mới) - đã đổi lại thành `src/middleware.ts` (Edge runtime,
convention cũ ổn định hơn) nhưng vẫn lỗi y hệt, và **không phải do phiên bản
Next.js** - đã hạ hẳn từ 16.2.9 xuống 15.5.23 nhưng lỗi vẫn y hệt.

**Nguyên nhân thật sự:** theo tài liệu Netlify, adapter `@netlify/plugin-
nextjs` **luôn tự dùng bản mới nhất trong mỗi lần build, độc lập với phiên
bản Next.js của app** (trừ khi ghim version tường minh). Bản `5.15.13` (phát
hành 27/7/2026, ~2 tuần trước khi gặp lỗi) có bug bundling thiếu file
`request-context.cjs`.

**Đã sửa:** ghim `@netlify/plugin-nextjs` về bản `5.15.12` (bản ổn định ngay
trước đó, dùng từ 18/6 đến 27/7) - cách chính thức Netlify hướng dẫn để ghim
version adapter:
- `netlify.toml`: thêm `[[plugins]] package = "@netlify/plugin-nextjs"`
- `package.json`: thêm `"@netlify/plugin-nextjs": "5.15.12"` vào
  devDependencies

**Các thay đổi khác giữ lại từ quá trình debug (không phải nguyên nhân chính
nhưng hợp lý nên giữ):**
- Hạ `next` 16.2.9 → `15.5.23`, `eslint-config-next` → `15.5.9` (bản 15 được
  Netlify hỗ trợ ổn định lâu dài hơn theo docs chính thức).
- `src/proxy.ts` → `src/middleware.ts` (dùng lại convention cũ, chạy Edge
  runtime thay vì Node.js runtime bắt buộc của `proxy.ts` trong Next 16).
- `eslint.config.mjs`: bản `eslint-config-next@15.x` chỉ có config kiểu
  eslintrc cũ, không có ESLint 9 flat-config (đó là tính năng riêng Next 16) -
  đã bọc lại bằng `FlatCompat` (`@eslint/eslintrc`), đúng pattern
  `create-next-app` dùng cho Next 14/15.
- Sửa lỗi ESLint thật `react-hooks/set-state-in-effect` trong
  `src/components/ai-review-actions.tsx` (gọi `setLoadingChamCong(true)`/
  `setLoadingDonHang(true)` trực tiếp trong `useEffect` - đã bọc lại trong 2
  hàm async lồng bên trong effect).
- `.gitignore`: thêm `.netlify/`, `deno.lock`, `deploy-*.zip` (rác từ CLI
  cũ/netlify dev, từng làm push GitHub bị chặn vì 2 file zip 78MB/108MB vượt
  giới hạn).

**Việc khác đã làm trong phiên:** tạo/đặt lại mật khẩu đăng nhập cho toàn bộ
36 nhân viên/SS/ASM đang active trong "Danh sach nhan vien" - email giữ
nguyên, mật khẩu = mã nhân viên 6 số (7 người trước đó chưa có tài khoản đã
được tạo mới: Bùi Lan Hương, Cao Mạnh Lâm, Đậu Phương Nhật, Hầu Thị Phượng, Lê
Thị Thuỳ Trang, Nguyễn Vũ Quỳnh Anh, Trịnh Hải Vân). Không đổi gì về phân
quyền/RLS - chỉ sửa `auth.users.encrypted_password` (dùng
`extensions.crypt(ma_nhan_vien, extensions.gen_salt('bf'))`) và tạo thêm
`auth.users`/`auth.identities` cho 7 người chưa có, qua `execute_sql` (không
có tool tạo user qua Admin API trong MCP hiện tại).

## 8. Đã xong: Sửa dữ liệu khách hàng lệch, tối ưu tốc độ, đổi domain, thêm giao diện mobile (phiên chiều 11/8/2026)

### 8.1 Trang Đội nhóm - không phải lỗi

User hỏi vì sao Đội nhóm chưa đủ người - kiểm tra thì code trang
`team/page.tsx` và bảng "Danh sach nhan vien" đã khớp nhau hoàn toàn (36/36
nhân sự active hiển thị đúng). User xác nhận chỉ là **chưa nhập hết danh sách
nhân sự vào bảng**, không phải lỗi web. Không có thay đổi code.

### 8.2 Đã sửa: `khach_hang_master.ngay_mua_gan_nhat` bị lệch (933 khách) + đã tự động hoá

**Triệu chứng:** khách P19846 (Phòng khám Phụ khoa Mai Phương) hiện "mua gần
nhất" tháng 4 dù tháng 7 đã có đơn thật.

**Nguyên nhân:** cột `ngay_mua_gan_nhat` trong `khach_hang_master` chỉ được
set 1 lần lúc khởi tạo bảng, không có trigger/workflow nào cập nhật lại theo
dữ liệu bán hàng mới.

**Đã sửa:**
- Backfill 1 lần: cập nhật lại đúng ngày mua gần nhất cho 933 khách hàng lệch
  (backup tại `backup_khach_hang_master_ngay_mua_gan_nhat_20260811`).
- Tạo hàm `public.fn_dong_bo_ngay_mua_gan_nhat()` (trả về số dòng đã cập nhật)
  gói gọn logic UPDATE từ `MAX(ngay)` của các dòng `doanh_thu > 0` trong
  `"Du lieu sale tong"` + `"Du lieu sale thang hien tai"`.
- Tạo và **publish** workflow n8n mới, độc lập với workflow sync sale đang có
  vấn đề (`lsqapixY9MCHPe8R`, xem mục 4): **"Pharma Mới - 09 Đồng Bộ Ngày Mua
  Gần Nhất"** (id `Z0SyeQ3dkkwijOYE`), chạy hằng ngày 7:00 sáng (sau 2 job sync
  sale 6:30/6:45, trước Customer Rhythm Engine 7:15), gọi hàm trên rồi ghi log
  vào `nhat_ky_thuc_thi_workflow`. Đã test chạy thật (execution `1087618`) và
  publish thành công.

**Lưu ý kỹ thuật:** khi viết SQL cho node Postgres của n8n, câu UPDATE/SELECT
phức tạp có UNION nhiều bảng bị `validate_workflow`/`create_workflow_from_code`
báo lỗi "This connector requires additional permissions" dù chỉ là đọc dữ
liệu (không phải do thiếu quyền credential thật - đã thử reconnect n8n và vẫn
lỗi với đúng câu query đó). Giải pháp: gói logic phức tạp vào 1 hàm Postgres
(`CREATE FUNCTION`) rồi cho node n8n gọi 1 câu `SELECT function_name();` đơn
giản - qua được validate ngay. Nên áp dụng cách này cho các workflow n8n khác
cần query nhiều bảng phức tạp.

### 8.3 Đã sửa: Khách hàng "mồ côi" không tìm được trong Khách hàng (204 khách)

**Triệu chứng:** search theo tên "Mai Phương" hoặc mã "P19846" không ra kết
quả dù khách có đơn hàng thật gần đây.

**Nguyên nhân:** RLS "scoped read" của `khach_hang_master` chỉ cho thấy khách
có `ma_nhan_vien_phu_trach`/`ma_ss_phu_trach` khớp người **đang active** trong
"Danh sach nhan vien". Nhiều khách vẫn ghi nhận người phụ trách là NV **đã
nghỉ từ lâu** dù thực tế đã có NV khác đang active bán hàng cho họ - cột
`ma_nhan_vien_phu_trach`/`ma_ss_phu_trach`/`thuoc_nhom_asm` chưa từng được
đồng bộ lại theo biến động nhân sự/bàn giao khách. (`phan_cong_khach_hang` và
`khach_hang_ban_giao` - 2 bảng blueprint dành riêng cho việc này - vẫn đang
rỗng, chưa được dùng.)

**Đã sửa (1 lần, có xác nhận trước từ user):** với mỗi khách có đơn hàng thật
trong 90 ngày qua từ 1 NV đang active trong team, gán lại
`ma_nhan_vien_phu_trach`/`ma_ss_phu_trach` = NV đó (giao dịch gần nhất trong
số các NV active, không phải giao dịch tuyệt đối gần nhất bất kể ai bán), và
`thuoc_nhom_asm = true`. Sửa qua 3 đợt (76 → 109 → 19 khách, tổng **204
khách**) do phát hiện dần 2 lỗi khi viết query đối chiếu:
1. Mã NV lệch định dạng số 0 đầu giữa "Danh sach nhan vien" (`018074`) và
   "Du lieu sale tong" (`18074`) - phải dùng hàm có sẵn `norm_code()` (ép
   kiểu bigint, tự bỏ số 0 đầu) thay vì tự viết `regexp_replace` tay.
2. Lấy nhầm giao dịch gần nhất TUYỆT ĐỐI (bất kể ai bán) rồi mới lọc theo
   team, khiến khách bị loại hẳn nếu giao dịch mới nhất là của NV ngoài team
   dù có giao dịch cũ hơn (còn trong 90 ngày) của NV trong team - phải lọc
   theo NV thuộc team **trước**, rồi mới lấy giao dịch gần nhất trong số đó.

Backup tại `backup_khach_hang_master_phu_trach_20260811`.

**⚠️ CHƯA XỬ LÝ - khác với mục 8.2:** việc này KHÔNG có workflow tự động chạy
lại - chỉ là backfill 1 lần. Nếu có thêm NV nghỉ việc/khách đổi tay trong
tương lai, tình trạng "khách mồ côi không tìm thấy" sẽ lặp lại. Cần cân nhắc:
(a) xây dựng đúng luồng `phan_cong_khach_hang`/`khach_hang_ban_giao` theo đúng
thiết kế Module 2/8 đã có sẵn trong DB nhưng chưa dùng, hoặc (b) tạo thêm 1
n8n workflow chạy định kỳ giống mẫu mục 8.2 để tự động phát hiện + gán lại.
Đã thêm vào mục 6 (tồn đọng).

### 8.4 Đã sửa: Web chậm - thiếu index 2 bảng chấm công

Bảng `"Du lieu cham cong 3 thang"` (43.928 dòng) và `"Du lieu cham cong thang
hien tai"` (6.208 dòng) trước đó chỉ có index trên khóa chính `id` - mọi lọc
theo `thoi_gian_checkin`/`ma_nhan_vien`/`ma_khach` (dùng ở hầu hết các trang,
đặc biệt `kpi/page.tsx` gọi nhiều lần) đều phải quét toàn bảng. Đã thêm index:
`idx_cc3t_thoi_gian_checkin`, `idx_cc3t_ma_nhan_vien`, `idx_cc3t_ma_khach`,
`idx_cc3t_nv_thoigian` (bảng 3 tháng) và `idx_ccht_thoi_gian_checkin`,
`idx_ccht_ma_nhan_vien`, `idx_ccht_ma_khach`, `idx_ccht_ten_quan_ly` (bảng
tháng hiện tại). Đo bằng `EXPLAIN ANALYZE`: lọc theo tháng trên bảng 43.928
dòng giảm từ **1.648ms → 9ms**; trên bảng 6.208 dòng từ **391ms → <1ms**. Đã
dọn thêm 1 index trùng lặp (`idx_khbg_ma_khach` trên `khach_hang_ban_giao`).

### 8.5 Đã xong: Đổi domain Netlify

Đổi tên site Netlify từ `saleskpi-web.netlify.app` sang
**`asmquanden.netlify.app`** qua Netlify MCP (`update-project-name`). Link cũ
không còn hoạt động. Đã kiểm tra: không có chỗ nào trong code/`.env.local`
trỏ cứng domain cũ, đăng nhập bằng mật khẩu (không phải OAuth) nên không bị
ảnh hưởng.

### 8.6 Đã xong: Giao diện responsive cho điện thoại

Trước đó `(app)/layout.tsx` dùng sidebar cố định 240px luôn hiển thị, không
responsive - trên điện thoại chiếm hơn nửa màn hình. Đã sửa:
- `src/app/layout.tsx`: thêm `export const viewport` tường minh.
- `src/components/sign-out-button.tsx`: thêm prop `compact` (icon-only, cho
  top bar mobile).
- `src/components/nav-links.tsx`: thêm prop `variant="bottom"` - render thanh
  điều hướng dạng grid chia đều ở đáy màn hình (dùng chung logic filter NVKD
  ẩn mục "Đội nhóm" với sidebar desktop).
- `src/app/(app)/layout.tsx`: sidebar đổi thành `hidden lg:flex`; thêm
  `<header>` top bar gọn cho mobile (`lg:hidden`); thêm `<NavLinks
  variant="bottom">` cố định đáy màn hình; `<main>` thêm `pb-20 lg:pb-0` để
  không bị bottom nav che nội dung.

Đã deploy qua Netlify (commit `f6b7cb1`, deploy `6a7aebafa4fe7b00084df2b1`,
trạng thái `ready`), kiểm tra live thành công.

### 8.7 Đã xác nhận: Tính năng "ghi nhớ đăng nhập" đã hoạt động sẵn

User hỏi trước (chưa gặp lỗi thật) về việc có cần đăng nhập lại khi vào lại
web. Đã kiểm tra: cookie session của `@supabase/ssr` mặc định có hiệu lực
~1 năm (xác nhận qua tài liệu cộng đồng - thư viện tự ép `maxAge` này, không
phụ thuộc cấu hình), và `auth.sessions` của project không có `not_after` nào
được set (không giới hạn session timebox phía server). Kết luận: không cần
sửa code, tính năng đã có sẵn theo mặc định. Chỉ 3 trường hợp thật sự cần
đăng nhập lại: tự đăng xuất, dùng chế độ ẩn danh, hoặc trình duyệt tự xoá
cookie.

### Ghi chú kỹ thuật quan trọng: lỗi `.git/index.lock` khi thao tác git từ Cowork

Môi trường sandbox Linux của Cowork mount thư mục dự án Windows qua FUSE. Khi
chạy `git add`/`git commit`/`git status` từ Cowork, git tạo file tạm
`.git/index.lock` (và tương tự `.git/objects/**/tmp_obj_*`,
`.git/HEAD.lock`) rồi cố xoá/rename sau khi xong việc - bước dọn dẹp này luôn
báo `Operation not permitted` qua FUSE mount (không phải do tiến trình khác
giữ file - đã kiểm tra `fuser`/`lsof` không thấy gì). **Quan trọng: bản thân
thao tác git (rename dữ liệu thật) thường vẫn THÀNH CÔNG dù có warning này**
(vd `git commit` vẫn tạo commit đúng) - chỉ riêng việc dọn file lock/tmp là
thất bại, và file lock còn sót lại sẽ chặn lệnh git tiếp theo (`fatal: Unable
to create index.lock: File exists`). Cách xử lý: nhờ user tự xoá file đó trực
tiếp trên Windows (PowerShell: `Remove-Item ".git\index.lock" -Force`) trước
mỗi lệnh git cần chạy từ Cowork. Ngoài ra `git push` **không thể chạy được từ
Cowork** vì sandbox không có thông tin đăng nhập GitHub của user (tách biệt
hoàn toàn khỏi Windows/GitHub Desktop) - luôn cần user tự push bằng GitHub
Desktop hoặc terminal trên máy họ sau khi Cowork đã commit xong ở local.

## 9. Đã xong: Hoàn thiện mục "Phê duyệt" KPI (nhánh feature/xay-dung-duyet-kpi)

**Bối cảnh:** nhánh `feature/xay-dung-duyet-kpi` (remote, chưa merge) đã có sẵn
2 tab mới trong `/kpi`: "Xây dựng KPI tháng" (NV tự nhập chỉ tiêu nháp, gửi
duyệt) và "Phê duyệt" (SS/ASM duyệt/từ chối). User yêu cầu bổ sung cho tab
Phê duyệt: (1) hiển thị nhóm theo `Mã nhân viên - Tên nhân viên` thay vì
`Tên (Mã)`, (2) thêm nút Xóa ở từng dòng, (3) SS/ASM có thêm nút Điều chỉnh
(sửa giá trị kế hoạch) bên cạnh nút Xóa.

**Sự cố khi lấy code nhánh:** `git checkout feature/xay-dung-duyet-kpi` từ
Cowork chỉ thành công 1 phần - 6 file mới (`build-actions.ts`,
`kpi-autocomplete.tsx`, `kpi-duyet.tsx`, `kpi-tabs.tsx`, `kpi-xay-dung.tsx`,
`kpi-chi-tieu.ts`) được ghi đúng, nhưng `unlink` file cũ `kpi/page.tsx` báo
`Operation not permitted` (lỗi FUSE quen thuộc, xem mục cuối file) nên
`page.tsx` KHÔNG được thay bằng bản nhánh, và `HEAD` không chuyển được sang
nhánh mới (vẫn nằm trên `main`, `git branch --show-current` xác nhận). Đã xử
lý: áp trực tiếp đúng phần diff của `page.tsx` bằng Edit tool (không qua git),
nên kết quả cuối cùng là code của nhánh feature được **gộp thẳng vào working
tree của `main`** - không phải merge nhánh qua git, chỉ là copy nội dung tương
đương. User cần tự quyết định khi commit: giữ nguyên trên `main` (theo đúng
pattern làm việc từ đầu dự án - 1 nhánh duy nhất) hoặc tách lại thành nhánh
riêng nếu muốn review qua PR trước.

**Đã bổ sung (trên nền code nhánh có sẵn):**
- `build-actions.ts`: thêm `xoaDongKpi(id)` (SS/ASM xóa MỘT dòng ở BẤT KỲ
  trạng thái nào - khác `xoaDongKpiNhap()` cũ chỉ cho chính NV xóa dòng
  "nhập" của mình), `dieuChinhKeHoachDongKpi(id, {...})` (SS/ASM sửa riêng
  các giá trị kế hoạch - số lượng khách hàng kế hoạch/sản lượng tối
  thiểu/ngưỡng nhóm/điểm KPI kế hoạch - KHÔNG đụng `trang_thai_duyet`, khác
  `suaVaDuyetDongKpi()` cũ vốn sửa+duyệt luôn trong 1 bước), và
  `layTatCaKpiTheoThang()` (lấy TOÀN BỘ dòng KPI theo tháng bất kể trạng thái,
  thay vì chỉ lọc `cho_duyet` như `layDanhSachChoDuyet()` cũ - tách phần gom
  nhóm theo NV ra hàm dùng chung `gomTheoNv()` để tránh lặp code).
- `kpi-duyet.tsx`: đổi nguồn dữ liệu sang `layTatCaKpiTheoThang()` (hiển thị
  mọi chỉ tiêu KPI hiện có của từng NV, không chỉ dòng chờ duyệt - theo đúng
  lựa chọn của user), tiêu đề nhóm đổi thành hàm riêng `maTruocTen()` cho ra
  `"Mã - Tên"` (không đổi `ghepTenMa()` dùng chung toàn app vì các trang khác
  vẫn cần giữ format `"Tên (Mã)"`), thêm cột Trạng thái + nút Điều chỉnh (form
  inline sửa các trường kế hoạch, ẩn/hiện theo `layCauHinhChiTieu()` giống
  cách form Xây dựng đang làm) và nút Xóa (có `window.confirm`) trên MỌI dòng;
  nút Duyệt/Từ chối vẫn chỉ hiện khi dòng đang `cho_duyet`.
- Đã kiểm tra `tsc --noEmit` (0 lỗi trong `src/`, chỉ còn lỗi môi trường sẵn
  có trong `.next/types/*` do version generator cũ - không liên quan thay đổi
  lần này) và `eslint` (sạch) cho toàn bộ 6 file liên quan. Không chạy được
  `next build` đầy đủ trong sandbox Cowork vì thiếu SWC native binary cho
  Linux x64 (môi trường sandbox, không phải lỗi code) - **cần user tự chạy
  `npm run build` hoặc `npm run dev` trên máy Windows để xác nhận UI trước khi
  push**, Cowork chưa verify được bằng mắt.

## 10. Đã sửa: Cờ "Sản phẩm trọng tâm" (san_pham_trong_tam) sai/thiếu trong KPI

**Triệu chứng:** khách hàng P04915, sản phẩm "pH Balance Protect Intimate Gel"
- mục Khách hàng lấy đúng lần mua gần nhất T07/2026, nhưng mục KPI vẫn hiện
T04/2026 và báo "Đã lặp đơn" ngay cả khi chọn Tháng 7/2026. Nguyên nhân: cột
`san_pham_trong_tam` trên `"Du lieu sale tong"`/`"Du lieu sale thang hien tai"`
được gán thủ công/không đồng bộ theo `ma_chuan`, nên nhiều dòng của SPTT thật
không được đánh dấu, khiến 09a (đối chiếu lặp đơn) bỏ sót dòng gần nhất.

**Đã sửa (chọn "sửa dữ liệu ngay" thay vì chỉ báo dev):**
- Tạo bảng chuẩn `public.danh_sach_san_pham_trong_tam (ma_chuan PK, ten_sptt)`
  - nguồn sự thật duy nhất cho danh sách SPTT, seed 7 sản phẩm (Atosiban-BFS,
  Progermila x2 mã, Proges sup x2 mã, Propofol-BFS, pH Balance Protect).
- Backfill toàn bộ dòng thiếu cờ trên cả 2 bảng sale (join qua
  `danh_muc_chuan_hoa_san_pham` + bảng mới theo `ma_chuan`), verify hết 0 dòng
  còn thiếu.
- Sửa workflow n8n **"Pharma Mới - 03 Đồng Bộ Dữ Liệu Sale"** (id
  `lsqapixY9MCHPe8R`): node "Đọc bảng chuẩn hóa SP" thêm join với bảng
  `danh_sach_san_pham_trong_tam`; 2 node Code "Chuẩn hóa sale tổng"/"Chuẩn hóa
  sale tháng hiện tại" đổi sang lấy `san_pham_trong_tam` từ map tra cứu theo
  `ma_chuan` thay vì đọc trực tiếp cột thô hay gán tay - **từ nay thêm SKU mới
  vào bảng `danh_sach_san_pham_trong_tam` là tự động chảy vào sale hàng ngày,
  không cần sửa code/workflow nữa.** Đã publish workflow (xác nhận
  `activeVersionId` khớp `versionId`).

## 11. Đã xong: Hoàn thiện + merge mục Phê duyệt KPI (PR #4, #5, #6) - kèm sự cố nghiêm trọng và cách khôi phục

**Yêu cầu:** mục Phê duyệt hiển thị theo "Mã NV - Tên NV", có nút Xóa (mọi
tài khoản NV/SS/ASM) và nút Điều chỉnh (chỉ SS/ASM, sửa riêng giá trị kế
hoạch không đổi trạng thái duyệt) - tiếp nối mục 9. Toàn bộ đã lên `main` và
chạy đúng trên production tính đến cuối phiên 12-13/8/2026.

**PR #4 (nhánh `feature/kpi-pheduyet-dieu-chinh`) - xung đột do lệch nhánh
gốc:** nhánh tách ra từ điểm TRƯỚC KHI 2 PR fix khác (#2 nguong-nhom-hien-thi,
#3 cong-thuc-diem-kpi) merge vào `main`, nên cùng file KPI vừa bị sửa ở
`main` vừa bị sửa thêm ở nhánh này → GitHub báo "has conflicts". Vì
`git checkout`/`merge` từ Cowork luôn lỗi FUSE (xem mục cuối file), đã xử lý
bằng cách hợp nhất NỘI DUNG thủ công (lấy bản `main` mới nhất làm nền, chèn
lại đúng phần thêm của nhánh) rồi tạo **merge commit thật sự bằng git plumbing**
(`git write-tree` + `git commit-tree -p <tip> -p origin/main` + `git
update-ref`) để GitHub công nhận đã hợp nhất - hợp nhất nội dung đơn thuần
KHÔNG đủ vì 2 file này được "thêm mới độc lập" ở cả 2 nhánh (không có bản gốc
chung), Git 3-way merge vẫn báo xung đột dù nội dung cuối đã đúng.

**Sự cố ".git/index bị lệch" khi commit qua GitHub Desktop:** sau nhiều lần
Cowork can thiệp git thủ công (đặc biệt lỗi unlink/rename do FUSE), file
`.git/index` trên máy user bị lệch so với thực tế, khiến GitHub Desktop báo
"Commit failed - no changes added" dù các file đã sửa đúng. Cách gỡ: xóa
`.git/index` (KHÔNG phải `.git/index.lock`) để Git tự dựng lại từ HEAD + working
tree. **Rủi ro:** việc dựng lại lộ ra ~2459 file rác `.netlify/...` (build
cache của Netlify CLI) đã bị lỡ `git add` commit vào repo từ trước, xen lẫn
~69 file dự án thật trong cùng 1 danh sách "changed files".

**SỰ CỐ NGHIÊM TRỌNG - PR #5 xóa sạch project khỏi git:** khi user tự chọn
tay từng file để tránh commit nhầm 2459 file rác `.netlify/...` nói trên,
thao tác đã xóa nhầm CẢ các file dự án thật (`package.json`, `netlify.toml`,
`.gitignore`, toàn bộ `src/`...) - PR #5 merge xong khiến **nhánh `main` trên
GitHub còn 0 file được theo dõi**. Hậu quả: Netlify vẫn báo deploy "ready"
nhưng build chỉ mất 7 giây, không có `npm install`/`next build` nào chạy (log
"Building" chỉ có 2 dòng meta, không output), `plugin_state: none`, "No
functions deployed" → web sập hoàn toàn dù dashboard không báo lỗi rõ ràng.
**Cách phát hiện:** so `deploy_time` giữa các lần deploy trong danh sách
Netlify (bản lỗi chỉ 7-13s, bản đúng luôn >= 1 phút) + `git ls-tree -r
origin/main --name-only | wc -l` trả về 0.

**Cách khôi phục (PR #6):** vì working tree trên máy user vẫn còn nguyên file
thật (Cowork chỉ *build/sửa* trong working tree, chưa từng xóa gì), chỉ cần
`git add -A -- . ':!.netlify'` (loại trừ đúng thư mục cache, giữ lại
`.netlifyignore` là file thật) rồi commit thẳng - khôi phục đúng 69 file gốc +
giữ nguyên các sửa lỗi đang làm dở (tên NV, cache `getCurrentEmployee`,
`loading.tsx`). Verify bằng `comm` giữa danh sách file ở commit tốt cuối cùng
(`e5a64dd`, trước PR #5) và danh sách vừa stage - khớp 1:1 (chỉ thiếu
`deno.lock` không dùng tới, thừa đúng 1 file mới `loading.tsx`).

**Bài học cho phiên sau:** KHÔNG bao giờ tự `git add -A`/chọn "Select all" khi
GitHub Desktop hiện danh sách hàng nghìn file bất thường - luôn dừng lại,
xác định rõ file nào THẬT sự cần thay đổi trước khi commit. Nếu thấy số
lượng file thay đổi tăng đột biến so với dự kiến, đó là dấu hiệu cảnh báo
sớm, không phải điều để bỏ qua.

## 12. Đã sửa: RLS chặn ngầm việc SS/ASM xóa dòng KPI đã cho_duyet/da_duyet

Nút "Xóa" ở mục Phê duyệt gọi đúng `xoaDongKpi()`, `assertQuanLy()` (kiểm tra
server-side) cũng pass, nhưng RLS DELETE trên bảng `"Chi tieu KPIs"` trước đó
CHỈ có 1 policy `"scoped delete draft"` giới hạn `trang_thai_duyet = 'nhap'`
(dành cho NV tự xóa dòng nháp của mình). Khi SS/ASM xóa dòng đã "chờ duyệt"/
"đã duyệt", Postgres lặng lẽ lọc mất 0 dòng bị xóa (không báo lỗi) → giao
diện không đổi. Đã thêm policy `"scoped delete quan ly"` (SS/ASM xóa được MỌI
trạng thái, trong phạm vi `visible_employee_codes()`) - 2 policy DELETE cộng
theo OR nên NV vẫn chỉ xóa được dòng nháp của mình như cũ.

Đồng thời sửa hiển thị thiếu tên NV ở mục Phê duyệt: danh sách `danhSachNv`
(dùng để chọn "xây KPI thay cho ai") loại trừ vị trí ASM VÀ chỉ chứa mã đã
chuẩn hóa (bỏ số 0 đầu), trong khi dòng KPI do chính NV tự tạo cho mình lại
lưu mã THÔ (có số 0 đầu, lấy nguyên từ "Mã nhân viên" của `getCurrentEmployee()`)
→ tra cứu tên bị lệch key, chỉ hiện mã. Đã bổ sung tra cứu trực tiếp cho MỌI
mã thực sự xuất hiện trong dữ liệu Phê duyệt (không lọc vị trí), so khớp theo
mã đã chuẩn hóa rồi gán lại đúng key thô để khớp với cách component tra cứu.

## 13. Đã xong: Tối ưu hiệu năng web (Supabase + Next.js)

**Vấn đề 1 - query không lọc tháng bị full scan:** RLS "scoped read" trên
`"Du lieu sale tong"` lọc theo `norm_code(ma_nhan_vien)`/`norm_code(ma_quan_ly)`
nhưng bảng chỉ có index trên cột thô, không có index theo biểu thức
`norm_code(...)` → truy vấn không kèm `nam`/`thang` phải quét hết 83k dòng
(đo thực tế: 5,1 giây). Đã thêm 2 index biểu thức
(`idx_sales_norm_ma_nhan_vien`, `idx_sales_norm_ma_quan_ly`). Các trang hiện
tại đa số đã lọc theo `nam`/`thang` trước nên ít bị ảnh hưởng trực tiếp, index
này chủ yếu phòng ngừa các truy vấn không lọc phát sinh sau này.

**Vấn đề 2 - view tổng hợp tính lại toàn bộ lịch sử mỗi lần load trang (thủ
phạm chính):** `v_customer_summary` (trang Khách hàng) và `v_product_sales_summary`
(trang Sản phẩm) là VIEW thường, `GROUP BY` trực tiếp trên toàn bộ 83k dòng
`"Du lieu sale tong"` mỗi lần được gọi - đo thực tế 516ms và 178ms/lần, nhân
lên nếu trang cần phân trang >1000 dòng. Đã chuyển cả 2 thành
**MATERIALIZED VIEW** (giữ nguyên tên, không cần đổi code web), thêm index
tương ứng, kết quả 0,3ms và 1ms (nhanh hơn 180-1700 lần). Đã bật
**`pg_cron`**, job `refresh_v_customer_and_product_sales_summary` chạy
**7:15 sáng hằng ngày** (00:15 UTC, sau khi n8n đồng bộ sale lúc 6:30/6:45
sáng VN) để làm mới 2 view này. Đánh đổi: số liệu tổng hợp KH/SP không cập
nhật real-time trong ngày, chỉ mới nhất tính đến lần refresh gần nhất - nếu
cần đổi giờ refresh, sửa lịch cron trong Supabase (project `lfykohprunrfprityslr`).

**Vấn đề 3 - chuyển trang cảm giác lâu (perceived latency):** `(app)/layout.tsx`
gọi `getCurrentEmployee()` và không có `loading.tsx` nào trong `src/app/(app)/`
→ Next.js không có gì để hiện ngay khi bấm chuyển mục, phải đợi toàn bộ
server render xong mới đổi màn hình. Đã thêm `src/app/(app)/loading.tsx`
(skeleton dùng chung cho mọi trang con) để Next.js prefetch/hiện ngay lập
tức. Đồng thời bọc `getCurrentEmployee()` bằng React `cache()` - trước đó bị
gọi 2 lần/lượt tải trang (1 lần ở layout, 1 lần ở chính trang) tại các trang
kpi/customers/ai-review, mỗi lần lại tốn 2 vòng gọi Supabase riêng.

## 15. Đã sửa: NV mới (Trần Thị Kim Oanh) không đăng nhập được - lỗi NULL token trong auth.users (14/8/2026)

**Triệu chứng:** Web báo "Email hoặc mật khẩu không đúng" dù nhập đúng mật khẩu.

**Nguyên nhân thật:** Không phải sai mật khẩu. Dòng của chị Oanh trong
`auth.users` có giá trị NULL ở các cột token nội bộ của GoTrue
(`confirmation_token`, `recovery_token`, `email_change_token_new`,
`email_change_token_current`, `email_change`, `phone_change`,
`phone_change_token`, `reauthentication_token`) thay vì chuỗi rỗng `''`. GoTrue
dùng Go's `sql.Scan` để đọc các cột này khi tra cứu user lúc đăng nhập - nếu
gặp NULL sẽ crash với lỗi "converting NULL to string is unsupported", trả về
HTTP 500. Trang `/login` (`src/app/login/page.tsx`) bắt mọi lỗi Supabase Auth
và hiển thị chung chung "Email hoặc mật khẩu không đúng", nên lỗi 500 này bị
ngụy trang thành lỗi sai mật khẩu.

**Đã kiểm tra:** Không có bản ghi nào trong `auth.audit_log_entries` cho tài
khoản này, và không có execution n8n nào (workflow "01 Đồng Bộ Danh Sách Nhân
Sự", "02 Xử Lý Biến Động Nhân Sự", hay bất kỳ workflow nào khác) chạy quanh
thời điểm tài khoản được tạo (07:28 UTC 14/8). Kết luận: tài khoản này được
tạo bằng INSERT SQL thủ công (giống cách tạo 7 tài khoản còn thiếu hôm 11/8),
không qua workflow tự động nào - lần này bước tạo bị thiếu gán chuỗi rỗng cho
các cột token.

**Đã sửa:**
```sql
UPDATE auth.users
SET confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    email_change = coalesce(email_change, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '')
WHERE id = '9e3291ef-c1a2-45f0-a55e-d362f3d5ae47';
```

**Lưu ý cho lần sau:** Nếu cần tạo tài khoản `auth.users` thủ công qua SQL cho
nhân viên mới (thay vì qua Supabase Dashboard "Invite user" / Admin API - cách
này tự set đúng các cột), LUÔN gán `''` (không để mặc định/NULL) cho toàn bộ 8
cột token ở trên. Có thể chạy nhanh câu lệnh kiểm tra hàng loạt trước khi báo
"đã xong":
```sql
select id, email from auth.users
where confirmation_token is null or recovery_token is null
   or email_change_token_new is null or email_change_token_current is null
   or email_change is null or phone_change is null
   or phone_change_token is null or reauthentication_token is null;
```

## 14. Trạng thái hiện tại (chốt phiên 13/8/2026) - đọc mục này trước khi bắt đầu phiên mới

**Trên máy (Windows, `C:\Users\DELL\projects\saleskpi-web`):**
- Nhánh đang checkout trong GitHub Desktop: `feature/kpi-pheduyet-dieu-chinh`
  (đã merge xong vào `main` qua PR #6, có thể an toàn chuyển checkout sang
  `main` và pull để đồng bộ, hoặc xóa nhánh này nếu không còn dùng).
- Working tree sạch, không còn thay đổi chưa commit.

**Trên GitHub (`ngoquan-0493/KPIs-CPC1HN-QuanNgo`):**
- `main` đang ở commit `0eb321d` (merge PR #6 "Khôi phục toàn bộ project bị
  xóa nhầm khỏi git"), đã bao gồm toàn bộ PR #1-#6.
- Repo đã sạch trở lại đúng ~69 file dự án thật, không còn lẫn file rác
  `.netlify/...` (đã chặn qua `.gitignore` có sẵn, chỉ cần luôn cẩn thận khi
  commit số lượng file bất thường - xem mục 11).

**Trên Netlify (site `asmquanden`, https://asmquanden.netlify.app):**
- Deploy hiện tại (`6a7c8faf48022f000856a028`) build thành công thật sự:
  `plugin_state: success`, framework nhận đúng `next`, có 1 function
  (`___netlify-server-handler`) + 1 edge function, thời gian build ~62s (bình
  thường). Đã xác nhận user vào lại được web.
- Lưu ý: `deploy_source` của các lần deploy gần đây đều ghi `"api"` thay vì
  kiểu trigger qua webhook GitHub cổ điển - có thể chỉ là cách UI Netlify mới
  gắn nhãn khi deploy qua nút bấm/dashboard, KHÔNG chắc chắn là bất thường,
  nhưng nếu lần sau lại thấy build chỉ vài giây/0 function thì đây là điểm
  đầu tiên cần nhìn lại (đối chiếu `deploy_time` trong danh sách Deploys).

**Trên Supabase (project `lfykohprunrfprityslr`):**
- Bảng mới: `danh_sach_san_pham_trong_tam` (mục 10).
- RLS: thêm 1 policy DELETE `"scoped delete quan ly"` trên `"Chi tieu KPIs"`
  (mục 12).
- Index mới: `idx_sales_norm_ma_nhan_vien`, `idx_sales_norm_ma_quan_ly` trên
  `"Du lieu sale tong"` (mục 13).
- `v_customer_summary`, `v_product_sales_summary` đổi từ view → materialized
  view, có `pg_cron` refresh 7:15 sáng hằng ngày (mục 13).
- n8n workflow "Pharma Mới - 03 Đồng Bộ Dữ Liệu Sale" (`lsqapixY9MCHPe8R`) đã
  publish bản có tra `san_pham_trong_tam` theo `ma_chuan` (mục 10).
