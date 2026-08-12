"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function PeriodPicker({ nam, thang }: { nam: number; thang: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(nextNam: number, nextThang: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("nam", String(nextNam));
    params.set("thang", String(nextThang));
    router.push(`${pathname}?${params.toString()}`);
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const selectClass =
    "cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="flex items-center gap-2">
      <select
        value={thang}
        onChange={(e) => update(nam, Number(e.target.value))}
        className={selectClass}
      >
        {months.map((m) => (
          <option key={m} value={m}>
            Tháng {m}
          </option>
        ))}
      </select>
      <select
        value={nam}
        onChange={(e) => update(Number(e.target.value), thang)}
        className={selectClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
