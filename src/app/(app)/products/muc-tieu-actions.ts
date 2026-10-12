"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { LapDonCap, LapDonNgoai } from "@/lib/muc-tieu-quy";

// Server Action cho tab "Muc tieu quy". Moi ham TRA VE { error } thay vi throw - Next.js production
// an noi dung that cua loi bi throw tu Server Action (xem GHI-CHU-VAN-HANH / bug 25/9/2026).
// Quyen that su duoc kiem tra trong cac ham Postgres (chi ASM duoc ghi), day chi la lop chuyen tiep.

function thongBao(e: unknown) {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  return "Có lỗi không xác định, vui lòng thử lại.";
}

function lamMoi() {
  try {
    revalidatePath("/products");
  } catch (e) {
    console.error("revalidatePath /products failed", e);
  }
}

export async function taoNhapMucTieuQuy(input: { nam: number; quy: number; tyLe: number }): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("tao_nhap_muc_tieu_quy", {
      p_nam: input.nam,
      p_quy: input.quy,
      p_ty_le: input.tyLe,
    });
    if (error) return { error: thongBao(error) };
    lamMoi();
    return {};
  } catch (e) {
    return { error: thongBao(e) };
  }
}

export async function capNhatTyLeMucTieuQuy(input: { nam: number; quy: number; tyLe: number }): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cap_nhat_ty_le_muc_tieu_quy", {
      p_nam: input.nam,
      p_quy: input.quy,
      p_ty_le: input.tyLe,
    });
    if (error) return { error: thongBao(error) };
    lamMoi();
    return {};
  } catch (e) {
    return { error: thongBao(e) };
  }
}

export async function loaiTruSanPhamQuy(input: {
  nam: number;
  quy: number;
  maChuan: string;
  loaiTru: boolean;
  ghiChu?: string;
}): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("loai_tru_san_pham_quy", {
      p_nam: input.nam,
      p_quy: input.quy,
      p_ma_chuan: input.maChuan,
      p_loai_tru: input.loaiTru,
      p_ghi_chu: input.ghiChu ?? null,
    });
    if (error) return { error: thongBao(error) };
    lamMoi();
    return {};
  } catch (e) {
    return { error: thongBao(e) };
  }
}

export async function chotMucTieuQuy(input: { nam: number; quy: number }): Promise<{ error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("chot_muc_tieu_quy", { p_nam: input.nam, p_quy: input.quy });
    if (error) return { error: thongBao(error) };
    lamMoi();
    return {};
  } catch (e) {
    return { error: thongBao(e) };
  }
}

// Phan B: khach lap don cua 1 san pham (tai khi mo dong).
export async function layLapDonQuy(input: {
  nam: number;
  quy: number;
  maChuan: string;
  ss: string | null;
}): Promise<{ error?: string; pairs?: LapDonCap[]; ngoai?: LapDonNgoai[] }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_lap_don_quy", {
      p_nam: input.nam,
      p_quy: input.quy,
      p_ma_chuan: input.maChuan,
      p_ss: input.ss,
    });
    if (error) return { error: thongBao(error) };
    const j = (data ?? {}) as { pairs?: LapDonCap[]; ngoai?: LapDonNgoai[] };
    return { pairs: j.pairs ?? [], ngoai: j.ngoai ?? [] };
  } catch (e) {
    return { error: thongBao(e) };
  }
}
