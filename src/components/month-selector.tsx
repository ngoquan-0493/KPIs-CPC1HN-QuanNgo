"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

function formatMonth(iso: string) {
  const [year, month] = iso.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

export default function MonthSelector({
  months,
  selected,
}: {
  months: string[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("thang", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={selected}
      onChange={(e) => update(e.target.value)}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    >
      {months.map((m) => (
        <option key={m} value={m}>
          {formatMonth(m)}
        </option>
      ))}
    </select>
  );
}
