"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ghepTenMa } from "@/lib/display";

// Bo loc theo nhan vien, dung chung cho 3 trang (Doanh so, KPI, De xuat & Danh
// gia AI) - cung 1 kieu voi SsFilter (giu nguyen cac query param khac). Gia
// tri filter la MA nhan vien (khong phai ten) de tranh truong hop 2 NV trung
// ten nhau; nhan hien thi ghep "Ten (Ma)" lam mot chuoi duy nhat, khong tach
// rieng 2 truong loc ten/ma.
export default function NvFilter({
  employees,
}: {
  employees: { code: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("nv", value);
    else params.delete("nv");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={searchParams.get("nv") ?? ""}
      onChange={(e) => update(e.target.value)}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    >
      <option value="">Tất cả nhân viên</option>
      {employees.map((e) => (
        <option key={e.code} value={e.code}>
          {ghepTenMa(e.name, e.code)}
        </option>
      ))}
    </select>
  );
}
