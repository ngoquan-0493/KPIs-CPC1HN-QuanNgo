"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import { revalidatePath } from "next/cache";
import { weekBoundsTheoDoi, type MucDoCanhBao } from "@/lib/week-bounds-theo-doi";

function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || code || "";
}

// Xac dinh NV se duoc tick vao ke hoach: mac dinh la chinh nguoi goi. Neu
// truyen maNhanVienMucTieu khac chinh minh (SS/ASM giao viec thay cho NV duoi
// quyen), bat buoc nguoi goi phai la SS/ASM - chan som o day de bao loi ro
// rang, RLS (scoped insert/delete theo visible_employee_codes()) van la lop
// chan cuoi cung neu code nay bi bo qua.
async function xacDinhNguoiThucHien(maNhanVienMucTieu?: string) {
  const employee = await getCurrentEmployee();
  if (!employee) throw new Error("Không xác định được nhân viên đang đăng nhập.");

  const maChinhMinh = employee["Mã nhân viên"];
  const target = maNhanVienMucTieu?.trim() || maChinhMinh;
  const laGiaoThay = normCode(target) !== normCode(maChinhMinh);

  if (laGiaoThay && employee["Vị trí"] !== "SS" && employee["Vị trí"] !== "ASM") {
    throw new Error("Chỉ SS/ASM mới có quyền giao việc thay cho nhân viên khác.");
  }

  return { maChinhMinh, target, giaoBoi: laGiaoThay ? maChinhMinh : null };
}

// Dua 1 cap khach-san pham can theo doi vao ke hoach tuan hien tai - hoac NV
// tu tick cho chinh minh, hoac SS/ASM tick thay cho 1 NV duoi quyen ("giao
// viec" - khong can NV xac nhan lai, vao ke hoach ngay theo yeu cau).
export async function dinhVaoKeHoachTuan(input: {
  maKhach: string;
  tenKhach: string | null;
  maSanPham: string;
  tenSanPham: string | null;
  mucDoCanhBao: MucDoCanhBao;
  thangDanhGia: string | null;
  maNhanVienMucTieu?: string;
}) {
  const { target, giaoBoi } = await xacDinhNguoiThucHien(input.maNhanVienMucTieu);

  const { start, end } = weekBoundsTheoDoi();
  const supabase = await createClient();

  const { error } = await supabase.from("khach_hang_theo_doi_ke_hoach").upsert(
    {
      ma_nhan_vien: target,
      ma_khach: input.maKhach,
      ten_khach: input.tenKhach,
      ma_san_pham: input.maSanPham,
      ten_san_pham: input.tenSanPham,
      muc_do_canh_bao: input.mucDoCanhBao,
      thang_danh_gia: input.thangDanhGia,
      tuan_bat_dau: start,
      tuan_ket_thuc: end,
      trang_thai: "da_len_ke_hoach",
      giao_boi: giaoBoi,
    },
    { onConflict: "ma_khach,ma_san_pham,tuan_bat_dau" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/customers");
}

// Bo 1 dong da tick ra khoi ke hoach tuan (NV doi y/tick nham, hoac SS/ASM bo
// mot viec da giao). maSanPham luon la string (co the rong "") - khong dung
// null de tranh vuong mac voi .eq() tren cot nullable.
export async function boKhoiKeHoachTuan(maKhach: string, maSanPham: string, maNhanVienMucTieu?: string) {
  const { target } = await xacDinhNguoiThucHien(maNhanVienMucTieu);

  const { start } = weekBoundsTheoDoi();
  const supabase = await createClient();

  const { error } = await supabase
    .from("khach_hang_theo_doi_ke_hoach")
    .delete()
    .eq("ma_nhan_vien", target)
    .eq("ma_khach", maKhach)
    .eq("tuan_bat_dau", start)
    .eq("ma_san_pham", maSanPham);
  if (error) throw new Error(error.message);

  revalidatePath("/customers");
}
