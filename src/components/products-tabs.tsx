"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Tab trang /products: "Muc tieu quy" (mac dinh) va "Phan tich san pham" (trang cu). Cung pattern CustomersTabs:
// doi 1 param (tab) va XOA cac param dac thu cua tab kia (sp/nv thuoc tab phan tich; nam/quy thuoc tab muc tieu).
const TABS = [
  { value: "muc-tieu", label: "Mục tiêu quý" },
  { value: "phan-tich", label: "Phân tích sản phẩm" },
];

export default function ProductsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? "muc-tieu";
  const [isPending, startTransition] = useTransition();
  const [pendingValue, setPendingValue] = useState<string | null>(null);

  function goTo(value: string) {
    if (value === current) return;
    const params = new URLSearchParams();
    params.set("tab", value);
    const ss = searchParams.get("ss");
    if (ss) params.set("ss", ss);
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
