"use client";

import { useState, useTransition } from "react";
import { dinhVaoKeHoachTuan, boKhoiKeHoachTuan } from "@/app/(app)/customers/theo-doi-actions";
import type { MucDoCanhBao } from "@/lib/week-bounds-theo-doi";

// Nut tick "Dua vao ke hoach tuan" cho 1 cap khach-san pham trong tab "Khach
// hang can theo doi". 3 che do hien thi tuy nguoi dang xem:
// - NV xem dong cua chinh minh: checkbox tu tick nhu binh thuong.
// - SS/ASM xem dong cua 1 NV duoi quyen: nut "Giao cho NV" (tick THAY, vao
//   ke hoach ngay, khong can NV xac nhan lai - theo yeu cau nguoi dung).
// - Con lai (vd NV xem dong khong phai cua minh - khong nen xay ra vi canh
//   bao da gan san theo ma_nhan_vien): read-only.
export default function TheoDoiToggle({
  maKhach,
  tenKhach,
  maSanPham,
  tenSanPham,
  mucDoCanhBao,
  thangDanhGia,
  maNhanVienMucTieu,
  daLenKeHoach,
  daViengTham,
  giaoBoi,
  chePDo,
}: {
  maKhach: string;
  tenKhach: string | null;
  maSanPham: string;
  tenSanPham: string | null;
  mucDoCanhBao: MucDoCanhBao;
  thangDanhGia: string | null;
  maNhanVienMucTieu: string;
  daLenKeHoach: boolean;
  daViengTham: boolean;
  giaoBoi: string | null;
  chePDo: "tu_tick" | "giao_viec" | "chi_xem";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(daLenKeHoach);

  function toggle() {
    setError(null);
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      try {
        if (next) {
          await dinhVaoKeHoachTuan({
            maKhach,
            tenKhach,
            maSanPham,
            tenSanPham,
            mucDoCanhBao,
            thangDanhGia,
            maNhanVienMucTieu,
          });
        } else {
          await boKhoiKeHoachTuan(maKhach, maSanPham, maNhanVienMucTieu);
        }
      } catch (e) {
        setChecked(!next);
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  const nhanTrangThai = checked
    ? daViengTham
      ? "Đã lên kế hoạch · đã ghé thăm"
      : giaoBoi
        ? "SS/ASM đã giao · chờ ghé thăm"
        : "Đã lên kế hoạch tuần này"
    : null;

  if (chePDo === "chi_xem") {
    return checked ? (
      <span className="text-xs font-medium text-emerald-600">{nhanTrangThai}</span>
    ) : (
      <span className="text-xs text-slate-400">Chưa lên kế hoạch</span>
    );
  }

  if (chePDo === "giao_viec") {
    if (checked) {
      return (
        <div className="text-right">
          <p className="text-xs font-medium text-emerald-600">{nhanTrangThai}</p>
          <button
            onClick={toggle}
            disabled={pending}
            className="mt-0.5 cursor-pointer text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-600 disabled:opacity-50"
          >
            Bỏ giao
          </button>
          {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
        </div>
      );
    }
    return (
      <div className="text-right">
        <button
          onClick={toggle}
          disabled={pending}
          className="cursor-pointer rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {pending ? "Đang giao..." : "Giao cho NV"}
        </button>
        {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          disabled={pending}
          onChange={toggle}
          className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-700 focus:ring-blue-500/30"
        />
        {checked ? nhanTrangThai : "Đưa vào kế hoạch tuần"}
      </label>
      {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
