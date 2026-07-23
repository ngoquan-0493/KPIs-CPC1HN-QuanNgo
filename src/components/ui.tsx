// Bo khoi UI dung chung (Card, StatCard, Badge, PageHeader...) - dong bo
// design system "modern minimal" tren toan bo cac trang thay vi lap lai
// className rai rac o tung file.
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padding = "p-5",
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white ${padding} shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.10)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
  count,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  count?: number;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {count != null && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {count}
          </span>
        )}
      </div>
      {description && !actions && <p className="text-xs text-slate-500">{description}</p>}
      {actions}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15",
  danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/15",
  info: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/15",
  brand: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/15",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE_TONES;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-7 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

const STAT_TONES: Record<string, string> = {
  brand: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
};

export function StatCard({
  label,
  value,
  icon,
  tone = "brand",
  hint,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: keyof typeof STAT_TONES;
  hint?: string;
}) {
  return (
    <Card className="flex items-start gap-3.5">
      {icon && (
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${STAT_TONES[tone]}`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-2xl font-semibold tabular-nums text-slate-900">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
    </Card>
  );
}

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-blue-500 text-xs font-semibold text-white ${className}`}
    >
      {initials || "?"}
    </span>
  );
}
