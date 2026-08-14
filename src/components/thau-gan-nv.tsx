"use client";

import { useState, useTransition } from "react";
import { ganNhanVienPhuTrachHopDong } from "@/app/(app)/thau/gan-nv-actions";

// Dropdown gan nguoi phu trach cho 1 hop dong thau. Chi hien cho SS/ASM -
// NVKD thay chu tinh (server da chan quyen 1 lan nua trong action).
export default function ThauGanNv({
  hopDongId,
  maNhanVien,
  nhanVienList,
  coQuyen,
  tenHienTai,
}: {
  hopDongId: number;
  maNhanVien: string | null;
  nhanVienList: { ma: string; ten: string; ss: string | null }[];
  coQuyen: boolean;
  tenHienTai: string | null;
}) {
  const [value, setValue] = useState(maNhanVien ?? "");
  const [loi, setLoi] = useState<string | null>(null);
  const [dangLuu, startTransition] = useTransition();

  if (!coQuyen) {
    return (
      <span className={tenHienTai ? "text-slate-700" : "text-amber-600"}>
        {tenHienTai ?? "Chưa gán"}
      </span>
    );
  }

  function luu(next: string) {
    const truoc = value;
    setValue(next);
    setLoi(null);
    startTransition(async () => {
      try {
        await ganNhanVienPhuTrachHopDong({ hopDongId, maNhanVien: next || null });
      } catch (e) {
        setValue(truoc);
        setLoi(e instanceof Error ? e.message : "Lưu thất bại");
      }
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <select
        value={value}
        disabled={dangLuu}
        onChange={(e) => luu(e.target.value)}
        className={`w-full cursor-pointer rounded-lg border px-2 py-1 text-xs outline-none transition-colors disabled:opacity-50 ${
          value
            ? "border-slate-200 bg-white text-slate-700"
            : "border-amber-300 bg-amber-50 text-amber-700"
        } hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20`}
      >
        <option value="">— Chưa gán —</option>
        {nhanVienList.map((nv) => (
          <option key={nv.ma} value={nv.ma}>
            {nv.ten} ({nv.ma}){nv.ss ? ` · ${nv.ss}` : ""}
          </option>
        ))}
      </select>
      {loi && <span className="text-[10px] text-red-600">{loi}</span>}
    </div>
  );
}
