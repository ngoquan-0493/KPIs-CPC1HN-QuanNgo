"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import { revalidatePath } from "next/cache";

// Module Luong - Thuong: chi ASM duoc nhap "Luong cung" / "Loai hop dong"
// (2 truong nhap tay, dung lam dau vao tinh luong/xet dieu kien thuong thu
// viec). Chan quyen o TANG SERVER truoc, RLS ("asm update luong thuong" tren
// "Danh sach nhan vien" - xem migration add_luong_thuong_module) la lop chan
// thu 2 - cung pattern voi kpi/build-actions.ts, customers/theo-doi-actions.ts.
async function assertAsm(): Promise<void> {
  const employee = await getCurrentEmployee();
  if (employee?.["Vị trí"] !== "ASM") {
    throw new Error("Chỉ ASM mới có quyền cập nhật Lương cứng / Loại hợp đồng.");
  }
}

export async function capNhatLuongCung(maNhanVien: string, luongCung: number | null) {
  await assertAsm();

  if (luongCung != null && (!Number.isFinite(luongCung) || luongCung < 0)) {
    throw new Error("Lương cứng phải là số không âm.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("Danh sach nhan vien")
    .update({ luong_cung: luongCung })
    .eq("ma_nhan_vien", maNhanVien);

  if (error) throw new Error(error.message);
  revalidatePath("/luong-thuong");
}

export async function capNhatLoaiHopDong(
  maNhanVien: string,
  loaiHopDong: "Chính thức" | "Thử việc",
) {
  await assertAsm();

  if (loaiHopDong !== "Chính thức" && loaiHopDong !== "Thử việc") {
    throw new Error("Loại hợp đồng không hợp lệ.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("Danh sach nhan vien")
    .update({ loai_hop_dong: loaiHopDong })
    .eq("ma_nhan_vien", maNhanVien);

  if (error) throw new Error(error.message);
  revalidatePath("/luong-thuong");
}
