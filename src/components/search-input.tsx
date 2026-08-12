"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// O tim kiem dung chung, giu nguyen moi query param khac (ss, nv...) khi
// submit - cung nguyen tac voi SsFilter/NvFilter. Dung state noi bo cho input
// de go duoc tu do truoc khi Enter/bam nut, khong push router tren tung phim.
export default function SearchInput({ placeholder = "Tìm kiếm..." }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = value.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-60 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
      />
      <button
        type="submit"
        className="cursor-pointer rounded-xl bg-blue-700 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-800"
      >
        Tìm
      </button>
    </form>
  );
}
