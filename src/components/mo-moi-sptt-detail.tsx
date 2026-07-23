"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ghepTenMa } from "@/lib/display";

type DetailRow = {
  ma_khach: string;
  loai: string;
  nv_ban_lan_cuoi: string | null;
  ngay_ban_gan_nhat: string | null;
  so_luong: number;
};

// Dung chung cho ca "Mo moi SPTT" (bang chi_tiet_mo_moi_sptt) va "Mo moi"
// (bang chi_tiet_mo_moi) - 2 chi tieu nay dung chung 1 cong thuc tinh (khach
// moi / khach ngu dong hoi sinh mua san pham), chi khac pham vi san pham
// (trong tam vs tat ca), nen chia se luon UI xem chi tiet.
export default function MoMoiSpttDetail({
  maNhanVien,
  sanPham,
  ketQua,
  thangDanhGia,
  table = "chi_tiet_mo_moi_sptt",
}: {
  maNhanVien: string;
  sanPham: string;
  ketQua: string;
  thangDanhGia: string;
  table?: "chi_tiet_mo_moi_sptt" | "chi_tiet_mo_moi";
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[] | null>(null);
  const [tenKhachByMa, setTenKhachByMa] = useState<Map<string, string>>(new Map());
  const [tenNvByMa, setTenNvByMa] = useState<Map<string, string>>(new Map());

  async function handleClick() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (rows !== null) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from(table)
      .select("ma_khach,loai,nv_ban_lan_cuoi,ngay_ban_gan_nhat,so_luong")
      .ilike("ma_nhan_vien", `%${maNhanVien.replace(/\D/g, "")}%`)
      .ilike("san_pham", sanPham)
      .eq("thang_danh_gia", thangDanhGia)
      .order("so_luong", { ascending: false });
    const detailRows = (data as DetailRow[]) ?? [];
    setRows(detailRows);
    // chi_tiet_mo_moi_sptt khong co ten_khach - tra cuu khach_hang_master de
    // hien cap Ma khach - Ten khach; nv_ban_lan_cuoi la ma NV tho (vd
    // "018815") - tra cuu them Danh sach nhan vien de hien cap Ten - Ma.
    const maKhachList = Array.from(new Set(detailRows.map((r) => r.ma_khach).filter(Boolean)));
    const maNvList = Array.from(
      new Set(detailRows.map((r) => r.nv_ban_lan_cuoi).filter((v): v is string => !!v)),
    );
    const [khachRes, nvRes] = await Promise.all([
      maKhachList.length > 0
        ? supabase.from("khach_hang_master").select("ma_khach,ten_khach").in("ma_khach", maKhachList)
        : Promise.resolve({ data: [] }),
      maNvList.length > 0
        ? supabase
            .from("Danh sach nhan vien")
            .select("ma_nhan_vien,ten_nhan_vien")
            .in("ma_nhan_vien", maNvList)
        : Promise.resolve({ data: [] }),
    ]);
    const khachMap = new Map<string, string>();
    for (const k of (khachRes.data ?? []) as { ma_khach: string; ten_khach: string | null }[]) {
      if (k.ten_khach) khachMap.set(k.ma_khach, k.ten_khach);
    }
    setTenKhachByMa(khachMap);
    const nvMap = new Map<string, string>();
    for (const n of (nvRes.data ?? []) as { ma_nhan_vien: string; ten_nhan_vien: string | null }[]) {
      if (n.ten_nhan_vien) nvMap.set(n.ma_nhan_vien, n.ten_nhan_vien);
    }
    setTenNvByMa(nvMap);
    setLoading(false);
  }

  const color =
    ketQua === "Đạt"
      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
      : ketQua === "Không đạt"
        ? "bg-red-100 text-red-700 hover:bg-red-200"
        : "bg-amber-100 text-amber-700 hover:bg-amber-200";

  return (
    <div>
      <button
        onClick={handleClick}
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
      >
        {ketQua || "Chưa tính"}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs">
          {loading && <p className="text-slate-400">Đang tải...</p>}
          {!loading && rows && rows.length === 0 && (
            <p className="text-slate-400">Chưa có khách hàng nào đóng góp vào kết quả này.</p>
          )}
          {!loading && rows && rows.length > 0 && (
            <table className="data-table w-full text-left">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 pr-2 font-medium">Mã khách</th>
                  <th className="py-1 pr-2 font-medium">Loại</th>
                  <th className="py-1 pr-2 font-medium">Số lượng</th>
                  <th className="py-1 font-medium">NV bán lần cuối / Ngày</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="py-1 pr-2 text-slate-900">
                      {ghepTenMa(tenKhachByMa.get(r.ma_khach), r.ma_khach)}
                    </td>
                    <td className="py-1 pr-2 text-slate-700">{r.loai}</td>
                    <td className="py-1 pr-2 text-slate-700">{r.so_luong}</td>
                    <td className="py-1 text-slate-500">
                      {r.nv_ban_lan_cuoi
                        ? `${ghepTenMa(tenNvByMa.get(r.nv_ban_lan_cuoi), r.nv_ban_lan_cuoi)} · ${r.ngay_ban_gan_nhat}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
