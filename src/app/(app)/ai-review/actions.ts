"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

// Duyet mot de xuat AI: chuyen sang da_tao_task va tao ngay 1 dong cong viec
// that trong ke_hoach_cong_viec_tuan, cung pattern voi WF13a (nguon_tao:
// "ai_learning_loop") de khong lech convention voi tac vu tu dong.
export async function approveDeXuat(id: number) {
  const supabase = await createClient();

  const { data: feedback, error: fetchError } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .select("id,ma_nhan_vien_thuc_hien,hanh_dong_goc,tuan_bat_dau")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (!feedback.ma_nhan_vien_thuc_hien) {
    throw new Error("Đề xuất không có mã nhân viên thực hiện, không thể tạo việc.");
  }

  const { start, end } = weekBounds(feedback.tuan_bat_dau);

  const { error: insertError } = await supabase.from("ke_hoach_cong_viec_tuan").insert({
    tuan_bat_dau: start,
    tuan_ket_thuc: end,
    ma_nhan_vien: feedback.ma_nhan_vien_thuc_hien,
    noi_dung: feedback.hanh_dong_goc,
    han_hoan_thanh: end,
    muc_do_uu_tien: "cao",
    trang_thai: "proposed",
    nguon_tao: "ai_learning_loop",
    nguon_phan_hoi_ai_id: feedback.id,
  });
  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from("phan_hoi_hoc_tu_ai")
    .update({ quyet_dinh_quan_ly: "approved", trang_thai_thuc_hien: "da_tao_task" })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/ai-review");
}

// Bo / dieu chinh mot de xuat AI: luu ly do vao quyet_dinh_quan_ly (text tu
// do), khong tao cong viec. Ly do nay se duoc dung lam bai hoc de AI khong
// de xuat lai kieu tuong tu.
export async function adjustDeXuat(id: number, lyDo: string) {
  const trimmed = lyDo.trim();
  if (!trimmed) throw new Error("Cần nhập lý do trước khi bỏ/điều chỉnh đề xuất.");

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

// ASM tu them 1 viec moi (khong xuat phat tu de xuat AI) thang vao
// ke_hoach_cong_viec_tuan, danh dau nguon_tao = "asm_bo_sung".
export async function addManualTask(input: {
  maNhanVien: string;
  noiDung: string;
  tuanBatDau?: string;
  hanHoanThanh?: string;
  mucDoUuTien?: string;
}) {
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

export async function duyetWeeklyReview(id: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("nhan_dinh_ai_tuan")
    .update({ trang_thai_duyet: "approved" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/ai-review");
}
