# Danh sách bảng Supabase và vai trò trong workflow

Project: `lfykohprunrfprityslr`. Tài liệu này liệt kê từng bảng/view trong schema `public`, lưu thông tin gì, và bảng đó gắn với workflow n8n nào (đọc/ghi) hoặc trang nào trong web app. Nhóm theo chức năng để dễ tra cứu.

## A. Nhân sự

| Bảng | Lưu gì | Vai trò trong workflow |
|---|---|---|
| `Danh sach nhan vien` | Danh sách nhân viên gốc: mã, tên, vị trí (NVKD/SS/ASM), SS/ASM quản lý, email đăng nhập, tỉnh, trạng thái active/nghỉ. | Đồng bộ hằng ngày bởi **01 Đồng Bộ Danh Sách Nhân Sự** (đọc Google Sheet, phát hiện biến động, gọi WF02 nếu có). Là bảng gốc cho hàm `visible_employee_codes()` — quyết định ai thấy dữ liệu gì trong toàn bộ RLS, và cho đăng nhập web app. |
| `lich_su_phan_cong_nhan_vien` | Lịch sử đổi SS/địa bàn/vị trí theo thời gian, không ghi đè. | Ghi bởi **01 Đồng Bộ Danh Sách Nhân Sự** mỗi khi phát hiện thay đổi phân công. |
| `khach_hang_ban_giao` | Yêu cầu bàn giao khách khi NV nghỉ/chuyển: khách nào, từ ai sang ai, trạng thái xử lý. | Tạo bởi **02 Xử Lý Biến Động Nhân Sự**; xử lý tiếp bởi **10a SS Chỉ Định Người Tiếp Nhận**, **10b NV Xác Nhận Tiếp Nhận**, **10c Kiểm Tra Hoàn Tất Và Escalation Bàn Giao**. |
| `dieu_chinh_kpi` | Quyết định điều chỉnh/chuyển chỉ tiêu KPI khi có biến động nhân sự, có phê duyệt. | Liên quan **02 Xử Lý Biến Động Nhân Sự** / module điều chỉnh KPI. |

## B. Khách hàng & phân công

| Bảng | Lưu gì | Vai trò trong workflow |
|---|---|---|
| `khach_hang_master` | Hồ sơ trung tâm từng khách hàng (mã, tên, kênh, nhóm, tỉnh, mức ưu tiên, người phụ trách gần nhất...). | Khởi tạo/cập nhật từ `Du lieu sale tong` bởi **03 Đồng Bộ Dữ Liệu Sale**. Là bảng tra cứu tên khách cho hầu hết workflow và web app. |
| `phan_cong_khach_hang` | Ai đang phụ trách khách nào, hiệu lực từ khi nào, trạng thái phân công (kể cả người tạm thời). | Cập nhật khi có bàn giao (WF02/10a/10b) hoặc đồng bộ sale (WF03). |
| `nhip_khach_hang` | **Lõi Customer Rhythm Engine** — trạng thái nhịp chăm sóc (overdue/followup_due/...) và mức rủi ro P1/P2/P3 cho toàn bộ khách active. | Tính lại hằng ngày bởi **05 Customer Rhythm Engine**. Là nguồn cho **07 Nhắc Việc & Cảnh Báo**, **08 Kế Hoạch Công Việc Tuần** (tự tạo việc từ P1/P2), và trang `/sales`, `/kpi` web app. |
| `cau_hinh_nhip_khach_hang` | Quy tắc ngưỡng nhịp theo kênh/nhóm khách hàng (bao nhiêu ngày thì coi là quá hạn...). | Input cấu hình cho **05 Customer Rhythm Engine** — sửa trực tiếp trong bảng, không sửa code workflow. |
| `lich_su_khach_khong_nguoi_phu_trach` | Snapshot hằng ngày danh sách khách chưa có người phụ trách. | Ghi bởi **06 Kiểm Tra Chất Lượng Dữ Liệu**, phục vụ theo dõi xu hướng (view `v_dashboard_xu_huong`). |

## C. Dữ liệu bán hàng

| Bảng/View | Lưu gì | Vai trò trong workflow |
|---|---|---|
| `Du lieu sale tong` | Toàn bộ lịch sử bán hàng (upsert, không xoá), theo NV/khách/sản phẩm/kênh. | Đồng bộ từ Google Sheets bởi **03 Đồng Bộ Dữ Liệu Sale**. Nguồn chính cho `khach_hang_master`, cho tính KPI (WF09a), và trang `/sales`. |
| `Du lieu sale thang hien tai` | Sale của riêng tháng hiện tại (xoá & nạp lại mỗi lần đồng bộ, không cộng dồn lịch sử). | Cũng từ **03 Đồng Bộ Dữ Liệu Sale**; dùng để tính KPI tháng hiện tại và các chỉ tiêu Code mới/Mở mới/Duy trì SPTT (WF09a). |
| `sales` (view) | View của `Du lieu sale tong`, dùng làm bí danh gọn cho truy vấn/web app. | Không có workflow ghi riêng — chỉ đọc. |
| `canh_bao_chat_luong_sale` + `v_canh_bao_chat_luong_sale` | Tổng hợp số lượng theo từng loại lỗi chất lượng dữ liệu sale (thiếu mã khách, sai định dạng...); view để xem chi tiết từng dòng lỗi. | Ghi bởi **06 Kiểm Tra Chất Lượng Dữ Liệu** mỗi lần chạy. |

## D. Chấm công / viếng thăm khách hàng

| Bảng | Lưu gì | Vai trò trong workflow |
|---|---|---|
| `Du lieu cham cong 3 thang` | Lịch sử check-in/check-out 3 tháng gần nhất: mã khách, thời gian, địa điểm, báo cáo (`bao_cao`) NV ghi tại chỗ. | Đồng bộ bởi **04 Đồng Bộ Check Call** (đọc Google Sheets, chuẩn hoá, upsert). |
| `Du lieu cham cong thang hien tai` | Check-in/checkout của tháng hiện tại — cấu trúc giống bảng trên nhưng phạm vi tháng nay, cập nhật thường xuyên hơn. | Cũng từ **04 Đồng Bộ Check Call**. Được **08 Kế Hoạch Công Việc Tuần** (bước "Liên Kết Check Call", chạy 20:00 hằng ngày) dùng để tự động đối chiếu xem NV có ghé đúng khách trong tuần của 1 việc hay không, gắn `bao_cao`/`ket_qua`/`next_action` vào `ke_hoach_cong_viec_tuan`. Web app dùng bảng này để hiện "Xem chấm công trong tuần" khi SS/ASM xác nhận kết quả đề xuất AI. |

## E. KPI

| Bảng | Lưu gì | Vai trò trong workflow |
|---|---|---|
| `Chi tieu KPIs` | Chỉ tiêu + kết quả thực hiện từng NV theo tháng (Code mới / Mở mới SPTT / Duy trì SPTT / Doanh số...), có mã NV, mã SS, mã ASM. | Tính bởi **09a Tính KPI Code Mới, Mở Mới SPTT, Duy Trì SPTT** hằng ngày. Nguồn chính cho trang `/kpi` web app. |
| `chi_tiet_code_moi` / `chi_tiet_mo_moi_sptt` / `chi_tiet_duy_tri_sptt` / `chi_tiet_mo_moi` | Chi tiết từng khách hàng đóng góp vào từng loại KPI ở trên (dùng để giải trình "Số lượng thực hiện" tính từ đâu). | Ghi cùng lúc với `Chi tieu KPIs` bởi **09a**. |
| `tong_hop_diem_kpi_thang` | Tổng điểm toàn bộ nhóm chỉ tiêu theo NV-tháng, áp luật ngưỡng riêng cho nhóm Duy trì SPTT, xếp loại (Tốt/Chậm/Báo động...). | Tính bởi **09b Tổng Hợp Điểm KPI Và Cảnh Báo Nguy Cơ**. |
| `canh_bao_nguy_co_khong_dat_kpi` | Danh sách NV nguy cơ không đạt KPI tháng, kèm gợi ý khách hàng có thể hỗ trợ hoàn thành. | Cũng từ **09b**, gửi Telegram cho SS/ASM. |
| `lich_su_kpi_thang` | Lịch sử % đạt theo tuần cho nhóm chỉ tiêu số lượng — dùng đếm chuỗi đạt liên tiếp. | Cập nhật định kỳ, đọc bởi `v_dashboard_xu_huong`. |
| `phan_loai_khach_hang_can_lap_don` | Phân loại Khẩn/Ưu tiên/Mồ côi cho chỉ tiêu lặp đơn SPTT theo từng cặp khách-sản phẩm, theo tháng đánh giá. | Chạy lại hàng tháng (workflow sinh chỉ tiêu lặp đơn), là nguồn cho skill `pharma-lap-don-target` / `pharma-warning-analysis` và trang `/kpi`. |
| `lich_su_thuc_hien_ke_hoach` | Lịch sử NV đã ghé đúng cặp khách-sản phẩm trong kế hoạch lặp đơn hay chưa. | Gắn với workflow "Tổng Kết Cuối Tuần" đời cũ (hiện **đã tắt/inactive**) — bảng còn tồn tại nhưng nguồn ghi mới không rõ còn workflow nào chủ động cập nhật không, cần rà lại nếu thấy dữ liệu không tăng. |

## F. Kế hoạch công việc & Đề xuất AI (vòng lặp học AI)

| Bảng | Lưu gì | Vai trò trong workflow |
|---|---|---|
| `ke_hoach_cong_viec_tuan` | **Bảng việc-theo-tuần trung tâm**: từng việc cụ thể (khách/sản phẩm/mục tiêu/hạn/mức ưu tiên/trạng thái), có thể tự sinh từ cảnh báo hoặc từ đề xuất AI. | Tự sinh từ `nhip_khach_hang` P1/P2 bởi **08 Kế Hoạch Công Việc Tuần** (thứ Hai 8:30); nối `bao_cao`/`ket_qua` từ chấm công (20:00 hằng ngày, bước "Liên Kết Check Call"); đánh dấu quá hạn + chuyển việc tồn sang tuần mới (Chủ Nhật). Cũng được tạo trực tiếp khi web app duyệt 1 đề xuất AI (`approveDeXuat`), liên kết qua cột `nguon_phan_hoi_ai_id`. |
| `phan_hoi_hoc_tu_ai` | Đề xuất hành động AI đưa ra cho từng NV + toàn bộ vòng đời phản hồi: quyết định SS/ASM (duyệt/bỏ/điều chỉnh), trạng thái NV xác nhận/từ chối (`trang_thai_nv`), kết quả thực tế, điểm hiệu quả. | Tạo task + chấm điểm bởi **13a Theo Dõi Và Chấm Điểm Đề Xuất AI** (6:15 sáng — sau khi vá gần đây, bước tự động đóng trạng thái đã bị **tắt**, chỉ còn tạo task + chấm điểm). Toàn bộ vòng duyệt/xác nhận nay đi qua trang `/ai-review` web app. Là nguồn chính cho **13b AI Tổng Hợp Bài Học Dài Hạn**. |
| `bai_hoc_dai_han` | Bài học dài hạn AI rút ra theo từng phạm vi (kênh/nhóm khách/sản phẩm/NV/SS), có bằng chứng đi kèm. | Output của **13b AI Tổng Hợp Bài Học Dài Hạn** — đọc lại `phan_hoi_hoc_tu_ai` đã chấm điểm để tổng hợp. |
| `nhan_dinh_ai_tuan` | Đánh giá AI hàng tuần theo nhóm SS hoặc từng NV: tình trạng chung, điểm hiệu quả, rủi ro, hành động đề xuất, trạng thái duyệt. | Sinh bởi **12 AI Weekly Review** (chuẩn bị dữ liệu tuần + gọi AI Agent), gửi Telegram báo có review mới, duyệt qua trang `/ai-review`. |
| `bao_cao_phan_tich_hang_ngay` | Tiền thân cấp-ngày của `nhan_dinh_ai_tuan` — tóm tắt kết quả, nhận xét AI, đề xuất tiếp theo theo NV. | Không còn workflow chính nào ghi mới thường xuyên (đã có `nhan_dinh_ai_tuan` cấp tuần thay thế), giữ lại cho lịch sử. |
| `ghi_chu_pdca_tuan` | Mục tiêu tuần mới ASM đặt riêng (ngoại lệ) cho từng NV, để đối chiếu cam kết ở chu kỳ tuần kế tiếp. | Dùng bởi skill `pharma-weekly-pdca-cycle` (chạy trực tiếp qua Claude, không qua n8n). |
| `xac_nhan_ke_hoach_tuan` | Xác nhận NV đã đọc kế hoạch tuần qua email (token xác nhận, thời điểm xác nhận). | Gắn với workflow "Form Xác Nhận Kế Hoạch Tuần" và "Check Xác Nhận Thứ Hai" — **cả hai hiện đang tắt (inactive)**. |

## G. Vận hành / hạ tầng

| Bảng | Lưu gì | Vai trò trong workflow |
|---|---|---|
| `nhat_ky_thuc_thi_workflow` | Log mỗi lần chạy 1 workflow n8n: tên, run_id, thời gian, trạng thái, số dòng vào/thành công/lỗi. | **Mọi workflow "Pharma Moi" đều ghi vào đây** ở bước cuối. **14a Cảnh Báo Workflow Lỗi** quét bảng này mỗi 30 phút, báo Telegram cho ASM nếu có bản ghi lỗi chưa cảnh báo. |
| `telegram_chat_context` | Context hội thoại Telegram bot (khách đang nói tới, sản phẩm...). | Dùng bởi bot Telegram tra cứu thông tin khách hàng. |

## H. Views tổng hợp / báo cáo (chỉ đọc)

| View | Lưu gì | Dùng ở đâu |
|---|---|---|
| `v_dashboard_tong_the` | Dashboard cấp ASM (toàn vùng), snapshot tại thời điểm truy vấn. | Báo cáo cấp ASM, web app. |
| `v_dashboard_ss` | Dashboard theo từng SS. | Web app, báo cáo SS. |
| `v_dashboard_nhan_vien` | Dashboard theo từng NV, gồm xếp loại KPI. | Trang `/kpi`, `/ai-review` (ghép tên NV). |
| `v_dashboard_xu_huong` | Xu hướng theo thời gian, gộp từ `lich_su_kpi_thang` + `lich_su_khach_khong_nguoi_phu_trach`. | Báo cáo xu hướng — sẽ đầy đủ hơn khi tích luỹ thêm dữ liệu qua các tuần. |
| `v_canh_bao_ss` | Cảnh báo hằng ngày cho SS — tổng hợp tình trạng nhịp chăm sóc toàn team. | **07 Nhắc Việc & Cảnh Báo**. |
| `v_escalation_asm` | Escalation cho ASM khi 1 SS có ≥5 khách P1 hoặc ≥1 khách chưa ai phụ trách. | **07 Nhắc Việc & Cảnh Báo**. |
| `v_nhac_viec_nhan_vien` | Nhắc việc hằng ngày cho từng NV — khách quá hạn/đến hạn thuộc phần việc của họ. | **07 Nhắc Việc & Cảnh Báo**. |
| `v_khach_hang_khong_nguoi_phu_trach` | Toàn bộ khách active chưa có người phụ trách chính, phân biệt "có SS tạm" vs "thực sự không ai lo". | **06 Kiểm Tra Chất Lượng Dữ Liệu**, dashboard chất lượng dữ liệu. |
| `v_canh_bao_chat_luong_sale` | Chi tiết từng dòng lỗi chất lượng dữ liệu sale (xem mục C). | **06 Kiểm Tra Chất Lượng Dữ Liệu**. |
| `v_customer_summary` / `v_customer_product_summary` | Tổng hợp theo khách hàng / theo khách-sản phẩm. | Web app tra cứu khách hàng. |
| `v_product_sales_summary` / `v_employee_sales_summary` | Tổng hợp doanh số theo sản phẩm / theo nhân viên. | Trang `/sales`, `/kpi`. |

## I. Bảng tạm / nên dọn dẹp

| Bảng | Ghi chú |
|---|---|
| `_legacy_unused_chi_tieu_mo_moi_sptt` | Đã đánh dấu DEPRECATED, bảng rỗng, trùng chức năng `chi_tiet_mo_moi_sptt`. Có thể xoá hẳn sau khi xác nhận không còn workflow ẩn nào tham chiếu. |
| `zz_backfill_chitieu_20260712` / `zz_backfill_tonghop_20260712` | Bảng backfill tạm thời dùng một lần (12/7/2026). Nên xoá khi đã xác nhận dữ liệu chính (`Chi tieu KPIs`, `Du lieu sale tong`...) đã đúng, không cần đối chiếu lại nữa. |

---

**Ghi chú chung:** hầu hết bảng có RLS "scoped read/insert/update" dựa trên hàm `visible_employee_codes()` — NV chỉ thấy dữ liệu mã mình, SS thấy cả nhóm, ASM thấy toàn vùng; các workflow n8n chạy bằng `service_role` nên không bị giới hạn này. Danh sách 57 workflow đầy đủ (kể cả các workflow đang tắt) có thể xem trực tiếp trong n8n tại https://n8n.cpc1hn.com.vn.
