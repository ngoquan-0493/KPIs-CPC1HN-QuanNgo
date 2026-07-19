"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Bo loc dung chung cho 3 trang (Doanh so, KPI, De xuat & Danh gia AI): giu
// nguyen moi query param khac (thang, nam, ss...) khi doi bo loc SS, tranh
// tinh trang doi 1 bo loc lam mat bo loc con lai (bug da co o MonthSelector/
// PeriodPicker cu, sua luon o day).
export default function SsFilter({ ssList }: { ssList: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("ss", value);
    else params.delete("ss");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={searchParams.get("ss") ?? ""}
      onChange={(e) => update(e.target.value)}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    >
      <option value="">Tất cả nhóm SS</option>
      {ssList.map((ss) => (
        <option key={ss} value={ss}>
          Nhóm {ss}
        </option>
      ))}
    </select>
  );
}
