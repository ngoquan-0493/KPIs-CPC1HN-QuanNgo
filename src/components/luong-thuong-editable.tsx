"use client";

import { useState, useTransition } from "react";
import { capNhatLoaiHopDong, capNhatLuongCung } from "@/app/(app)/luong-thuong/actions";

const inputClass =
  "w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";
const selectClass =
  "rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

// O nhap "Luong cung" - chi ASM thay duoc component nay (page chi render no
// khi laAsm=true), RLS + server action van la lop chan quyen thuc su. Luu
// khi roi khoi o (onBlur) thay vi tung phim go, tranh spam request.
export function LuongCungInput({
  maNhanVien,
  giaTriBanDau,
}: {
  maNhanVien: string;
  giaTriBanDau: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(giaTriBanDau != null ? String(giaTriBanDau) : "");
  const [error, setError] = useState<string | null>(null);
  const [daLuu, setDaLuu] = useState(false);

  function luu() {
    setError(null);
    setDaLuu(false);
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed.replace(/[.,\s]/g, ""));
    if (trimmed !== "" && (parsed == null || !Number.isFinite(parsed))) {
      setError("Số không hợp lệ.");
      return;
    }
    startTransition(async () => {
      try {
        await capNhatLuongCung(maNhanVien, parsed);
        setDaLuu(true);
        setTimeout(() => setDaLuu(false), 1500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  return (
    <div className="text-right">
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={pending}
        placeholder="Chưa nhập"
        onChange={(e) => setValue(e.target.value)}
        onBlur={luu}
        className={inputClass}
      />
      {pending && <p className="mt-0.5 text-[11px] text-slate-400">Đang lưu...</p>}
      {!pending && daLuu && <p className="mt-0.5 text-[11px] text-emerald-600">Đã lưu</p>}
      {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

// Dropdown "Loai hop dong" - chi ASM thay (xem ghi chu tren). Danh dau thu
// viec THU CONG (khong suy luan tu ngay vao lam) vi 1 NV/SS co the thu viec
// LAI neu khong dat chi tieu, theo yeu cau ASM.
export function LoaiHopDongSelect({
  maNhanVien,
  giaTriBanDau,
}: {
  maNhanVien: string;
  giaTriBanDau: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<"Chính thức" | "Thử việc">(
    giaTriBanDau === "Thử việc" ? "Thử việc" : "Chính thức",
  );
  const [error, setError] = useState<string | null>(null);

  function doi(next: "Chính thức" | "Thử việc") {
    setError(null);
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await capNhatLoaiHopDong(maNhanVien, next);
      } catch (e) {
        setValue(prev);
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      }
    });
  }

  return (
    <div>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => doi(e.target.value as "Chính thức" | "Thử việc")}
        className={selectClass}
      >
        <option value="Chính thức">Chính thức</option>
        <option value="Thử việc">Thử việc</option>
      </select>
      {error && <p className="mt-0.5 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
