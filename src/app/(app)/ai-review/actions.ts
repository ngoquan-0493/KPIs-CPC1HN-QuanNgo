"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import { mergeSaleRowsByMonth } from "@/lib/sales-channel";
import { revalidatePath } from "next/cache";

// Chan quyen o TANG SERVER, khong dua hoan toan vao RLS: visible_employee_codes()
// luon tra ve it nhat ma cua chinh nguoi goi, nen mot NVKD van "hop le" theo
// RLS khi update/insert tren chinh cac dong cua ho. Cac thao tac quan ly
// (duyet, bo/dieu chinh, xac nhan ket qua, them viec, duyet weekly review)
// phai la SS/ASM - khong the chi an nut o UI. NV van goi duoc revertDeXuat/
// nvXacNhanNhanViec/nvTuChoiDeXuat vi do la thao tac danh cho chinh ho.
async function assertQuanLy(): Promise<void> {
  const employee = await getCurrentEmployee();
  const viTri = employee?.["Vị trí"];
  if (viTri !== "SS" && viTri !== "ASM") {
    throw new Error("Chỉ SS/ASM mới có quyền thực hiện thao tác này.");
  }
}

// Cong thuc tuan: parse "YYYY-MM-DD" thanh moc UTC de tranh lech mui gio,
// tra ve {start, end} = Thu Hai -> Chu Nhat cua tuan chua ngay do.
function weekBounds(dateStr?: string | null): { start: string; end: string } {
  const base = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  const day = base.getUTCDay(); // 0 = CN, 1 = T2, ... 6 = T7
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

// Do ma khach hang (vd: P06561, C01177 - 1 chu cai + 5 chu so) xuat hien
// trong 1 doan text tu do (ASM go tay). Ban sao cua ham cung ten trong
// components/ai-review-actions.tsx (client) - giu 2 ban vi 1 ben chay server
// action, 1 ben chay client component, khong dung chung module duoc.
function trichMaKhach(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.toUpperCase().match(/\b[A-Z]\d{5}\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

// Noi dung cong viec cho 1 dong: neu co ma khach cu the thi gan vao cuoi
// noi dung goc de NV/SS deu thay ro dang lam viec voi khach nao.
function noiDungTheoKhach(noiDungGoc: string, maKhach: string | null): string {
  if (!maKhach) return noiDungGoc;
  return `${noiDungGoc} — tập trung khách ${maKhach}`;
}

// Tao cong viec that (ke_hoach_cong_viec_tuan) cho 1 de xuat da duyet/dieu
// chinh. Neu danhSachMaKhach co NHIEU HON 1 ma khach: TACH thanh nhieu dong
// khach hang - sanh pham rieng biet, moi dong co nut duyet/xac nhan doc lap -
// dong DAU dung lai chinh id hien co (chi tao them 1 task), cac dong SAU
// insert them ban ghi phan_hoi_hoc_tu_ai MOI (nhan ban cac field dung chung)
// + task rieng. Tra ve ma khach se duoc gan cho chinh dong `id` (dong dau
// tien, hoac null neu danh sach rong) de caller tu update ban ghi goc.
async function taoCongViecTheoDanhSachKhach(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    id: number;
    maNhanVien: string;
    maSs: string | null;
    reviewId: number | null;
    noiDungGoc: string;
    ghiChuQuanLy: string | null;
    danhSachMaKhach: string[];
  },
): Promise<string | null> {
  const { id, maNhanVien, maSs, reviewId, noiDungGoc, ghiChuQuanLy, danhSachMaKhach } = params;
  const { start, end } = weekBounds();

  const maKhachDauTien = danhSachMaKhach[0] ?? null;

  const { error: insertTaskError } = await supabase.from("ke_hoach_cong_viec_tuan").insert({
    tuan_bat_dau: start,
    tuan_ket_thuc: end,
    ma_nhan_vien: maNhanVien,
    noi_dung: noiDungTheoKhach(noiDungGoc, maKhachDauTien),
    han_hoan_thanh: end,
    muc_do_uu_tien: "cao",
    trang_thai: "proposed",
    nguon_tao: "ai_learning_loop",
    nguon_phan_hoi_ai_id: id,
  });
  if (insertTaskError) throw new Error(insertTaskError.message);

  for (const maKhach of danhSachMaKhach.slice(1)) {
    const { data: newRow, error: insertRowError } = await supabase
      .from("phan_hoi_hoc_tu_ai")
      .insert({
        review_id: reviewId,
        tuan_bat_dau: start,
        loai_phan_hoi: "de_xuat_ca_nhan_tuan",
        ma_nhan_vien_thuc_hien: maNhanVien,
        ma_ss: maSs,
        hanh_dong_goc: noiDungTheoKhach(noiDungGoc, maKhach),
        quyet_dinh_quan_ly: "approved",
        ghi_chu_quan_ly: ghiChuQuanLy,
        trang_thai_thuc_hien: "da_tao_task",
        trang_thai_nv: "cho_xac_nhan",
        ma_khach: maKhach,
      })
      .select("id")
      .single();
    if (insertRowError) throw new Error(insertRowError.message);

    const { error: insertTask2Error } = await supabase.from("ke_hoach_cong_viec_tuan").insert({
      tuan_bat_dau: start,
      tuan_ket_thuc: end,
      ma_nhan_vien: maNhanVien,
      noi_dung: noiDungTheoKhach(noiDungGoc, maKhach),
      han_hoan_thanh: end,
      muc_do_uu_tien: "cao",
      trang_thai: "proposed",
      nguon_tao: "ai_learning_loop",
      nguon_phan_hoi_ai_id: newRow.id,
    });
    if (insertTask2Error) throw new Error(insertTask2Error.message);
  }

  return maKhachDauTien;
}

// Duyet mot de xuat AI: chuyen sang da_tao_task va tao ngay cong viec that
// trong ke_hoach_cong_viec_tuan, cung pattern voi WF13a (nguon_tao:
// "ai_learning_loop") de khong lech convention voi tac vu tu dong. Neu
// maKhachCanTapTrung liet ke NHIEU ma khach, tu dong tach thanh nhieu dong
// khach hang - san pham rieng (xem taoCongViecTheoDanhSachKhach).
export async function approveDeXuat(id: number, maKhachCanTapTrung?: string) {
  await assertQuanLy();
  const supabase = await createClient();

  const { data: feedback, error: fetchError } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .select("id,ma_nhan_vien_thuc_hien,ma_ss,review_id,hanh_dong_goc,tuan_bat_dau")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!feedback.ma_nhan_vien_thuc_hien) {
    throw new Error("Đề xuất không có mã nhân viên thực hiện, không thể tạo việc.");
  }

  const danhSachMaKhach = trichMaKhach(maKhachCanTapTrung);
  const noiDungGoc = feedback.hanh_dong_goc ?? "Hành động đề xuất từ AI Weekly Review";

  const maKhachDauTien = await taoCongViecTheoDanhSachKhach(supabase, {
    id: feedback.id,
    maNhanVien: feedback.ma_nhan_vien_thuc_hien,
    maSs: feedback.ma_ss,
    reviewId: feedback.review_id,
    noiDungGoc,
    ghiChuQuanLy: null,
    danhSachMaKhach,
  });

  const { error: updateError } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .update({
      quyet_dinh_quan_ly: "approved",
      trang_thai_thuc_hien: "da_tao_task",
      // Mo giai doan moi: cho NV xac nhan nhan viec truoc khi SS/ASM co the
      // xac nhan ket qua (xem xacNhanKetQua ben duoi).
      trang_thai_nv: "cho_xac_nhan",
      ly_do_tu_choi_nv: null,
      thoi_gian_nv_xac_nhan: null,
      ma_khach: maKhachDauTien,
      hanh_dong_goc: noiDungTheoKhach(noiDungGoc, maKhachDauTien),
    })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/ai-review");
}

// HUY hoan toan 1 de xuat AI: khong tao cong viec, khong co NV nao phai lam
// gi ca - dung khi de xuat khong con phu hop (NV nghi viec, y tuong chung
// chung khong dung...). Ly do luu vao quyet_dinh_quan_ly, dung lam bai hoc de
// AI khong de xuat lai kieu tuong tu. Khac voi dieuChinhDeXuat ben duoi (van
// tao viec that, chi doi huong sang khach cu the).
export async function huyDeXuat(id: number, lyDo: string) {
  await assertQuanLy();
  const trimmed = lyDo.trim();
  if (!trimmed) throw new Error("Cần nhập lý do trước khi hủy đề xuất.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .update({
      quyet_dinh_quan_ly: trimmed,
      trang_thai_thuc_hien: "tieu_chi_can_dieu_chinh",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/ai-review");
}

// DIEU CHINH mot de xuat AI: khac HUY o cho VAN TAO CONG VIEC THAT cho NV
// (giong approveDeXuat), nhung thay vi giu nguyen hanh_dong_goc chung chung
// cua AI, ASM ghi de bang huong dan cu the (ghi chu) + bat buoc chi ro ma
// khach hang can tap trung. Neu liet ke NHIEU ma khach, tach thanh nhieu
// dong khach hang - san pham rieng (xem taoCongViecTheoDanhSachKhach) - moi
// dong co nut duyet/xac nhan doc lap, khong bat buoc phai xu ly ca loat.
export async function dieuChinhDeXuat(id: number, ghiChu: string, maKhachCanTapTrung: string) {
  await assertQuanLy();
  const trimmedGhiChu = ghiChu.trim();
  const danhSachMaKhach = trichMaKhach(maKhachCanTapTrung);
  if (danhSachMaKhach.length === 0) {
    throw new Error(
      "Cần nhập ít nhất 1 mã khách hàng hợp lệ (vd: P06561). Nếu không có khách cụ thể, dùng nút Duyệt thay vì Điều chỉnh.",
    );
  }

  const supabase = await createClient();

  const { data: feedback, error: fetchError } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .select("id,ma_nhan_vien_thuc_hien,ma_ss,review_id,hanh_dong_goc")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!feedback.ma_nhan_vien_thuc_hien) {
    throw new Error("Đề xuất không có mã nhân viên thực hiện, không thể tạo việc.");
  }

  const noiDungGoc = trimmedGhiChu || feedback.hanh_dong_goc || "Điều chỉnh từ đề xuất AI";

  const maKhachDauTien = await taoCongViecTheoDanhSachKhach(supabase, {
    id: feedback.id,
    maNhanVien: feedback.ma_nhan_vien_thuc_hien,
    maSs: feedback.ma_ss,
    reviewId: feedback.review_id,
    noiDungGoc,
    ghiChuQuanLy: trimmedGhiChu || null,
    danhSachMaKhach,
  });

  const { error: updateError } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .update({
      quyet_dinh_quan_ly: "approved",
      ghi_chu_quan_ly: trimmedGhiChu || null,
      ma_khach: maKhachDauTien,
      hanh_dong_goc: noiDungTheoKhach(noiDungGoc, maKhachDauTien),
      trang_thai_thuc_hien: "da_tao_task",
      trang_thai_nv: "cho_xac_nhan",
      ly_do_tu_choi_nv: null,
      thoi_gian_nv_xac_nhan: null,
    })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/ai-review");
}

// ASM tu them 1 viec moi (khong xuat phat tu de xuat AI) thang vao
// ke_hoach_cong_viec_tuan, danh dau nguon_tao = "asm_bo_sung".
export async function addManualTask(input: {
  maNhanVien: string;
  noiDung: string;
  tuanBatDau?: string;
  hanHoanThanh?: string;
  mucDoUuTien?: string;
}) {
  await assertQuanLy();
  const maNhanVien = input.maNhanVien.trim();
  const noiDung = input.noiDung.trim();
  if (!maNhanVien) throw new Error("Cần chọn nhân viên.");
  if (!noiDung) throw new Error("Cần nhập nội dung việc.");

  const { start, end } = weekBounds(input.tuanBatDau);
  const supabase = await createClient();

  const { error } = await supabase.from("ke_hoach_cong_viec_tuan").insert({
    tuan_bat_dau: input.tuanBatDau || start,
    tuan_ket_thuc: end,
    ma_nhan_vien: maNhanVien,
    noi_dung: noiDung,
    han_hoan_thanh: input.hanHoanThanh || end,
    muc_do_uu_tien: input.mucDoUuTien || "trung_binh",
    trang_thai: "proposed",
    nguon_tao: "asm_bo_sung",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/ai-review");
}

export type KhachHangRuiRo = {
  ma_khach: string;
  ten_khach: string | null;
  nhom_khach_hang: string | null;
  muc_do_rui_ro: string | null;
  trang_thai_nhip: string | null;
  ly_do_rui_ro: string | null;
  ngay_tuong_tac_gan_nhat: string | null;
  so_cong_viec_qua_han: number | null;
};

const RUI_RO_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };

// Lay danh sach khach hang rui ro/qua han cua 1 nhan vien tu nhip_khach_hang
// (loi Customer Rhythm) + ten khach tu khach_hang_master, de ASM xem chi
// tiet truoc khi duyet/bo/dieu chinh mot de xuat. Dung chung cho moi nhan
// vien — khong phu thuoc vao text de xuat cua AI.
export async function getChiTietKhachHangRuiRo(maNhanVien: string): Promise<KhachHangRuiRo[]> {
  const supabase = await createClient();

  const { data: nhip, error: nhipError } = await supabase
    .from("nhip_khach_hang")
    .select("ma_khach,muc_do_rui_ro,trang_thai_nhip,ly_do_rui_ro,ngay_tuong_tac_gan_nhat,so_cong_viec_qua_han")
    .eq("ma_nhan_vien", maNhanVien)
    .or("muc_do_rui_ro.not.is.null,trang_thai_nhip.eq.overdue")
    .limit(500);
  if (nhipError) throw new Error(nhipError.message);
  if (!nhip || nhip.length === 0) return [];

  const maKhachList = nhip.map((n) => n.ma_khach);
  const { data: master, error: masterError } = await supabase
    .from("khach_hang_master")
    .select("ma_khach,ten_khach,nhom_khach_hang")
    .in("ma_khach", maKhachList);
  if (masterError) throw new Error(masterError.message);

  const masterByCode = new Map(master?.map((m) => [m.ma_khach, m]) ?? []);

  const merged: KhachHangRuiRo[] = nhip.map((n) => ({
    ma_khach: n.ma_khach,
    ten_khach: masterByCode.get(n.ma_khach)?.ten_khach ?? null,
    nhom_khach_hang: masterByCode.get(n.ma_khach)?.nhom_khach_hang ?? null,
    muc_do_rui_ro: n.muc_do_rui_ro,
    trang_thai_nhip: n.trang_thai_nhip,
    ly_do_rui_ro: n.ly_do_rui_ro,
    ngay_tuong_tac_gan_nhat: n.ngay_tuong_tac_gan_nhat,
    so_cong_viec_qua_han: n.so_cong_viec_qua_han,
  }));

  merged.sort((a, b) => {
    const ra = RUI_RO_ORDER[a.muc_do_rui_ro ?? ""] ?? 9;
    const rb = RUI_RO_ORDER[b.muc_do_rui_ro ?? ""] ?? 9;
    if (ra !== rb) return ra - rb;
    if (a.trang_thai_nhip === "overdue" && b.trang_thai_nhip !== "overdue") return -1;
    if (b.trang_thai_nhip === "overdue" && a.trang_thai_nhip !== "overdue") return 1;
    return (a.ten_khach ?? a.ma_khach).localeCompare(b.ten_khach ?? b.ma_khach);
  });

  return merged;
}

// Xac nhan ket qua thuc te cua 1 de xuat DA DUYET: SS/ASM bao da lam va co
// thanh cong hay khong. Day la mat xich con thieu cua vong lap hoc AI - neu
// khong lam buoc nay, cot "thanh_cong" trong phan_hoi_hoc_tu_ai mai la NULL,
// WF13a khong bao gio cham diem toi da (25/25/25/25) va WF13b (tong hop bai
// hoc dai han) khong co bang chung thanh cong de rut bai hoc "nen lam".
//
// Tinh diem_ket_qua ngay tai day thay vi cho WF13a dong bo tu trang thai
// ke_hoach_cong_viec_tuan, vi lien ket qua check-call/nhip kham pha rat it
// khi tu dong dong task nay (ty le hoan thanh chung cua bang ke_hoach_cong_viec_tuan
// chi ~3%) - cho SS bao truc tiep la duong tin cay va nhanh hon nhieu.
export async function xacNhanKetQua(id: number, thanhCong: boolean, ketQuaThucTe: string) {
  await assertQuanLy();
  const trimmed = ketQuaThucTe.trim();
  if (!thanhCong && !trimmed) {
    throw new Error("Cần nhập ghi chú lý do khi đánh dấu chưa thành công.");
  }

  const supabase = await createClient();

  const { data: linkedTask } = await supabase
    .from("ke_hoach_cong_viec_tuan")
    .select("id,han_hoan_thanh")
    .eq("nguon_phan_hoi_ai_id", id)
    .maybeSingle();

  const today = new Date().toISOString().slice(0, 10);
  const dungHan = linkedTask?.han_hoan_thanh ? today <= linkedTask.han_hoan_thanh : true;
  const quaHan = linkedTask?.han_hoan_thanh ? today > linkedTask.han_hoan_thanh : false;

  // Chi cho SS/ASM xac nhan ket qua khi NV da xac nhan nhan viec, HOAC da
  // qua han ma NV chua phan hoi (leo thang - xem NvDeXuatCard/nvXacNhanNhanViec).
  // Neu NV da tu choi thi de xuat khong con o day nua (RPC nv_tu_choi_de_xuat
  // da chuyen trang_thai_thuc_hien sang tieu_chi_can_dieu_chinh).
  const { data: feedback, error: feedbackError } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .select("trang_thai_nv")
    .eq("id", id)
    .single();
  if (feedbackError) throw new Error(feedbackError.message);
  if (feedback.trang_thai_nv !== "da_xac_nhan" && !quaHan) {
    throw new Error(
      "Nhân viên chưa xác nhận nhận việc này. Chờ nhân viên xác nhận, hoặc đợi quá hạn hoàn thành để tự xác nhận thay.",
    );
  }
  // Cong thuc giu nguyen 4 tru cot x 25 diem dung nhu WF13a: da duyet (luon
  // dung o day) + da thuc hien (luon dung, vi dang xac nhan) + dung han + thanh cong.
  const diemKetQua = 25 + 25 + (dungHan ? 25 : 0) + (thanhCong ? 25 : 0);

  const { error } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .update({
      thanh_cong: thanhCong,
      da_thuc_hien: true,
      ket_qua_thuc_te: trimmed || (thanhCong ? "Thành công" : null),
      trang_thai_thuc_hien: "hoan_thanh",
      diem_ket_qua: diemKetQua,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (linkedTask?.id) {
    await supabase
      .from("ke_hoach_cong_viec_tuan")
      .update({ trang_thai: "completed" })
      .eq("id", linkedTask.id);
  }

  revalidatePath("/ai-review");
}

// Dua 1 de xuat DA DUYET (dang o muc "cho xac nhan ket qua") quay lai muc
// "cho duyet", va huy (khong xoa) cong viec da duoc tao trong
// ke_hoach_cong_viec_tuan de tranh tao trung neu duyet lai lan nua. Toan bo
// logic + kiem tra quyen (theo visible_employee_codes) nam trong RPC Postgres
// revert_de_xuat_ve_cho_duyet, chay atomically trong 1 transaction.
//
// Ly do bat buoc: duoc luu vao ly_do_chinh_sua (khac quyet_dinh_quan_ly, vi
// cot do bi null de de xuat hien lai o muc "cho duyet"), va WF13b (AI Tong
// Hop Bai Hoc Dai Han) da duoc cap nhat de doc cot nay lam bang chung ve cac
// de xuat hay bi duyet nham/sai doi tuong khi tong hop bai hoc dai han.
export async function revertDeXuat(id: number, lyDo: string) {
  const trimmed = lyDo.trim();
  if (!trimmed) throw new Error("Cần nhập lý do trước khi đưa đề xuất về chờ duyệt.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("revert_de_xuat_ve_cho_duyet", {
    p_feedback_id: id,
    p_ly_do: trimmed,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/ai-review");
}

export async function duyetWeeklyReview(id: number) {
  await assertQuanLy();
  const supabase = await createClient();
  const { error } = await supabase
    .from("nhan_dinh_ai_tuan")
    .update({ trang_thai_duyet: "approved" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ai-review");
}

// NV xac nhan NHAN VIEC (khong phai xac nhan ket qua) cho 1 de xuat da duoc
// SS/ASM duyet. Day la dieu kien de mo khoa muc "Xac nhan ket qua" cua
// SS/ASM (xem guard trong xacNhanKetQua o tren) - tach biet ro giua "NV cam
// ket se lam" va "SS/ASM xac nhan ket qua thuc te". RLS (scoped update tren
// phan_hoi_hoc_tu_ai) da tu gioi han chi NV/SS/ASM lien quan moi update duoc.
export async function nvXacNhanNhanViec(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .update({ trang_thai_nv: "da_xac_nhan", thoi_gian_nv_xac_nhan: new Date().toISOString() })
    .eq("id", id)
    .eq("trang_thai_thuc_hien", "da_tao_task")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Không tìm thấy đề xuất này hoặc bạn không có quyền xác nhận.");
  revalidatePath("/ai-review");
}

// NV TU CHOI 1 de xuat da duyet, kem ly do bat buoc de AI hoc lai. Chuyen
// thang sang muc "Da xu ly gan day" (tieu_chi_can_dieu_chinh), huy task da
// tao - khac voi "Chinh sua" (revertDeXuat) la dua ve lai "cho duyet" de
// SS/ASM xem lai. Toan bo logic + kiem tra quyen nam trong RPC
// nv_tu_choi_de_xuat, chay atomically.
export async function nvTuChoiDeXuat(id: number, lyDo: string) {
  const trimmed = lyDo.trim();
  if (!trimmed) throw new Error("Cần nhập lý do trước khi từ chối đề xuất.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("nv_tu_choi_de_xuat", {
    p_feedback_id: id,
    p_ly_do: trimmed,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/ai-review");
}

export type ChamCongDoiChieu = {
  ma_khach: string | null;
  ten_khach_hang: string | null;
  ten_nhiem_vu: string | null;
  bao_cao: string | null;
  ket_qua: string | null;
  thoi_gian_checkin: string | null;
};

// Lay danh sach chi tiet cham cong (check-in/bao_cao) cua 1 NV trong khoang
// ngay cua 1 cong viec, de SS/ASM doi chieu bang mat truoc khi xac nhan ket
// qua - khong khop theo ma khach/san pham cu the (xem trao doi thiet ke:
// phan_hoi_hoc_tu_ai khong co cot ma khach chuan hoa de khop chinh xac).
export async function getChamCongTrongTuan(
  maNhanVien: string,
  tuanBatDau: string,
  hanHoanThanh: string,
): Promise<ChamCongDoiChieu[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("Du lieu cham cong thang hien tai")
    .select("ma_khach,ten_khach_hang,ten_nhiem_vu,bao_cao,ket_qua,thoi_gian_checkin")
    .eq("ma_nhan_vien", maNhanVien)
    .gte("thoi_gian_checkin", `${tuanBatDau}T00:00:00`)
    .lte("thoi_gian_checkin", `${hanHoanThanh}T23:59:59`)
    .order("thoi_gian_checkin", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as ChamCongDoiChieu[];
}

export type DonHangDoiChieu = {
  ma_khach: string | null;
  ten_khach: string | null;
  ten_mat_hang: string | null;
  so_luong: number | null;
  gia_ban: number | null;
  doanh_thu: number | null;
  ngay: string | null;
  kenh: string | null;
};

// Lay danh sach don hang thuc te cua 1 NV trong khoang ngay cua 1 cong viec,
// de SS/ASM doi chieu voi doanh thu phat sinh truoc khi xac nhan ket qua.
//
// Doc ca 2 bang vi khong bang nao 1 minh du du lieu:
// - "Du lieu sale thang hien tai": chi co du lieu THANG HIEN TAI (bi xoa &
//   nap lai moi lan dong bo), nhung la nguon DUY NHAT co don hang moi phat
//   sinh trong thang dang chay.
// - "Du lieu sale tong": luu lich su nhieu thang nhung dong bo co do tre -
//   thuc te no dang dung lai o cuoi thang truoc, chua co du lieu thang nay
//   (da kiem tra truc tiep: max(ngay) la ngay cuoi thang truoc tai thoi diem
//   viet ham nay). Van giu de doi chieu duoc cac cong viec cua thang cu.
//
// Gop ca hai, khong khop theo ma khach/san pham cu the vi ly do tuong tu
// getChamCongTrongTuan o tren.
export async function getDonHangTrongTuan(
  maNhanVien: string,
  tuanBatDau: string,
  hanHoanThanh: string,
): Promise<DonHangDoiChieu[]> {
  const supabase = await createClient();
  const cols = "ma_khach,ten_khach,ten_mat_hang,so_luong,gia_ban,doanh_thu,ngay,kenh";

  const [thangHienTai, tong] = await Promise.all([
    supabase
      .from("Du lieu sale thang hien tai")
      .select(cols)
      .eq("ma_nhan_vien", maNhanVien)
      .gte("ngay", tuanBatDau)
      .lte("ngay", hanHoanThanh)
      .limit(200),
    supabase
      .from("Du lieu sale tong")
      .select(cols)
      .eq("ma_nhan_vien", maNhanVien)
      .gte("ngay", tuanBatDau)
      .lte("ngay", hanHoanThanh)
      .limit(200),
  ]);
  if (thangHienTai.error) throw new Error(thangHienTai.error.message);
  if (tong.error) throw new Error(tong.error.message);

  const rows = mergeSaleRowsByMonth(
    (tong.data ?? []) as DonHangDoiChieu[],
    (thangHienTai.data ?? []) as DonHangDoiChieu[],
  );
  rows.sort((a, b) => (b.ngay ?? "").localeCompare(a.ngay ?? ""));
  return rows.slice(0, 200);
}
