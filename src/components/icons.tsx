// Bo icon SVG toi gian dung chung cho toan bo app - khong phu thuoc thu vien
// ngoai (tranh phai them dependency moi), stroke-based, 24x24, ke thua mau
// tu currentColor de de doi mau qua className.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconChartBar(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </Base>
  );
}

export function IconTarget(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 13.4 8 18 9.5 13.4 11l-1.4 4.5L10.6 11 6 9.5 10.6 8Z" />
      <path d="M19 15.5 19.7 17.8 22 18.5 19.7 19.2 19 21.5 18.3 19.2 16 18.5 18.3 17.8Z" />
    </Base>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M2.7 20c.8-3.2 3.3-5 6.3-5s5.5 1.8 6.3 5" />
      <circle cx="17.5" cy="8" r="2.4" />
      <path d="M15.6 5.2a3.8 3.8 0 0 1 0 5.6" />
      <path d="M17 15.3c2.4.4 4.1 1.9 4.7 4.7" />
    </Base>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 21H5a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 5 3h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Base>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="6.5" width="18" height="13" rx="2.2" />
      <path d="M3 10.5h18" />
      <path d="M16.2 15h2.3" />
    </Base>
  );
}

export function IconReceipt(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.6Z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </Base>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <path d="M14 8h6v13h-6" />
      <path d="M7.5 7h3M7.5 11h3M7.5 15h3" />
    </Base>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3.5 21.5 20h-19Z" />
      <path d="M12 9.5v4.2" />
      <circle cx="12" cy="16.8" r="0.75" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconClock(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.5V12l3 2" />
    </Base>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12.5 9.5 17 19 6.5" />
    </Base>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Base>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9l6 6 6-6" />
    </Base>
  );
}
