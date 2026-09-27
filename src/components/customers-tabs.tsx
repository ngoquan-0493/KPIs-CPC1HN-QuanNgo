"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Chuyen tab giua "Danh sach khach hang" va "Khach hang can theo doi" trong
// cung 1 trang /customers, giu nguyen cac bo loc khac (q, ss, nv) dang co -
// cung pattern voi SsFilter/NvFilter (doi 1 param, khong lam mat param con lai).
//
// 2026-09-27: Boc router.push trong startTransition + hien isPending ngay
// tren nut vua bam - Next.js App Router KHONG tu hien loading.tsx cap route
// khi chi doi searchParams tren CUNG 1 trang (chi tu kich hoat khi chuyen
// SANG segment/route khac), nen truoc day bam doi tab khong co phan hoi gi
// ca cho toi khi Server Component render xong xuoi (tab "Khach hang can theo
// doi" nang hon, gay cam giac trang bi "do"). isPending o day + Suspense
// boundary rieng quanh TheoDoiSection (xem page.tsx) cung giai quyet dut diem
// cam giac nay.
const TABS = [
  { value: "", label: "Danh sách khách hàng" },
  { value: "theo-doi", label: "Khách hàng cần theo dõi" },
];

export default function CustomersTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? "";
  const [isPending, startTransition] = useTransition();
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  function goTo(value: string) {
    if (value === current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("tab", value);
    else params.delete("tab");
    setPendingValue(value);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="mb-5 flex flex-wrap gap-1.5 border-b border-slate-200">
      {TABS.map((tab) => {
        const active = current === tab.value;
        const dangCho = isPending && pendingValue === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => goTo(tab.value)}
            disabled={isPending}
            className={`relative -mb-px flex items-center gap-1.5 rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              isPending ? "cursor-wait" : "cursor-pointer"
            } ${
              active ? "border-b-2 border-blue-700 text-blue-800" : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            } ${dangCho ? "opacity-60" : ""}`}
          >
            {dangCho && (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
