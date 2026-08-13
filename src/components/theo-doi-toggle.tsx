"use client";

import { useState, useTransition } from "react";
import { dinhVaoKeHoachTuan, boKhoiKeHoachTuan } from "@/app/(app)/customers/theo-doi-actions";
import { ghepTenMa } from "@/lib/display";
import type { MucDoCanhBao } from "@/lib/week-bounds-theo-doi";

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

// Nut tick "Dua vao ke hoach tuan" cho 1 cap khach-san pham trong tab "Khach
// hang can theo doi". 3 che do hien thi tuy nguoi dang xem:
// - NV xem dong cua chinh minh: checkbox tu tick nhu binh thuong.
// - SS/ASM xem dong cua 1 NV duoi quyen: dropdown chon NV trong CUNG nhom SS
//   de "giao viec" (tick THAY, vao ke hoach ngay, khong can NV xac nhan lai -
//   theo yeu cau nguoi dung). Ly do co dropdown thay vi luon giao co dinh cho
//   NV goc: rat nhieu truong hop khach-san pham qua han la do NV goc phu
//   trach DA NGHI VIEC, ASM/SS can giao lai cho 1 NV khac dang hoat dong.
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
  nvDaGiao,
  tenNvDaGiao,
  danhSachNv,
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
  // NV DANG THUC SU duoc giao cho cap khach-san pham nay tuan nay (co the
  // khac maNhanVienMucTieu neu SS/ASM da giao lai truoc do) + ten hien thi.
  nvDaGiao: string;
  tenNvDaGiao: string | null;
  // Danh sach NV co the chon de giao (cung nhom SS voi NV goc phu trach).
  danhSachNv: { code: string; name: string }[];
  daLenKeHoach: boolean;
  daViengTham: boolean;
  giaoBoi: string | null;
  chePDo: "tu_tick" | "giao_viec" | "chi_xem";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(daLenKeHoach);
  const [assignedTo, setAssignedTo] = useState(nvDaGiao);
  const [selectedNv, setSelectedNv] = useState(
    danhSachNv.some((nv) => nv.code === nvDaGiao) ? nvDaGiao : "",
  );
  const [dangSuaNv, setDangSuaNv] = useState(false);

  // Che do "tu_tick": NV tu tick/bo tick cho chinh minh.
  function toggleTuTick() {
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

  // Che do "giao_viec": SS/ASM giao (hoac giao lai) cho 1 NV cu the trong
  // dropdown - KHONG bat buoc phai la NV goc phu trach khach hang nay.
  function giaoChoNv(nvCode: string) {
    if (!nvCode) return;
    setError(null);
    startTransition(async () => {
      try {
        await dinhVaoKeHoachTuan({
          maKhach,
          tenKhach,
          maSanPham,
          tenSanPham,
          mucDoCanhBao,
          thangDanhGia,
          maNhanVienMucTieu: nvCode,
        });
        setChecked(true);
        setAssignedTo(nvCode);
        setDangSuaNv(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  function boGiao() {
    setError(null);
    startTransition(async () => {
      try {
        await boKhoiKeHoachTuan(maKhach, maSanPham, assignedTo);
        setChecked(false);
        setDangSuaNv(false);
      } catch (e) {
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
    // Chua giao (hoac dang bam "Doi NV" de giao lai): hien dropdown + nut Giao.
    if (!checked || dangSuaNv) {
      return (
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <select
              value={selectedNv}
              disabled={pending}
              onChange={(e) => setSelectedNv(e.target.value)}
              className={selectClass}
            >
              <option value="">Chọn NV để giao...</option>
              {danhSachNv.map((nv) => (
                <option key={nv.code} value={nv.code}>
                  {ghepTenMa(nv.name, nv.code)}
                </option>
              ))}
            </select>
            <button
              onClick={() => giaoChoNv(selectedNv)}
              disabled={pending || !selectedNv}
              className="cursor-pointer rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Đang giao..." : "Giao"}
            </button>
            {checked && (
              <button
                onClick={() => setDangSuaNv(false)}
                disabled={pending}
                className="cursor-pointer text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-600"
              >
                Hủy
              </button>
            )}
          </div>
          {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
        </div>
      );
    }

    // Da giao: hien trang thai + ten NV dang duoc giao + doi NV / bo giao.
    return (
      <div className="text-right">
        <p className="text-xs font-medium text-emerald-600">{nhanTrangThai}</p>
        <p className="text-[11px] text-slate-400">NV: {ghepTenMa(tenNvDaGiao, assignedTo)}</p>
        <div className="mt-0.5 flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setSelectedNv(danhSachNv.some((nv) => nv.code === assignedTo) ? assignedTo : "");
              setDangSuaNv(true);
            }}
            disabled={pending}
            className="cursor-pointer text-[11px] text-blue-600 underline decoration-dotted hover:text-blue-800 disabled:opacity-50"
          >
            Đổi NV
          </button>
          <button
            onClick={boGiao}
            disabled={pending}
            className="cursor-pointer text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-600 disabled:opacity-50"
          >
            Bỏ giao
          </button>
        </div>
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
          onChange={toggleTuTick}
          className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-700 focus:ring-blue-500/30"
        />
        {checked ? nhanTrangThai : "Đưa vào kế hoạch tuần"}
      </label>
      {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
