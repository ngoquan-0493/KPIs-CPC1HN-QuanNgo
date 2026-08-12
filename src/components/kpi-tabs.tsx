"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Cung pattern voi CustomersTabs: chuyen tab trong cung 1 trang /kpi, giu
// nguyen cac query param khac (thang, ss, nv) dang co. "duyet" chi hien voi
// SS/ASM (kiem tra o page.tsx truoc khi render component nay).
export default function KpiTabs({ hienThiDuyet }: { hienThiDuyet: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? "";

  const TABS = [
    { value: "", label: "Tiến độ" },
    { value: "xay-dung", label: "Xây dựng KPI tháng" },
    ...(hienThiDuyet ? [{ value: "duyet", label: "Phê duyệt" }] : []),
  ];

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
            key={tab.value || "tien-do"}
            onClick={() => goTo(tab.value)}
            className={`relative -mb-px cursor-pointer rounded-t-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-b-2 border-blue-700 text-blue-800"
                : "border-b-2 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
