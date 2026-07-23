"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChartBar, IconTarget, IconSparkles, IconUsers } from "@/components/icons";

const NAV = [
  { href: "/sales", label: "Doanh số", icon: IconChartBar },
  { href: "/kpi", label: "KPI", icon: IconTarget },
  { href: "/ai-review", label: "Đề xuất AI", icon: IconSparkles },
  { href: "/team", label: "Đội nhóm", icon: IconUsers },
];

export default function NavLinks({ viTri }: { viTri?: string | null }) {
  const pathname = usePathname();
  // NVKD chi xem du lieu ca nhan (RLS da gioi han) - trang "Doi nhom" hien
  // ca cay to chuc nen khong phu hop, an di cho gon.
  const items = viTri === "NVKD" ? NAV.filter((item) => item.href !== "/team") : NAV;

  return (
    <nav className="flex-1 space-y-1 px-3 py-2">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-blue-50 text-blue-800"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-blue-700" />
            )}
            <Icon
              className={`h-[18px] w-[18px] shrink-0 ${
                active ? "text-blue-700" : "text-slate-400 group-hover:text-slate-500"
              }`}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
