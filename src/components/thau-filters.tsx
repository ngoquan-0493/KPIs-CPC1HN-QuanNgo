"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

// Bo loc dung rieng cho trang Thau. Giu nguyen moi query param khac khi doi 1
// bo loc (cung quy uoc voi SsFilter/NvFilter o cac trang khac).
function useUpdateParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };
}

const SELECT_CLASS =
  "cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

export function ThauSelect({
  paramKey,
  allLabel,
  options,
}: {
  paramKey: string;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  const searchParams = useSearchParams();
  const update = useUpdateParam();

  return (
    <select
      value={searchParams.get(paramKey) ?? ""}
      onChange={(e) => update(paramKey, e.target.value)}
      className={SELECT_CLASS}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// O tim kiem theo ten/ma khach hoac so hop dong. Debounce 400ms de khong ban
// 1 request moi ky tu.
export function ThauSearch() {
  const searchParams = useSearchParams();
  const update = useUpdateParam();
  const current = searchParams.get("q") ?? "";
  const [value, setValue] = useState(current);

  useEffect(() => {
    setValue(current);
  }, [current]);

  useEffect(() => {
    if (value === current) return;
    const t = setTimeout(() => update("q", value.trim()), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Tìm khách hàng / số HĐ…"
      className="w-56 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
    />
  );
}
