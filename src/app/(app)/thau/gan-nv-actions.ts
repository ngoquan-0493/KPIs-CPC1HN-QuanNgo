"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentEmployee } from "@/lib/current-employee";
import { revalidatePath } from "next/cache";

// File bao cao thau (nguon Google Sheet) KHONG co cot "Nhan vien phu trach" -
// toan bo 6.8xx dong deu trong. Vi vay nguoi phu trach tung hop dong do
// SS/ASM gan tay tren web va luu vao thau_hop_dong.ma_nhan_vien_phu_trach.
// Cot nay KHONG bao gio bi workflow import ghi de (cau lenh upsert co tinh
// khong dung toi cot nay), nen gan 1 lan la giu vinh vien qua cac ky import.
export async function ganNhanVienPhuTrachHopDong(input: {
  hopDongId: number;
  maNhanVien: string | null;
}) {
  const employee = await getCurrentEmployee();
  if (!employee) throw new Error("Không xác định được nhân viên đang đăng nhập.");

  const viTri = employee["Vị trí"];
  if (viTri !== "SS" && viTri !== "ASM") {
    throw new Error("Chỉ SS/ASM mới được gán người phụ trách hợp đồng thầu.");
  }

  const supabase = await createClient();
  const maNhanVien = input.maNhanVien?.trim() || null;

  // Tra ma SS tuong ung de luu kem - phuc vu loc theo nhom SS tren trang Thau
  // ma khong phai join lai moi lan doc.
  let maSs: string | null = null;
  if (maNhanVien) {
    const { data } = await supabase
      .from("Danh sach nhan vien")
      .select("ma_ss")
      .eq("ma_nhan_vien", maNhanVien)
      .limit(1)
      .maybeSingle();
    maSs = (data as { ma_ss: string | null } | null)?.ma_ss ?? null;
  }

  const { error } = await supabase
    .from("thau_hop_dong")
    .update({
      ma_nhan_vien_phu_trach: maNhanVien,
      ma_ss_phu_trach: maSs,
      nguoi_gan: employee["Mã nhân viên"],
      ngay_gan: new Date().toISOString(),
    })
    .eq("id", input.hopDongId);

  if (error) throw new Error(error.message);

  revalidatePath("/thau");
}
