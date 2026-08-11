"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Chuyen tab giua "Danh sach khach hang" va "Khach hang can theo doi" trong
// cung 1 trang /customers, giu nguyen cac bo loc khac (q, ss, nv) dang co -
// cung pattern voi SsFilter/NvFilter (doi 1 param, khong lam mat param con lai).
const TABS = [
  { value: "", label: "Danh sách khách hàng" },
  { value: "theo-doi", label: "Khách hàng cần theo dõi" },
];

export default function CustomersTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? "";

  function goTo(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("tab", value);
    else params.delete("tab");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-5 flex flex-wrap gap-1.5 border-b border-slate-200">
      {TABS.map((tab) => {
        const active = current === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => goTo(tab.value)}
            className={`relative -mb-px cursor-pointer rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              active ? "border-b-2 border-blue-700 text-blue-800" : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
