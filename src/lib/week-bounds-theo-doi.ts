// Tach rieng khoi theo-doi-actions.ts (file "use server") vi Next.js chi cho
// phep export CAC HAM ASYNC tu file "use server" - ham thuan (khong async) va
// type dung chung phai nam o module rieng, dung o ca server action lan
// server component (theo-doi-section.tsx).

export type MucDoCanhBao = "Khẩn" | "Ưu tiên" | "Mồ côi" | "Sắp đến hạn";

// Tuan lam viec Thu Hai -> Chu Nhat chua ngay truyen vao (mac dinh hom nay).
export function weekBoundsTheoDoi(dateStr?: string | null): { start: string; end: string } {
  const base = dateStr ? new Date(`${dateStr}T00:00:00Z`) : new Date();
  const day = base.getUTCDay(); // 0 = CN, 1 = T2, ... 6 = T7
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}
