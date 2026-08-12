"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChartBar, IconTarget, IconSparkles, IconUsers, IconBuilding, IconPackage } from "@/components/icons";

const NAV = [
  { href: "/sales", label: "Doanh số", icon: IconChartBar },
  { href: "/kpi", label: "KPI", icon: IconTarget },
  { href: "/customers", label: "Khách hàng", icon: IconBuilding },
  { href: "/products", label: "Sản phẩm", icon: IconPackage },
  { href: "/ai-review", label: "Đề xuất AI", icon: IconSparkles },
  { href: "/team", label: "Đội nhóm", icon: IconUsers },
];

export default function NavLinks({
  viTri,
  variant = "sidebar",
}: {
  viTri?: string | null;
  variant?: "sidebar" | "bottom";
}) {
  const pathname = usePathname();
  // NVKD chi xem du lieu ca nhan (RLS da gioi han) - trang "Doi nhom" hien
  // ca cay to chuc nen khong phu hop, an di cho gon.
  const items = viTri === "NVKD" ? NAV.filter((item) => item.href !== "/team") : NAV;

  // Thanh dieu huong duoi cung cho dien thoai (thay the sidebar bi an o
  // (app)/layout.tsx khi man hinh nho hon lg). Dung grid chia deu theo so
  // muc (5 hoac 6 tuy vi tri) thay vi flex de tranh muc bi lech do do dai chu.
  if (variant === "bottom") {
    return (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium ${
                active ? "text-blue-700" : "text-slate-500"
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${active ? "text-blue-700" : "text-slate-400"}`} />
              <span className="max-w-full truncate leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

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
