import { createClient } from "@/lib/supabase/server";
import PeriodPicker from "@/components/period-picker";
import SsFilter from "@/components/ss-filter";
import NvFilter from "@/components/nv-filter";
import {
  formatVnd,
  normalizeChannel,
  isExcludedSaleRow,
  fetchAllRows,
  preferClosedMonthRows,
} from "@/lib/sales-channel";
import { ghepTenMa } from "@/lib/display";
import { Card, PageHeader, SectionHeading, EmptyState, StatCard } from "@/components/ui";
import { IconWallet, IconReceipt, IconUsers } from "@/components/icons";

type SaleRow = {
  ma_nhan_vien: string | null;
  ten_nhan_vien: string | null;
  ten_san_pham_chuan_hoa: string | null;
  ten_khach: string | null;
  ma_khach: string | null;
  tinh: string | null;
  ngay: string | null;
  doanh_thu: number | null;
  nhom_khach_hang: string | null;
  trang_thai?: string | null;
};

type EmployeeSsRow = { ma_nhan_vien: string; ten_nhan_vien: string | null; ss: string | null };

function topN(rows: SaleRow[], key: keyof SaleRow, n: number) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const k = (r[key] as string) || "Không xác định";
    totals.set(k, (totals.get(k) ?? 0) + (r.doanh_thu ?? 0));
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

// Rieng top NV can kem ma de tien tra cuu - gop theo ma_nhan_vien (chuan
// hoa) thay vi ten, vi ten co the trung nhau giua cac NV khac nhau.
function topNvByRevenue(rows: SaleRow[], n: number) {
  const totals = new Map<string, { name: string; value: number }>();
  for (const r of rows) {
    const code = normCode(r.ma_nhan_vien) || "khong_xac_dinh";
    const cur = totals.get(code) ?? { name: r.ten_nhan_vien || "Không xác định", value: 0 };
    cur.value += r.doanh_thu ?? 0;
    if (r.ten_nhan_vien) cur.name = r.ten_nhan_vien;
    totals.set(code, cur);
  }
  return [...totals.entries()]
    .map(([code, { name, value }]) => [ghepTenMa(name, code), value] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

type ChannelStat = { channel: string; revenue: number; orders: number };

function channelBreakdown(rows: SaleRow[]): ChannelStat[] {
  const map = new Map<string, ChannelStat>();
  for (const r of rows) {
    const channel = normalizeChannel(r.nhom_khach_hang);
    const cur = map.get(channel) ?? { channel, revenue: 0, orders: 0 };
    cur.revenue += r.doanh_thu ?? 0;
    cur.orders += 1;
    map.set(channel, cur);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

const CHANNEL_DOT: Record<string, string> = {
  "Kê đơn": "bg-blue-600",
  "Phòng mạch": "bg-emerald-500",
  "Thầu": "bg-amber-500",
  "Online": "bg-sky-500",
  "Khác": "bg-slate-400",
};

// Ma nhan vien nhap khong dong nhat giua cac bang (co/khong so 0 dau) - chuan
// hoa ve digits-only truoc khi doi chieu voi danh sach nhan vien, cung cach
// lam voi trang KPI.
function normCode(code: string | null | undefined) {
  return (code ?? "").replace(/\D/g, "").replace(/^0+/, "") || code || "";
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ nam?: string; thang?: string; ss?: string; nv?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const nam = Number(sp.nam ?? now.getFullYear());
  const thang = Number(sp.thang ?? now.getMonth() + 1);
  const selectedSs = sp.ss;
  const selectedNv = sp.nv;

  const supabase = await createClient();

  // "Du lieu sale tong" holds historical months; "Du lieu sale thang hien tai"
  // holds the live, currently-in-progress month. Merge both so the selected
  // period always shows data regardless of which table it lives in.
  const [tongRes, hienTaiRes, empRes] = await Promise.all([
    fetchAllRows<SaleRow>((from, to) =>
      supabase
        .from("Du lieu sale tong")
        .select(
          "ma_nhan_vien,ten_nhan_vien,ten_san_pham_chuan_hoa,ten_khach,ma_khach,tinh,ngay,doanh_thu,nhom_khach_hang",
        )
        .eq("nam", nam)
        .eq("thang", thang)
        .range(from, to),
    ),
    fetchAllRows<SaleRow>((from, to) =>
      supabase
        .from("Du lieu sale thang hien tai")
        .select(
          "ma_nhan_vien,ten_nhan_vien,ten_san_pham_chuan_hoa,ten_khach,ma_khach,tinh,ngay,doanh_thu,nhom_khach_hang,trang_thai",
        )
        .eq("nam", nam)
        .eq("thang", thang)
        .range(from, to),
    ),
    supabase.from("Danh sach nhan vien").select("ma_nhan_vien,ten_nhan_vien,ss").neq("vi_tri", "ASM"),
  ]);

  const ssByCode = new Map<string, string | null>();
  const nameByCode = new Map<string, string | null>();
  for (const e of (empRes.data ?? []) as EmployeeSsRow[]) {
    const code = normCode(e.ma_nhan_vien);
    ssByCode.set(code, e.ss);
    nameByCode.set(code, e.ten_nhan_vien);
  }
  const ssList = Array.from(new Set(Array.from(ssByCode.values()).filter((v): v is string => !!v))).sort(
    (a, b) => a.localeCompare(b),
  );
  const employeeOptions = Array.from(nameByCode.entries())
    .filter(([code]) => !selectedSs || ssByCode.get(code) === selectedSs)
    .map(([code, name]) => ({ code, name: name ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const error = tongRes.error ?? hienTaiRes.error ?? empRes.error;
  let rows = preferClosedMonthRows(
    (tongRes.data ?? []) as SaleRow[],
    (hienTaiRes.data ?? []) as SaleRow[],
  ).filter((r) => !isExcludedSaleRow(r));
  if (selectedSs) {
    rows = rows.filter((r) => ssByCode.get(normCode(r.ma_nhan_vien)) === selectedSs);
  }
  if (selectedNv) {
    rows = rows.filter((r) => normCode(r.ma_nhan_vien) === selectedNv);
  }
  const tongDoanhThu = rows.reduce((s, r) => s + (r.doanh_thu ?? 0), 0);
  const soDon = rows.length;
  const soKhach = new Set(rows.map((r) => r.ma_khach).filter(Boolean)).size;

  const topNV = topNvByRevenue(rows, 8);
  const topSP = topN(rows, "ten_san_pham_chuan_hoa", 8);
  const maxNV = Math.max(1, ...topNV.map(([, v]) => v));
  const maxSP = Math.max(1, ...topSP.map(([, v]) => v));
  const channels = channelBreakdown(rows);

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader
        title="Dashboard Doanh số"
        description={`Kỳ báo cáo: Tháng ${thang}/${nam}${selectedSs ? ` · Nhóm ${selectedSs}` : ""}${
          selectedNv ? ` · NV ${ghepTenMa(nameByCode.get(selectedNv), selectedNv)}` : ""
        }`}
        actions={
          <>
            {ssList.length > 0 && <SsFilter ssList={ssList} />}
            {employeeOptions.length > 0 && <NvFilter employees={employeeOptions} />}
            <PeriodPicker nam={nam} thang={thang} />
          </>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Lỗi tải dữ liệu: {error.message}
        </p>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Tổng doanh thu"
          value={formatVnd(tongDoanhThu)}
          icon={<IconWallet className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Số dòng đơn hàng"
          value={soDon.toLocaleString("vi-VN")}
          icon={<IconReceipt className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="Số khách hàng phát sinh"
          value={soKhach.toLocaleString("vi-VN")}
          icon={<IconUsers className="h-5 w-5" />}
          tone="success"
        />
      </div>

      <div className="mb-6">
        <Card>
          <SectionHeading title="Doanh thu theo kênh bán hàng" />
          <ChannelTable channels={channels} total={tongDoanhThu} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeading title="Top nhân viên theo doanh thu" />
          <BarList items={topNV} max={maxNV} format={formatVnd} />
        </Card>
        <Card>
          <SectionHeading title="Top sản phẩm theo doanh thu" />
          <BarList items={topSP} max={maxSP} format={formatVnd} />
        </Card>
      </div>
    </div>
  );
}

function ChannelTable({ channels, total }: { channels: ChannelStat[]; total: number }) {
  if (channels.length === 0) {
    return <EmptyState>Không có dữ liệu trong kỳ này.</EmptyState>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th className="py-2 pr-3 font-medium">Kênh bán hàng</th>
            <th className="py-2 pr-3 font-medium">Doanh thu</th>
            <th className="py-2 pr-3 font-medium">Số dòng đơn</th>
            <th className="py-2 pr-3 font-medium">Doanh thu TB / đơn</th>
            <th className="py-2 font-medium">Tỉ trọng</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((c) => {
            const share = total ? (c.revenue / total) * 100 : 0;
            return (
              <tr key={c.channel} className="border-b border-slate-100 last:border-0">
                <td className="py-2.5 pr-3 font-medium text-slate-900">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${CHANNEL_DOT[c.channel] ?? "bg-slate-400"}`}
                    />
                    {c.channel}
                  </span>
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-slate-700">{formatVnd(c.revenue)}</td>
                <td className="py-2.5 pr-3 tabular-nums text-slate-700">
                  {c.orders.toLocaleString("vi-VN")}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-slate-700">
                  {formatVnd(c.orders ? Math.round(c.revenue / c.orders) : 0)}
                </td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${CHANNEL_DOT[c.channel] ?? "bg-slate-400"}`}
                        style={{ width: `${Math.max(4, share)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-slate-600">
                      {total ? `${share.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 font-semibold text-slate-900">
            <td className="py-2.5 pr-3">Tổng</td>
            <td className="py-2.5 pr-3 tabular-nums">{formatVnd(total)}</td>
            <td className="py-2.5 pr-3 tabular-nums">
              {channels.reduce((s, c) => s + c.orders, 0).toLocaleString("vi-VN")}
            </td>
            <td className="py-2.5 pr-3" />
            <td className="py-2.5">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BarList({
  items,
  max,
  format,
}: {
  items: [string, number][];
  max: number;
  format: (n: number) => string;
}) {
  if (items.length === 0) {
    return <EmptyState>Không có dữ liệu trong kỳ này.</EmptyState>;
  }
  return (
    <ul className="space-y-3">
      {items.map(([name, value], i) => (
        <li key={name} className="flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-slate-700">{name}</span>
              <span className="ml-2 shrink-0 font-semibold tabular-nums text-slate-900">
                {format(value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-700 to-blue-500"
                style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
