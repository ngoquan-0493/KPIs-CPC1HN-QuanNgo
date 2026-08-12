"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ghepTenMa } from "@/lib/display";

type DetailRow = {
  ma_khach: string;
  san_pham: string;
  so_luong: number;
};

export default function CodeMoiDetail({
  maNhanVien,
  ketQua,
  thangDanhGia,
}: {
  maNhanVien: string;
  ketQua: string;
  thangDanhGia: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DetailRow[] | null>(null);
  const [tenKhachByMa, setTenKhachByMa] = useState<Map<string, string>>(new Map());

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
      .from("chi_tiet_code_moi")
      .select("ma_khach,san_pham,so_luong")
      .ilike("ma_nhan_vien", `%${maNhanVien.replace(/\D/g, "")}%`)
      .eq("thang_danh_gia", thangDanhGia)
      .order("ma_khach", { ascending: true });
    const detailRows = (data as DetailRow[]) ?? [];
    setRows(detailRows);
    // chi_tiet_code_moi khong co ten_khach - tra cuu them tu khach_hang_master
    // de hien cap Ma khach - Ten khach thay vi chi hien ma tho.
    const maList = Array.from(new Set(detailRows.map((r) => r.ma_khach).filter(Boolean)));
    if (maList.length > 0) {
      const { data: khachData } = await supabase
        .from("khach_hang_master")
        .select("ma_khach,ten_khach")
        .in("ma_khach", maList);
      const map = new Map<string, string>();
      for (const k of (khachData ?? []) as { ma_khach: string; ten_khach: string | null }[]) {
        if (k.ten_khach) map.set(k.ma_khach, k.ten_khach);
      }
      setTenKhachByMa(map);
    }
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
            <p className="text-slate-400">Chưa có mã khách mới nào đóng góp vào kết quả này.</p>
          )}
          {!loading && rows && rows.length > 0 && (
            <table className="data-table w-full text-left">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 pr-2 font-medium">Mã khách</th>
                  <th className="py-1 pr-2 font-medium">Sản phẩm</th>
                  <th className="py-1 font-medium">Số lượng</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="py-1 pr-2 text-slate-900">
                      {ghepTenMa(tenKhachByMa.get(r.ma_khach), r.ma_khach)}
                    </td>
                    <td className="py-1 pr-2 text-slate-700">{r.san_pham}</td>
                    <td className="py-1 text-slate-700">{r.so_luong}</td>
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
