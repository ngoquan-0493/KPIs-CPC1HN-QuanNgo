# Ghi chú vận hành (cập nhật gần nhất: 2026-08-11)

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
